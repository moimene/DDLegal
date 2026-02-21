-- ============================================================
-- Migracion F4.1: Audit Log y Domain Enums
-- Crea las tablas dd_audit_log y dd_domain_enums para
-- gobernanza enterprise (Fase 4). dd_audit_log registra
-- acciones significativas del sistema; dd_domain_enums
-- almacena enumeraciones y dominios configurables.
-- Incluye indices, trigger updated_at y seed de dominios.
-- Fecha: 2026-02-25
-- ============================================================

begin;

-- ============================================================
-- 1. dd_audit_log — Tracking de acciones significativas
-- ============================================================
create table if not exists public.dd_audit_log (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid,
  user_id       uuid,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  details       jsonb default '{}',
  ip_address    text,
  user_agent    text,
  created_at    timestamptz default now()
);

-- FK: project_id -> dd_projects(id) CASCADE (NULL para eventos de sistema)
do $$
begin
  alter table public.dd_audit_log
    add constraint dd_audit_log_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- Indices para consultas frecuentes
create index if not exists idx_audit_log_project
  on public.dd_audit_log(project_id, created_at desc);
create index if not exists idx_audit_log_user
  on public.dd_audit_log(user_id, created_at desc);
create index if not exists idx_audit_log_entity
  on public.dd_audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_action
  on public.dd_audit_log(action);

-- ============================================================
-- 2. dd_domain_enums — Enumeraciones y dominios configurables
-- ============================================================
create table if not exists public.dd_domain_enums (
  id          uuid primary key default gen_random_uuid(),
  domain      text not null,
  code        text not null,
  label       text not null,
  label_en    text,
  color       text,
  icon        text,
  sort_order  integer default 0,
  is_active   boolean default true,
  metadata    jsonb default '{}',
  version     integer default 1,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (domain, code)
);

-- Indices para filtrado y ordenacion
create index if not exists idx_domain_enums_domain
  on public.dd_domain_enums(domain, sort_order);
create index if not exists idx_domain_enums_active
  on public.dd_domain_enums(domain) where is_active = true;

-- Trigger updated_at (la funcion update_updated_at_column ya existe)
drop trigger if exists trg_domain_enums_updated_at on public.dd_domain_enums;
create trigger trg_domain_enums_updated_at
  before update on public.dd_domain_enums
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- 3. Seed: Dominios y enumeraciones del sistema
-- ============================================================

-- Dominio: severity (Severidad de contingencias)
insert into public.dd_domain_enums (domain, code, label, color, sort_order)
values
  ('severity', 'critical', 'Crítica',  '#EF4444', 0),
  ('severity', 'high',     'Alta',     '#F97316', 1),
  ('severity', 'medium',   'Media',    '#EAB308', 2),
  ('severity', 'low',      'Baja',     '#6B7280', 3)
on conflict (domain, code) do nothing;

-- Dominio: task_status (Estados de tareas)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('task_status', 'pending',     'Pendiente',   0),
  ('task_status', 'in_progress', 'En Progreso', 1),
  ('task_status', 'review',      'En Revisión', 2),
  ('task_status', 'completed',   'Completada',  3),
  ('task_status', 'blocked',     'Bloqueada',   4)
on conflict (domain, code) do nothing;

-- Dominio: contingency_category (Categorias de contingencias)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('contingency_category', 'societario',      'Societario',             0),
  ('contingency_category', 'laboral',         'Laboral',                1),
  ('contingency_category', 'fiscal',          'Fiscal',                 2),
  ('contingency_category', 'contractual',     'Contractual',            3),
  ('contingency_category', 'regulatorio',     'Regulatorio',            4),
  ('contingency_category', 'medioambiental',  'Medioambiental',         5),
  ('contingency_category', 'litigioso',       'Litigioso',              6),
  ('contingency_category', 'ip',              'Propiedad Intelectual',  7)
on conflict (domain, code) do nothing;

-- Dominio: treatment_type (Tipos de tratamiento en negociacion)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('treatment_type', 'indemnity',         'Indemnización',     0),
  ('treatment_type', 'retention',         'Retención',         1),
  ('treatment_type', 'escrow',            'Escrow',            2),
  ('treatment_type', 'price_adjustment',  'Ajuste de Precio',  3),
  ('treatment_type', 'insurance',         'Seguro R&W',        4),
  ('treatment_type', 'waiver',            'Renuncia',          5)
on conflict (domain, code) do nothing;

-- Dominio: negotiation_status (Estados de negociacion)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('negotiation_status', 'open',      'Abierto',    0),
  ('negotiation_status', 'proposed',  'Propuesto',  1),
  ('negotiation_status', 'agreed',    'Acordado',   2),
  ('negotiation_status', 'rejected',  'Rechazado',  3),
  ('negotiation_status', 'deferred',  'Diferido',   4)
on conflict (domain, code) do nothing;

-- Dominio: report_category (Categorias de informes)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('report_category', 'operational',    'Operativo',       0),
  ('report_category', 'workstream',     'Workstream',      1),
  ('report_category', 'consolidated',   'Consolidado',     2),
  ('report_category', 'transactional',  'Transaccional',   3),
  ('report_category', 'final',          'Final',           4),
  ('report_category', 'negotiation',    'Negociación',     5)
on conflict (domain, code) do nothing;

-- Dominio: visibility (Niveles de visibilidad)
insert into public.dd_domain_enums (domain, code, label, sort_order)
values
  ('visibility', 'internal',      'Interno',       0),
  ('visibility', 'client',        'Cliente',       1),
  ('visibility', 'deal_team',     'Deal Team',     2),
  ('visibility', 'counterparty',  'Contraparte',   3),
  ('visibility', 'committee',     'Comité',        4)
on conflict (domain, code) do nothing;

commit;
