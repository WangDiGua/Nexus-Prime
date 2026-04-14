import { MilvusClient, DataType, LoadState } from '@zilliz/milvus2-sdk-node';

const globalForMilvus = globalThis as unknown as {
  milvus: MilvusClient | undefined;
};

export function getMilvusClient(): MilvusClient {
  if (!globalForMilvus.milvus) {
    globalForMilvus.milvus = new MilvusClient({
      address: process.env.MILVUS_ADDRESS || 'localhost:19530',
      token: process.env.MILVUS_TOKEN || undefined,
    });
  }
  return globalForMilvus.milvus;
}

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

export async function initVectorCollection(): Promise<void> {
  const milvus = getMilvusClient();
  const hasCollection = await milvus.hasCollection({ collection_name: COLLECTION_NAME });
  
  if (!hasCollection.value) {
    await milvus.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          data_type: DataType.VarChar,
          max_length: 36,
          is_primary_key: true,
        },
        {
          name: 'userId',
          data_type: DataType.VarChar,
          max_length: 36,
        },
        {
          name: 'conversationId',
          data_type: DataType.VarChar,
          max_length: 36,
        },
        {
          name: 'messageId',
          data_type: DataType.VarChar,
          max_length: 36,
        },
        {
          name: 'role',
          data_type: DataType.VarChar,
          max_length: 20,
        },
        {
          name: 'content',
          data_type: DataType.VarChar,
          max_length: 8000,
        },
        {
          name: 'embedding',
          data_type: DataType.FloatVector,
          dim: VECTOR_DIMENSION,
        },
        {
          name: 'createdAt',
          data_type: DataType.Int64,
        },
      ],
    });

    await milvus.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'COSINE',
      params: { nlist: 1024 },
    });

    await milvus.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'userId',
      index_type: 'Trie',
    });

    await milvus.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'conversationId',
      index_type: 'Trie',
    });

    console.log('[Milvus] Collection created:', COLLECTION_NAME);
  }

  const loadState = await milvus.getLoadState({ collection_name: COLLECTION_NAME });
  if (loadState.state !== LoadState.LoadStateLoaded) {
    await milvus.loadCollectionSync({ collection_name: COLLECTION_NAME });
    console.log('[Milvus] Collection loaded:', COLLECTION_NAME);
  }
}

export class VectorService {
  async insertVector(data: MessageVector): Promise<void> {
    const milvus = getMilvusClient();
    await milvus.insert({
      collection_name: COLLECTION_NAME,
      data: [data] as any,
    });
  }

  async insertVectors(data: MessageVector[]): Promise<void> {
    if (data.length === 0) return;
    const milvus = getMilvusClient();
    await milvus.insert({
      collection_name: COLLECTION_NAME,
      data: data as any,
    });
  }

  async searchSimilar(
    embedding: number[],
    options: {
      userId?: string;
      conversationId?: string;
      topK?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{ id: string; messageId: string; score: number; content: string; metadata: Record<string, unknown> }>> {
    const { userId, conversationId, topK = 10 } = options;
    const milvus = getMilvusClient();
    
    const filter: string[] = [];
    if (userId) {
      filter.push(`userId == "${userId}"`);
    }
    if (conversationId) {
      filter.push(`conversationId == "${conversationId}"`);
    }

    const results = await milvus.search({
      collection_name: COLLECTION_NAME,
      vector: embedding,
      filter: filter.length > 0 ? filter.join(' and ') : undefined,
      limit: topK,
      output_fields: ['id', 'userId', 'conversationId', 'messageId', 'role', 'content', 'createdAt'],
      metric_type: 'COSINE',
      params: { nprobe: 10 },
    });

    if (!results.results || results.results.length === 0) {
      return [];
    }

    return results.results.map((result) => ({
      id: result.id as string,
      messageId: result.messageId as string,
      score: result.score,
      content: (result.content || '') as string,
      metadata: {
        userId: result.userId,
        conversationId: result.conversationId,
        role: result.role,
        createdAt: result.createdAt,
      },
    }));
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    const milvus = getMilvusClient();
    await milvus.deleteEntities({
      collection_name: COLLECTION_NAME,
      filter: `messageId == "${messageId}"`,
    });
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const milvus = getMilvusClient();
    await milvus.deleteEntities({
      collection_name: COLLECTION_NAME,
      filter: `conversationId == "${conversationId}"`,
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    const milvus = getMilvusClient();
    await milvus.deleteEntities({
      collection_name: COLLECTION_NAME,
      filter: `userId == "${userId}"`,
    });
  }

  async getStats(): Promise<{ total: number }> {
    const milvus = getMilvusClient();
    const stats = await milvus.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    return {
      total: parseInt(stats.data?.row_count || '0', 10),
    };
  }
}

export const vectorService = new VectorService();
export default getMilvusClient;
