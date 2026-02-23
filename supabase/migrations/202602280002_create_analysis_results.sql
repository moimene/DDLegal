-- ============================================================
-- Migration: Create dd_analysis_results
-- Accumulative table for skill analysis outputs per project.
-- Supports incremental upsert as new documents arrive.
-- Date: 2026-02-28
-- ============================================================

begin;

create table if not exists public.dd_analysis_results (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null,
  area             text not null,
  report_type      text not null,
  finding_key      text not null,
  structured_data  jsonb not null default '{}',
  evidence_refs    text[] default '{}',
  confidence_score numeric(3,2) default 0.00,
  version          integer not null default 1,
  source_skill     text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique(project_id, area, finding_key)
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.dd_analysis_results
    add constraint dd_analysis_results_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- RLS
alter table public.dd_analysis_results enable row level security;

create policy "dd_analysis_results_service_bypass"
  on public.dd_analysis_results for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_analysis_results_select_assigned"
  on public.dd_analysis_results for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_analysis_results.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- Indexes
create index if not exists idx_analysis_results_project_area
  on public.dd_analysis_results(project_id, area, report_type);

create index if not exists idx_analysis_results_updated
  on public.dd_analysis_results(project_id, updated_at desc);

commit;
