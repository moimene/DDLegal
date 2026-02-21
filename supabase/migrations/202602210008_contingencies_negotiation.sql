-- Negotiation module: contingencies_ext, SPA clause library, clause mapping
-- Applied to Supabase 2026-02-21

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.dd_contingencies_ext (
  id                  uuid primary key default gen_random_uuid(),
  contingency_id      uuid not null references dd_contingencies(id) on delete cascade,
  buy_position        text,
  sell_position       text,
  treatment           text check (treatment in ('indemnity','retention','escrow','price_adjustment','insurance','waiver')),
  cap_amount          numeric(15,2),
  basket_type         text check (basket_type in ('deductible','tipping','mini_basket','none')),
  basket_amount       numeric(15,2),
  survival_months     integer,
  rwi_coverage        boolean default false,
  spa_clause_ref      text,
  negotiation_status  text default 'open' check (negotiation_status in ('open','proposed','agreed','rejected','deferred')),
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (contingency_id)
);

create index if not exists idx_contingencies_ext_status on dd_contingencies_ext(negotiation_status);
create index if not exists idx_contingencies_ext_treatment on dd_contingencies_ext(treatment);

drop trigger if exists trg_contingencies_ext_updated_at on dd_contingencies_ext;
create trigger trg_contingencies_ext_updated_at
  before update on dd_contingencies_ext for each row execute function update_updated_at_column();

create table if not exists public.dd_spa_clause_library (
  id             uuid primary key default gen_random_uuid(),
  clause_key     text not null unique,
  clause_type    text not null check (clause_type in ('r_and_w','indemnity','limitation','condition_precedent','definition','boilerplate')),
  title          text not null,
  standard_text  text not null,
  area_code      text,
  version        integer default 1,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_spa_clause_type on dd_spa_clause_library(clause_type);

drop trigger if exists trg_spa_clause_library_updated_at on dd_spa_clause_library;
create trigger trg_spa_clause_library_updated_at
  before update on dd_spa_clause_library for each row execute function update_updated_at_column();

create table if not exists public.dd_contingency_clause_map (
  id               uuid primary key default gen_random_uuid(),
  contingency_id   uuid not null references dd_contingencies(id) on delete cascade,
  clause_key       text not null references dd_spa_clause_library(clause_key) on delete cascade,
  merge_fields     jsonb default '{}',
  is_primary       boolean default false,
  created_at       timestamptz default now(),
  unique (contingency_id, clause_key)
);

create index if not exists idx_contingency_clause_map_clause on dd_contingency_clause_map(clause_key);

-- Seed SPA clauses
insert into dd_spa_clause_library (clause_key, clause_type, title, standard_text, area_code) values
  ('r_and_w_general', 'r_and_w', 'Representaciones y Garantias Generales', 'El Vendedor declara y garantiza...', null),
  ('r_and_w_mercantil', 'r_and_w', 'R&W Mercantil', 'Sociedad debidamente constituida...', 'MERC'),
  ('r_and_w_laboral', 'r_and_w', 'R&W Laboral', 'Cumplimiento obligaciones laborales...', 'LAB'),
  ('r_and_w_fiscal', 'r_and_w', 'R&W Fiscal', 'Declaraciones tributarias en tiempo...', 'FISC'),
  ('r_and_w_contable', 'r_and_w', 'R&W Contable', 'Estados Financieros imagen fiel...', 'CONTA'),
  ('general_indemnity', 'indemnity', 'Indemnidad General', 'Vendedor indemniza frente a Perdidas...', null),
  ('specific_indemnity', 'indemnity', 'Indemnidad Especifica', 'Sin sujecion a Basket ni Cap...', null),
  ('tax_indemnity', 'indemnity', 'Indemnidad Fiscal', 'Pasivo Fiscal periodos anteriores...', 'FISC'),
  ('cap_general', 'limitation', 'Cap General', 'Responsabilidad maxima agregada...', null),
  ('basket_deductible', 'limitation', 'Basket Deductible', 'Solo exceso sobre basket_amount...', null),
  ('basket_tipping', 'limitation', 'Basket Tipping', 'Totalidad desde primer euro...', null),
  ('time_limitation', 'limitation', 'Limitacion Temporal', 'Notificacion antes de survival_months...', null),
  ('regulatory_approval', 'condition_precedent', 'Aprobacion Regulatoria', 'Autorizacion regulatory_body...', null),
  ('third_party_consent', 'condition_precedent', 'Consentimiento Terceros', 'Clausulas cambio de control...', 'CONT'),
  ('material_adverse_change', 'definition', 'Efecto Material Adverso (MAC)', 'Impacto negativo material...', null),
  ('permitted_leakage', 'definition', 'Filtracion Permitida', 'Conceptos enumerados en Anexo...', null)
on conflict (clause_key) do nothing;
