-- F.2.1: Create dd_worker_runs table
-- Worker Architecture v1.0 - Worker Controller State Machine
-- Persists worker state, progress, and execution metrics

-- ==================================================================
-- Table: dd_worker_runs
-- Worker state machine with cycle tracking and coverage snapshots
-- ==================================================================
CREATE TABLE dd_worker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,

  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  -- idle, sensing, normalizing, evaluating, concluding, paused, error, completed
  current_phase VARCHAR(20),

  -- Progreso
  phase_progress JSONB DEFAULT '{}',
  -- { items_total, items_done, items_error, percentage }
  cycle_count INTEGER DEFAULT 0,

  -- Presupuesto AI
  ai_budget_total INTEGER DEFAULT 15,    -- llamadas Harvey por ciclo
  ai_budget_used INTEGER DEFAULT 0,
  ai_budget_reset_at TIMESTAMPTZ,

  -- Cobertura
  coverage_snapshot JSONB DEFAULT '{}',
  -- { by_area: { MERC: 85, CONT: 72, ... }, overall: 78 }

  -- Work Queue (snapshot del ciclo actual)
  work_queue JSONB DEFAULT '[]',
  -- [{ document_id, objective_id, priority_score, status }]

  -- Ejecución
  execution_mode VARCHAR(20) DEFAULT 'continuous',
  -- continuous, targeted, full_sweep, on_demand
  execution_config JSONB DEFAULT '{}',
  -- { target_area?, target_fo?, coverage_threshold: 80, docs_per_cycle: 20 }

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  error_message TEXT,

  -- Métricas del ciclo
  metrics JSONB DEFAULT '{}',
  -- { docs_normalized, fos_evaluated, findings_created, findings_updated,
  --   conclusions_generated, ai_calls_total, duration_ms }

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_status CHECK (
    status IN ('idle', 'sensing', 'normalizing', 'evaluating', 'concluding', 'paused', 'error', 'completed')
  ),
  CONSTRAINT chk_current_phase CHECK (
    current_phase IS NULL OR
    current_phase IN ('sense', 'normalize', 'evaluate', 'conclude')
  ),
  CONSTRAINT chk_execution_mode CHECK (
    execution_mode IN ('continuous', 'targeted', 'full_sweep', 'on_demand')
  ),
  CONSTRAINT chk_ai_budget CHECK (
    ai_budget_used >= 0 AND ai_budget_used <= ai_budget_total
  )
);

-- ==================================================================
-- Indexes
-- ==================================================================
CREATE INDEX idx_wr_project ON dd_worker_runs(project_id);
CREATE INDEX idx_wr_status ON dd_worker_runs(status) WHERE status != 'completed';
CREATE INDEX idx_wr_heartbeat ON dd_worker_runs(last_heartbeat_at)
  WHERE status IN ('sensing', 'normalizing', 'evaluating', 'concluding');
CREATE INDEX idx_wr_created ON dd_worker_runs(created_at DESC);

-- ==================================================================
-- Enable RLS
-- ==================================================================
ALTER TABLE dd_worker_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users with project access can view worker runs
CREATE POLICY dd_worker_runs_select_policy ON dd_worker_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_worker_runs.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

-- Policy: PM, CLO can start/manage worker
CREATE POLICY dd_worker_runs_insert_policy ON dd_worker_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_worker_runs.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm')
    )
  );

-- Policy: PM, CLO can update worker state
CREATE POLICY dd_worker_runs_update_policy ON dd_worker_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_worker_runs.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm')
    )
  );

-- Policy: Service role can do everything (for cron operations)
CREATE POLICY dd_worker_runs_service_role ON dd_worker_runs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- Updated_at trigger
-- ==================================================================
CREATE TRIGGER set_dd_worker_runs_updated_at
  BEFORE UPDATE ON dd_worker_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==================================================================
-- Helper function: Get or create active worker run for project
-- ==================================================================
CREATE OR REPLACE FUNCTION get_or_create_worker_run(p_project_id UUID)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  -- Try to get existing active run
  SELECT id INTO v_run_id
  FROM dd_worker_runs
  WHERE project_id = p_project_id
    AND status NOT IN ('completed', 'error')
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no active run, create one
  IF v_run_id IS NULL THEN
    INSERT INTO dd_worker_runs (project_id, status)
    VALUES (p_project_id, 'idle')
    RETURNING id INTO v_run_id;
  END IF;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- Helper function: Update heartbeat
-- ==================================================================
CREATE OR REPLACE FUNCTION worker_heartbeat(p_run_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE dd_worker_runs
  SET last_heartbeat_at = now()
  WHERE id = p_run_id
    AND status IN ('sensing', 'normalizing', 'evaluating', 'concluding');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- Comments
-- ==================================================================
COMMENT ON TABLE dd_worker_runs IS 'Worker state machine with cycle tracking - Worker Architecture v1.0';
COMMENT ON COLUMN dd_worker_runs.status IS 'Current worker status: idle, sensing, normalizing, evaluating, concluding, paused, error, completed';
COMMENT ON COLUMN dd_worker_runs.current_phase IS 'Current processing phase: sense, normalize, evaluate, conclude';
COMMENT ON COLUMN dd_worker_runs.ai_budget_total IS 'Maximum Harvey AI calls allowed per cycle';
COMMENT ON COLUMN dd_worker_runs.coverage_snapshot IS 'Last computed coverage by area: { by_area: { MERC: 85, ... }, overall: 78 }';
COMMENT ON COLUMN dd_worker_runs.work_queue IS 'Current cycle work items: [{ document_id, objective_id, priority_score, status }]';
COMMENT ON FUNCTION get_or_create_worker_run(UUID) IS 'Get active worker run or create new one for project';
COMMENT ON FUNCTION worker_heartbeat(UUID) IS 'Update worker heartbeat timestamp';
