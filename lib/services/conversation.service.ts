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

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class ConversationService {
  async create(data: CreateConversationData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const now = new Date();
    return prisma.conversation.create({
      data: {
        userId: user.userId,
        title: data.title,
        summary: data.summary,
        metadata: toJson(data.metadata) || {},
        /** 与 createdAt 对齐，避免 lastMessageAt 为 null 时在列表排序中沉到底部 */
        lastMessageAt: now,
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
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({
        where: { userId: user.userId },
      }),
    ]);

    /** lastMessageAt 为 null 的旧数据在部分库上排序会沉底，用 createdAt 兜底 */
    const sorted = [...conversations].sort((a, b) => {
      const ta = a.lastMessageAt?.getTime() ?? a.createdAt.getTime();
      const tb = b.lastMessageAt?.getTime() ?? b.createdAt.getTime();
      return tb - ta;
    });

    return { conversations: sorted, total };
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
