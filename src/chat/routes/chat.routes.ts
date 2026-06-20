import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createChatSessionSchema,
  createChatMessageSchema,
  endChatSessionSchema,
} from '../validators/chat.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public routes (used by widget / anonymous visitors)
router.post(
  '/session',
  validateRequest(createChatSessionSchema),
  chatController.createSession,
);

router.get(
  '/session/:sessionToken',
  chatController.getBySessionToken,
);

router.post(
  '/:chatSessionId/message',
  validateRequest(createChatMessageSchema),
  chatController.createMessage,
);

router.get(
  '/:chatSessionId/messages',
  chatController.getMessages,
);

router.post(
  '/:chatSessionId/end',
  validateRequest(endChatSessionSchema),
  chatController.endSession,
);

// Authenticated routes (business owner)
router.use(authenticate);

router.get('/business', chatController.getByBusinessId);
router.get('/visitor/:visitorId', chatController.getByVisitorId);
router.get('/active-sessions', chatController.getActiveSessions);

export default router;
