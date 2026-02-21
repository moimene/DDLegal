import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbedding } from '@/lib/embeddings';

export interface SemanticSearchResult {
  chunk_id: string;
  content: string;
  similarity: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
}

export async function semanticSearch(
  projectId: string, query: string,
  options?: { threshold?: number; limit?: number; areaCode?: string }
): Promise<SemanticSearchResult[]> {
  const threshold = options?.threshold ?? 0.7;
  const limit = options?.limit ?? 10;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabaseAdmin.rpc('match_vdr_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: limit,
    filter_project_id: projectId,
    filter_area_code: options?.areaCode || null,
  });

  if (error) throw new Error(`Semantic search failed: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => ({
    chunk_id: row.id as string,
    content: row.content as string,
    similarity: row.similarity as number,
    document_id: row.document_id as string,
    document_name: row.document_name as string,
    page_number: row.page_number as number | null,
    section_title: row.section_title as string | null,
    category: row.category as string | null,
  }));
}
