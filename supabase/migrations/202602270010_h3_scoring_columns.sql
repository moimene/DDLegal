-- ============================================================
-- Migration H3: Deal Risk Score — Scoring Columns & Table
-- Adds risk_score, go_no_go, is_deal_breaker to dd_contingencies.
-- Creates dd_deal_risk_scores for project-level aggregated scores.
-- Fecha: 2026-02-27
-- ============================================================

-- ============================================================
-- 1. Add scoring columns to dd_contingencies
-- ============================================================
ALTER TABLE dd_contingencies
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS go_no_go TEXT CHECK (go_no_go IN ('go', 'conditional_go', 'no_go')),
  ADD COLUMN IF NOT EXISTS is_deal_breaker BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Project-level deal risk score table
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_deal_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2) NOT NULL,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('go', 'conditional_go', 'no_go')),
  area_scores JSONB NOT NULL DEFAULT '{}'::JSONB,
  deal_breakers JSONB NOT NULL DEFAULT '[]'::JSONB,
  top_risks JSONB NOT NULL DEFAULT '[]'::JSONB,
  sensitivity JSONB NOT NULL DEFAULT '{}'::JSONB,
  total_economic_exposure NUMERIC(15,2) DEFAULT 0,
  scored_by UUID REFERENCES auth.users(id),
  area_weights JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_risk_project ON dd_deal_risk_scores(project_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_deal_risk_scores_updated_at ON dd_deal_risk_scores;
CREATE TRIGGER trg_deal_risk_scores_updated_at
  BEFORE UPDATE ON dd_deal_risk_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. RLS policies
-- ============================================================
ALTER TABLE dd_deal_risk_scores ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_deal_risk" ON dd_deal_risk_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Select: any active project member
CREATE POLICY "deal_risk_select" ON dd_deal_risk_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles
      WHERE user_id = auth.uid()
      AND project_id = dd_deal_risk_scores.project_id
      AND is_active = true
    )
  );

-- Insert: only CLO and PM roles
CREATE POLICY "deal_risk_insert" ON dd_deal_risk_scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles
      WHERE user_id = auth.uid()
      AND project_id = dd_deal_risk_scores.project_id
      AND role IN ('clo', 'pm_transaccion')
      AND is_active = true
    )
  );
