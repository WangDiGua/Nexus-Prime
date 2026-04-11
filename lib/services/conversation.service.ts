import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/auth-service';
import { Prisma } from '@prisma/client';

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
  }>;
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class ConversationService {
  async create(data: CreateConversationData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    return prisma.conversation.create({
      data: {
        userId: user.userId,
        title: data.title,
        summary: data.summary,
        metadata: toJson(data.metadata) || {},
      },
    });
  }

  async findById(id: string, includeMessages: boolean = false) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

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
              },
            },
          }
        : undefined,
    });

    return conversation as ConversationWithMessages | null;
  }

  async findByUserId(options?: { limit?: number; offset?: number }) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { userId: user.userId },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({
        where: { userId: user.userId },
      }),
    ]);

    return { conversations, total };
  }

  async update(id: string, data: UpdateConversationData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) throw new Error('Conversation not found');

    return prisma.conversation.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary,
        metadata: toJson(data.metadata),
      },
    });
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

    return { success: true };
  }

  async updateMessageCount(id: string) {
    const result = await prisma.message.aggregate({
      where: { conversationId: id },
      _count: { id: true },
      _sum: { tokensUsed: true },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        messageCount: result._count.id,
        totalTokens: result._sum.tokensUsed || 0,
        lastMessageAt: new Date(),
      },
    });
  }

  async generateTitle(id: string, firstMessage: string) {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    
    await prisma.conversation.update({
      where: { id },
      data: { title },
    });

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
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return conversations;
  }
}

export const conversationService = new ConversationService();
