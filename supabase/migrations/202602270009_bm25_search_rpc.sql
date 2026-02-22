-- Workstream L: BM25 full-text search RPC for hybrid retrieval
-- Uses inline to_tsvector since vdr_chunks has no stored tsvector column

CREATE OR REPLACE FUNCTION bm25_search_vdr_chunks(
  search_query text,
  filter_project_id uuid DEFAULT NULL,
  filter_area_code text DEFAULT NULL,
  match_count int DEFAULT 30,
  ts_config text DEFAULT 'spanish'
)
RETURNS TABLE (
  id uuid,
  content text,
  bm25_rank float,
  document_id uuid,
  document_name text,
  page_number int,
  section_title text,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    ts_rank_cd(
      to_tsvector(ts_config::regconfig, c.content),
      to_tsquery(ts_config::regconfig, search_query)
    )::float AS bm25_rank,
    c.document_id,
    d.name AS document_name,
    c.page_number,
    c.section_title,
    c.category
  FROM vdr_chunks c
  JOIN vdr_documents d ON d.id = c.document_id
  WHERE to_tsvector(ts_config::regconfig, c.content) @@ to_tsquery(ts_config::regconfig, search_query)
    AND (filter_project_id IS NULL OR d.project_id = filter_project_id)
    AND (filter_area_code IS NULL OR c.category = filter_area_code)
  ORDER BY bm25_rank DESC
  LIMIT match_count;
END;
$$;

-- GIN index on content for faster full-text search (inline tsvector, spanish config)
CREATE INDEX IF NOT EXISTS idx_vdr_chunks_content_fts
  ON vdr_chunks
  USING gin (to_tsvector('spanish', content));
