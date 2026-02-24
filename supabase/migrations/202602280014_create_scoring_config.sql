-- Migration: Create dd_scoring_config table
-- Parameterizable scoring weights by deal type/jurisdiction

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),

  -- Weights
  severity_weights JSONB NOT NULL DEFAULT '{"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.15, "informational": 0.0}',
  probability_weights JSONB NOT NULL DEFAULT '{"certain": 1.0, "alta": 0.9, "probable": 0.75, "media": 0.5, "baja": 0.2, "remote": 0.15}',
  timing_multipliers JSONB NOT NULL DEFAULT '{"blocking": 1.5, "pre_closing": 1.2, "post_closing": 1.0, "ongoing": 0.8}',
  area_weights JSONB NOT NULL DEFAULT '{"MERC": 1.0, "CONT": 1.2, "LAB": 0.8, "FISC": 1.0, "PI": 0.7, "LIT": 1.1, "ADM": 0.9, "GENERAL": 0.5}',

  -- Thresholds
  recommendation_thresholds JSONB NOT NULL DEFAULT '{"go_below": 30, "no_go_above": 65}',
  deal_breaker_rules JSONB NOT NULL DEFAULT '{"severity": "critical", "probability_min": "alta", "timing": "blocking"}',
  tier_rules JSONB NOT NULL DEFAULT '{}',

  -- Applicability
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sc_default ON dd_scoring_config(is_default) WHERE is_default = true;

-- RLS
ALTER TABLE dd_scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_read_all" ON dd_scoring_config
  FOR SELECT USING (true);

CREATE POLICY "sc_admin_modify" ON dd_scoring_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid() AND pur.role = 'clo'
    )
  );

-- Seed default config
INSERT INTO dd_scoring_config (config_key, name, is_default)
VALUES ('default', 'Default Scoring Configuration', true)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
