import { prisma } from '../../lib/prisma';
import { chatRepository } from '../repositories/chat.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';
import {
  ChatSessionCreatedEvent,
  ChatSessionEndedEvent,
  MessageCreatedEvent,
} from '../events/chat.event';
import { chatListener } from '../listeners/chat.listener';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { ChatSession, Message, Visitor } from '@prisma/client';

export class ChatService {
  // ---------------------------------------------------------------------------
  // Visitors
  // ---------------------------------------------------------------------------
  async createVisitor(data: {
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
  }): Promise<Visitor> {
    const existingVisitor = await chatRepository.findVisitorBySessionId(data.sessionId);
    if (existingVisitor) {
      return prisma.visitor.update({
        where: { id: existingVisitor.id },
        data: {
          lastVisit: new Date(),
          visitCount: { increment: 1 },
        },
      });
    }

    return chatRepository.createVisitor(data);
  }

  // ---------------------------------------------------------------------------
  // Chat sessions
  // ---------------------------------------------------------------------------
  async createChatSession(visitorId: string, businessId: string): Promise<ChatSession> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const sessionToken = uuidv4();

    const chatSession = await chatRepository.createChatSession({
      visitorId,
      businessId,
      sessionToken,
    });

    const event = new ChatSessionCreatedEvent(
      chatSession.id,
      visitorId,
      businessId,
      sessionToken,
    );
    await chatListener.onChatSessionCreated(event);

    return chatSession;
  }

  async getChatSessionById(id: string): Promise<ChatSession> {
    const session = await chatRepository.findById(id);
    if (!session) {
      throw new Error('Chat session not found');
    }
    return session;
  }

  async getChatSessionBySessionToken(sessionToken: string): Promise<ChatSession> {
    const session = await chatRepository.findBySessionToken(sessionToken);
    if (!session) {
      throw new Error('Chat session not found');
    }
    return session;
  }

  async getChatSessionsByBusinessId(businessId: string): Promise<ChatSession[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return chatRepository.findByBusinessId(businessId);
  }

  async getChatSessionsByVisitorId(visitorId: string): Promise<ChatSession[]> {
    return chatRepository.findByVisitorId(visitorId);
  }

  async getActiveChatSessionsByBusinessId(businessId: string): Promise<ChatSession[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return prisma.chatSession.findMany({
      where: { businessId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  async createMessage(
    chatSessionId: string,
    content: string,
    isFromUser = true,
  ): Promise<Message> {
    const session = await chatRepository.findById(chatSessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const message = await chatRepository.createMessage({
      chatSessionId,
      content,
      isFromUser,
    });

    const messageCount = await chatRepository.getMessageCountByChatSessionId(chatSessionId);
    await chatRepository.updateMessageCount(chatSessionId, messageCount);

    const event = new MessageCreatedEvent(
      message.id,
      chatSessionId,
      content,
      isFromUser,
    );
    await chatListener.onMessageCreated(event);

    // Forward to AI service for bot responses.
    if (isFromUser) {
      await this.proxyToAiService(chatSessionId, content);
    }

    return message;
  }

  private async proxyToAiService(chatSessionId: string, content: string): Promise<void> {
    try {
      const aiServiceUrl = process.env.EXTERNAL_LLM_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await axios.post<{ response?: string }>(
        `${aiServiceUrl}/chat`,
        {
          session_id: chatSessionId,
          message: content,
        },
        { timeout: 10_000 },
      );

      if (aiResponse.data?.response) {
        await chatRepository.createMessage({
          chatSessionId,
          content: aiResponse.data.response,
          isFromUser: false,
        });
        const newCount = await chatRepository.getMessageCountByChatSessionId(chatSessionId);
        await chatRepository.updateMessageCount(chatSessionId, newCount);
      }
    } catch (err) {
      logger.error('Failed to communicate with AI Service', err);
    }
  }

  async getMessagesByChatSessionId(chatSessionId: string): Promise<Message[]> {
    return chatRepository.getMessagesByChatSessionId(chatSessionId);
  }

  // ---------------------------------------------------------------------------
  // End session
  // ---------------------------------------------------------------------------
  async endChatSession(
    chatSessionId: string,
    satisfactionScore?: number,
    feedback?: string,
  ): Promise<ChatSession> {
    const session = await chatRepository.findById(chatSessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const ended = await chatRepository.endChatSession(
      chatSessionId,
      satisfactionScore,
      feedback,
    );

    const event = new ChatSessionEndedEvent(
      chatSessionId,
      satisfactionScore ?? null,
      feedback ?? null,
    );
    await chatListener.onChatSessionEnded(event);

    return ended;
  }
}

export const chatService = new ChatService();
