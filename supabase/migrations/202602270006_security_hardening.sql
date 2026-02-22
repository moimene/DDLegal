-- ============================================================
-- Migration: 202602270006_security_hardening.sql
-- Purpose: Fix all Supabase Security Advisor ERROR + WARN findings
-- Covers: 4.1 (RLS on 6 tables), 4.2 (SECURITY INVOKER view),
--         4.3 (search_path on 9 functions), 4.7 (policies on 5 tables)
-- ============================================================

-- ============================================================
-- 4.1: Enable RLS on 6 public tables + add appropriate policies
-- ============================================================

-- 1) dd_hitl_decisions — project-scoped (has project_id)
ALTER TABLE dd_hitl_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hitl_decisions_select" ON dd_hitl_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_hitl_decisions.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

CREATE POLICY "hitl_decisions_insert" ON dd_hitl_decisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_hitl_decisions.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion', 'abogado_area')
    )
  );

-- 2) dd_areas — catalog (read-only for all authenticated)
ALTER TABLE dd_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select_all" ON dd_areas
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3) dd_processes — catalog (read-only for all authenticated)
ALTER TABLE dd_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processes_select_all" ON dd_processes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4) dd_contingencies_ext — SENSITIVE (treatment column), project-scoped via FK
ALTER TABLE dd_contingencies_ext ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contingencies_ext_select" ON dd_contingencies_ext
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_contingencies c
      JOIN dd_project_user_roles pur ON pur.project_id = c.project_id
      WHERE c.id = dd_contingencies_ext.contingency_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

CREATE POLICY "contingencies_ext_insert" ON dd_contingencies_ext
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_contingencies c
      JOIN dd_project_user_roles pur ON pur.project_id = c.project_id
      WHERE c.id = dd_contingencies_ext.contingency_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion', 'abogado_area')
    )
  );

CREATE POLICY "contingencies_ext_update" ON dd_contingencies_ext
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dd_contingencies c
      JOIN dd_project_user_roles pur ON pur.project_id = c.project_id
      WHERE c.id = dd_contingencies_ext.contingency_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion', 'abogado_area')
    )
  );

-- 5) dd_spa_clause_library — catalog (read-only for all authenticated)
ALTER TABLE dd_spa_clause_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spa_clause_library_select" ON dd_spa_clause_library
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6) dd_contingency_clause_map — project-scoped via FK to dd_contingencies
ALTER TABLE dd_contingency_clause_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contingency_clause_map_select" ON dd_contingency_clause_map
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_contingencies c
      JOIN dd_project_user_roles pur ON pur.project_id = c.project_id
      WHERE c.id = dd_contingency_clause_map.contingency_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

CREATE POLICY "contingency_clause_map_insert" ON dd_contingency_clause_map
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_contingencies c
      JOIN dd_project_user_roles pur ON pur.project_id = c.project_id
      WHERE c.id = dd_contingency_clause_map.contingency_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion', 'abogado_area')
    )
  );


-- ============================================================
-- 4.2: Recreate dd_documents_compat as SECURITY INVOKER
-- ============================================================

DROP VIEW IF EXISTS dd_documents_compat;

CREATE VIEW dd_documents_compat
WITH (security_invoker = true)
AS
SELECT vd.id,
    vd.project_id,
    vd.area_code,
    vd.name,
    COALESCE(vv.original_filename, vd.name) AS original_filename,
    COALESCE(vv.file_type, 'unknown'::text) AS file_type,
    COALESCE(vv.file_size_bytes, 0::bigint) AS file_size_bytes,
    vv.storage_path,
    vd.status,
    vd.category,
    (vd.uploaded_by)::text AS uploaded_by,
    vd.metadata,
    vd.created_at,
    vd.updated_at
FROM vdr_documents vd
LEFT JOIN LATERAL (
    SELECT dvv.id,
        dvv.document_id,
        dvv.version_number,
        dvv.original_filename,
        dvv.file_type,
        dvv.file_size_bytes,
        dvv.storage_path,
        dvv.checksum_sha256,
        dvv.change_notes,
        dvv.uploaded_by,
        dvv.created_at
    FROM vdr_document_versions dvv
    WHERE dvv.document_id = vd.id
    ORDER BY dvv.version_number DESC
    LIMIT 1
) vv ON true;


-- ============================================================
-- 4.3: Set search_path on 9 functions with mutable search_path
-- ============================================================

ALTER FUNCTION public.user_has_project_role(uuid) SET search_path = public;
ALTER FUNCTION public.user_has_permission(uuid, text) SET search_path = public;
ALTER FUNCTION public.match_vdr_chunks(vector, double precision, integer, uuid, text) SET search_path = public;
ALTER FUNCTION public.current_user_org() SET search_path = public;
ALTER FUNCTION public.forbid_audit_update_delete() SET search_path = public;
ALTER FUNCTION public.update_kanban_state_timestamp() SET search_path = public;
ALTER FUNCTION public.seed_kanban_config_for_project() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.current_tenant_id() SET search_path = public;


-- ============================================================
-- 4.7: Add policies to 5 tables with RLS enabled but no policies
-- ============================================================

-- 1) agent_executions — legacy table, admin-only read
CREATE POLICY "agent_executions_admin_select" ON agent_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion')
    )
  );

-- 2) dd_agent_executions — execution logs, admin-only read
CREATE POLICY "dd_agent_executions_admin_select" ON dd_agent_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion')
    )
  );

-- 3) deletion_log — audit log of deletions, admin-only read
CREATE POLICY "deletion_log_admin_select" ON deletion_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion')
    )
  );

-- 4) document_sections — project-scoped via document_id -> vdr_documents
CREATE POLICY "document_sections_select" ON document_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vdr_documents vd
      JOIN dd_project_user_roles pur ON pur.project_id = vd.project_id
      WHERE vd.id = document_sections.document_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

-- 5) tenants — legacy multi-tenant, admin-only read
CREATE POLICY "tenants_admin_select" ON tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm_transaccion')
    )
  );
