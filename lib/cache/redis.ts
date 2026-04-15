import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  disabledReason: string | null | undefined;
  disableLogged: boolean | undefined;
  connectPromise: Promise<boolean> | null | undefined;
};

function disableRedis(reason: string): void {
  globalForRedis.disabledReason = reason;

  if (globalForRedis.redis) {
    globalForRedis.redis.removeAllListeners();
    globalForRedis.redis.disconnect();
    globalForRedis.redis = undefined;
  }

  if (!globalForRedis.disableLogged) {
    console.log(`[Redis] disabled: ${reason}`);
    globalForRedis.disableLogged = true;
  }
}

function getRedisDisableReason(error: unknown): string | null {
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown redis error');

  if (/NOAUTH|WRONGPASS|AUTH/i.test(message)) {
    return message;
  }

  if (
    /Stream isn't writeable|Connection is closed|enableOfflineQueue options is false/i.test(
      message,
    )
  ) {
    return 'Redis connection is unavailable';
  }

  return null;
}

function getRedisOrNull(): Redis | null {
  if (globalForRedis.disabledReason) {
    return null;
  }

  if (!globalForRedis.redis) {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    redis.on('error', (error) => {
      const message = error.message || 'unknown redis error';
      if (/NOAUTH|WRONGPASS|AUTH/i.test(message)) {
        disableRedis(message);
        return;
      }
      console.error('[Redis] client error:', message);
    });

    globalForRedis.redis = redis;
  }

  return globalForRedis.redis;
}

async function ensureRedisReady(redis: Redis): Promise<boolean> {
  if (globalForRedis.disabledReason) {
    return false;
  }

  if (redis.status === 'ready') {
    return true;
  }

  if (!globalForRedis.connectPromise) {
    globalForRedis.connectPromise = (async () => {
      try {
        if (redis.status === 'wait') {
          await redis.connect();
        } else if (redis.status !== 'ready') {
          await new Promise<void>((resolve, reject) => {
            const onReady = () => {
              cleanup();
              resolve();
            };
            const onError = (error: Error) => {
              cleanup();
              reject(error);
            };
            const cleanup = () => {
              redis.off('ready', onReady);
              redis.off('error', onError);
            };
            redis.on('ready', onReady);
            redis.on('error', onError);
            setTimeout(() => {
              cleanup();
              reject(new Error('Redis connect timeout'));
            }, 3000);
          });
        }
        return redis.status === 'ready';
      } catch (error) {
        const reason = getRedisDisableReason(error);
        if (reason) {
          disableRedis(reason);
          return false;
        }
        throw error;
      } finally {
        globalForRedis.connectPromise = null;
      }
    })();
  }

  try {
    return await globalForRedis.connectPromise;
  } catch (error) {
    const reason = getRedisDisableReason(error);
    if (reason) {
      disableRedis(reason);
      return false;
    }
    throw error;
  }
}

export function getRedis(): Redis {
  const redis = getRedisOrNull();
  if (!redis) {
    throw new Error(
      globalForRedis.disabledReason || 'Redis client is unavailable',
    );
  }
  return redis;
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
    const redis = getRedisOrNull();
    if (!redis) return null;
    if (!(await ensureRedisReady(redis))) return null;

    let data: string | null = null;
    try {
      data = await redis.get(this.getKey(key));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return null;
      }
      throw error;
    }
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedisOrNull();
    if (!redis) return;
    if (!(await ensureRedisReady(redis))) return;

    const data = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      if (ttl) {
        await redis.setex(this.getKey(key), ttl, data);
      } else {
        await redis.set(this.getKey(key), data);
      }
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return;
      }
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    const redis = getRedisOrNull();
    if (!redis) return;
    if (!(await ensureRedisReady(redis))) return;
    try {
      await redis.del(this.getKey(key));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const redis = getRedisOrNull();
    if (!redis) return false;
    if (!(await ensureRedisReady(redis))) return false;
    let result = 0;
    try {
      result = await redis.exists(this.getKey(key));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return false;
      }
      throw error;
    }
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    const redis = getRedisOrNull();
    if (!redis) return -1;
    if (!(await ensureRedisReady(redis))) return -1;
    try {
      return await redis.ttl(this.getKey(key));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return -1;
      }
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    const redis = getRedisOrNull();
    if (!redis) return 0;
    if (!(await ensureRedisReady(redis))) return 0;
    try {
      return await redis.incr(this.getKey(key));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return 0;
      }
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    const redis = getRedisOrNull();
    if (!redis) return;
    if (!(await ensureRedisReady(redis))) return;
    try {
      await redis.expire(this.getKey(key), ttl);
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return;
      }
      throw error;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const redis = getRedisOrNull();
    if (!redis) return keys.map(() => null);
    if (!(await ensureRedisReady(redis))) return keys.map(() => null);

    const fullKeys = keys.map((k) => this.getKey(k));
    let results: (string | null)[] = [];
    try {
      results = await redis.mget(...fullKeys);
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return keys.map(() => null);
      }
      throw error;
    }
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
    const redis = getRedisOrNull();
    if (!redis) return;
    if (!(await ensureRedisReady(redis))) return;

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
    try {
      await pipeline.exec();
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return;
      }
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const redis = getRedisOrNull();
    if (!redis) return [];
    if (!(await ensureRedisReady(redis))) return [];
    try {
      return await redis.keys(this.getKey(pattern));
    } catch (error) {
      const reason = getRedisDisableReason(error);
      if (reason) {
        disableRedis(reason);
        return [];
      }
      throw error;
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      const redis = getRedisOrNull();
      if (!redis) return;
      if (!(await ensureRedisReady(redis))) return;
      try {
        await redis.del(...keys);
      } catch (error) {
        const reason = getRedisDisableReason(error);
        if (reason) {
          disableRedis(reason);
          return;
        }
        throw error;
      }
    }
  }
}

export const llmCache = new CacheService('llm:');
export const toolCache = new CacheService('tool:');
export const sessionCache = new CacheService('session:');

export default getRedis;
