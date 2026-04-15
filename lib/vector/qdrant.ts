import { vectorConfig } from '@/lib/vector/config';

const globalForVector = globalThis as unknown as {
  vectorInitPromise: Promise<void> | undefined;
  skipWriteNoticeShown: boolean | undefined;
};

export interface MessageVector {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  embedding: number[];
  createdAt: number;
}

export const COLLECTION_NAME = vectorConfig.collectionName;
export const VECTOR_DIMENSION = parseInt(
  process.env.NDEA_EMBEDDING_DIMENSION || process.env.VECTOR_DIMENSION || '1024',
  10
);

function getMilvusHeaders(): HeadersInit {
  if (!vectorConfig.milvusToken) {
    return {
      'Content-Type': 'application/json',
    };
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${vectorConfig.milvusToken}`,
  };
}

async function milvusRequest<T extends { code?: number; message?: string }>(
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${vectorConfig.milvusBaseUrl}${path}`, {
    ...init,
    headers: {
      ...getMilvusHeaders(),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Milvus ${response.status}: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as T;
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(
      `Milvus request failed (${payload.code}): ${payload.message || 'Unknown error'}`
    );
  }

  return payload;
}

export async function initVectorCollection(): Promise<void> {
  if (!globalForVector.vectorInitPromise) {
    globalForVector.vectorInitPromise = (async () => {
      const response = await milvusRequest<{
        code?: number;
        message?: string;
        data?: {
          fields?: Array<{
            name?: string;
          }>;
        };
      }>('/v2/vectordb/collections/describe', {
        method: 'POST',
        body: JSON.stringify({
          dbName: vectorConfig.database,
          collectionName: COLLECTION_NAME,
        }),
      });

      const hasVectorField = response.data?.fields?.some(
        (field) => field.name === vectorConfig.vectorField
      );
      if (!hasVectorField) {
        throw new Error(
          `Milvus collection ${vectorConfig.database}.${COLLECTION_NAME} does not contain vector field ${vectorConfig.vectorField}`
        );
      }
    })().catch((error) => {
      globalForVector.vectorInitPromise = undefined;
      throw error;
    });
  }

  await globalForVector.vectorInitPromise;
}

function logSkipWriteOnce(): void {
  if (globalForVector.skipWriteNoticeShown) return;
  globalForVector.skipWriteNoticeShown = true;
  console.info(
    `[Milvus] Using external collection ${vectorConfig.database}.${COLLECTION_NAME}; message vector write/delete is disabled.`
  );
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function tokenizeKeywordQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const splitTerms = normalized
    .split(/[\s,.;|/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  return [...new Set([normalized, ...splitTerms])];
}

function scoreKeywordMatch(
  query: string,
  content: string,
  metadata: Record<string, unknown>
): number {
  const haystack = [
    content,
    normalizeText(metadata.title),
    normalizeText(metadata.source),
    normalizeText(metadata.assetType),
    normalizeText(metadata.table_name),
    normalizeText(metadata.table_comment),
    normalizeText(metadata.question),
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack) return 0;

  const keywords = tokenizeKeywordQuery(query);
  if (keywords.length === 0) return 0;

  let matched = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      matched += 1;
    }
  }

  let score = matched / keywords.length;
  if (haystack.includes(query.trim().toLowerCase())) {
    score += vectorConfig.hybridExactMatchBoost;
  }

  return Math.min(score, 1 + vectorConfig.hybridExactMatchBoost);
}

type SearchHit = {
  id: string;
  messageId: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
};

export class VectorService {
  async insertVector(_data: MessageVector): Promise<void> {
    logSkipWriteOnce();
  }

  async insertVectors(_data: MessageVector[]): Promise<void> {
    logSkipWriteOnce();
  }

  async searchSimilar(
    embedding: number[],
    options: {
      userId?: string;
      conversationId?: string;
      topK?: number;
      threshold?: number;
      queryText?: string;
    } = {}
  ): Promise<SearchHit[]> {
    await initVectorCollection();
    const { topK = vectorConfig.searchLimit, threshold, queryText = '' } = options;
    const limit = vectorConfig.hybridEnabled
      ? Math.max(topK, vectorConfig.hybridOverfetchLimit)
      : topK;

    const response = await milvusRequest<{
      code?: number;
      message?: string;
      data?: Array<{
        asset_id?: string;
        asset_type?: string;
        distance?: number;
        title?: string;
        text?: string;
        source?: string;
        metadata?: unknown;
        messageId?: string;
      }>;
    }>('/v2/vectordb/entities/search', {
      method: 'POST',
      body: JSON.stringify({
        dbName: vectorConfig.database,
        collectionName: COLLECTION_NAME,
        data: [embedding],
        annsField: vectorConfig.vectorField,
        limit,
        outputFields: ['asset_id', 'asset_type', 'title', 'text', 'source', 'metadata'],
      }),
    });

    const hits = (response.data || [])
      .map((item) => {
        const metadata = parseMetadata(item.metadata);
        const content = normalizeText(item.text) || normalizeText(item.title);
        return {
          id: String(item.asset_id || ''),
          messageId: normalizeText(item.messageId) || normalizeText(metadata.messageId),
          score: Number(item.distance || 0),
          content,
          metadata: {
            ...metadata,
            assetId: String(item.asset_id || ''),
            assetType: normalizeText(item.asset_type),
            title: normalizeText(item.title),
            source: normalizeText(item.source),
          },
        } satisfies SearchHit;
      })
      .filter((item) => item.id && item.content)
      .filter((item) => (threshold == null ? true : item.score >= threshold));

    if (!vectorConfig.hybridEnabled || !queryText.trim()) {
      return hits.slice(0, topK);
    }

    return hits
      .map((item) => {
        const keywordScore = scoreKeywordMatch(
          queryText,
          item.content,
          item.metadata
        );
        return {
          ...item,
          score:
            item.score * vectorConfig.hybridVectorWeight +
            keywordScore * vectorConfig.hybridKeywordWeight,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByMessageId(_messageId: string): Promise<void> {
    logSkipWriteOnce();
  }

  async deleteByConversationId(_conversationId: string): Promise<void> {
    logSkipWriteOnce();
  }

  async deleteByUserId(_userId: string): Promise<void> {
    logSkipWriteOnce();
  }

  async getStats(): Promise<{ total: number }> {
    await initVectorCollection();
    return {
      total: 0,
    };
  }
}

export const vectorService = new VectorService();
