-- ============================================================
-- Migration: 202602270012_rls_tighten_policies.sql
-- Purpose: Replace overly permissive USING(true) policies with
--          project-scoped RLS policies on 10 tables.
-- ============================================================

-- ============================================================
-- 1) dd_deliverables — has project_id
--    Existing: deliverables_select already uses user_has_project_role
--    Add: INSERT/UPDATE policies (missing)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_deliverables') THEN

    -- SELECT already scoped via deliverables_select — no change needed

    -- Add INSERT policy
    DROP POLICY IF EXISTS "deliverables_insert" ON dd_deliverables;
    CREATE POLICY "deliverables_insert" ON dd_deliverables
      FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

    -- Add UPDATE policy
    DROP POLICY IF EXISTS "deliverables_update" ON dd_deliverables;
    CREATE POLICY "deliverables_update" ON dd_deliverables
      FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

  END IF;
END $$;


-- ============================================================
-- 2) dd_evidence — has project_id
--    Existing: evidence_select already uses user_has_project_role
--    Add: INSERT/UPDATE policies (missing)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_evidence') THEN

    -- SELECT already scoped via evidence_select — no change needed

    -- Add INSERT policy
    DROP POLICY IF EXISTS "evidence_insert" ON dd_evidence;
    CREATE POLICY "evidence_insert" ON dd_evidence
      FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

    -- Add UPDATE policy
    DROP POLICY IF EXISTS "evidence_update" ON dd_evidence;
    CREATE POLICY "evidence_update" ON dd_evidence
      FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

  END IF;
END $$;


-- ============================================================
-- 3) dd_reports — linked via request_id (no project_id column)
--    Existing: allow_all_dd_reports USING(true) — OVERLY PERMISSIVE
--    Existing: reports_select — already join-based (keep)
--    Action: Drop the permissive ALL policy, add scoped INSERT/UPDATE
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_reports') THEN

    -- Drop overly permissive ALL policy
    DROP POLICY IF EXISTS "allow_all_dd_reports" ON dd_reports;

    -- reports_select already exists with join-based check — keep it

    -- Add INSERT policy (only CLO/PM can create reports)
    DROP POLICY IF EXISTS "reports_insert" ON dd_reports;
    CREATE POLICY "reports_insert" ON dd_reports
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM dd_project_user_roles pur
          WHERE pur.user_id = auth.uid()
            AND pur.is_active = true
            AND pur.role IN ('clo', 'pm_transaccion')
        )
      );

    -- Add UPDATE policy (only CLO/PM can update reports)
    DROP POLICY IF EXISTS "reports_update" ON dd_reports;
    CREATE POLICY "reports_update" ON dd_reports
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM dd_project_user_roles pur
          WHERE pur.user_id = auth.uid()
            AND pur.is_active = true
            AND pur.role IN ('clo', 'pm_transaccion')
        )
      );

    -- Service role bypass for API routes
    DROP POLICY IF EXISTS "service_role_reports" ON dd_reports;
    CREATE POLICY "service_role_reports" ON dd_reports
      FOR ALL USING (auth.role() = 'service_role');

  END IF;
END $$;


-- ============================================================
-- 4) dd_event_log — has project_id column
--    Existing: events_select already project-scoped — keep
--    Add: INSERT policy (missing)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_event_log') THEN

    -- SELECT already scoped via events_select — no change needed

    -- Add INSERT policy (anyone with project role can log events)
    DROP POLICY IF EXISTS "events_insert" ON dd_event_log;
    CREATE POLICY "events_insert" ON dd_event_log
      FOR INSERT WITH CHECK (
        project_id IS NULL
        OR public.user_has_project_role(project_id)
      );

    -- Service role bypass for API/cron event logging
    DROP POLICY IF EXISTS "service_role_events" ON dd_event_log;
    CREATE POLICY "service_role_events" ON dd_event_log
      FOR ALL USING (auth.role() = 'service_role');

  END IF;
END $$;


-- ============================================================
-- 5) dd_negotiation_actions — has project_id
--    Existing: neg_actions_select, neg_actions_insert, neg_actions_update
--              Already properly scoped. service_role policy exists.
--    No changes needed — already tight.
-- ============================================================
-- (Verified: all policies already use user_has_project_role / user_has_permission)


-- ============================================================
-- 6) dd_negotiation_alerts — has project_id
--    Existing: "Allow all for dd_negotiation_alerts" USING(true) — OVERLY PERMISSIVE
--    Existing: alerts_all USING(true) — OVERLY PERMISSIVE
--    Action: Drop permissive policies, add project-scoped ones
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_negotiation_alerts') THEN

    -- Drop overly permissive policies
    DROP POLICY IF EXISTS "Allow all for dd_negotiation_alerts" ON dd_negotiation_alerts;
    DROP POLICY IF EXISTS "alerts_all" ON dd_negotiation_alerts;

    -- SELECT: project-scoped
    DROP POLICY IF EXISTS "neg_alerts_select" ON dd_negotiation_alerts;
    CREATE POLICY "neg_alerts_select" ON dd_negotiation_alerts
      FOR SELECT USING (public.user_has_project_role(project_id));

    -- INSERT: users with edit permission
    DROP POLICY IF EXISTS "neg_alerts_insert" ON dd_negotiation_alerts;
    CREATE POLICY "neg_alerts_insert" ON dd_negotiation_alerts
      FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

    -- UPDATE: users with edit permission
    DROP POLICY IF EXISTS "neg_alerts_update" ON dd_negotiation_alerts;
    CREATE POLICY "neg_alerts_update" ON dd_negotiation_alerts
      FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

    -- Service role bypass for API routes
    DROP POLICY IF EXISTS "service_role_neg_alerts" ON dd_negotiation_alerts;
    CREATE POLICY "service_role_neg_alerts" ON dd_negotiation_alerts
      FOR ALL USING (auth.role() = 'service_role');

  END IF;
END $$;


-- ============================================================
-- 7) dd_war_room_decisions — has project_id
--    Existing: select_wr_decisions (project-scoped) — keep
--    Existing: insert_wr_decisions (manage_contingencies) — keep
--    Existing: service_role_wr_decisions — keep
--    Add: UPDATE policy for decision resolution
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_war_room_decisions') THEN

    -- Existing SELECT, INSERT, service_role policies are already scoped — keep them

    -- Add UPDATE policy (CLO/PM can resolve decisions)
    DROP POLICY IF EXISTS "update_wr_decisions" ON dd_war_room_decisions;
    CREATE POLICY "update_wr_decisions" ON dd_war_room_decisions
      FOR UPDATE USING (public.user_has_permission(project_id, 'can_approve_reports'));

  END IF;
END $$;


-- ============================================================
-- 8) dd_war_room_notifications — has project_id
--    Existing: select_wr_notif (project-scoped) — keep
--    Existing: update_wr_notif (project-scoped) — keep
--    Existing: service_role_wr_notif — keep
--    Add: INSERT policy (missing)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dd_war_room_notifications') THEN

    -- Existing SELECT, UPDATE, service_role policies already scoped — keep them

    -- Add INSERT policy
    DROP POLICY IF EXISTS "insert_wr_notif" ON dd_war_room_notifications;
    CREATE POLICY "insert_wr_notif" ON dd_war_room_notifications
      FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

  END IF;
END $$;


-- ============================================================
-- 9) workflow_instances — has project_id (table may not exist yet)
--    Action: Enable RLS + add project-scoped policies
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_instances') THEN

    ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "wf_instances_select" ON workflow_instances;
    CREATE POLICY "wf_instances_select" ON workflow_instances
      FOR SELECT USING (public.user_has_project_role(project_id));

    DROP POLICY IF EXISTS "wf_instances_insert" ON workflow_instances;
    CREATE POLICY "wf_instances_insert" ON workflow_instances
      FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'can_edit_tasks'));

    DROP POLICY IF EXISTS "wf_instances_update" ON workflow_instances;
    CREATE POLICY "wf_instances_update" ON workflow_instances
      FOR UPDATE USING (public.user_has_permission(project_id, 'can_edit_tasks'));

    DROP POLICY IF EXISTS "service_role_wf_instances" ON workflow_instances;
    CREATE POLICY "service_role_wf_instances" ON workflow_instances
      FOR ALL USING (auth.role() = 'service_role');

  END IF;
END $$;


-- ============================================================
-- 10) workflow_task_groups — linked via workflow_instances.project_id
--     (table may not exist yet)
--     Action: Enable RLS + add join-based project-scoped policies
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_task_groups') THEN

    ALTER TABLE workflow_task_groups ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "wf_task_groups_select" ON workflow_task_groups;
    CREATE POLICY "wf_task_groups_select" ON workflow_task_groups
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM workflow_instances wi
          WHERE wi.id = workflow_task_groups.instance_id
            AND public.user_has_project_role(wi.project_id)
        )
      );

    DROP POLICY IF EXISTS "wf_task_groups_insert" ON workflow_task_groups;
    CREATE POLICY "wf_task_groups_insert" ON workflow_task_groups
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM workflow_instances wi
          WHERE wi.id = workflow_task_groups.instance_id
            AND public.user_has_permission(wi.project_id, 'can_edit_tasks')
        )
      );

    DROP POLICY IF EXISTS "wf_task_groups_update" ON workflow_task_groups;
    CREATE POLICY "wf_task_groups_update" ON workflow_task_groups
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM workflow_instances wi
          WHERE wi.id = workflow_task_groups.instance_id
            AND public.user_has_permission(wi.project_id, 'can_edit_tasks')
        )
      );

    DROP POLICY IF EXISTS "service_role_wf_task_groups" ON workflow_task_groups;
    CREATE POLICY "service_role_wf_task_groups" ON workflow_task_groups
      FOR ALL USING (auth.role() = 'service_role');

  END IF;
END $$;
