import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/auth-service';
import { vectorService } from '@/lib/vector/milvus';
import { embeddingService } from '@/lib/vector/embedding';
import { Prisma } from '@prisma/client';

export interface CreateMessageData {
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  toolCalls?: Record<string, unknown>;
  toolResults?: Record<string, unknown>;
  thinkingLog?: Record<string, unknown>;
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

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

export class MessageService {
  async create(data: CreateMessageData) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolCalls: toJson(data.toolCalls),
        toolResults: toJson(data.toolResults),
        thinkingLog: toJson(data.thinkingLog),
        tokensUsed: data.tokensUsed || 0,
        latencyMs: data.latencyMs || 0,
        model: data.model,
      },
      include: {
        toolInvocations: true,
      },
    });

    if (data.storeVector !== false && data.content.trim()) {
      try {
        const embeddingResult = await embeddingService.embed(data.content);
        await vectorService.insertVector({
          id: message.id,
          messageId: message.id,
          conversationId: message.conversationId,
          userId: user.userId,
          role: data.role,
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
    options?: { limit?: number; offset?: number }
  ) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      include: {
        toolInvocations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return messages as MessageWithInvocations[];
  }

  async findById(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const message = await prisma.message.findFirst({
      where: { id },
      include: {
        toolInvocations: true,
      },
    });

    return message as MessageWithInvocations | null;
  }

  async update(id: string, data: Partial<CreateMessageData>) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.message.findFirst({ where: { id } });
    if (!existing) throw new Error('Message not found');

    return prisma.message.update({
      where: { id },
      data: {
        content: data.content,
        toolCalls: toJson(data.toolCalls),
        toolResults: toJson(data.toolResults),
        thinkingLog: toJson(data.thinkingLog),
        tokensUsed: data.tokensUsed,
        latencyMs: data.latencyMs,
      },
    });
  }

  async delete(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.message.findFirst({ where: { id } });
    if (!existing) throw new Error('Message not found');

    await prisma.message.delete({ where: { id } });
    
    try {
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
    }
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
    limit: number = 10
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

    return messages.reverse().map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));
  }
}

export const messageService = new MessageService();
