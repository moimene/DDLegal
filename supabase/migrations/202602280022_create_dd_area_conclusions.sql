-- Migration: Create dd_area_conclusions table
-- Part of Worker Architecture v1.0 — F.4: Conclusions Engine
--
-- Stores area-level conclusions generated during the CONCLUDE phase.
-- Each area gets a synthesized conclusion with risk score, recommendations, and patterns.

CREATE TABLE IF NOT EXISTS dd_area_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  area_code VARCHAR(10) NOT NULL,

  -- Conclusion narrative
  conclusion_narrative TEXT,
  risk_level VARCHAR(20) CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'minimal')),
  risk_score NUMERIC(5,2) CHECK (risk_score BETWEEN 0 AND 100),

  -- Finding statistics
  findings_total INTEGER DEFAULT 0,
  findings_critical INTEGER DEFAULT 0,
  findings_high INTEGER DEFAULT 0,
  findings_medium INTEGER DEFAULT 0,
  findings_low INTEGER DEFAULT 0,
  deal_breakers INTEGER DEFAULT 0,

  -- Coverage metrics
  fos_applicable INTEGER DEFAULT 0,      -- FOs that apply to this area/deal
  fos_evaluated INTEGER DEFAULT 0,       -- FOs effectively evaluated
  fos_with_findings INTEGER DEFAULT 0,   -- FOs that generated findings
  fos_with_gaps INTEGER DEFAULT 0,       -- FOs without sufficient data
  coverage_pct NUMERIC(5,2),             -- fos_evaluated / fos_applicable * 100

  -- Recommendations (AI-generated)
  recommendations JSONB DEFAULT '[]',
  -- [{ type: 'mitigation'|'negotiation'|'condition_precedent'|'indemnity',
  --    description, priority, estimated_cost, related_findings[] }]

  -- Patterns detected across findings
  patterns JSONB DEFAULT '[]',
  -- [{ pattern_type, description, affected_findings[], severity_impact }]

  -- Key findings summary (top 5 by severity)
  key_findings JSONB DEFAULT '[]',
  -- [{ finding_id, title, severity, economic_impact }]

  -- Versionado
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by VARCHAR(50) DEFAULT 'worker',

  -- HITL review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(20) DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'corrected', 'rejected')),
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint per project/area/version
  CONSTRAINT uq_project_area_version UNIQUE (project_id, area_code, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ac_project ON dd_area_conclusions(project_id);
CREATE INDEX IF NOT EXISTS idx_ac_area ON dd_area_conclusions(area_code);
CREATE INDEX IF NOT EXISTS idx_ac_project_area ON dd_area_conclusions(project_id, area_code);
CREATE INDEX IF NOT EXISTS idx_ac_risk_level ON dd_area_conclusions(risk_level) WHERE risk_level IN ('critical', 'high');
CREATE INDEX IF NOT EXISTS idx_ac_review_status ON dd_area_conclusions(review_status) WHERE review_status = 'pending';

-- Updated trigger
CREATE OR REPLACE TRIGGER trg_ac_updated_at
  BEFORE UPDATE ON dd_area_conclusions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE dd_area_conclusions ENABLE ROW LEVEL SECURITY;

-- Policy: Select for users with project access
CREATE POLICY "select_area_conclusions_with_project_access"
  ON dd_area_conclusions
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM dd_project_user_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: Insert for CLO and PM
CREATE POLICY "insert_area_conclusions_clo_pm"
  ON dd_area_conclusions
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM dd_project_user_roles
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('clo', 'pm')
    )
  );

-- Policy: Update for CLO and PM
CREATE POLICY "update_area_conclusions_clo_pm"
  ON dd_area_conclusions
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM dd_project_user_roles
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('clo', 'pm')
    )
  );

-- Policy: Service role full access
CREATE POLICY "service_role_area_conclusions"
  ON dd_area_conclusions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Helper function: Get or create current area conclusion
CREATE OR REPLACE FUNCTION get_or_create_area_conclusion(
  p_project_id UUID,
  p_area_code VARCHAR(10)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to find existing latest version
  SELECT id INTO v_id
  FROM dd_area_conclusions
  WHERE project_id = p_project_id
    AND area_code = p_area_code
  ORDER BY version DESC
  LIMIT 1;

  -- If not found, create new
  IF v_id IS NULL THEN
    INSERT INTO dd_area_conclusions (project_id, area_code, version)
    VALUES (p_project_id, p_area_code, 1)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Migration 202602280022: Created dd_area_conclusions table with RLS';
END $$;
