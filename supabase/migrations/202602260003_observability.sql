-- S5: Observability tables

CREATE TABLE dd_gateway_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  retries INTEGER NOT NULL DEFAULT 0,
  client_matter_id TEXT,
  feature_flag TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gateway_telemetry_created ON dd_gateway_telemetry(created_at);
CREATE INDEX idx_gateway_telemetry_status ON dd_gateway_telemetry(status_code);

CREATE TABLE dd_slo_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  target_value NUMERIC,
  is_met BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slo_period ON dd_slo_snapshots(period_start, metric_name);

ALTER TABLE dd_gateway_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_slo_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telemetry_select" ON dd_gateway_telemetry
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles
      WHERE user_id = auth.uid()
      AND role IN ('clo', 'pm_transaccion')
      AND is_active = true
    )
  );

CREATE POLICY "slo_select" ON dd_slo_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles
      WHERE user_id = auth.uid()
      AND role IN ('clo', 'pm_transaccion')
      AND is_active = true
    )
  );
