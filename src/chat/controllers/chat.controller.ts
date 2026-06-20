import { Request, Response, NextFunction } from 'express';
import {
  createChatSessionSchema,
  createChatMessageSchema,
  endChatSessionSchema,
} from '../validators/chat.validator';
import { chatService } from '../services/chat.service';
import { businessRepository } from '../../business/repositories/business.repository';
import { logger } from '../../utils/logger';

export class ChatController {
  // POST /api/chat/session — create chat session (widget / business owner)
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createChatSessionSchema.parse(req.body);

      // Resolve business from either the explicit body field or the
      // authenticated user's business.
      let businessId = data.businessId;
      if (!businessId) {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const business = await businessRepository.findByUserId(userId);
        if (!business) {
          return res.status(404).json({ error: 'Business not found' });
        }
        businessId = business.id;
      }

      const visitorId = data.visitorId ?? `temp-visitor-${Date.now()}`;

      const chatSession = await chatService.createChatSession(visitorId, businessId);

      return res.status(201).json({
        message: 'Chat session created successfully',
        chatSession: {
          id: chatSession.id,
          sessionToken: chatSession.sessionToken,
          startedAt: chatSession.startedAt,
        },
      });
    } catch (error) {
      logger.error('Create chat session failed', error);
      return next(error);
    }
  }

  // GET /api/chat/session/:sessionToken — lookup by widget token
  async getBySessionToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionToken } = req.params;
      const chatSession = await chatService.getChatSessionBySessionToken(sessionToken);
      return res.status(200).json({ chatSession });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/business — list sessions for the authenticated user's business
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const chatSessions = await chatService.getChatSessionsByBusinessId(business.id);
      return res.status(200).json({ chatSessions });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/visitor/:visitorId — list sessions for a given visitor
  async getByVisitorId(req: Request, res: Response, next: NextFunction) {
    try {
      const { visitorId } = req.params;
      const chatSessions = await chatService.getChatSessionsByVisitorId(visitorId);
      return res.status(200).json({ chatSessions });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/chat/:chatSessionId/message
  async createMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const data = createChatMessageSchema.parse(req.body);
      const message = await chatService.createMessage(
        chatSessionId,
        data.content,
        data.isFromUser,
      );
      return res.status(201).json({
        message: 'Message created successfully',
        result: message,
        chatSessionId,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/:chatSessionId/messages
  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const messages = await chatService.getMessagesByChatSessionId(chatSessionId);
      return res.status(200).json({ messages });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/chat/:chatSessionId/end
  async endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const data = endChatSessionSchema.parse(req.body);
      const chatSession = await chatService.endChatSession(
        chatSessionId,
        data.satisfactionScore,
        data.feedback,
      );
      return res.status(200).json({
        message: 'Chat session ended successfully',
        chatSession,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/active-sessions — sessions with no endedAt for the auth'd business
  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const activeSessions = await chatService.getActiveChatSessionsByBusinessId(business.id);
      return res.status(200).json({ activeSessions });
    } catch (error) {
      return next(error);
    }
  }
}

export const chatController = new ChatController();
