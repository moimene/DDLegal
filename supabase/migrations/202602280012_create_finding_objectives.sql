-- Migration: Create dd_finding_objectives table
-- Finding-Centric Architecture v2.0 — Catalog Layer

BEGIN;

-- Create the finding objectives catalog table
CREATE TABLE IF NOT EXISTS public.dd_finding_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_key VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(10) NOT NULL DEFAULT '1.0',
  title TEXT NOT NULL,
  description TEXT,

  -- Classification
  area_code VARCHAR(10) NOT NULL,
  skill_key VARCHAR(100),
  risk_category VARCHAR(100),
  dd_phase VARCHAR(50),

  -- Applicability
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  materiality_threshold_amount NUMERIC,
  materiality_threshold_currency VARCHAR(3) DEFAULT 'EUR',
  applies_when JSONB DEFAULT '[]',

  -- Evaluation
  evaluation_criteria JSONB NOT NULL DEFAULT '[]',
  data_required JSONB NOT NULL DEFAULT '[]',

  -- Severity
  severity_if_positive VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity_modifiers JSONB DEFAULT '[]',

  -- Examples
  positive_examples TEXT[] DEFAULT '{}',
  negative_examples TEXT[] DEFAULT '{}',
  false_positive_examples TEXT[] DEFAULT '{}',

  -- Audit
  source_standard VARCHAR(100),
  regulatory_basis VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_fo_severity CHECK (severity_if_positive IN ('critical', 'high', 'medium', 'low', 'informational'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fo_area ON dd_finding_objectives(area_code) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_fo_skill ON dd_finding_objectives(skill_key) WHERE is_active AND skill_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fo_deal_types ON dd_finding_objectives USING GIN(deal_types);
CREATE INDEX IF NOT EXISTS idx_fo_jurisdictions ON dd_finding_objectives USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_fo_objective_key ON dd_finding_objectives(objective_key);

-- RLS
ALTER TABLE dd_finding_objectives ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read active FOs
CREATE POLICY "fo_read_active" ON dd_finding_objectives
  FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can modify
CREATE POLICY "fo_admin_all" ON dd_finding_objectives
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
      AND pur.role = 'clo'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fo_updated_at
  BEFORE UPDATE ON dd_finding_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_fo_updated_at();

COMMIT;
