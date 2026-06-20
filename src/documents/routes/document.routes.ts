import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { upload } from '../services/document.service';
import { validateRequest } from '../../middleware/validation.middleware';
import { updateDocumentSchema } from '../validators/document.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Upload (multer handles file parsing inline in the controller)
router.post('/upload', upload.single('file'), documentController.upload);

// List & count
router.get('/', documentController.getByUser);
router.get('/count', documentController.getCount);

// Per-id operations
router.get('/:id', documentController.getById);
router.put('/:id', validateRequest(updateDocumentSchema), documentController.update);
router.delete('/:id', documentController.delete);
router.post('/:id/process', documentController.markAsProcessed);

export default router;
