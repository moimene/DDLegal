-- ============================================================
-- Migration: Create dd_report_cache and dd_report_versions
-- Level-2 cache for generated reports (skip re-generation).
-- Versioned history for audit trail.
-- Date: 2026-02-28
-- ============================================================

begin;

-- dd_report_cache — active cache keyed by evidence_hash
create table if not exists public.dd_report_cache (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null,
  report_type    text not null,
  evidence_hash  text not null,
  html_content   text,
  md_content     text,
  json_output    jsonb,
  is_valid       boolean default true,
  created_at     timestamptz default now(),
  valid_until    timestamptz not null,

  unique(project_id, report_type, evidence_hash)
);

do $$
begin
  alter table public.dd_report_cache
    add constraint dd_report_cache_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.dd_report_cache enable row level security;

create policy "dd_report_cache_service_bypass"
  on public.dd_report_cache for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_report_cache_select_assigned"
  on public.dd_report_cache for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_report_cache.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

create index if not exists idx_report_cache_lookup
  on public.dd_report_cache(project_id, report_type, is_valid);

-- dd_report_versions — immutable history
create table if not exists public.dd_report_versions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null,
  report_type    text not null,
  version        integer not null default 1,
  json_output    jsonb not null,
  html_content   text,
  md_content     text,
  evidence_hash  text not null,
  generated_by   text default 'system',
  created_at     timestamptz default now(),

  unique(project_id, report_type, version)
);

do $$
begin
  alter table public.dd_report_versions
    add constraint dd_report_versions_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.dd_report_versions enable row level security;

create policy "dd_report_versions_service_bypass"
  on public.dd_report_versions for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_report_versions_select_assigned"
  on public.dd_report_versions for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_report_versions.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

create index if not exists idx_report_versions_project
  on public.dd_report_versions(project_id, report_type, version desc);

commit;
