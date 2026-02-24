-- Migration: Seed default VDR folder structure
-- Task 12 of 12: G-05 - Default folder structure per project

BEGIN;

-- Create function to seed default folders for a new project
CREATE OR REPLACE FUNCTION seed_project_folders(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_folder_id UUID;
BEGIN
  -- Only seed if project has no folders yet
  IF EXISTS (SELECT 1 FROM vdr_folders WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;

  -- 01 - Mercantil (MERC)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '01 - Mercantil', 'MERC', 1)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Escrituras y Estatutos', 'MERC', 1),
    (p_project_id, v_folder_id, 'Libros de Actas', 'MERC', 2),
    (p_project_id, v_folder_id, 'Cuentas Anuales', 'MERC', 3),
    (p_project_id, v_folder_id, 'Poderes y Certificados', 'MERC', 4);

  -- 02 - Contractual (CONT)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '02 - Contractual', 'CONT', 2)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Contratos Financieros', 'CONT', 1),
    (p_project_id, v_folder_id, 'Contratos Mercantiles', 'CONT', 2),
    (p_project_id, v_folder_id, 'Pólizas de Seguros', 'CONT', 3),
    (p_project_id, v_folder_id, 'Contratos Intragrupo', 'CONT', 4);

  -- 03 - Fiscal (FISC)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '03 - Fiscal', 'FISC', 3)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Declaraciones', 'FISC', 1),
    (p_project_id, v_folder_id, 'Precios de Transferencia', 'FISC', 2),
    (p_project_id, v_folder_id, 'Certificados', 'FISC', 3);

  -- 04 - Laboral (LAB)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '04 - Laboral', 'LAB', 4)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Plantilla', 'LAB', 1),
    (p_project_id, v_folder_id, 'Alta Dirección', 'LAB', 2),
    (p_project_id, v_folder_id, 'Convenios y Litigios', 'LAB', 3);

  -- 05 - Propiedad Intelectual (PI)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '05 - Propiedad Intelectual', 'PI', 5)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Marcas y Patentes', 'PI', 1),
    (p_project_id, v_folder_id, 'Licencias', 'PI', 2);

  -- 06 - Litigios (LIT)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '06 - Litigios', 'LIT', 6)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Procedimientos Activos', 'LIT', 1),
    (p_project_id, v_folder_id, 'Resoluciones', 'LIT', 2),
    (p_project_id, v_folder_id, 'Compliance', 'LIT', 3);

  -- 07 - Administrativo (ADM)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '07 - Administrativo', 'ADM', 7)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Licencias y Permisos', 'ADM', 1),
    (p_project_id, v_folder_id, 'Contratos Públicos', 'ADM', 2),
    (p_project_id, v_folder_id, 'Subvenciones', 'ADM', 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-seed folders on new project
CREATE OR REPLACE FUNCTION trg_seed_project_folders()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_project_folders(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_seed_project_folders'
  ) THEN
    CREATE TRIGGER trigger_seed_project_folders
    AFTER INSERT ON dd_projects
    FOR EACH ROW
    EXECUTE FUNCTION trg_seed_project_folders();
  END IF;
END $$;

-- Seed folders for existing projects that don't have them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM dd_projects LOOP
    PERFORM seed_project_folders(r.id);
  END LOOP;
END $$;

COMMIT;
