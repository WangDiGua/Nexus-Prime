import type { CacheService } from '@/lib/cache/redis';
import type { EmbeddingService } from '@/lib/vector/embedding';
import type { LantuClient } from '@/lib/lantu-client';
import type { VectorService } from '@/lib/vector/qdrant';
import { systemSettingsService } from '@/lib/services/system-settings.service';

export async function getLantuClient(): Promise<LantuClient> {
  await systemSettingsService.applyRuntimeEnv();
  const mod = await import('@/lib/lantu-client');
  return new mod.LantuClient();
}

export async function getVectorServices(): Promise<{
  embeddingService: EmbeddingService;
  vectorService: VectorService;
}> {
  const [embeddingModule, vectorModule] = await Promise.all([
    import('@/lib/vector/embedding'),
    import('@/lib/vector/qdrant'),
  ]);

  return {
    embeddingService: embeddingModule.embeddingService,
    vectorService: vectorModule.vectorService,
  };
}

export async function getCaches(): Promise<{
  llmCache: CacheService;
  toolCache: CacheService;
}> {
  const mod = await import('@/lib/cache/redis');
  return {
    llmCache: mod.llmCache,
    toolCache: mod.toolCache,
  };
}
