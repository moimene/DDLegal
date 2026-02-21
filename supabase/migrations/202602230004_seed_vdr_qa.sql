-- ============================================================
-- Migration: Seed VDR & QA defaults
-- 1. Function to create standard VDR folder structure per project
-- 2. Add review_depth to dd_expected_documents
-- 3. Seed QA assignments for demo project
-- Date: 2026-02-23
-- ============================================================

begin;

-- ============================================================
-- 1. Function: create_default_vdr_folders(p_project_id)
--    Creates root folders per area and standard subfolders.
-- ============================================================
create or replace function public.create_default_vdr_folders(p_project_id uuid)
returns void
language plpgsql
as $$
declare
  v_area record;
  v_root_id uuid;
  v_subfolder text;
begin
  -- Root folders per DD area
  for v_area in
    select unnest(array[
      'Mercantil',
      'Contable',
      'Laboral',
      'Fiscal',
      'Inmobiliario',
      'PI',
      'Litigios',
      'Admin/Regulatorio',
      'M&A',
      'Datos',
      'General'
    ]) as name,
    unnest(array[
      'MERC',
      'CONT',
      'LAB',
      'FISC',
      'INM',
      'PI',
      'LIT',
      'ADMIN',
      'MA',
      'DATOS',
      'GENERAL'
    ]) as code,
    unnest(array[
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    ]) as sort
  loop
    -- Insert root folder (skip if exists due to unique constraint)
    insert into public.vdr_folders (project_id, parent_id, name, area_code, sort_order)
    values (p_project_id, null, v_area.name, v_area.code, v_area.sort)
    on conflict (project_id, parent_id, name) do nothing
    returning id into v_root_id;

    -- If root folder already existed, fetch its id
    if v_root_id is null then
      select id into v_root_id
      from public.vdr_folders
      where project_id = p_project_id
        and parent_id is null
        and name = v_area.name;
    end if;

    -- Standard subfolders for each root
    foreach v_subfolder in array array['Contratos', 'Escrituras', 'Certificados', 'Informes', 'Otros']
    loop
      insert into public.vdr_folders (project_id, parent_id, name, area_code, sort_order)
      values (p_project_id, v_root_id, v_subfolder, v_area.code, 0)
      on conflict (project_id, parent_id, name) do nothing;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- 2. Add review_depth to dd_expected_documents if table exists
-- ============================================================
do $$
begin
  if to_regclass('public.dd_expected_documents') is not null then
    alter table public.dd_expected_documents
      add column if not exists review_depth text default 'standard';
  end if;
end $$;

-- ============================================================
-- 3. Seed QA assignments for demo project
--    Project ID: a1b2c3d4-0001-4000-8000-000000000001
--    (created in Phase 1 seed migration)
-- ============================================================
insert into public.qa_assignments (project_id, area_code, sla_hours, escalation_after_hours)
values
  ('a1b2c3d4-0001-4000-8000-000000000001', 'MERC', 48, 72),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'CONT', 48, 72),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'LAB',  72, 72),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'FISC', 48, 72)
on conflict (project_id, area_code) do nothing;

commit;
