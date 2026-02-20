begin;

do $$
begin
  if to_regclass('public.dd_tasks') is not null then
    alter table public.dd_tasks
      add column if not exists client_visible boolean not null default false,
      add column if not exists hitl_reviewed_at timestamptz,
      add column if not exists hitl_reviewed_by text;
  end if;

  if to_regclass('public.dd_contingencies') is not null then
    alter table public.dd_contingencies
      add column if not exists client_visible boolean not null default false;
  end if;

  if to_regclass('public.dd_qa') is not null then
    alter table public.dd_qa
      add column if not exists client_visible boolean not null default false;
  end if;

  if to_regclass('public.dd_deliverables') is not null then
    alter table public.dd_deliverables
      add column if not exists client_visible boolean not null default false;
  end if;
end $$;

create table if not exists public.dd_hitl_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  project_id uuid not null,
  decision text not null check (decision in ('approve', 'correct', 'reject')),
  note text null,
  previous_status text null,
  new_status text null,
  previous_ai_status text null,
  new_ai_status text null,
  decided_by text null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.dd_tasks') is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'dd_hitl_decisions_task_id_fkey'
  ) then
    alter table public.dd_hitl_decisions
      add constraint dd_hitl_decisions_task_id_fkey
      foreign key (task_id)
      references public.dd_tasks(id)
      on delete cascade;
  end if;

  if to_regclass('public.dd_projects') is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'dd_hitl_decisions_project_id_fkey'
  ) then
    alter table public.dd_hitl_decisions
      add constraint dd_hitl_decisions_project_id_fkey
      foreign key (project_id)
      references public.dd_projects(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_dd_hitl_decisions_task_id on public.dd_hitl_decisions(task_id);
create index if not exists idx_dd_hitl_decisions_project_id on public.dd_hitl_decisions(project_id);
create index if not exists idx_dd_hitl_decisions_decided_at on public.dd_hitl_decisions(decided_at desc);

do $$
begin
  if to_regclass('public.dd_tasks') is not null then
    execute $q$
      update public.dd_tasks
      set client_visible = true
      where status in ('blocked', 'completed')
    $q$;
  end if;

  if to_regclass('public.dd_contingencies') is not null then
    execute $q$
      update public.dd_contingencies
      set client_visible = true
      where status in ('identified', 'confirmed')
    $q$;
  end if;
end $$;

commit;

