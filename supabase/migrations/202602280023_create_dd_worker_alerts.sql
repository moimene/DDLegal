-- Migration: Create dd_worker_alerts table
-- Part of Worker Architecture v1.0 — F.5: Observability & Alerts

CREATE TABLE IF NOT EXISTS dd_worker_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES dd_worker_runs(id) ON DELETE SET NULL,

  -- Alert details
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'stalled', 'error_rate', 'coverage_regression',
    'ai_budget_exceeded', 'evaluation_failures',
    'low_coverage', 'deal_breaker_detected'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Acknowledgement
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_project ON dd_worker_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_wa_type ON dd_worker_alerts(type);
CREATE INDEX IF NOT EXISTS idx_wa_severity ON dd_worker_alerts(severity) WHERE severity = 'critical';
CREATE INDEX IF NOT EXISTS idx_wa_unack ON dd_worker_alerts(project_id, created_at)
  WHERE acknowledged_at IS NULL;

-- RLS
ALTER TABLE dd_worker_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Select for users with project access
CREATE POLICY "select_worker_alerts_with_project_access"
  ON dd_worker_alerts
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM dd_project_user_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: Update (acknowledge) for CLO and PM
CREATE POLICY "update_worker_alerts_clo_pm"
  ON dd_worker_alerts
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
CREATE POLICY "service_role_worker_alerts"
  ON dd_worker_alerts
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Migration 202602280023: Created dd_worker_alerts table with RLS';
END $$;
