-- Migration: Seed expected documents for MERC/CA
-- Task 7 of 15: CA expected documents
-- Adds 9 documents for Cuentas Anuales sub-category

BEGIN;

INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, sort_order)
VALUES
  ('MERC', 'cuentas', 'Cuentas anuales completas (balance, PyG, memoria)', 'Cuentas anuales formuladas de los ultimos ejercicios', true, 10),
  ('MERC', 'auditoria', 'Informe de auditoria', 'Informes de auditoria de los ejercicios revisados', true, 11),
  ('MERC', 'actas_ca', 'Actas JGA con aprobacion de cuentas', 'Actas de junta general con aprobacion de cuentas y aplicacion del resultado', true, 12),
  ('MERC', 'registro_ca', 'Notas simples Registro Mercantil', 'Certificacion de deposito de cuentas en Registro Mercantil', true, 13),
  ('MERC', 'vinculadas', 'Contratos con partes vinculadas', 'Contratos con socios, administradores y sociedades del grupo', false, 14),
  ('MERC', 'garantias', 'Polizas y garantias otorgadas', 'Avales, garantias y polizas de seguro relevantes', false, 15),
  ('MERC', 'escrituras_ca', 'Escrituras publicas relevantes', 'Escrituras de ampliacion/reduccion de capital, aportaciones', false, 16),
  ('MERC', 'esg', 'EINF / Informe ESG', 'Estado de Informacion No Financiera o informe ESG si aplica', false, 17),
  ('MERC', 'retributiva', 'Politicas retributivas', 'Politica de remuneracion de administradores', false, 18);

COMMIT;
