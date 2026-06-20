import path from 'path';
import fs from 'fs';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { documentRepository, extensionToDocumentType } from '../repositories/document.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';
import { config } from '../../config';
import { Document, DocumentType } from '@prisma/client';
import { DocumentUploadedEvent } from '../events/document.event';
import { documentListener } from '../listeners/document.listener';

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
const UPLOAD_DIR = config.uploadDir || './uploads';
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Document service
// ---------------------------------------------------------------------------
export class DocumentService {
  async uploadDocument(
    businessId: string,
    file: Express.Multer.File,
    description?: string,
  ): Promise<Document> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const type = extensionToDocumentType(path.extname(file.originalname));

    const document = await documentRepository.createDocument({
      businessId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type,
      url: `/uploads/${file.filename}`,
      description,
    });

    const event = new DocumentUploadedEvent(
      document.id,
      businessId,
      file.originalname,
      file.size,
      type,
    );
    await documentListener.onDocumentUploaded(event);

    // Forward to the AI service for chunking/embedding. We don't await this
    // before returning — uploads should be fast. Errors are logged but
    // surface as a 'pending' document; the listener above can also retry.
    void this.proxyToAiService(document.id, businessId, file).catch((err) => {
      logger.error('Failed to communicate with AI Service for document processing', err);
    });

    return document;
  }

  private async proxyToAiService(
    documentId: string,
    businessId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    const aiServiceUrl = process.env.EXTERNAL_DOCUMENT_SERVICE_URL || 'http://localhost:8000';
    const fileStream = fs.createReadStream(file.path);

    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('document_id', documentId);
    formData.append('business_id', businessId);

    await axios.post(`${aiServiceUrl}/process-document`, formData, {
      headers: formData.getHeaders(),
      timeout: 30_000,
    });

    await this.markAsProcessed(documentId);
  }

  async getDocumentById(id: string): Promise<Document> {
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }
    return document;
  }

  async getDocumentsByBusinessId(businessId: string): Promise<Document[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return documentRepository.findByBusinessId(businessId);
  }

  async updateDocument(
    id: string,
    data: { description?: string; isProcessed?: boolean },
  ): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    return documentRepository.updateDocument(id, {
      description: data.description ?? null,
      isProcessed: data.isProcessed,
    });
  }

  async deleteDocument(id: string): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    return documentRepository.deleteDocument(id);
  }

  async markAsProcessed(
    id: string,
    extractedText?: string,
    chunkCount?: number,
  ): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    return documentRepository.markAsProcessed(id, extractedText, chunkCount);
  }

  async getDocumentCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return documentRepository.countByBusinessId(businessId);
  }
}

export const documentService = new DocumentService();

export type { Document, DocumentType };
