-- ============================================================================
-- Migration: dd_finding_evidence — Granular finding-to-evidence traceability
-- Part of the Finding-Centric refactor (Fase A, Step 2)
-- ============================================================================

CREATE TABLE public.dd_finding_evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id          UUID NOT NULL REFERENCES public.dd_findings(id) ON DELETE CASCADE,

  -- Evidence reference (polymorphic)
  evidence_type       TEXT NOT NULL CHECK (evidence_type IN (
                        'vdr_chunk', 'vdr_document', 'external_url', 'manual', 'registry'
                      )),
  vdr_chunk_id        UUID,  -- FK added conditionally below (vdr_chunks may not exist in all envs)
  vdr_document_id     UUID,
  external_url        TEXT,
  page_number         INTEGER,
  section_title       TEXT,
  snippet             TEXT,
  similarity_score    NUMERIC(4,3),

  -- Link traceability
  link_method         TEXT NOT NULL CHECK (link_method IN (
                        'auto_semantic', 'auto_keyword', 'auto_hybrid', 'manual', 'hitl_correction'
                      )),
  linked_by_user_id   UUID REFERENCES auth.users(id),
  linked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate links
  CONSTRAINT uq_finding_chunk UNIQUE (finding_id, vdr_chunk_id),
  CONSTRAINT uq_finding_url UNIQUE (finding_id, external_url)
);

-- Conditional FK to vdr_chunks (table exists in production)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vdr_chunks') THEN
    ALTER TABLE public.dd_finding_evidence
      ADD CONSTRAINT fk_finding_evidence_chunk
      FOREIGN KEY (vdr_chunk_id) REFERENCES public.vdr_chunks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Conditional FK to vdr_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vdr_documents') THEN
    ALTER TABLE public.dd_finding_evidence
      ADD CONSTRAINT fk_finding_evidence_document
      FOREIGN KEY (vdr_document_id) REFERENCES public.vdr_documents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indices
CREATE INDEX idx_dd_finding_evidence_finding
  ON public.dd_finding_evidence(finding_id);
CREATE INDEX idx_dd_finding_evidence_chunk
  ON public.dd_finding_evidence(vdr_chunk_id)
  WHERE vdr_chunk_id IS NOT NULL;
CREATE INDEX idx_dd_finding_evidence_document
  ON public.dd_finding_evidence(vdr_document_id)
  WHERE vdr_document_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.dd_finding_evidence IS
  'Granular evidence links for findings. Each row connects a finding to a specific VDR chunk, document, or external source with traceability of how the link was created.';
COMMENT ON COLUMN public.dd_finding_evidence.link_method IS
  'How this evidence was linked: auto_semantic (pgvector), auto_keyword (BM25), auto_hybrid (RRF), manual (user), hitl_correction (HITL reviewer)';
COMMENT ON COLUMN public.dd_finding_evidence.similarity_score IS
  'Cosine similarity score for auto-linked evidence (0.000 to 1.000)';

-- Security: RLS enabled in 202602280008_rls_findings.sql
