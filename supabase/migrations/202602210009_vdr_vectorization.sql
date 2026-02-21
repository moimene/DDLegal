-- S4: VDR Vectorization — chunks + ingestion jobs + semantic search RPC
-- Applied to Supabase 2026-02-21

CREATE TABLE IF NOT EXISTS vdr_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES vdr_document_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  chunks_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_jobs_document ON vdr_ingestion_jobs(document_id);
CREATE INDEX idx_ingestion_jobs_status ON vdr_ingestion_jobs(status);

CREATE TABLE IF NOT EXISTS vdr_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES vdr_document_versions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL DEFAULT 0,
  page_number INTEGER,
  section_title TEXT,
  category TEXT,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_document ON vdr_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON vdr_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS
ALTER TABLE vdr_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vdr_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_ingestion_jobs" ON vdr_ingestion_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_chunks" ON vdr_chunks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "select_ingestion_jobs" ON vdr_ingestion_jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM vdr_documents d JOIN dd_project_user_roles pur ON pur.project_id = d.project_id
    WHERE d.id = vdr_ingestion_jobs.document_id AND pur.user_id = auth.uid() AND pur.is_active = true
    AND (pur.expires_at IS NULL OR pur.expires_at > now()))
);

CREATE POLICY "select_chunks" ON vdr_chunks FOR SELECT USING (
  EXISTS (SELECT 1 FROM vdr_documents d JOIN dd_project_user_roles pur ON pur.project_id = d.project_id
    WHERE d.id = vdr_chunks.document_id AND pur.user_id = auth.uid() AND pur.is_active = true
    AND (pur.expires_at IS NULL OR pur.expires_at > now()))
);

-- Semantic search RPC
CREATE OR REPLACE FUNCTION match_vdr_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_project_id uuid DEFAULT NULL,
  filter_area_code text DEFAULT NULL
)
RETURNS TABLE (id uuid, content text, similarity float, document_id uuid, document_name text, page_number int, section_title text, category text)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.content, (1 - (c.embedding <=> query_embedding))::float AS similarity,
    c.document_id, d.name AS document_name, c.page_number, c.section_title, c.category
  FROM vdr_chunks c JOIN vdr_documents d ON d.id = c.document_id
  WHERE (filter_project_id IS NULL OR d.project_id = filter_project_id)
    AND (filter_area_code IS NULL OR c.category = filter_area_code)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding LIMIT match_count;
END; $$;
