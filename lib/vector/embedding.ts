import { embeddingConfig } from '@/lib/vector/config';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1';

export const EMBEDDING_MODEL = embeddingConfig.model;
export const EMBEDDING_DIMENSION = parseInt(
  process.env.NDEA_EMBEDDING_DIMENSION || process.env.VECTOR_DIMENSION || '1024',
  10
);

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

function shouldUseOllamaEmbedding(): boolean {
  return Boolean(embeddingConfig.baseUrl);
}

async function requestOllamaEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (!embeddingConfig.baseUrl) {
    throw new Error('Missing NDEA_EMBEDDING_BASE_URL');
  }

  const response = await fetch(`${embeddingConfig.baseUrl}/api/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.length === 1 ? texts[0] : texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Ollama embedding API error (${response.status}): ${errorText || response.statusText}`
    );
  }

  const result = (await response.json()) as {
    embeddings?: number[][];
    prompt_eval_count?: number;
  };
  const embeddings = Array.isArray(result.embeddings) ? result.embeddings : [];

  if (embeddings.length === 0) {
    throw new Error('Failed to generate embeddings from Ollama');
  }

  return embeddings.map((embedding, index) => ({
    embedding,
    tokens: index === 0 ? result.prompt_eval_count || 0 : 0,
  }));
}

async function requestDashScopeEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const response = await fetch(
    `${DASHSCOPE_BASE_URL}/services/embeddings/text-embedding/text-embedding`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
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
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const result = await response.json();
  const embeddings = result.output?.embeddings || [];

  return embeddings.map((item: { embedding: number[] }, index: number) => ({
    embedding: item.embedding,
    tokens: index === 0 ? result.usage?.total_tokens || 0 : 0,
  }));
}

export class EmbeddingService {
  async embed(text: string): Promise<EmbeddingResult> {
    const [result] = await this.embedBatch([text]);
    if (!result?.embedding?.length) {
      throw new Error('Failed to generate embedding');
    }
    return result;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    if (shouldUseOllamaEmbedding()) {
      return requestOllamaEmbeddings(texts);
    }
    return requestDashScopeEmbeddings(texts);
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
        const score = this.cosineSimilarity(
          queryEmbedding.embedding,
          candidateEmbedding.embedding
        );
        return { score, data: candidate.data };
      })
    );

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export const embeddingService = new EmbeddingService();
