import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbedding } from '@/lib/embeddings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HybridSearchResult {
  chunk_id: string;
  content: string;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
  /** Reciprocal Rank Fusion score (higher = more relevant) */
  rrf_score: number;
  /** Cosine similarity from pgvector (0-1), null when only BM25 matched */
  similarity: number | null;
  /** BM25 ts_rank score, null when only vector matched */
  bm25_rank: number | null;
}

export interface HybridSearchOptions {
  /** Minimum cosine similarity threshold for vector results (default 0.5) */
  threshold?: number;
  /** Maximum results to return (default 10) */
  limit?: number;
  /** Filter by area code / category */
  areaCode?: string;
  /** RRF constant k (default 60) */
  k?: number;
  /** Weight multiplier for BM25 leg (default 1.0) */
  weightBm25?: number;
  /** Weight multiplier for vector leg (default 1.0) */
  weightVector?: number;
  /** Postgres text-search configuration (default 'spanish') */
  tsConfig?: string;
}

// ---------------------------------------------------------------------------
// Internal row shapes coming back from raw SQL
// ---------------------------------------------------------------------------

interface VectorRow {
  id: string;
  content: string;
  similarity: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
}

interface Bm25Row {
  id: string;
  content: string;
  bm25_rank: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a raw user query so it is safe inside a Postgres `to_tsquery` call.
 * Each word is converted to a lexeme joined with `&` (AND).
 */
function sanitiseTsQuery(query: string): string {
  return query
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.toLowerCase())
    .join(' & ');
}

// ---------------------------------------------------------------------------
// Core: hybrid search
// ---------------------------------------------------------------------------

export async function hybridSearch(
  projectId: string,
  query: string,
  options?: HybridSearchOptions,
): Promise<HybridSearchResult[]> {
  const threshold = options?.threshold ?? 0.5;
  const limit = options?.limit ?? 10;
  const k = options?.k ?? 60;
  const weightBm25 = options?.weightBm25 ?? 1.0;
  const weightVector = options?.weightVector ?? 1.0;
  const tsConfig = options?.tsConfig ?? 'spanish';

  // Run BM25 and vector searches in parallel
  const [bm25Results, vectorResults] = await Promise.all([
    runBm25Search(projectId, query, { limit: limit * 3, areaCode: options?.areaCode, tsConfig }),
    runVectorSearch(projectId, query, { threshold, limit: limit * 3, areaCode: options?.areaCode }),
  ]);

  // Build rank maps (1-based ranking)
  const bm25RankMap = new Map<string, { rank: number; row: Bm25Row }>();
  bm25Results.forEach((row, idx) => {
    bm25RankMap.set(row.id, { rank: idx + 1, row });
  });

  const vectorRankMap = new Map<string, { rank: number; row: VectorRow }>();
  vectorResults.forEach((row, idx) => {
    vectorRankMap.set(row.id, { rank: idx + 1, row });
  });

  // Collect all unique chunk IDs
  const allIds = Array.from(new Set([
    ...Array.from(bm25RankMap.keys()),
    ...Array.from(vectorRankMap.keys()),
  ]));

  // Compute RRF score for each chunk
  const fused: HybridSearchResult[] = [];

  for (let i = 0; i < allIds.length; i++) {
    const chunkId = allIds[i];
    const bm25Entry = bm25RankMap.get(chunkId);
    const vectorEntry = vectorRankMap.get(chunkId);

    const rrfBm25 = bm25Entry ? weightBm25 / (k + bm25Entry.rank) : 0;
    const rrfVector = vectorEntry ? weightVector / (k + vectorEntry.rank) : 0;
    const rrfScore = rrfBm25 + rrfVector;

    // Pick metadata from whichever leg has data (prefer vector for richer info)
    const source = vectorEntry?.row ?? bm25Entry!.row;

    fused.push({
      chunk_id: chunkId,
      content: source.content,
      document_id: source.document_id,
      document_name: source.document_name,
      page_number: source.page_number,
      section_title: source.section_title,
      category: source.category,
      rrf_score: rrfScore,
      similarity: vectorEntry ? vectorEntry.row.similarity : null,
      bm25_rank: bm25Entry ? bm25Entry.row.bm25_rank : null,
    });
  }

  // Sort by RRF score descending, take top `limit`
  fused.sort((a, b) => b.rrf_score - a.rrf_score);

  return fused.slice(0, limit);
}

// ---------------------------------------------------------------------------
// BM25 leg: Postgres full-text search via to_tsvector / to_tsquery
// ---------------------------------------------------------------------------

async function runBm25Search(
  projectId: string,
  query: string,
  opts: { limit: number; areaCode?: string; tsConfig: string },
): Promise<Bm25Row[]> {
  const tsQuery = sanitiseTsQuery(query);
  if (!tsQuery) return [];

  const { data, error } = await supabaseAdmin.rpc('bm25_search_vdr_chunks', {
    search_query: tsQuery,
    filter_project_id: projectId,
    filter_area_code: opts.areaCode || null,
    match_count: opts.limit,
    ts_config: opts.tsConfig,
  });

  if (error) {
    console.warn('[hybrid-search] BM25 search failed, falling back to vector-only:', error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    content: row.content as string,
    bm25_rank: row.bm25_rank as number,
    document_id: row.document_id as string,
    document_name: row.document_name as string,
    page_number: row.page_number as number | null,
    section_title: row.section_title as string | null,
    category: row.category as string | null,
  }));
}

// ---------------------------------------------------------------------------
// Vector leg: pgvector cosine similarity (reuses existing match_vdr_chunks)
// ---------------------------------------------------------------------------

async function runVectorSearch(
  projectId: string,
  query: string,
  opts: { threshold: number; limit: number; areaCode?: string },
): Promise<VectorRow[]> {
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabaseAdmin.rpc('match_vdr_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: opts.threshold,
    match_count: opts.limit,
    filter_project_id: projectId,
    filter_area_code: opts.areaCode || null,
  });

  if (error) {
    console.warn('[hybrid-search] Vector search failed:', error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    content: row.content as string,
    similarity: row.similarity as number,
    document_id: row.document_id as string,
    document_name: row.document_name as string,
    page_number: row.page_number as number | null,
    section_title: row.section_title as string | null,
    category: row.category as string | null,
  }));
}
