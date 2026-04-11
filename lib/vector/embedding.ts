const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1';

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v3';
export const EMBEDDING_DIMENSION = parseInt(process.env.VECTOR_DIMENSION || '1536', 10);

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/services/embeddings/text-embedding/text-embedding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: {
          texts: [text],
        },
        parameters: {
          text_type: 'query',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const result = await response.json();
    const embedding = result.output?.embeddings?.[0]?.embedding;
    
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }

    return {
      embedding,
      tokens: result.usage?.total_tokens || 0,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/services/embeddings/text-embedding/text-embedding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: {
          texts,
        },
        parameters: {
          text_type: 'query',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const result = await response.json();
    const embeddings = result.output?.embeddings || [];

    return embeddings.map((item: any, index: number) => ({
      embedding: item.embedding,
      tokens: index === 0 ? result.usage?.total_tokens || 0 : 0,
    }));
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findMostSimilar(
    query: string,
    candidates: Array<{ text: string; data: Record<string, unknown> }>,
    topK: number = 5
  ): Promise<Array<{ score: number; data: Record<string, unknown> }>> {
    const queryEmbedding = await this.embed(query);
    
    const scores = await Promise.all(
      candidates.map(async (candidate) => {
        const candidateEmbedding = await this.embed(candidate.text);
        const score = this.cosineSimilarity(queryEmbedding.embedding, candidateEmbedding.embedding);
        return { score, data: candidate.data };
      })
    );

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const embeddingService = new EmbeddingService();
