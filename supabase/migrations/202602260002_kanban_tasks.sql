-- S2: Kanban task engine
-- Expand/contract: new table dd_kanban_tasks, legacy_task_id references dd_tasks

CREATE TYPE kanban_state AS ENUM (
  'backlog',
  'info_solicitada',
  'info_recibida',
  'lista_para_analisis',
  'en_analisis',
  'ia_propuesta',
  'hitl_revision',
  'conclusion',
  'integrado_en_informe',
  'bloqueado'
);

CREATE TABLE dd_kanban_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  column_state kanban_state NOT NULL,
  wip_limit INTEGER NOT NULL DEFAULT 5,
  dor_criteria JSONB DEFAULT '[]'::JSONB,
  dod_criteria JSONB DEFAULT '[]'::JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, column_state)
);

CREATE TABLE dd_kanban_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state kanban_state NOT NULL DEFAULT 'backlog',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assigned_to UUID REFERENCES auth.users(id),
  reviewer UUID REFERENCES auth.users(id),
  due_date DATE,
  ai_output JSONB,
  ai_status TEXT CHECK (ai_status IN ('pending', 'running', 'done', 'failed')),
  ai_confidence NUMERIC(5,2),
  hitl_required BOOLEAN DEFAULT false,
  hitl_decision TEXT,
  hitl_decided_by UUID REFERENCES auth.users(id),
  hitl_decided_at TIMESTAMPTZ,
  entered_state_at TIMESTAMPTZ DEFAULT NOW(),
  evidence_refs JSONB DEFAULT '[]'::JSONB,
  legacy_task_id UUID REFERENCES dd_tasks(id),
  workflow_key TEXT,
  skill_key TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kanban_project_state ON dd_kanban_tasks(project_id, state);
CREATE INDEX idx_kanban_area ON dd_kanban_tasks(area_code);
CREATE INDEX idx_kanban_assigned ON dd_kanban_tasks(assigned_to);
CREATE INDEX idx_kanban_aging ON dd_kanban_tasks(entered_state_at);
CREATE INDEX idx_kanban_legacy ON dd_kanban_tasks(legacy_task_id);

ALTER TABLE dd_kanban_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_kanban_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_tasks_select" ON dd_kanban_tasks
  FOR SELECT USING (auth.user_has_project_role(project_id));

CREATE POLICY "kanban_tasks_insert" ON dd_kanban_tasks
  FOR INSERT WITH CHECK (auth.user_has_permission(project_id, 'can_edit_tasks'));

CREATE POLICY "kanban_tasks_update" ON dd_kanban_tasks
  FOR UPDATE USING (auth.user_has_permission(project_id, 'can_edit_tasks'));

CREATE POLICY "kanban_config_select" ON dd_kanban_config
  FOR SELECT USING (auth.user_has_project_role(project_id));

CREATE POLICY "kanban_config_update" ON dd_kanban_config
  FOR UPDATE USING (auth.user_has_permission(project_id, 'can_manage_roles'));

CREATE OR REPLACE FUNCTION update_kanban_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    NEW.entered_state_at = NOW();
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kanban_state_change
  BEFORE UPDATE ON dd_kanban_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_kanban_state_timestamp();

CREATE OR REPLACE FUNCTION seed_kanban_config_for_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dd_kanban_config (project_id, column_state, wip_limit, sort_order)
  VALUES
    (NEW.id, 'backlog', 0, 0),
    (NEW.id, 'info_solicitada', 10, 1),
    (NEW.id, 'info_recibida', 10, 2),
    (NEW.id, 'lista_para_analisis', 8, 3),
    (NEW.id, 'en_analisis', 5, 4),
    (NEW.id, 'ia_propuesta', 5, 5),
    (NEW.id, 'hitl_revision', 3, 6),
    (NEW.id, 'conclusion', 5, 7),
    (NEW.id, 'integrado_en_informe', 0, 8),
    (NEW.id, 'bloqueado', 0, 9);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_kanban_config
  AFTER INSERT ON dd_projects
  FOR EACH ROW
  EXECUTE FUNCTION seed_kanban_config_for_project();
