import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/auth-service';
import {
  invalidateChatCache,
  readChatCache,
  writeChatCache,
} from '@/lib/cache/chat-data';

export interface CreateConversationData {
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationData {
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationWithMessages {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  messageCount: number;
  totalTokens: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown> | null;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    toolCalls: Record<string, unknown> | null;
    toolResults: Record<string, unknown> | null;
    thinkingLog: Record<string, unknown> | null;
    thinkingStepDurationsMs: unknown;
    tokensUsed: number;
    latencyMs: number;
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
  }>;
}

type ConversationListResult = {
  conversations: ConversationWithMessages[];
  total: number;
};

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeConversation<T extends ConversationWithMessages | null>(conversation: T): T {
  if (!conversation) {
    return conversation;
  }

  const normalized = {
    ...conversation,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
    lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : null,
    messages: conversation.messages?.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
      toolInvocations: message.toolInvocations.map((toolInvocation) => ({
        ...toolInvocation,
        createdAt: new Date(toolInvocation.createdAt),
      })),
    })),
  } satisfies ConversationWithMessages;

  return normalized as T;
}

function normalizeConversationListResult(result: ConversationListResult): ConversationListResult {
  return {
    total: result.total,
    conversations: result.conversations.map((conversation) =>
      normalizeConversation(conversation),
    ),
  };
}

function listCacheKey(userId: string, limit: number, offset: number): string {
  return `conversations:user:${userId}:limit:${limit}:offset:${offset}`;
}

function detailCacheKey(userId: string, conversationId: string): string {
  return `conversation:user:${userId}:id:${conversationId}`;
}

async function invalidateConversationCache(userId: string, conversationId?: string) {
  await invalidateChatCache(`conversations:user:${userId}:*`);
  if (conversationId) {
    await invalidateChatCache(`conversation:user:${userId}:id:${conversationId}`);
    await invalidateChatCache(`messages:user:${userId}:conversation:${conversationId}:*`);
  }
}

export class ConversationService {
  async create(data: CreateConversationData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.userId,
        title: data.title,
        summary: data.summary,
        metadata: toJson(data.metadata) || {},
        lastMessageAt: now,
      },
    });

    await invalidateConversationCache(user.userId, conversation.id);
    return conversation;
  }

  async findById(id: string, includeMessages: boolean = false) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    if (!includeMessages) {
      const cached = await readChatCache<ConversationWithMessages | null>(
        detailCacheKey(user.userId, id),
      );
      if (cached) {
        return normalizeConversation(cached);
      }
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
      include: includeMessages
        ? {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                toolCalls: true,
                toolResults: true,
                thinkingLog: true,
                thinkingStepDurationsMs: true,
                tokensUsed: true,
                latencyMs: true,
                toolInvocations: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    toolName: true,
                    resourceType: true,
                    resourceId: true,
                    arguments: true,
                    result: true,
                    status: true,
                    errorMessage: true,
                    latencyMs: true,
                    cached: true,
                    createdAt: true,
                  },
                },
              },
            },
          }
        : undefined,
    });

    const typedConversation = conversation as ConversationWithMessages | null;

    if (typedConversation && !includeMessages) {
      await writeChatCache(detailCacheKey(user.userId, id), typedConversation);
    }

    return normalizeConversation(typedConversation);
  }

  async findByUserId(options?: { limit?: number; offset?: number }) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const key = listCacheKey(user.userId, limit, offset);

    const cached = await readChatCache<ConversationListResult>(key);
    if (cached) {
      return normalizeConversationListResult(cached);
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { userId: user.userId },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({
        where: { userId: user.userId },
      }),
    ]);

    const sorted = [...conversations].sort((a, b) => {
      const ta = a.lastMessageAt?.getTime() ?? a.createdAt.getTime();
      const tb = b.lastMessageAt?.getTime() ?? b.createdAt.getTime();
      return tb - ta;
    });

    const result: ConversationListResult = {
      conversations: sorted as ConversationWithMessages[],
      total,
    };

    await writeChatCache(key, result);
    return result;
  }

  async update(id: string, data: UpdateConversationData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) throw new Error('Conversation not found');

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary,
        metadata: toJson(data.metadata),
      },
    });

    await invalidateConversationCache(user.userId, id);
    return conversation;
  }

  async delete(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) throw new Error('Conversation not found');

    await prisma.conversation.delete({
      where: { id },
    });

    await invalidateConversationCache(user.userId, id);
    return { success: true };
  }

  async updateMessageCount(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const result = await prisma.message.aggregate({
      where: { conversationId: id },
      _count: { id: true },
      _sum: { tokensUsed: true },
    });

    const rawSum = result._sum.tokensUsed;
    const totalTokens =
      rawSum == null
        ? 0
        : typeof rawSum === 'bigint'
          ? Number(rawSum)
          : Math.trunc(Number(rawSum));

    await prisma.conversation.update({
      where: { id },
      data: {
        messageCount: result._count.id,
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
        lastMessageAt: new Date(),
      },
    });

    await invalidateConversationCache(user.userId, id);
  }

  async generateTitle(id: string, firstMessage: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');

    await prisma.conversation.update({
      where: { id },
      data: { title },
    });

    await invalidateConversationCache(user.userId, id);
    return title;
  }

  async search(query: string, limit: number = 20) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.userId,
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return [...conversations].sort((a, b) => {
      const ta = a.lastMessageAt?.getTime() ?? a.createdAt.getTime();
      const tb = b.lastMessageAt?.getTime() ?? b.createdAt.getTime();
      return tb - ta;
    });
  }
}

export const conversationService = new ConversationService();
