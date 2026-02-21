-- ============================================================
-- Migracion F3.1: Modulo de Negociacion de Contingencias
-- Crea las tablas dd_contingencies_ext, dd_spa_clause_library
-- y dd_contingency_clause_map para gestionar posiciones de
-- negociacion, clausulas SPA y su mapeo a contingencias.
-- Incluye indices, triggers updated_at y seed de clausulas.
-- Fecha: 2026-02-24
-- ============================================================

begin;

-- ============================================================
-- 0. Funcion reutilizable para trigger updated_at
--    Se crea si no existe para no romper otros modulos.
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. dd_contingencies_ext — Campos extendidos de negociacion
--    Relacion 1:1 con dd_contingencies via UNIQUE(contingency_id)
-- ============================================================
create table if not exists public.dd_contingencies_ext (
  id                  uuid primary key default gen_random_uuid(),
  contingency_id      uuid not null,
  buy_position        text,
  sell_position       text,
  treatment           text check (treatment in (
                        'indemnity','retention','escrow',
                        'price_adjustment','insurance','waiver'
                      )),
  cap_amount          numeric(15,2),
  basket_type         text check (basket_type in (
                        'deductible','tipping','mini_basket','none'
                      )),
  basket_amount       numeric(15,2),
  survival_months     integer,
  rwi_coverage        boolean default false,
  spa_clause_ref      text,
  negotiation_status  text default 'open' check (negotiation_status in (
                        'open','proposed','agreed','rejected','deferred'
                      )),
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (contingency_id)
);

-- FK: contingency_id -> dd_contingencies(id) CASCADE
do $$
begin
  alter table public.dd_contingencies_ext
    add constraint dd_contingencies_ext_contingency_id_fkey
    foreign key (contingency_id) references public.dd_contingencies(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- Indices para filtrado frecuente
create index if not exists idx_contingencies_ext_status
  on public.dd_contingencies_ext(negotiation_status);
create index if not exists idx_contingencies_ext_treatment
  on public.dd_contingencies_ext(treatment);

-- Trigger updated_at
drop trigger if exists trg_contingencies_ext_updated_at on public.dd_contingencies_ext;
create trigger trg_contingencies_ext_updated_at
  before update on public.dd_contingencies_ext
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- 2. dd_spa_clause_library — Biblioteca de clausulas SPA
-- ============================================================
create table if not exists public.dd_spa_clause_library (
  id             uuid primary key default gen_random_uuid(),
  clause_key     text not null unique,
  clause_type    text not null check (clause_type in (
                   'r_and_w','indemnity','limitation',
                   'condition_precedent','definition','boilerplate'
                 )),
  title          text not null,
  standard_text  text not null,
  area_code      text,
  version        integer default 1,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Indice por tipo de clausula
create index if not exists idx_spa_clause_type
  on public.dd_spa_clause_library(clause_type);

-- Trigger updated_at
drop trigger if exists trg_spa_clause_library_updated_at on public.dd_spa_clause_library;
create trigger trg_spa_clause_library_updated_at
  before update on public.dd_spa_clause_library
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- 3. dd_contingency_clause_map — Mapeo contingencia <-> clausula
-- ============================================================
create table if not exists public.dd_contingency_clause_map (
  id               uuid primary key default gen_random_uuid(),
  contingency_id   uuid not null,
  clause_key       text not null,
  merge_fields     jsonb default '{}',
  is_primary       boolean default false,
  created_at       timestamptz default now(),
  unique (contingency_id, clause_key)
);

-- FK: contingency_id -> dd_contingencies(id) CASCADE
do $$
begin
  alter table public.dd_contingency_clause_map
    add constraint dd_contingency_clause_map_contingency_id_fkey
    foreign key (contingency_id) references public.dd_contingencies(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- FK: clause_key -> dd_spa_clause_library(clause_key) CASCADE
do $$
begin
  alter table public.dd_contingency_clause_map
    add constraint dd_contingency_clause_map_clause_key_fkey
    foreign key (clause_key) references public.dd_spa_clause_library(clause_key) on delete cascade;
exception when duplicate_object then null;
end $$;

-- Indice para busqueda por clausula
create index if not exists idx_contingency_clause_map_clause
  on public.dd_contingency_clause_map(clause_key);

-- ============================================================
-- 4. Seed: Biblioteca estandar de clausulas SPA
--    Cubre escenarios comunes de DD legal en M&A
-- ============================================================
insert into public.dd_spa_clause_library
  (clause_key, clause_type, title, standard_text, area_code)
values
  -- R&W: Representaciones y Garantias
  ('r_and_w_general', 'r_and_w',
   'Representaciones y Garantias Generales',
   'El Vendedor declara y garantiza que, a la fecha de este Contrato y a la fecha de Cierre, las declaraciones contenidas en el Anexo de Representaciones y Garantias son verdaderas, completas y exactas en todos sus aspectos materiales.',
   null),

  ('r_and_w_mercantil', 'r_and_w',
   'R&W Mercantil — Sociedad y Organos',
   'El Vendedor declara y garantiza que la Sociedad esta debidamente constituida y vigente conforme a la legislacion aplicable, que su capital social esta integramente suscrito y desembolsado, y que no existen restricciones o gravamenes sobre las participaciones/acciones distintos de los aqui revelados.',
   'MERC'),

  ('r_and_w_laboral', 'r_and_w',
   'R&W Laboral — Relaciones Laborales',
   'El Vendedor declara y garantiza que la Sociedad cumple con la totalidad de sus obligaciones laborales y de Seguridad Social, que no existen procedimientos laborales pendientes o amenazados, y que el Anexo Laboral refleja fielmente la plantilla, condiciones y compromisos laborales vigentes.',
   'LAB'),

  ('r_and_w_fiscal', 'r_and_w',
   'R&W Fiscal — Obligaciones Tributarias',
   'El Vendedor declara y garantiza que la Sociedad ha presentado en tiempo y forma todas las declaraciones tributarias exigibles, que no existen actas de inspeccion abiertas ni liquidaciones pendientes distintas de las reveladas, y que las provisiones fiscales del Balance reflejan razonablemente las obligaciones tributarias.',
   'FISC'),

  ('r_and_w_contable', 'r_and_w',
   'R&W Contable — Estados Financieros',
   'El Vendedor declara y garantiza que los Estados Financieros Auditados adjuntos como Anexo reflejan la imagen fiel del patrimonio, la situacion financiera y los resultados de la Sociedad, habiendo sido preparados de conformidad con los principios contables generalmente aceptados aplicados de manera consistente.',
   'CONTA'),

  -- Indemnidad
  ('general_indemnity', 'indemnity',
   'Indemnidad General',
   'El Vendedor se obliga a indemnizar y mantener indemne al Comprador frente a cualesquiera Perdidas que resulten de o esten relacionadas con cualquier incumplimiento de las Representaciones y Garantias contenidas en este Contrato, sujeto a las limitaciones establecidas en la Clausula de Limitaciones.',
   null),

  ('specific_indemnity', 'indemnity',
   'Indemnidad Especifica',
   'Sin perjuicio de las limitaciones generales, el Vendedor indemnizara al Comprador, euro por euro y sin sujecion a Basket ni Cap, por cualesquiera Perdidas derivadas de las Contingencias Especificas identificadas en el Anexo de Indemnidades Especificas.',
   null),

  ('tax_indemnity', 'indemnity',
   'Indemnidad Fiscal',
   'El Vendedor indemnizara al Comprador frente a cualquier Pasivo Fiscal de la Sociedad correspondiente a periodos impositivos anteriores a la Fecha de Cierre, incluyendo ajustes, sanciones e intereses derivados de inspecciones o regularizaciones tributarias, en los terminos previstos en el Pacto Fiscal adjunto.',
   'FISC'),

  -- Limitaciones
  ('cap_general', 'limitation',
   'Cap General de Responsabilidad',
   'La responsabilidad maxima agregada del Vendedor por incumplimiento de las Representaciones y Garantias Generales no excedera de un importe equivalente al {{cap_percentage}}% del Precio, es decir, {{cap_amount}} EUR (el "Cap").',
   null),

  ('basket_deductible', 'limitation',
   'Basket Tipo Deductible',
   'El Comprador no podra reclamar indemnizacion alguna por incumplimiento de Representaciones y Garantias hasta que el importe agregado de las Perdidas supere {{basket_amount}} EUR (el "Basket"), y en tal caso solo podra reclamar el exceso sobre dicho importe.',
   null),

  ('basket_tipping', 'limitation',
   'Basket Tipo Tipping (First Dollar)',
   'El Comprador no podra reclamar indemnizacion hasta que las Perdidas agregadas superen {{basket_amount}} EUR; alcanzado dicho umbral, el Comprador podra reclamar la totalidad de las Perdidas desde el primer euro.',
   null),

  ('time_limitation', 'limitation',
   'Limitacion Temporal de Reclamaciones',
   'Cualquier reclamacion por incumplimiento de Representaciones y Garantias debera notificarse por escrito al Vendedor antes del vencimiento de los {{survival_months}} meses siguientes a la Fecha de Cierre, salvo las Representaciones Fundamentales cuyo plazo de supervivencia sera el establecido por ley.',
   null),

  -- Condiciones precedentes
  ('regulatory_approval', 'condition_precedent',
   'Aprobacion Regulatoria',
   'El Cierre estara condicionado a la obtencion de la autorizacion de {{regulatory_body}}, en terminos razonablemente satisfactorios para el Comprador, sin imposicion de condiciones o remedios que constituyan un Efecto Material Adverso.',
   null),

  ('third_party_consent', 'condition_precedent',
   'Consentimiento de Terceros',
   'El Cierre estara condicionado a la obtencion de los consentimientos y/o renuncias de terceros identificados en el Anexo de Consentimientos Requeridos, incluyendo sin limitacion los derivados de clausulas de cambio de control.',
   'CONT'),

  -- Definiciones clave
  ('material_adverse_change', 'definition',
   'Efecto Material Adverso (MAC)',
   '"Efecto Material Adverso" significa cualquier hecho, circunstancia, cambio o efecto que, individualmente o en su conjunto, tenga o razonablemente pueda tener un impacto negativo material en el negocio, activos, situacion financiera o resultados de la Sociedad, excluyendo los efectos derivados de: (i) cambios en las condiciones economicas generales, (ii) cambios en la legislacion aplicable, y (iii) los hechos ya revelados en la Due Diligence.',
   null),

  ('permitted_leakage', 'definition',
   'Filtracion Permitida (Permitted Leakage)',
   '"Filtracion Permitida" significa exclusivamente los conceptos enumerados en el Anexo de Filtraciones Permitidas, incluyendo: (i) retribuciones ordinarias de administradores y empleados conforme a politica vigente, (ii) pagos bajo contratos intragrupo en condiciones de mercado revelados, y (iii) impuestos devengados en el curso ordinario del negocio.',
   null)

on conflict (clause_key) do nothing;

commit;
