import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/auth-service';
import { getVectorServices } from '@/lib/runtime/lazy-services';
import {
  invalidateChatCache,
  readChatCache,
  writeChatCache,
} from '@/lib/cache/chat-data';

export interface CreateMessageData {
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  thinkingLog?: unknown;
  thinkingStepDurationsMs?: number[];
  tokensUsed?: number;
  latencyMs?: number;
  model?: string;
  storeVector?: boolean;
}

export interface MessageWithInvocations {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls: Record<string, unknown> | null;
  toolResults: Record<string, unknown> | null;
  thinkingLog: Record<string, unknown> | null;
  tokensUsed: number;
  latencyMs: number;
  model: string | null;
  createdAt: Date;
  toolInvocations: Array<{
    id: string;
    toolName: string;
    resourceType: string | null;
    resourceId: string | null;
    arguments: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    status: string;
    errorMessage: string | null;
    latencyMs: number;
    cached: boolean;
    createdAt: Date;
  }>;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toPrismaJsonField(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function normalizeMessageRole(role: unknown): 'USER' | 'ASSISTANT' | 'SYSTEM' {
  const raw = String(role ?? '').toUpperCase();
  if (raw === 'USER' || raw === 'ASSISTANT' || raw === 'SYSTEM') {
    return raw;
  }
  return 'ASSISTANT';
}

function messagesCacheKey(userId: string, conversationId: string, limit: number, offset: number) {
  return `messages:user:${userId}:conversation:${conversationId}:limit:${limit}:offset:${offset}`;
}

function normalizeMessages(messages: MessageWithInvocations[]): MessageWithInvocations[] {
  return messages.map((message) => ({
    ...message,
    createdAt: new Date(message.createdAt),
    toolInvocations: message.toolInvocations.map((toolInvocation) => ({
      ...toolInvocation,
      createdAt: new Date(toolInvocation.createdAt),
    })),
  }));
}

async function invalidateMessageCache(userId: string, conversationId: string) {
  await invalidateChatCache(`messages:user:${userId}:conversation:${conversationId}:*`);
}

export class MessageService {
  async create(data: CreateMessageData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const role = normalizeMessageRole(data.role);

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role,
        content: data.content,
        toolCalls: toJson(data.toolCalls),
        toolResults: toJson(data.toolResults),
        thinkingLog: toPrismaJsonField(data.thinkingLog),
        thinkingStepDurationsMs: toPrismaJsonField(data.thinkingStepDurationsMs),
        tokensUsed: data.tokensUsed || 0,
        latencyMs: data.latencyMs || 0,
        model: data.model,
      },
      include: {
        toolInvocations: true,
      },
    });

    await invalidateMessageCache(user.userId, data.conversationId);

    if (data.storeVector !== false && data.content.trim()) {
      try {
        const { embeddingService, vectorService } = await getVectorServices();
        const embeddingResult = await embeddingService.embed(data.content);
        await vectorService.insertVector({
          id: message.id,
          messageId: message.id,
          conversationId: data.conversationId,
          userId: user.userId,
          role,
          content: data.content.slice(0, 1000),
          embedding: embeddingResult.embedding,
          createdAt: Date.now(),
        });
      } catch (error) {
        console.error('[VectorStore] Failed to store vector:', error);
      }
    }

    return message;
  }

  async findByConversationId(
    conversationId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.userId,
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const key = messagesCacheKey(user.userId, conversationId, limit, offset);

    const cached = await readChatCache<MessageWithInvocations[]>(key);
    if (cached) {
      return normalizeMessages(cached);
    }

    const messages = (await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      include: {
        toolInvocations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })) as MessageWithInvocations[];

    await writeChatCache(key, messages);
    return normalizeMessages(messages);
  }

  async findById(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const message = await prisma.message.findFirst({
      where: {
        id,
        conversation: {
          userId: user.userId,
        },
      },
      include: {
        toolInvocations: true,
      },
    });

    return message as MessageWithInvocations | null;
  }

  async update(id: string, data: Partial<CreateMessageData>) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.message.findFirst({
      where: {
        id,
        conversation: {
          userId: user.userId,
        },
      },
    });
    if (!existing) throw new Error('Message not found');

    const message = await prisma.message.update({
      where: { id },
      data: {
        content: data.content,
        toolCalls: toJson(data.toolCalls),
        toolResults: toJson(data.toolResults),
        thinkingLog: toJson(data.thinkingLog),
        thinkingStepDurationsMs: data.thinkingStepDurationsMs
          ? (data.thinkingStepDurationsMs as Prisma.InputJsonValue)
          : undefined,
        tokensUsed: data.tokensUsed,
        latencyMs: data.latencyMs,
      },
    });

    await invalidateMessageCache(user.userId, existing.conversationId);
    return message;
  }

  async delete(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.message.findFirst({
      where: {
        id,
        conversation: {
          userId: user.userId,
        },
      },
    });
    if (!existing) throw new Error('Message not found');

    await prisma.message.delete({ where: { id } });
    await invalidateMessageCache(user.userId, existing.conversationId);

    try {
      const { vectorService } = await getVectorServices();
      await vectorService.deleteByMessageId(id);
    } catch (error) {
      console.error('[VectorStore] Failed to delete vector:', error);
    }

    return { success: true };
  }

  async createToolInvocation(data: {
    messageId: string;
    toolName: string;
    resourceType?: string;
    resourceId?: string;
    arguments?: Record<string, unknown>;
    status: 'PENDING' | 'SUCCESS' | 'ERROR';
    result?: Record<string, unknown>;
    errorMessage?: string;
    latencyMs?: number;
    cached?: boolean;
  }) {
    return prisma.toolInvocation.create({
      data: {
        messageId: data.messageId,
        toolName: data.toolName,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        arguments: toJson(data.arguments) || {},
        status: data.status,
        result: toJson(data.result),
        errorMessage: data.errorMessage,
        latencyMs: data.latencyMs || 0,
        cached: data.cached || false,
      },
    });
  }

  async updateToolInvocation(
    id: string,
    data: {
      status?: 'PENDING' | 'SUCCESS' | 'ERROR';
      result?: Record<string, unknown>;
      errorMessage?: string;
      latencyMs?: number;
      cached?: boolean;
    },
  ) {
    return prisma.toolInvocation.update({
      where: { id },
      data: {
        status: data.status,
        result: toJson(data.result),
        errorMessage: data.errorMessage,
        latencyMs: data.latencyMs,
        cached: data.cached,
      },
    });
  }

  async getConversationContext(
    conversationId: string,
    limit: number = 10,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
      },
    });

    return messages.reverse().map((message) => ({
      role: message.role.toLowerCase(),
      content: message.content,
    }));
  }
}

export const messageService = new MessageService();
