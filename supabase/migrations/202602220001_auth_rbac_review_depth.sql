-- ============================================================
-- Migration: Phase 1 — RBAC + Review Depth
-- Creates project-scoped user roles, extends dd_projects with
-- review_depth, and replaces permissive RLS policies on core
-- DD tables with role-based policies.
-- Date: 2026-02-22
-- ============================================================

begin;

-- ============================================================
-- 1. dd_project_user_roles — Project-scoped RBAC assignments
-- ============================================================
create table if not exists public.dd_project_user_roles (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null,
  user_id     uuid not null,
  role        text not null check (role in (
    'clo',
    'pm_transaccion',
    'abogado_area',
    'deal_sponsor',
    'target_liaison',
    'stakeholder_negocio',
    'cliente_externo'
  )),
  area_code   text null,  -- NULL = global access; specific code = area-scoped
  is_active   boolean not null default true,
  granted_by  uuid null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique(project_id, user_id, role, area_code)
);

-- Indexes
create index if not exists idx_dd_project_user_roles_project_id
  on public.dd_project_user_roles(project_id);
create index if not exists idx_dd_project_user_roles_user_id
  on public.dd_project_user_roles(user_id);
create index if not exists idx_dd_project_user_roles_role
  on public.dd_project_user_roles(role);

-- FK to dd_projects (conditional, safe)
do $$
begin
  alter table public.dd_project_user_roles
    add constraint dd_project_user_roles_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- FK to auth.users (conditional, safe)
do $$
begin
  alter table public.dd_project_user_roles
    add constraint dd_project_user_roles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 2. Extend dd_projects with review_depth
-- ============================================================
do $$
begin
  if to_regclass('public.dd_projects') is not null then
    alter table public.dd_projects
      add column if not exists review_depth text not null default 'standard';

    -- Add check constraint safely
    if not exists (
      select 1 from pg_constraint where conname = 'dd_projects_review_depth_check'
    ) then
      alter table public.dd_projects
        add constraint dd_projects_review_depth_check
        check (review_depth in ('light', 'standard', 'enhanced'));
    end if;

    alter table public.dd_projects
      add column if not exists review_depth_config jsonb default '{}';
  end if;
end $$;

-- ============================================================
-- 3. RLS POLICIES — Role-based access on core DD tables
-- ============================================================
-- Strategy:
--   - Service role bypass on every table (API routes via supabaseAdmin)
--   - Authenticated users see rows only if they have an active
--     assignment in dd_project_user_roles for that project
--   - abogado_area: area-scoped filtering on dd_tasks
--   - cliente_externo: only client_visible rows on dd_contingencies
-- ============================================================

-- ----------------------------------------------------------
-- 3a. dd_project_user_roles — self
-- ----------------------------------------------------------
alter table public.dd_project_user_roles enable row level security;

-- Service role bypass
create policy "dd_project_user_roles_service_bypass"
  on public.dd_project_user_roles
  for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

-- Authenticated users can see their own role assignments
create policy "dd_project_user_roles_select_own"
  on public.dd_project_user_roles
  for select
  using (
    auth.uid() = user_id
    or current_setting('role') = 'service_role'
  );

-- ----------------------------------------------------------
-- 3b. dd_projects
-- ----------------------------------------------------------
-- dd_projects comes from remote baseline; no existing RLS policies to drop.
do $$
begin
  if to_regclass('public.dd_projects') is not null then
    execute 'alter table public.dd_projects enable row level security';

    -- Service role bypass
    execute $p$
      create policy "dd_projects_service_bypass"
        on public.dd_projects
        for all
        using (current_setting('role') = 'service_role')
        with check (current_setting('role') = 'service_role')
    $p$;

    -- Authenticated: user has active role on project
    execute $p$
      create policy "dd_projects_select_assigned"
        on public.dd_projects
        for select
        using (
          exists (
            select 1 from public.dd_project_user_roles r
            where r.project_id = dd_projects.id
              and r.user_id = auth.uid()
              and r.is_active = true
              and (r.expires_at is null or r.expires_at > now())
          )
          or current_setting('role') = 'service_role'
        )
    $p$;
  end if;
end $$;

-- ----------------------------------------------------------
-- 3c. dd_tasks
-- ----------------------------------------------------------
-- dd_tasks comes from remote baseline; no existing RLS policies to drop.
do $$
begin
  if to_regclass('public.dd_tasks') is not null then
    execute 'alter table public.dd_tasks enable row level security';

    -- Service role bypass
    execute $p$
      create policy "dd_tasks_service_bypass"
        on public.dd_tasks
        for all
        using (current_setting('role') = 'service_role')
        with check (current_setting('role') = 'service_role')
    $p$;

    -- Authenticated: user has active role on project.
    -- If role = abogado_area, further filter by area_code matching.
    execute $p$
      create policy "dd_tasks_select_assigned"
        on public.dd_tasks
        for select
        using (
          exists (
            select 1 from public.dd_project_user_roles r
            where r.project_id = dd_tasks.project_id
              and r.user_id = auth.uid()
              and r.is_active = true
              and (r.expires_at is null or r.expires_at > now())
              and (
                r.role <> 'abogado_area'
                or r.area_code is null
                or r.area_code = dd_tasks.area_code
              )
          )
          or current_setting('role') = 'service_role'
        )
    $p$;
  end if;
end $$;

-- ----------------------------------------------------------
-- 3d. dd_contingencies
-- ----------------------------------------------------------
-- dd_contingencies comes from remote baseline; no existing RLS policies to drop.
do $$
begin
  if to_regclass('public.dd_contingencies') is not null then
    execute 'alter table public.dd_contingencies enable row level security';

    -- Service role bypass
    execute $p$
      create policy "dd_contingencies_service_bypass"
        on public.dd_contingencies
        for all
        using (current_setting('role') = 'service_role')
        with check (current_setting('role') = 'service_role')
    $p$;

    -- Authenticated: user assigned to project.
    -- cliente_externo only sees client_visible rows.
    execute $p$
      create policy "dd_contingencies_select_assigned"
        on public.dd_contingencies
        for select
        using (
          exists (
            select 1 from public.dd_project_user_roles r
            where r.project_id = dd_contingencies.project_id
              and r.user_id = auth.uid()
              and r.is_active = true
              and (r.expires_at is null or r.expires_at > now())
              and (
                r.role <> 'cliente_externo'
                or dd_contingencies.client_visible = true
              )
          )
          or current_setting('role') = 'service_role'
        )
    $p$;
  end if;
end $$;

-- ----------------------------------------------------------
-- 3e. dd_reports
-- ----------------------------------------------------------
-- dd_reports was created in 202602210001_societario_schema.sql
-- with permissive policy allow_all_dd_reports. Drop and replace.
do $$
begin
  if to_regclass('public.dd_reports') is not null then
    -- Drop old permissive policy if exists
    begin
      execute 'drop policy if exists "allow_all_dd_reports" on public.dd_reports';
    exception when undefined_object then null;
    end;

    -- Service role bypass
    execute $p$
      create policy "dd_reports_service_bypass"
        on public.dd_reports
        for all
        using (current_setting('role') = 'service_role')
        with check (current_setting('role') = 'service_role')
    $p$;

    -- Authenticated: user assigned to project via request -> dd_requests
    -- dd_reports links to dd_requests which links to dd_tool_executions.
    -- For simplicity, allow any assigned user to see all reports
    -- linked to the project via the request chain.
    execute $p$
      create policy "dd_reports_select_assigned"
        on public.dd_reports
        for select
        using (
          exists (
            select 1 from public.dd_requests req
            join public.dd_tool_executions tex on tex.id = req.tool_execution_id
            join public.dd_project_user_roles r on r.project_id = tex.project_id
            where req.id = dd_reports.request_id
              and r.user_id = auth.uid()
              and r.is_active = true
              and (r.expires_at is null or r.expires_at > now())
          )
          or current_setting('role') = 'service_role'
        )
    $p$;
  end if;
end $$;

-- ----------------------------------------------------------
-- 3f. dd_documents
-- ----------------------------------------------------------
-- dd_documents was created in 202602210004_data_room.sql
-- with permissive policy dd_documents_all. Drop and replace.
do $$
begin
  if to_regclass('public.dd_documents') is not null then
    -- Drop old permissive policy
    begin
      execute 'drop policy if exists "dd_documents_all" on public.dd_documents';
    exception when undefined_object then null;
    end;

    -- Service role bypass
    execute $p$
      create policy "dd_documents_service_bypass"
        on public.dd_documents
        for all
        using (current_setting('role') = 'service_role')
        with check (current_setting('role') = 'service_role')
    $p$;

    -- Authenticated: user assigned to project
    execute $p$
      create policy "dd_documents_select_assigned"
        on public.dd_documents
        for select
        using (
          exists (
            select 1 from public.dd_project_user_roles r
            where r.project_id = dd_documents.project_id
              and r.user_id = auth.uid()
              and r.is_active = true
              and (r.expires_at is null or r.expires_at > now())
          )
          or current_setting('role') = 'service_role'
        )
    $p$;
  end if;
end $$;

commit;
