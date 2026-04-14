const globalForQdrant = globalThis as unknown as {
  qdrantInitPromise: Promise<void> | undefined;
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

export const COLLECTION_NAME = 'conversation_messages';
export const VECTOR_DIMENSION = parseInt(process.env.VECTOR_DIMENSION || '1536', 10);

function getQdrantBaseUrl(): string {
  return (
    process.env.QDRANT_URL ||
    process.env.QDRANT_ADDRESS ||
    'http://localhost:6333'
  ).replace(/\/+$/, '');
}

function getQdrantHeaders(): HeadersInit {
  const apiKey = process.env.QDRANT_API_KEY || process.env.QDRANT_TOKEN || '';
  return apiKey
    ? {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      }
    : {
        'Content-Type': 'application/json',
      };
}

async function qdrantRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getQdrantBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...getQdrantHeaders(),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Qdrant ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function collectionExists(): Promise<boolean> {
  const response = await fetch(
    `${getQdrantBaseUrl()}/collections/${COLLECTION_NAME}`,
    {
      headers: getQdrantHeaders(),
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Qdrant ${response.status}: ${text || response.statusText}`);
  }

  return true;
}

export async function initVectorCollection(): Promise<void> {
  if (!globalForQdrant.qdrantInitPromise) {
    globalForQdrant.qdrantInitPromise = (async () => {
      const exists = await collectionExists();
      if (!exists) {
        await qdrantRequest(`/collections/${COLLECTION_NAME}`, {
          method: 'PUT',
          body: JSON.stringify({
            vectors: {
              size: VECTOR_DIMENSION,
              distance: 'Cosine',
            },
          }),
        });
        console.log('[Qdrant] Collection created:', COLLECTION_NAME);
      }
    })().catch((error) => {
      globalForQdrant.qdrantInitPromise = undefined;
      throw error;
    });
  }

  await globalForQdrant.qdrantInitPromise;
}

function toPointPayload(data: MessageVector) {
  return {
    id: data.id,
    vector: data.embedding,
    payload: {
      userId: data.userId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt,
    },
  };
}

function buildFilter(options: {
  userId?: string;
  conversationId?: string;
}) {
  const must: Array<Record<string, unknown>> = [];

  if (options.userId) {
    must.push({
      key: 'userId',
      match: { value: options.userId },
    });
  }

  if (options.conversationId) {
    must.push({
      key: 'conversationId',
      match: { value: options.conversationId },
    });
  }

  return must.length > 0 ? { must } : undefined;
}

export class VectorService {
  async insertVector(data: MessageVector): Promise<void> {
    await initVectorCollection();
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [toPointPayload(data)],
      }),
    });
  }

  async insertVectors(data: MessageVector[]): Promise<void> {
    if (data.length === 0) return;
    await initVectorCollection();
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: data.map(toPointPayload),
      }),
    });
  }

  async searchSimilar(
    embedding: number[],
    options: {
      userId?: string;
      conversationId?: string;
      topK?: number;
      threshold?: number;
    } = {},
  ): Promise<
    Array<{
      id: string;
      messageId: string;
      score: number;
      content: string;
      metadata: Record<string, unknown>;
    }>
  > {
    await initVectorCollection();
    const { userId, conversationId, topK = 10, threshold } = options;
    const response = await qdrantRequest<{
      result?: Array<{
        id: string;
        score: number;
        payload?: Record<string, unknown>;
      }>;
    }>(`/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        vector: embedding,
        limit: topK,
        filter: buildFilter({ userId, conversationId }),
        with_payload: true,
        score_threshold: threshold,
      }),
    });

    return (response.result || []).map((item) => ({
      id: String(item.id),
      messageId: String(item.payload?.messageId || ''),
      score: item.score,
      content: String(item.payload?.content || ''),
      metadata: {
        userId: item.payload?.userId,
        conversationId: item.payload?.conversationId,
        role: item.payload?.role,
        createdAt: item.payload?.createdAt,
      },
    }));
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    await initVectorCollection();
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'messageId',
              match: { value: messageId },
            },
          ],
        },
      }),
    });
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    await initVectorCollection();
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'conversationId',
              match: { value: conversationId },
            },
          ],
        },
      }),
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await initVectorCollection();
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId },
            },
          ],
        },
      }),
    });
  }

  async getStats(): Promise<{ total: number }> {
    await initVectorCollection();
    const response = await qdrantRequest<{
      result?: {
        count?: number;
      };
    }>(`/collections/${COLLECTION_NAME}/points/count`, {
      method: 'POST',
      body: JSON.stringify({
        exact: true,
      }),
    });

    return {
      total: Number(response.result?.count || 0),
    };
  }
}

export const vectorService = new VectorService();
