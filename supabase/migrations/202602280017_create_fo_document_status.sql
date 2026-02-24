-- Migration: Create dd_fo_document_status for iterative tracking
-- Tracks N documents × M Finding Objectives analysis status

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_fo_document_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,

  -- Cache
  content_hash_at_analysis VARCHAR(64),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Result
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),
  rule_execution_id UUID REFERENCES dd_rule_executions(id),

  -- Timestamps
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_fo_doc UNIQUE(project_id, objective_id, document_id),
  CONSTRAINT chk_fods_status CHECK (status IN ('pending', 'analyzing', 'analyzed', 'skipped', 'error'))
);

-- Indexes
CREATE INDEX idx_fods_project ON dd_fo_document_status(project_id);
CREATE INDEX idx_fods_objective ON dd_fo_document_status(objective_id);
CREATE INDEX idx_fods_document ON dd_fo_document_status(document_id);
CREATE INDEX idx_fods_pending ON dd_fo_document_status(project_id, status) WHERE status = 'pending';
CREATE INDEX idx_fods_status ON dd_fo_document_status(status);

-- RLS
ALTER TABLE dd_fo_document_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fods_project_access" ON dd_fo_document_status
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_fo_document_status.project_id
      AND pur.user_id = auth.uid()
    )
  );

COMMIT;
