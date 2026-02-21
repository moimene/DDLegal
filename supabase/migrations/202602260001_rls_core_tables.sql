-- S1: Enable RLS on all core tables and add policies
-- Functions in public schema (auth schema requires elevated permissions)

-- Enable RLS (IF EXISTS for safety - some may already have it)
ALTER TABLE IF EXISTS dd_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_contingencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_qa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_project_user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user has role on project
CREATE OR REPLACE FUNCTION public.user_has_project_role(p_project_id UUID)
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
CREATE OR REPLACE FUNCTION public.user_has_permission(p_project_id UUID, p_permission TEXT)
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

-- Projects: add policies (RLS already enabled on dd_projects)
-- Drop existing if re-running
DROP POLICY IF EXISTS "projects_select" ON dd_projects;
DROP POLICY IF EXISTS "projects_insert" ON dd_projects;
DROP POLICY IF EXISTS "projects_update" ON dd_projects;

CREATE POLICY "projects_select" ON dd_projects
  FOR SELECT USING (public.user_has_project_role(id));

CREATE POLICY "projects_insert" ON dd_projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "projects_update" ON dd_projects
  FOR UPDATE USING (public.user_has_permission(id, 'can_manage_roles'));

-- Tasks
CREATE POLICY "tasks_select" ON dd_tasks
  FOR SELECT USING (public.user_has_project_role(project_id));

CREATE POLICY "tasks_update" ON dd_tasks
  FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

CREATE POLICY "tasks_insert" ON dd_tasks
  FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

-- Contingencies
CREATE POLICY "contingencies_select" ON dd_contingencies
  FOR SELECT USING (public.user_has_permission(project_id, 'can_view_contingencies'));

CREATE POLICY "contingencies_update" ON dd_contingencies
  FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_contingencies'));

-- QA
CREATE POLICY "qa_select" ON dd_qa
  FOR SELECT USING (public.user_has_project_role(project_id));

CREATE POLICY "qa_insert" ON dd_qa
  FOR INSERT WITH CHECK (public.user_has_project_role(project_id));

-- Deliverables
CREATE POLICY "deliverables_select" ON dd_deliverables
  FOR SELECT USING (public.user_has_project_role(project_id));

-- Evidence
CREATE POLICY "evidence_select" ON dd_evidence
  FOR SELECT USING (public.user_has_project_role(project_id));

-- Reports: accessible to any authenticated user with at least one active role
-- (dd_requests doesn't have project_id; reports are linked via request_id → sociedad_id)
DROP POLICY IF EXISTS "reports_select" ON dd_reports;
CREATE POLICY "reports_select" ON dd_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- Event log: uses project_id column directly
CREATE POLICY "events_select" ON dd_event_log
  FOR SELECT USING (
    public.user_has_project_role(project_id)
    OR project_id IS NULL
  );

-- Project user roles: users can see their own roles
CREATE POLICY "pur_select" ON dd_project_user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.user_has_permission(project_id, 'can_manage_roles'));

CREATE POLICY "pur_insert" ON dd_project_user_roles
  FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_manage_roles'));

CREATE POLICY "pur_update" ON dd_project_user_roles
  FOR UPDATE USING (public.user_has_permission(project_id, 'can_manage_roles'));
