-- Migration: Add objective_id FK to dd_findings
-- Links findings to their source Finding Objective

BEGIN;

-- Add nullable FK columns
ALTER TABLE dd_findings
ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES dd_finding_objectives(id);

ALTER TABLE dd_findings
ADD COLUMN IF NOT EXISTS rule_execution_id UUID;
-- FK to dd_rule_executions added in E.2 when table exists

-- Index for queries by objective
CREATE INDEX IF NOT EXISTS idx_findings_objective
ON dd_findings(objective_id)
WHERE objective_id IS NOT NULL;

COMMIT;
