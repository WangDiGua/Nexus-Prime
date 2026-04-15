import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    globalForRedis.redis.on('error', (error) => {
      console.error('[Redis] client error:', error.message);
    });
  }
  return globalForRedis.redis;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export class CacheService {
  private prefix: string;

  constructor(prefix: string = 'nexus:') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(this.getKey(key));
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedis();
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await redis.setex(this.getKey(key), ttl, data);
    } else {
      await redis.set(this.getKey(key), data);
    }
  }

  async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.getKey(key));
  }

  async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.exists(this.getKey(key));
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    const redis = getRedis();
    return redis.ttl(this.getKey(key));
  }

  async incr(key: string): Promise<number> {
    const redis = getRedis();
    return redis.incr(this.getKey(key));
  }

  async expire(key: string, ttl: number): Promise<void> {
    const redis = getRedis();
    await redis.expire(this.getKey(key), ttl);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const redis = getRedis();
    const fullKeys = keys.map((k) => this.getKey(k));
    const results = await redis.mget(...fullKeys);
    return results.map((data) => {
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    });
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    for (const { key, value, ttl } of entries) {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      const fullKey = this.getKey(key);
      if (ttl) {
        pipeline.setex(fullKey, ttl, data);
      } else {
        pipeline.set(fullKey, data);
      }
    }
    await pipeline.exec();
  }

  async keys(pattern: string): Promise<string[]> {
    const redis = getRedis();
    return redis.keys(this.getKey(pattern));
  }

  async flushPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      const redis = getRedis();
      await redis.del(...keys);
    }
  }
}

export const llmCache = new CacheService('llm:');
export const toolCache = new CacheService('tool:');
export const sessionCache = new CacheService('session:');

export default getRedis;
