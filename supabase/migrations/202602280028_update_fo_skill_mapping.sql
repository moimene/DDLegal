-- Migration: 202602280028_update_fo_skill_mapping.sql
-- Description: Link 15 CA Finding Objectives to their corresponding skills
-- Depends on: 202602280024_seed_ca_fos.sql (FOs must exist)
--             202602280025_seed_ca_skills.sql (skills must exist)

BEGIN;

-- FO-MERC-CA-001: Validar extracción cuentas anuales
-- FO-MERC-CA-014: Verificar integridad documentos
UPDATE dd_finding_objectives SET skill_key = 'ca.extraccion_cuentas'
WHERE objective_key IN ('FO-MERC-CA-001', 'FO-MERC-CA-014');

-- FO-MERC-CA-002: Verificar existencia informe auditoría
-- FO-MERC-CA-003: Analizar opinión auditor
UPDATE dd_finding_objectives SET skill_key = 'ca.analisis_auditoria'
WHERE objective_key IN ('FO-MERC-CA-002', 'FO-MERC-CA-003');

-- FO-MERC-CA-004: Evaluar patrimonio neto vs capital social
UPDATE dd_finding_objectives SET skill_key = 'ca.patrimonio_neto'
WHERE objective_key = 'FO-MERC-CA-004';

-- FO-MERC-CA-005: Verificar propuesta aplicación resultado
-- FO-MERC-CA-006: Detectar pérdidas significativas
UPDATE dd_finding_objectives SET skill_key = 'ca.aplicacion_resultado'
WHERE objective_key IN ('FO-MERC-CA-005', 'FO-MERC-CA-006');

-- FO-MERC-CA-007: Identificar operaciones vinculadas
UPDATE dd_finding_objectives SET skill_key = 'ca.partes_vinculadas'
WHERE objective_key = 'FO-MERC-CA-007';

-- FO-MERC-CA-008: Analizar contingencias en memoria
-- FO-MERC-CA-009: Evaluar pasivos contingentes
UPDATE dd_finding_objectives SET skill_key = 'ca.contingencias_memoria'
WHERE objective_key IN ('FO-MERC-CA-008', 'FO-MERC-CA-009');

-- FO-MERC-CA-010: Verificar cumplimiento revelaciones PGC
-- FO-MERC-CA-011: Evaluar principios contables aplicados
-- FO-MERC-CA-012: Detectar cambios criterios contables
-- FO-MERC-CA-013: Verificar información comparativa
UPDATE dd_finding_objectives SET skill_key = 'ca.compliance_revelaciones'
WHERE objective_key IN ('FO-MERC-CA-010', 'FO-MERC-CA-011', 'FO-MERC-CA-012', 'FO-MERC-CA-013');

-- FO-MERC-CA-PatNeto-002: Evaluar medidas de reequilibrio patrimonial
UPDATE dd_finding_objectives SET skill_key = 'ca.medidas_reequilibrio'
WHERE objective_key = 'FO-MERC-CA-PatNeto-002';

COMMIT;
