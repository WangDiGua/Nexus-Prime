function trimTrailingSlash(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, '');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const vectorConfig = {
  milvusBaseUrl: trimTrailingSlash(
    process.env.NDEA_MILVUS_URI || process.env.MILVUS_URL,
    'http://localhost:19530'
  ),
  milvusToken: process.env.NDEA_MILVUS_TOKEN || process.env.MILVUS_TOKEN || '',
  database: process.env.NDEA_MILVUS_DATABASE || 'default',
  collectionName: process.env.NDEA_MILVUS_COLLECTION || 'semantic_assets',
  vectorField:
    process.env.NDEA_MILVUS_VECTOR_NAME ||
    process.env.NDEA_EMBEDDING_VECTOR_NAME ||
    'embedding',
  searchLimit: parseNumber(process.env.NDEA_MILVUS_SEARCH_LIMIT, 5),
  hybridEnabled: parseBoolean(process.env.NDEA_MILVUS_HYBRID_ENABLED, true),
  hybridOverfetchLimit: parseNumber(
    process.env.NDEA_MILVUS_HYBRID_OVERFETCH_LIMIT,
    20
  ),
  hybridVectorWeight: parseNumber(
    process.env.NDEA_MILVUS_HYBRID_VECTOR_WEIGHT,
    0.65
  ),
  hybridKeywordWeight: parseNumber(
    process.env.NDEA_MILVUS_HYBRID_KEYWORD_WEIGHT,
    0.35
  ),
  hybridExactMatchBoost: parseNumber(
    process.env.NDEA_MILVUS_HYBRID_EXACT_MATCH_BOOST,
    0.15
  ),
};

export const embeddingConfig = {
  baseUrl: trimTrailingSlash(
    process.env.NDEA_EMBEDDING_BASE_URL ||
      process.env.EMBEDDING_BASE_URL ||
      process.env.OLLAMA_BASE_URL,
    ''
  ),
  model:
    process.env.NDEA_EMBEDDING_MODEL ||
    process.env.EMBEDDING_MODEL ||
    'bge-m3',
  vectorField:
    process.env.NDEA_EMBEDDING_VECTOR_NAME ||
    process.env.NDEA_MILVUS_VECTOR_NAME ||
    'embedding',
};
