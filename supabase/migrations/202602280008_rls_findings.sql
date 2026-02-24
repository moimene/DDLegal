-- ============================================================================
-- Migration: RLS policies for findings tables
-- Part of the Finding-Centric refactor (Fase A, Step 5)
-- Follows existing patterns from 202602260001_rls_core_tables.sql
-- ============================================================================

-- 0. Extend user_has_permission with findings-specific permissions
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
    -- Existing permissions (unchanged)
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

    -- New findings permissions
    WHEN 'can_view_findings' THEN
      -- Everyone except target_liaison can view findings (filtered by tier in app layer)
      RETURN v_role NOT IN ('target_liaison');
    WHEN 'can_edit_findings' THEN
      -- Same as contingencies: internal legal team
      RETURN v_role IN ('clo', 'pm_transaccion', 'abogado_area');
    WHEN 'can_change_finding_tier' THEN
      -- Tier changes require PM or CLO (abogado can only promote 3→2 in their area, enforced in app)
      RETURN v_role IN ('clo', 'pm_transaccion', 'abogado_area');
    WHEN 'can_resolve_findings' THEN
      -- Only CLO and PM can mark as resolved
      RETURN v_role IN ('clo', 'pm_transaccion');

    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 1. RLS on dd_findings
-- ============================================================================
ALTER TABLE public.dd_findings ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API routes)
CREATE POLICY dd_findings_service_bypass
  ON public.dd_findings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: SELECT if they have any active role on the project
CREATE POLICY dd_findings_select_project_member
  ON public.dd_findings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dd_project_user_roles pur
      WHERE pur.project_id = dd_findings.project_id
      AND pur.user_id = auth.uid()
      AND pur.is_active = true
    )
  );

-- Authenticated users: INSERT if they can edit findings on the project
CREATE POLICY dd_findings_insert_editor
  ON public.dd_findings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_permission(project_id, 'can_edit_findings')
  );

-- Authenticated users: UPDATE if they can edit findings on the project
CREATE POLICY dd_findings_update_editor
  ON public.dd_findings
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_permission(project_id, 'can_edit_findings')
  )
  WITH CHECK (
    public.user_has_permission(project_id, 'can_edit_findings')
  );

-- No DELETE policy for authenticated users — findings are never deleted, only dismissed


-- ============================================================================
-- 2. RLS on dd_finding_evidence
-- ============================================================================
ALTER TABLE public.dd_finding_evidence ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY dd_finding_evidence_service_bypass
  ON public.dd_finding_evidence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SELECT: if user can view the parent finding
CREATE POLICY dd_finding_evidence_select
  ON public.dd_finding_evidence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dd_findings f
      JOIN public.dd_project_user_roles pur ON pur.project_id = f.project_id
      WHERE f.id = dd_finding_evidence.finding_id
      AND pur.user_id = auth.uid()
      AND pur.is_active = true
    )
  );

-- INSERT/UPDATE: if user can edit findings on the project
CREATE POLICY dd_finding_evidence_insert
  ON public.dd_finding_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dd_findings f
      WHERE f.id = dd_finding_evidence.finding_id
      AND public.user_has_permission(f.project_id, 'can_edit_findings')
    )
  );

CREATE POLICY dd_finding_evidence_update
  ON public.dd_finding_evidence
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dd_findings f
      WHERE f.id = dd_finding_evidence.finding_id
      AND public.user_has_permission(f.project_id, 'can_edit_findings')
    )
  );


-- ============================================================================
-- 3. RLS on dd_report_findings
-- ============================================================================
ALTER TABLE public.dd_report_findings ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY dd_report_findings_service_bypass
  ON public.dd_report_findings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SELECT: if user can view reports on the project
CREATE POLICY dd_report_findings_select
  ON public.dd_report_findings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dd_reports r
      JOIN public.dd_project_user_roles pur ON pur.project_id = r.project_id
      WHERE r.id = dd_report_findings.report_id
      AND pur.user_id = auth.uid()
      AND pur.is_active = true
    )
  );

-- INSERT/UPDATE: if user can approve reports
CREATE POLICY dd_report_findings_insert
  ON public.dd_report_findings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dd_reports r
      WHERE r.id = dd_report_findings.report_id
      AND public.user_has_permission(r.project_id, 'can_approve_reports')
    )
  );
