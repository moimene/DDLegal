-- ============================================================
-- Migration: Phase 1 — Seed Demo Project & Test User Roles
-- Creates one demo project and 7 test role assignments.
-- Idempotent: safe to re-run.
--
-- IMPORTANT: The user_id UUIDs below are PLACEHOLDERS.
-- Real auth.users records must be created via:
--   1. Supabase Auth Dashboard > Users > "Add user"
--   2. Supabase Management API: POST /auth/v1/admin/users
--   3. supabase.auth.admin.createUser() in server code
--
-- After creating real users, UPDATE dd_project_user_roles
-- SET user_id = <real_uuid> WHERE user_id = <placeholder_uuid>
-- ============================================================

begin;

-- ============================================================
-- 1. Insert demo project (idempotent via ON CONFLICT)
-- ============================================================
-- We use a deterministic UUID so the seed is fully idempotent
-- and role assignments can reference it reliably.
do $$
declare
  v_project_id uuid := 'a1b2c3d4-0001-4000-8000-000000000001';
begin
  insert into public.dd_projects (
    id,
    name,
    target_company,
    target_sector,
    deal_type,
    status,
    review_depth,
    client_name
  ) values (
    v_project_id,
    'FMC Due Diligence - Prototipo',
    'FMC Corporation S.L.',
    'Industrial',
    'acquisition',
    'active',
    'standard',
    'Garrigues'
  )
  on conflict (id) do nothing;
end $$;

-- ============================================================
-- 2. Insert test user role assignments
-- ============================================================
-- Placeholder UUIDs for 7 test users.
-- These follow a deterministic pattern so they can be easily
-- found and replaced once real auth.users are created.
--
-- Placeholder user mapping:
--   user_clo              = bbbb0001-0001-4000-8000-000000000001
--   user_pm_transaccion   = bbbb0001-0002-4000-8000-000000000002
--   user_abogado_merc     = bbbb0001-0003-4000-8000-000000000003
--   user_abogado_lab      = bbbb0001-0004-4000-8000-000000000004
--   user_deal_sponsor     = bbbb0001-0005-4000-8000-000000000005
--   user_stakeholder      = bbbb0001-0006-4000-8000-000000000006
--   user_cliente_externo  = bbbb0001-0007-4000-8000-000000000007
-- ============================================================

do $$
declare
  v_project_id          uuid := 'a1b2c3d4-0001-4000-8000-000000000001';
  v_user_clo            uuid := 'bbbb0001-0001-4000-8000-000000000001';
  v_user_pm             uuid := 'bbbb0001-0002-4000-8000-000000000002';
  v_user_abogado_merc   uuid := 'bbbb0001-0003-4000-8000-000000000003';
  v_user_abogado_lab    uuid := 'bbbb0001-0004-4000-8000-000000000004';
  v_user_deal_sponsor   uuid := 'bbbb0001-0005-4000-8000-000000000005';
  v_user_stakeholder    uuid := 'bbbb0001-0006-4000-8000-000000000006';
  v_user_cliente        uuid := 'bbbb0001-0007-4000-8000-000000000007';
begin
  -- 1. CLO — Chief Legal Officer (global access, no area scope)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_clo, 'clo', null, true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 2. PM Transaccion — Project manager (global access)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_pm, 'pm_transaccion', null, true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 3. Abogado Area — Mercantil (scoped to MERC)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_abogado_merc, 'abogado_area', 'MERC', true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 4. Abogado Area — Laboral (scoped to LAB)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_abogado_lab, 'abogado_area', 'LAB', true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 5. Deal Sponsor — Business side (global access)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_deal_sponsor, 'deal_sponsor', null, true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 6. Stakeholder Negocio (global access)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_stakeholder, 'stakeholder_negocio', null, true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;

  -- 7. Cliente Externo — External client (global access, limited visibility)
  insert into public.dd_project_user_roles
    (project_id, user_id, role, area_code, is_active)
  values
    (v_project_id, v_user_cliente, 'cliente_externo', null, true)
  on conflict (project_id, user_id, role, area_code)
    do nothing;
end $$;

commit;
