-- Migration: Seed cuentas-anuales microtool
-- Task 4 of 15: CA Microtool seeding
-- Depends on: Tasks 2-3 (CA skills and workflow must exist)

BEGIN;

INSERT INTO dd_tools (slug, name, description, icon, area_codes, skills_used, requires_project, sort_order, is_active)
VALUES (
  'cuentas-anuales',
  'Revisión Cuentas Anuales',
  'Analiza cuentas anuales completas: aprobación, auditoría, patrimonio neto, distribución de resultados, partes vinculadas, contingencias y coherencia registral. Cubre 15 FOs del catálogo MERC-CA.',
  'FileSpreadsheet',
  ARRAY['MERC'],
  ARRAY['ca.extraccion_cuentas','ca.analisis_auditoria','ca.patrimonio_neto','ca.aplicacion_resultado','ca.partes_vinculadas','ca.contingencias_memoria','ca.compliance_revelaciones','ca.medidas_reequilibrio'],
  true,
  5,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  area_codes = EXCLUDED.area_codes,
  skills_used = EXCLUDED.skills_used,
  requires_project = EXCLUDED.requires_project,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

COMMIT;
