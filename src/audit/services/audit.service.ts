import { Audit, Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  AuditCreatedEvent,
  AuditDeletedEvent,
  AuditUpdatedEvent,
} from '../events/audit.event';
import { auditListener } from '../listeners/audit.listener';

export interface CreateAuditInput {
  businessId: string;
  readinessScore: number;
  businessSummary?: string;
  aiOpportunities?: unknown[];
  automationSuggestions?: unknown[];
  estimatedBenefits?: Record<string, unknown>;
  strengths?: unknown[];
  weaknesses?: unknown[];
  suggestedSolutions?: unknown[];
  expectedRoi?: Record<string, unknown>;
}

export type UpdateAuditInput = Partial<Omit<CreateAuditInput, 'businessId'>>;

export class AuditService {
  async getById(id: string): Promise<Audit> {
    const a = await auditRepository.findById(id);
    if (!a) throw new Error('Audit not found');
    return a;
  }

  async getByBusinessId(businessId: string): Promise<Audit[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.findByBusinessId(businessId);
  }

  async getLatestByBusinessId(businessId: string): Promise<Audit | null> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.findLatestByBusinessId(businessId);
  }

  async createAudit(data: CreateAuditInput): Promise<Audit> {
    const business = await businessRepository.findById(data.businessId);
    if (!business) throw new Error('Business not found');

    const audit = await auditRepository.createAudit({
      businessId: data.businessId,
      readinessScore: data.readinessScore,
      businessSummary: data.businessSummary,
      aiOpportunities: toJsonArray(data.aiOpportunities),
      automationSuggestions: toJsonArray(data.automationSuggestions),
      estimatedBenefits: toJsonObject(data.estimatedBenefits),
      strengths: toJsonArray(data.strengths),
      weaknesses: toJsonArray(data.weaknesses),
      suggestedSolutions: toJsonArray(data.suggestedSolutions),
      expectedRoi: toJsonObject(data.expectedRoi),
    });

    await auditListener.onAuditCreated(
      new AuditCreatedEvent(audit.id, audit.businessId, audit.readinessScore),
    );
    return audit;
  }

  async updateAudit(id: string, data: UpdateAuditInput): Promise<Audit> {
    const existing = await auditRepository.findById(id);
    if (!existing) throw new Error('Audit not found');

    const audit = await auditRepository.updateAudit(id, {
      readinessScore: data.readinessScore,
      businessSummary: data.businessSummary === undefined ? undefined : data.businessSummary,
      aiOpportunities:
        data.aiOpportunities === undefined
          ? undefined
          : toJsonArray(data.aiOpportunities),
      automationSuggestions:
        data.automationSuggestions === undefined
          ? undefined
          : toJsonArray(data.automationSuggestions),
      estimatedBenefits:
        data.estimatedBenefits === undefined
          ? undefined
          : toJsonObject(data.estimatedBenefits),
      strengths:
        data.strengths === undefined ? undefined : toJsonArray(data.strengths),
      weaknesses:
        data.weaknesses === undefined ? undefined : toJsonArray(data.weaknesses),
      suggestedSolutions:
        data.suggestedSolutions === undefined
          ? undefined
          : toJsonArray(data.suggestedSolutions),
      expectedRoi:
        data.expectedRoi === undefined ? undefined : toJsonObject(data.expectedRoi),
    });

    await auditListener.onAuditUpdated(
      new AuditUpdatedEvent(audit.id, {
        readinessScore: data.readinessScore,
        businessSummary: data.businessSummary,
        aiOpportunities: JSON.stringify(data.aiOpportunities ?? []),
        automationSuggestions: JSON.stringify(data.automationSuggestions ?? []),
        estimatedBenefits: JSON.stringify(data.estimatedBenefits ?? {}),
        strengths: JSON.stringify(data.strengths ?? []),
        weaknesses: JSON.stringify(data.weaknesses ?? []),
        suggestedSolutions: JSON.stringify(data.suggestedSolutions ?? []),
        expectedRoi: JSON.stringify(data.expectedRoi ?? {}),
      }),
    );
    return audit;
  }

  async deleteAudit(id: string): Promise<Audit> {
    const existing = await auditRepository.findById(id);
    if (!existing) throw new Error('Audit not found');
    const audit = await auditRepository.deleteAudit(id);
    await auditListener.onAuditDeleted(new AuditDeletedEvent(audit.id));
    return audit;
  }

  async getCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.countByBusinessId(businessId);
  }
}

function toJsonArray(value: unknown[] | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

function toJsonObject(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

export const auditService = new AuditService();
