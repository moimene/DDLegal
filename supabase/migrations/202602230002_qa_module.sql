-- ============================================================
-- Migration: QA Module — Question & Answer tracking
-- Creates qa_threads, qa_messages, qa_assignments, qa_slas,
-- qa_links with RLS via dd_project_user_roles.
-- Date: 2026-02-23
-- ============================================================

begin;

-- ============================================================
-- 1. qa_threads — Top-level Q&A threads per project/area
-- ============================================================
create table if not exists public.qa_threads (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null,
  area_code               text null,
  thread_number           serial,
  subject                 text not null,
  priority                text default 'medium'
    check (priority in ('critical','high','medium','low')),
  status                  text not null default 'draft'
    check (status in ('draft','sent','pending_response','answered','follow_up','escalated','closed')),
  source                  text default 'manual'
    check (source in ('manual','ai_generated','gap_analysis','cross_check')),
  assigned_to             uuid null,
  due_date                timestamptz null,
  sla_hours               integer null,
  sla_breached            boolean default false,
  client_visible          boolean default false,
  related_task_id         uuid null,
  related_contingency_id  uuid null,
  tags                    text[] default '{}',
  created_by              uuid null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.qa_threads
    add constraint qa_threads_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_qa_threads_project_id on public.qa_threads(project_id);
create index if not exists idx_qa_threads_status on public.qa_threads(status);
create index if not exists idx_qa_threads_priority on public.qa_threads(priority);
create index if not exists idx_qa_threads_area_code on public.qa_threads(area_code);

-- ============================================================
-- 2. qa_messages — Messages within a thread
-- ============================================================
create table if not exists public.qa_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  sender_role text not null
    check (sender_role in ('advisor','target','system','ai')),
  sender_id   uuid null,
  content     text not null,
  attachments jsonb default '[]',
  is_internal boolean default false,
  created_at  timestamptz not null default now()
);

-- FK: thread_id -> qa_threads(id) CASCADE
do $$
begin
  alter table public.qa_messages
    add constraint qa_messages_thread_id_fkey
    foreign key (thread_id) references public.qa_threads(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_qa_messages_thread_id on public.qa_messages(thread_id);

-- ============================================================
-- 3. qa_assignments — Default routing per area
-- ============================================================
create table if not exists public.qa_assignments (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null,
  area_code              text not null,
  default_assignee       uuid null,
  sla_hours              integer default 48,
  escalation_after_hours integer default 72,
  escalation_to          uuid null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique(project_id, area_code)
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.qa_assignments
    add constraint qa_assignments_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 4. qa_slas — SLA tracking per thread
-- ============================================================
create table if not exists public.qa_slas (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null,
  sla_type   text not null
    check (sla_type in ('response','resolution','escalation')),
  target_at  timestamptz not null,
  actual_at  timestamptz null,
  is_met     boolean null,
  created_at timestamptz not null default now()
);

-- FK: thread_id -> qa_threads(id) CASCADE
do $$
begin
  alter table public.qa_slas
    add constraint qa_slas_thread_id_fkey
    foreign key (thread_id) references public.qa_threads(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 5. qa_links — Cross-entity links from threads
-- ============================================================
create table if not exists public.qa_links (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  entity_type text not null
    check (entity_type in ('task','contingency','document_version','evidence','report')),
  entity_id   uuid not null,
  link_type   text not null default 'related'
    check (link_type in ('related','blocking','caused_by')),
  created_at  timestamptz not null default now(),
  unique(thread_id, entity_type, entity_id)
);

-- FK: thread_id -> qa_threads(id) CASCADE
do $$
begin
  alter table public.qa_links
    add constraint qa_links_thread_id_fkey
    foreign key (thread_id) references public.qa_threads(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 6. RLS — Role-based access on all QA tables
-- ============================================================

-- ----- qa_threads -----
alter table public.qa_threads enable row level security;

create policy "qa_threads_service_bypass"
  on public.qa_threads for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "qa_threads_select_assigned"
  on public.qa_threads for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = qa_threads.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- qa_messages -----
alter table public.qa_messages enable row level security;

create policy "qa_messages_service_bypass"
  on public.qa_messages for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "qa_messages_select_assigned"
  on public.qa_messages for select
  using (
    exists (
      select 1 from public.qa_threads qt
      join public.dd_project_user_roles r on r.project_id = qt.project_id
      where qt.id = qa_messages.thread_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- qa_assignments -----
alter table public.qa_assignments enable row level security;

create policy "qa_assignments_service_bypass"
  on public.qa_assignments for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "qa_assignments_select_assigned"
  on public.qa_assignments for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = qa_assignments.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- qa_slas -----
alter table public.qa_slas enable row level security;

create policy "qa_slas_service_bypass"
  on public.qa_slas for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "qa_slas_select_assigned"
  on public.qa_slas for select
  using (
    exists (
      select 1 from public.qa_threads qt
      join public.dd_project_user_roles r on r.project_id = qt.project_id
      where qt.id = qa_slas.thread_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- qa_links -----
alter table public.qa_links enable row level security;

create policy "qa_links_service_bypass"
  on public.qa_links for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "qa_links_select_assigned"
  on public.qa_links for select
  using (
    exists (
      select 1 from public.qa_threads qt
      join public.dd_project_user_roles r on r.project_id = qt.project_id
      where qt.id = qa_links.thread_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

commit;
