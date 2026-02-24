-- Migration: Create dd_rule_executions table
-- Audit trail for FO evaluations

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID REFERENCES vdr_documents(id),
  objective_version VARCHAR(10) NOT NULL,

  -- Context
  deal_context JSONB NOT NULL DEFAULT '{}',
  input_data_hash VARCHAR(64) NOT NULL,

  -- Result
  applicability_result BOOLEAN NOT NULL,
  applicability_reason TEXT,
  evaluation_results JSONB,
  severity_computed VARCHAR(20),
  severity_modifiers_applied JSONB,
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),

  -- Execution
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by VARCHAR(100) DEFAULT 'system',
  execution_duration_ms INTEGER,
  ai_calls_made INTEGER DEFAULT 0,

  -- Audit
  rule_source_hash VARCHAR(64),

  CONSTRAINT chk_re_severity CHECK (
    severity_computed IS NULL OR
    severity_computed IN ('critical', 'high', 'medium', 'low', 'informational')
  )
);

-- Indexes
CREATE INDEX idx_re_project ON dd_rule_executions(project_id);
CREATE INDEX idx_re_objective ON dd_rule_executions(objective_id);
CREATE INDEX idx_re_document ON dd_rule_executions(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_re_finding ON dd_rule_executions(finding_id) WHERE finding_id IS NOT NULL;
CREATE INDEX idx_re_executed ON dd_rule_executions(executed_at DESC);

-- RLS
ALTER TABLE dd_rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_project_access" ON dd_rule_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_rule_executions.project_id
      AND pur.user_id = auth.uid()
    )
  );

-- Now add the FK from dd_findings
ALTER TABLE dd_findings
ADD CONSTRAINT fk_findings_rule_execution
FOREIGN KEY (rule_execution_id) REFERENCES dd_rule_executions(id);

COMMIT;
