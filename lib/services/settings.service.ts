import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/auth-service';

export interface UserSettingsData {
  defaultModel: string;
  systemPrompt?: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  maxTokens: number;
  temperature: number;
  enableHistoryContext: boolean;
  historyContextLimit: number;
  enableVectorSearch: boolean;
}

export class SettingsService {
  async getSettings() {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.userId },
    });

    if (!settings) {
      return this.createDefaultSettings(user.userId);
    }

    return settings;
  }

  async updateSettings(data: Partial<UserSettingsData>) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.userSettings.findUnique({
      where: { userId: user.userId },
    });

    if (!existing) {
      return prisma.userSettings.create({
        data: {
          userId: user.userId,
          defaultModel: data.defaultModel || 'qwen-plus-latest',
          systemPrompt: data.systemPrompt,
          theme: data.theme || 'SYSTEM',
          language: data.language || 'zh-CN',
          maxTokens: data.maxTokens || 4096,
          temperature: data.temperature ?? 0.7,
          enableHistoryContext: data.enableHistoryContext ?? true,
          historyContextLimit: data.historyContextLimit || 10,
          enableVectorSearch: data.enableVectorSearch ?? true,
        },
      });
    }

    return prisma.userSettings.update({
      where: { userId: user.userId },
      data: {
        defaultModel: data.defaultModel,
        systemPrompt: data.systemPrompt,
        theme: data.theme,
        language: data.language,
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        enableHistoryContext: data.enableHistoryContext,
        historyContextLimit: data.historyContextLimit,
        enableVectorSearch: data.enableVectorSearch,
      },
    });
  }

  private async createDefaultSettings(userId: string) {
    return prisma.userSettings.create({
      data: {
        userId,
        defaultModel: 'qwen-plus-latest',
        theme: 'SYSTEM',
        language: 'zh-CN',
        maxTokens: 4096,
        temperature: 0.7,
        enableHistoryContext: true,
        historyContextLimit: 10,
        enableVectorSearch: true,
      },
    });
  }

  async getApiKeys() {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const keys = await prisma.userApiKey.findMany({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        provider: true,
        isDefault: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return keys;
  }

  async createApiKey(data: { name: string; key: string; provider?: string }) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const keyPrefix = data.key.slice(0, 8) + '...';
    
    const existing = await prisma.userApiKey.findFirst({
      where: { userId: user.userId },
    });

    return prisma.userApiKey.create({
      data: {
        userId: user.userId,
        name: data.name,
        keyHash: data.key,
        keyPrefix,
        provider: data.provider || 'lantuconnect',
        isDefault: !existing,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        provider: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async deleteApiKey(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.userApiKey.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) throw new Error('API Key not found');

    await prisma.userApiKey.delete({
      where: { id },
    });

    return { success: true };
  }

  async setDefaultApiKey(id: string) {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await prisma.userApiKey.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) throw new Error('API Key not found');

    await prisma.userApiKey.updateMany({
      where: { userId: user.userId },
      data: { isDefault: false },
    });

    await prisma.userApiKey.update({
      where: { id },
      data: { isDefault: true },
    });

    return { success: true };
  }
}

export const settingsService = new SettingsService();
