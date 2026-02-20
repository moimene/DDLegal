-- Migration: tools_evidence_skills
-- Purpose: Create microtools, evidence anchoring, and skills catalog tables
-- Date: 2026-02-20

begin;

-- ============================================================
-- 1. dd_evidence — Evidence anchoring layer
-- Links every finding/recommendation to a source document
-- ============================================================
create table if not exists public.dd_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  tool_execution_id uuid null,
  task_id uuid null,
  contingency_id uuid null,
  source_type text not null check (source_type in (
    'document', 'registry_scrape', 'api_response', 'manual_entry', 'ai_output'
  )),
  source_reference text not null,
  source_name text null,
  page_range text null,
  snippet text null,
  snippet_hash text null,
  confidence_score numeric(3,2) null check (confidence_score between 0 and 1),
  metadata jsonb null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dd_evidence_project_id on public.dd_evidence(project_id);
create index if not exists idx_dd_evidence_tool_execution_id on public.dd_evidence(tool_execution_id);
create index if not exists idx_dd_evidence_task_id on public.dd_evidence(task_id);
create index if not exists idx_dd_evidence_source_type on public.dd_evidence(source_type);

-- ============================================================
-- 2. dd_skills_catalog — Skills per DD area
-- ============================================================
create table if not exists public.dd_skills_catalog (
  id uuid primary key default gen_random_uuid(),
  area_code text not null,
  area_id uuid null,
  skill_key text not null unique,
  name text not null,
  description text null,
  category text not null check (category in (
    'verificacion', 'analisis', 'extraccion', 'generacion', 'monitorizacion'
  )),
  prompt_template text not null,
  expected_output_schema jsonb null,
  evidence_requirements jsonb null default '[]',
  agent_pipeline text[] null default '{}',
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dd_skills_catalog_area_code on public.dd_skills_catalog(area_code);
create index if not exists idx_dd_skills_catalog_category on public.dd_skills_catalog(category);

-- ============================================================
-- 3. dd_tools — Registry of available microtools
-- ============================================================
create table if not exists public.dd_tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text null,
  icon text null,
  area_codes text[] not null default '{}',
  input_schema jsonb null,
  output_schema jsonb null,
  skills_used text[] null default '{}',
  requires_project boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. dd_tool_executions — Execution log for microtools
-- ============================================================
create table if not exists public.dd_tool_executions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null,
  project_id uuid null,
  input_params jsonb not null default '{}',
  output_data jsonb null,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'error', 'cancelled'
  )),
  error_message text null,
  executed_by text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  duration_ms integer null,
  evidence_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_dd_tool_executions_tool_id on public.dd_tool_executions(tool_id);
create index if not exists idx_dd_tool_executions_project_id on public.dd_tool_executions(project_id);
create index if not exists idx_dd_tool_executions_status on public.dd_tool_executions(status);
create index if not exists idx_dd_tool_executions_created_at on public.dd_tool_executions(created_at desc);

-- ============================================================
-- 5. dd_tool_project_links — Links tool results to DD projects
-- ============================================================
create table if not exists public.dd_tool_project_links (
  id uuid primary key default gen_random_uuid(),
  tool_execution_id uuid not null,
  project_id uuid not null,
  linked_by text null,
  linked_at timestamptz not null default now(),
  notes text null,
  unique(tool_execution_id, project_id)
);

create index if not exists idx_dd_tool_project_links_project_id on public.dd_tool_project_links(project_id);
create index if not exists idx_dd_tool_project_links_exec_id on public.dd_tool_project_links(tool_execution_id);

-- ============================================================
-- Foreign keys (conditional, safe)
-- ============================================================
do $$
begin
  if to_regclass('public.dd_projects') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_evidence_project_id_fkey'
  ) then
    alter table public.dd_evidence
      add constraint dd_evidence_project_id_fkey
      foreign key (project_id) references public.dd_projects(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dd_evidence_tool_execution_id_fkey'
  ) then
    alter table public.dd_evidence
      add constraint dd_evidence_tool_execution_id_fkey
      foreign key (tool_execution_id) references public.dd_tool_executions(id) on delete cascade;
  end if;

  if to_regclass('public.dd_tasks') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_evidence_task_id_fkey'
  ) then
    alter table public.dd_evidence
      add constraint dd_evidence_task_id_fkey
      foreign key (task_id) references public.dd_tasks(id) on delete set null;
  end if;

  if to_regclass('public.dd_contingencies') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_evidence_contingency_id_fkey'
  ) then
    alter table public.dd_evidence
      add constraint dd_evidence_contingency_id_fkey
      foreign key (contingency_id) references public.dd_contingencies(id) on delete set null;
  end if;

  if to_regclass('public.dd_areas') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_skills_catalog_area_id_fkey'
  ) then
    alter table public.dd_skills_catalog
      add constraint dd_skills_catalog_area_id_fkey
      foreign key (area_id) references public.dd_areas(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dd_tool_executions_tool_id_fkey'
  ) then
    alter table public.dd_tool_executions
      add constraint dd_tool_executions_tool_id_fkey
      foreign key (tool_id) references public.dd_tools(id) on delete cascade;
  end if;

  if to_regclass('public.dd_projects') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_tool_executions_project_id_fkey'
  ) then
    alter table public.dd_tool_executions
      add constraint dd_tool_executions_project_id_fkey
      foreign key (project_id) references public.dd_projects(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dd_tool_project_links_exec_id_fkey'
  ) then
    alter table public.dd_tool_project_links
      add constraint dd_tool_project_links_exec_id_fkey
      foreign key (tool_execution_id) references public.dd_tool_executions(id) on delete cascade;
  end if;

  if to_regclass('public.dd_projects') is not null and not exists (
    select 1 from pg_constraint where conname = 'dd_tool_project_links_project_id_fkey'
  ) then
    alter table public.dd_tool_project_links
      add constraint dd_tool_project_links_project_id_fkey
      foreign key (project_id) references public.dd_projects(id) on delete cascade;
  end if;
end $$;

commit;
