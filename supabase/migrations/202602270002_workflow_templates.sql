-- ============================================================
-- Workflow Spec v1 — Foundational Tables
-- ============================================================
-- Expand/contract migration: adds NEW tables and columns
-- without modifying or breaking any existing functionality.
--
-- Tables created:
--   1. dd_workflow_templates       — Template master definitions
--   2. dd_workflow_template_versions — Immutable versioned snapshots
--   3. dd_workflow_instances        — Workflow executions per project
--   4. dd_workflow_task_groups      — Task groups per phase
--   5. dd_negotiation_actions       — Structured negotiation actions
--
-- Enum created:
--   dd_workflow_phase — 5 DD phases
--
-- Altered:
--   dd_kanban_tasks — adds workflow_instance_id, workflow_phase,
--                     task_group_id, template_version_id columns
--
-- Date: 2026-02-27
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Enum: dd_workflow_phase
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dd_workflow_phase') THEN
    CREATE TYPE dd_workflow_phase AS ENUM (
      'obtencion',
      'gestion',
      'analisis',
      'valoracion',
      'tratamiento'
    );
  END IF;
END $$;

-- ============================================================
-- 1. dd_workflow_templates — Template master definitions
--    Each template represents a reusable workflow pattern
--    (e.g., 'contratos_materiales', 'due_diligence_laboral').
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_workflow_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  area_codes    TEXT[] NOT NULL DEFAULT '{}',
  category      TEXT NOT NULL DEFAULT 'transactional'
                CHECK (category IN ('transactional', 'compliance', 'operational')),
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. dd_workflow_template_versions — Immutable versions
--    Each version captures a full snapshot of phase definitions,
--    HITL policy, input/output schemas, and evidence requirements.
--    Once published, a version is frozen.
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_workflow_template_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES dd_workflow_templates(id) ON DELETE CASCADE,
  version_number        INTEGER NOT NULL DEFAULT 1,

  -- Array of 5 DD phases. Each phase object has:
  -- phase, name, description, inputs_required, skills, artifacts,
  -- dod_criteria, dor_criteria, kanban_start_state, kanban_end_state,
  -- hitl_required, estimated_duration_hours, gateway_config
  phases                JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- HITL policy: { required_areas, auto_approve_below_severity,
  --   reviewer_role, escalation_after_hours }
  hitl_policy           JSONB NOT NULL DEFAULT '{}'::JSONB,

  input_schema          JSONB NOT NULL DEFAULT '{}'::JSONB,
  output_schema         JSONB NOT NULL DEFAULT '{}'::JSONB,
  evidence_requirements JSONB NOT NULL DEFAULT '[]'::JSONB,
  report_template_key   TEXT,
  feature_flag_key      TEXT,
  is_published          BOOLEAN DEFAULT false,
  published_at          TIMESTAMPTZ,
  changelog             TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, version_number)
);

-- ============================================================
-- 3. dd_workflow_instances — Workflow executions per project
--    Each instance binds a template version to a project and
--    tracks phase-level progress, counters, and overrides.
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_workflow_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES dd_workflow_templates(id),
  template_version_id UUID NOT NULL REFERENCES dd_workflow_template_versions(id),
  status              TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created', 'in_progress', 'paused', 'completed', 'failed', 'cancelled')),
  current_phase       dd_workflow_phase DEFAULT 'obtencion',
  project_overrides   JSONB DEFAULT '{}'::JSONB,
  phase_status        JSONB NOT NULL DEFAULT '{"obtencion":"pending","gestion":"pending","analisis":"pending","valoracion":"pending","tratamiento":"pending"}'::JSONB,
  phase_started_at    JSONB DEFAULT '{}'::JSONB,
  phase_completed_at  JSONB DEFAULT '{}'::JSONB,
  findings_count      INTEGER DEFAULT 0,
  red_flags_count     INTEGER DEFAULT 0,
  hitl_pending_count  INTEGER DEFAULT 0,
  initiated_by        UUID REFERENCES auth.users(id),
  completed_at        TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. dd_workflow_task_groups — Task groups per phase
--    Groups tasks within a phase for logical ordering
--    (e.g., "Document Review", "Registry Checks").
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_workflow_task_groups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id  UUID NOT NULL REFERENCES dd_workflow_instances(id) ON DELETE CASCADE,
  phase                 dd_workflow_phase NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  sort_order            INTEGER DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ALTER dd_kanban_tasks — Add workflow columns
--    Expand-only: new nullable columns, no existing data affected.
-- ============================================================
ALTER TABLE dd_kanban_tasks
  ADD COLUMN IF NOT EXISTS workflow_instance_id  UUID REFERENCES dd_workflow_instances(id),
  ADD COLUMN IF NOT EXISTS workflow_phase        dd_workflow_phase,
  ADD COLUMN IF NOT EXISTS task_group_id         UUID REFERENCES dd_workflow_task_groups(id),
  ADD COLUMN IF NOT EXISTS template_version_id   UUID REFERENCES dd_workflow_template_versions(id);

-- ============================================================
-- 6. dd_negotiation_actions — Structured negotiation actions
--    Treatment-phase actions that map findings to SPA clauses,
--    track negotiation positions, and link to war room decisions.
-- ============================================================
CREATE TABLE IF NOT EXISTS dd_negotiation_actions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  workflow_instance_id    UUID REFERENCES dd_workflow_instances(id),
  finding_ref             TEXT,
  contingency_id          UUID REFERENCES dd_contingencies(id),
  action_type             TEXT NOT NULL
                          CHECK (action_type IN (
                            'condition_precedent', 'indemnity', 'price_adjustment',
                            'warranty', 'covenant', 'escrow', 'cap_basket',
                            'carve_out', 'disclosure', 'remediation', 'insurance', 'other'
                          )),
  title                   TEXT NOT NULL,
  description             TEXT,
  spa_clause_id           UUID REFERENCES dd_spa_clause_library(id),
  proposed_text           TEXT,
  status                  TEXT NOT NULL DEFAULT 'proposed'
                          CHECK (status IN (
                            'proposed', 'accepted', 'rejected',
                            'counter', 'deferred', 'withdrawn'
                          )),
  owner                   UUID REFERENCES auth.users(id),
  counterparty_position   TEXT,
  economic_impact_amount  NUMERIC,
  economic_impact_currency TEXT DEFAULT 'EUR',
  evidence_refs           JSONB DEFAULT '[]'::JSONB,
  war_room_decision_id    UUID REFERENCES dd_war_room_decisions(id),
  metadata                JSONB DEFAULT '{}'::JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. Indexes
-- ============================================================

-- Templates
CREATE INDEX IF NOT EXISTS idx_wf_templates_key
  ON dd_workflow_templates(template_key);

-- Template versions
CREATE INDEX IF NOT EXISTS idx_wf_versions_template
  ON dd_workflow_template_versions(template_id);

-- Instances
CREATE INDEX IF NOT EXISTS idx_wf_instances_project
  ON dd_workflow_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_template
  ON dd_workflow_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_status
  ON dd_workflow_instances(status);

-- Task groups
CREATE INDEX IF NOT EXISTS idx_wf_task_groups_instance
  ON dd_workflow_task_groups(workflow_instance_id);

-- Kanban workflow columns
CREATE INDEX IF NOT EXISTS idx_kanban_wf_instance
  ON dd_kanban_tasks(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_kanban_wf_phase
  ON dd_kanban_tasks(workflow_phase);

-- Negotiation actions
CREATE INDEX IF NOT EXISTS idx_neg_actions_project
  ON dd_negotiation_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_neg_actions_wf
  ON dd_negotiation_actions(workflow_instance_id);

-- ============================================================
-- 8. Enable RLS on all new tables
-- ============================================================
ALTER TABLE dd_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_workflow_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_workflow_task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_negotiation_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. RLS Policies
-- ============================================================

-- 9.1 dd_workflow_templates: readable & insertable by all authenticated users
CREATE POLICY "wf_templates_select" ON dd_workflow_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "wf_templates_insert" ON dd_workflow_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 9.2 dd_workflow_template_versions: readable & insertable by all authenticated users
CREATE POLICY "wf_template_versions_select" ON dd_workflow_template_versions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "wf_template_versions_insert" ON dd_workflow_template_versions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 9.3 dd_workflow_instances: project-scoped access
CREATE POLICY "wf_instances_select" ON dd_workflow_instances
  FOR SELECT USING (public.user_has_project_role(project_id));

CREATE POLICY "wf_instances_insert" ON dd_workflow_instances
  FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

CREATE POLICY "wf_instances_update" ON dd_workflow_instances
  FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

-- 9.4 dd_workflow_task_groups: access via join to instance's project_id
CREATE POLICY "wf_task_groups_select" ON dd_workflow_task_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_workflow_instances wi
      WHERE wi.id = workflow_instance_id
      AND public.user_has_project_role(wi.project_id)
    )
  );

CREATE POLICY "wf_task_groups_insert" ON dd_workflow_task_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_workflow_instances wi
      WHERE wi.id = workflow_instance_id
      AND public.user_has_permission(wi.project_id, 'can_edit_tasks')
    )
  );

CREATE POLICY "wf_task_groups_update" ON dd_workflow_task_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dd_workflow_instances wi
      WHERE wi.id = workflow_instance_id
      AND public.user_has_permission(wi.project_id, 'can_edit_tasks')
    )
  );

-- 9.5 dd_negotiation_actions: project-scoped access
CREATE POLICY "neg_actions_select" ON dd_negotiation_actions
  FOR SELECT USING (public.user_has_project_role(project_id));

CREATE POLICY "neg_actions_insert" ON dd_negotiation_actions
  FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_contingencies'));

CREATE POLICY "neg_actions_update" ON dd_negotiation_actions
  FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_contingencies'));

-- 9.6 Service-role bypass for all new tables (for API routes using service_role key)
CREATE POLICY "service_role_wf_templates" ON dd_workflow_templates
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_wf_versions" ON dd_workflow_template_versions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_wf_instances" ON dd_workflow_instances
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_wf_task_groups" ON dd_workflow_task_groups
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_neg_actions" ON dd_negotiation_actions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 10. updated_at triggers (reuse existing function)
-- ============================================================
CREATE TRIGGER trg_wf_templates_updated_at
  BEFORE UPDATE ON dd_workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_wf_instances_updated_at
  BEFORE UPDATE ON dd_workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_neg_actions_updated_at
  BEFORE UPDATE ON dd_negotiation_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
