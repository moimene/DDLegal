-- S1: Enable RLS on all core tables and add policies

-- Enable RLS
ALTER TABLE IF EXISTS dd_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_contingencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_qa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_event_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user has role on project
CREATE OR REPLACE FUNCTION auth.user_has_project_role(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM dd_project_user_roles
    WHERE user_id = auth.uid()
    AND project_id = p_project_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: check specific permission
CREATE OR REPLACE FUNCTION auth.user_has_permission(p_project_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM dd_project_user_roles
  WHERE user_id = auth.uid()
  AND project_id = p_project_id
  AND is_active = true
  LIMIT 1;

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  CASE p_permission
    WHEN 'can_view_all_areas' THEN
      RETURN v_role IN ('clo', 'pm_transaccion', 'deal_sponsor');
    WHEN 'can_edit_tasks' THEN
      RETURN v_role IN ('clo', 'pm_transaccion', 'abogado_area');
    WHEN 'can_view_contingencies' THEN
      RETURN v_role IN ('clo', 'pm_transaccion', 'abogado_area', 'deal_sponsor', 'stakeholder_negocio');
    WHEN 'can_edit_contingencies' THEN
      RETURN v_role IN ('clo', 'pm_transaccion', 'abogado_area');
    WHEN 'can_manage_roles' THEN
      RETURN v_role IN ('clo', 'pm_transaccion');
    WHEN 'can_view_war_room' THEN
      RETURN v_role IN ('clo', 'pm_transaccion', 'deal_sponsor');
    WHEN 'can_view_reports' THEN
      RETURN v_role NOT IN ('target_liaison');
    WHEN 'can_approve_reports' THEN
      RETURN v_role IN ('clo', 'pm_transaccion');
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects: users can see projects they are assigned to
CREATE POLICY "projects_select" ON dd_projects
  FOR SELECT USING (auth.user_has_project_role(id));

CREATE POLICY "projects_insert" ON dd_projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "projects_update" ON dd_projects
  FOR UPDATE USING (auth.user_has_permission(id, 'can_manage_roles'));

-- Tasks
CREATE POLICY "tasks_select" ON dd_tasks
  FOR SELECT USING (auth.user_has_project_role(project_id));

CREATE POLICY "tasks_update" ON dd_tasks
  FOR UPDATE USING (auth.user_has_permission(project_id, 'can_edit_tasks'));

CREATE POLICY "tasks_insert" ON dd_tasks
  FOR INSERT WITH CHECK (auth.user_has_permission(project_id, 'can_edit_tasks'));

-- Contingencies
CREATE POLICY "contingencies_select" ON dd_contingencies
  FOR SELECT USING (auth.user_has_permission(project_id, 'can_view_contingencies'));

CREATE POLICY "contingencies_update" ON dd_contingencies
  FOR UPDATE USING (auth.user_has_permission(project_id, 'can_edit_contingencies'));

-- QA
CREATE POLICY "qa_select" ON dd_qa
  FOR SELECT USING (auth.user_has_project_role(project_id));

CREATE POLICY "qa_insert" ON dd_qa
  FOR INSERT WITH CHECK (auth.user_has_project_role(project_id));

-- Deliverables
CREATE POLICY "deliverables_select" ON dd_deliverables
  FOR SELECT USING (auth.user_has_project_role(project_id));

-- Evidence
CREATE POLICY "evidence_select" ON dd_evidence
  FOR SELECT USING (auth.user_has_project_role(project_id));

-- Reports
CREATE POLICY "reports_select" ON dd_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_requests r
      JOIN dd_project_user_roles pur ON pur.project_id = r.project_id
      WHERE r.id = dd_reports.request_id
      AND pur.user_id = auth.uid()
      AND pur.is_active = true
    )
  );

-- Event log
CREATE POLICY "events_select" ON dd_event_log
  FOR SELECT USING (
    auth.user_has_project_role((metadata->>'project_id')::UUID)
    OR (metadata->>'project_id') IS NULL
  );
