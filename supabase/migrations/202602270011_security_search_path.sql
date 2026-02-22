-- Migration: 202602270011_security_search_path.sql
-- Security hardening: fix mutable search_path, ensure RLS, fix view security
-- ============================================================================

-- ============================================================================
-- 1. ALTER existing functions to SET search_path = public
--    (Idempotent: if already set, this is a no-op equivalent)
-- ============================================================================

-- Functions in public schema (these exist and most already have search_path set,
-- but we enforce it explicitly for all to ensure consistency)
ALTER FUNCTION public.user_has_project_role(uuid) SET search_path = public;
ALTER FUNCTION public.user_has_permission(uuid, text) SET search_path = public;
ALTER FUNCTION public.match_vdr_chunks(vector, double precision, integer, uuid, text) SET search_path = public;
ALTER FUNCTION public.bm25_search_vdr_chunks(text, uuid, text, integer, text) SET search_path = public;
ALTER FUNCTION public.update_kanban_state_timestamp() SET search_path = public;
ALTER FUNCTION public.seed_kanban_config_for_project() SET search_path = public;

-- update_deal_risk_scores_updated_at may or may not exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'update_deal_risk_scores_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_deal_risk_scores_updated_at() SET search_path = public';
  END IF;
END $$;

-- Also check for auth schema variants (if they exist separately)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'user_has_project_role'
  ) THEN
    EXECUTE 'ALTER FUNCTION auth.user_has_project_role(uuid) SET search_path = public';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'user_has_permission'
  ) THEN
    EXECUTE 'ALTER FUNCTION auth.user_has_permission(uuid, text) SET search_path = public';
  END IF;
END $$;

-- ============================================================================
-- 2. Enable RLS on tables that may be missing it + add policies if needed
-- ============================================================================

-- dd_hitl_decisions: ensure RLS is enabled (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dd_hitl_decisions'
  ) THEN
    ALTER TABLE dd_hitl_decisions ENABLE ROW LEVEL SECURITY;

    -- Add SELECT policy for project members if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'dd_hitl_decisions' AND policyname = 'hitl_decisions_select'
    ) THEN
      CREATE POLICY hitl_decisions_select ON dd_hitl_decisions
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM dd_project_user_roles pur
            WHERE pur.project_id = dd_hitl_decisions.project_id
              AND pur.user_id = auth.uid()
              AND pur.is_active = true
          )
        );
    END IF;
  END IF;
END $$;

-- dd_spa_clause_library: ensure RLS is enabled (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dd_spa_clause_library'
  ) THEN
    ALTER TABLE dd_spa_clause_library ENABLE ROW LEVEL SECURITY;

    -- Add SELECT policy for all authenticated users if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'dd_spa_clause_library' AND policyname = 'spa_clause_library_select'
    ) THEN
      CREATE POLICY spa_clause_library_select ON dd_spa_clause_library
        FOR SELECT
        USING (auth.uid() IS NOT NULL);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. Fix dd_documents_compat view — recreate as SECURITY INVOKER
--    (SECURITY INVOKER is the default in PG15+, but we make it explicit)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'dd_documents_compat') THEN
    -- Drop the existing view
    DROP VIEW IF EXISTS dd_documents_compat;
  END IF;
END $$;

-- Recreate with explicit SECURITY INVOKER (runs with the permissions of the querying user)
CREATE OR REPLACE VIEW dd_documents_compat
WITH (security_invoker = true)
AS
SELECT
  vd.id,
  vd.project_id,
  vd.area_code,
  vd.name,
  COALESCE(vv.original_filename, vd.name) AS original_filename,
  COALESCE(vv.file_type, 'unknown'::text) AS file_type,
  COALESCE(vv.file_size_bytes, 0::bigint) AS file_size_bytes,
  vv.storage_path,
  vd.status,
  vd.category,
  vd.uploaded_by::text AS uploaded_by,
  vd.metadata,
  vd.created_at,
  vd.updated_at
FROM vdr_documents vd
LEFT JOIN LATERAL (
  SELECT
    dvv.id,
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

-- Grant SELECT on the recreated view to authenticated users
GRANT SELECT ON dd_documents_compat TO authenticated;
