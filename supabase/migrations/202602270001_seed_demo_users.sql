-- ============================================================
-- Migration: Seed Demo Users in auth.users + Project Roles
-- Creates 7 demo users + 1 admin superuser with bcrypt passwords.
-- Also creates demo project and assigns roles.
-- Idempotent: ON CONFLICT DO NOTHING.
-- ============================================================

begin;

-- 1. Create demo project
INSERT INTO public.dd_projects (id, name, target_company, project_type, status, metadata)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'FMC Due Diligence - Prototipo',
  'FMC Corporation S.L.',
  'acquisition',
  'active',
  '{"target_sector": "Industrial", "deal_type": "acquisition", "review_depth": "standard", "client_name": "Garrigues"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create auth users (password: test123456 for demo, admin123456 for admin)
DO $$
DECLARE
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_demo_password text;
  v_admin_password text;
BEGIN
  v_demo_password := crypt('test123456', gen_salt('bf'));
  v_admin_password := crypt('admin123456', gen_salt('bf'));

  -- Superusuario Admin
  -- NOTE: email_change MUST be '' not NULL — GoTrue scans it as string
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'admin@ddlegal.com', v_admin_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Superusuario Admin","role":"admin","is_test_user":false}'::jsonb, now(), now(), '', '', '', '', true)
  ON CONFLICT (id) DO NOTHING;

  -- CLO / Director Legal
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0001-4000-8000-000000000001', 'authenticated', 'authenticated', 'clo@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Director Legal (CLO)","role":"clo","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- PM Transaccion
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0002-4000-8000-000000000002', 'authenticated', 'authenticated', 'pm@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PM Transaccion","role":"pm_transaccion","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- Abogado Mercantil
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0003-4000-8000-000000000003', 'authenticated', 'authenticated', 'abogado.merc@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Abogado Mercantil","role":"abogado_area","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- Deal Sponsor
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0004-4000-8000-000000000004', 'authenticated', 'authenticated', 'sponsor@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Deal Sponsor","role":"deal_sponsor","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- Contacto Target
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0005-4000-8000-000000000005', 'authenticated', 'authenticated', 'target@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contacto Target","role":"target_liaison","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- Stakeholder Negocio
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0006-4000-8000-000000000006', 'authenticated', 'authenticated', 'stakeholder@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Stakeholder Negocio","role":"stakeholder_negocio","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;

  -- Cliente Externo
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_super_admin)
  VALUES (v_instance_id, 'aaaa0001-0007-4000-8000-000000000007', 'authenticated', 'authenticated', 'cliente@test.ddlegal.com', v_demo_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Cliente Externo","role":"cliente_externo","is_test_user":true}'::jsonb, now(), now(), '', '', '', '', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 3. Create auth.identities (required for email login)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaa0001-0000-4000-8000-000000000000', 'admin@ddlegal.com', '{"sub":"aaaa0001-0000-4000-8000-000000000000","email":"admin@ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0001-4000-8000-000000000001', 'clo@test.ddlegal.com', '{"sub":"aaaa0001-0001-4000-8000-000000000001","email":"clo@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0002-4000-8000-000000000002', 'pm@test.ddlegal.com', '{"sub":"aaaa0001-0002-4000-8000-000000000002","email":"pm@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0003-4000-8000-000000000003', 'abogado.merc@test.ddlegal.com', '{"sub":"aaaa0001-0003-4000-8000-000000000003","email":"abogado.merc@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0004-4000-8000-000000000004', 'sponsor@test.ddlegal.com', '{"sub":"aaaa0001-0004-4000-8000-000000000004","email":"sponsor@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0005-4000-8000-000000000005', 'target@test.ddlegal.com', '{"sub":"aaaa0001-0005-4000-8000-000000000005","email":"target@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0006-4000-8000-000000000006', 'stakeholder@test.ddlegal.com', '{"sub":"aaaa0001-0006-4000-8000-000000000006","email":"stakeholder@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaa0001-0007-4000-8000-000000000007', 'cliente@test.ddlegal.com', '{"sub":"aaaa0001-0007-4000-8000-000000000007","email":"cliente@test.ddlegal.com"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- 4. Assign project roles (real user IDs)
DELETE FROM public.dd_project_user_roles
WHERE project_id = 'a1b2c3d4-0001-4000-8000-000000000001'
AND user_id LIKE 'bbbb%';

INSERT INTO public.dd_project_user_roles (project_id, user_id, role, area_code, is_active)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0000-4000-8000-000000000000', 'clo', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0001-4000-8000-000000000001', 'clo', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0002-4000-8000-000000000002', 'pm_transaccion', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0003-4000-8000-000000000003', 'abogado_area', 'MERC', true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0004-4000-8000-000000000004', 'deal_sponsor', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0005-4000-8000-000000000005', 'target_liaison', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0006-4000-8000-000000000006', 'stakeholder_negocio', null, true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'aaaa0001-0007-4000-8000-000000000007', 'cliente_externo', null, true)
ON CONFLICT DO NOTHING;

commit;

-- ============================================================
-- User Credentials:
-- admin@ddlegal.com        / admin123456  (Superusuario)
-- clo@test.ddlegal.com     / test123456   (CLO)
-- pm@test.ddlegal.com      / test123456   (PM Transaccion)
-- abogado.merc@test.ddlegal.com / test123456 (Abogado Mercantil)
-- sponsor@test.ddlegal.com / test123456   (Deal Sponsor)
-- target@test.ddlegal.com  / test123456   (Contacto Target)
-- stakeholder@test.ddlegal.com / test123456 (Stakeholder)
-- cliente@test.ddlegal.com / test123456   (Cliente Externo)
-- ============================================================
