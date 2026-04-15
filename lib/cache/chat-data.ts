import { CacheService } from '@/lib/cache/redis';

export const CHAT_DATA_TTL_SECONDS = 15;

const chatDataCache = new CacheService('chat-data:');

export async function readChatCache<T>(key: string): Promise<T | null> {
  try {
    return await chatDataCache.get<T>(key);
  } catch (error) {
    console.error('[ChatCache] read failed:', error);
    return null;
  }
}

export async function writeChatCache<T>(key: string, value: T): Promise<void> {
  try {
    await chatDataCache.set(key, value, CHAT_DATA_TTL_SECONDS);
  } catch (error) {
    console.error('[ChatCache] write failed:', error);
  }
}

export async function invalidateChatCache(pattern: string): Promise<void> {
  try {
    await chatDataCache.flushPattern(pattern);
  } catch (error) {
    console.error('[ChatCache] invalidate failed:', error);
  }
}
