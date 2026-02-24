-- ============================================================================
-- Migration: 202602280026_seed_ca_workflow.sql
-- Purpose: Seed the cuentas_anuales workflow template with 5 phases
-- Date: 2026-02-28
-- Depends on: Task 2 (CA skills must exist in dd_skills_catalog)
-- Reference: docs/architecture/CA_SKILLS_WORKFLOWS.md
-- ============================================================================

BEGIN;

-- ============================================================
-- Insert workflow template: cuentas_anuales
-- Area: MERC (Mercantil/Societario)
-- Category: transactional
-- ============================================================
INSERT INTO dd_workflow_templates (
  template_key,
  name,
  description,
  area_codes,
  category,
  is_active
)
VALUES (
  'cuentas_anuales',
  'Cuentas Anuales',
  'Revision legal de cuentas anuales: aprobacion, deposito, auditoria, patrimonio, distribucion, revelaciones y coherencia registral',
  '{MERC}',
  'transactional',
  true
)
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- Insert workflow version with 5 phases:
-- 1. obtencion - Recopilacion documental CA (4h, no skills, no HITL)
-- 2. gestion - Extraccion y normalizacion (6h, ca.extraccion_cuentas, no HITL)
-- 3. analisis - Evaluacion legal CA (8h, 7 analysis skills, no HITL)
-- 4. valoracion - HITL: Revision legal de hallazgos CA (4h, no skills, HITL required)
-- 5. tratamiento - Acciones y seccion de informe CA (4h, no skills, no HITL)
-- ============================================================
INSERT INTO dd_workflow_template_versions (
  template_id,
  version_number,
  phases,
  hitl_policy,
  input_schema,
  output_schema,
  feature_flag_key,
  is_published,
  published_at,
  changelog
)
SELECT
  t.id,
  1,
  -- phases JSONB array
  '[
    {
      "phase": "obtencion",
      "name": "Recopilacion documental CA",
      "description": "Recopilar cuentas anuales, actas de junta, certificados de deposito RM, informes de auditoria y documentacion complementaria",
      "inputs_required": ["project_id", "ejercicio_fiscal", "sociedad_target"],
      "skills": [],
      "artifacts": ["cuentas_anuales", "actas_junta", "certificado_deposito_rm", "informe_auditoria"],
      "dod_criteria": [
        {"check": "cuentas_recibidas", "label": "Cuentas anuales recibidas", "required": true},
        {"check": "actas_recibidas", "label": "Actas de junta recibidas", "required": true}
      ],
      "dor_criteria": [],
      "kanban_start_state": "backlog",
      "kanban_end_state": "info_recibida",
      "hitl_required": false,
      "estimated_duration_hours": 4,
      "gateway_config": {"route": "none", "grounding_mode": "none"}
    },
    {
      "phase": "gestion",
      "name": "Extraccion y normalizacion",
      "description": "Extraer datos estructurados de cuentas anuales: magnitudes patrimoniales, aplicacion de resultado, autocartera, auditoria, coherencia registral",
      "inputs_required": ["cuentas_anuales", "actas_junta"],
      "skills": ["ca.extraccion_cuentas"],
      "artifacts": ["datos_estructurados_ca", "discrepancias_registrales"],
      "dod_criteria": [
        {"check": "datos_extraidos", "label": "Datos estructurados extraidos", "required": true},
        {"check": "coherencia_verificada", "label": "Coherencia registral verificada", "required": true}
      ],
      "dor_criteria": [
        {"check": "cuentas_recibidas", "label": "Cuentas anuales recibidas", "required": true}
      ],
      "kanban_start_state": "info_recibida",
      "kanban_end_state": "lista_para_analisis",
      "hitl_required": false,
      "estimated_duration_hours": 6,
      "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}
    },
    {
      "phase": "analisis",
      "name": "Evaluacion legal CA",
      "description": "Analisis legal completo: auditoria, patrimonio neto, aplicacion resultado, partes vinculadas, contingencias, revelaciones, medidas reequilibrio",
      "inputs_required": ["datos_estructurados_ca", "informe_auditoria", "memoria"],
      "skills": [
        "ca.analisis_auditoria",
        "ca.patrimonio_neto",
        "ca.aplicacion_resultado",
        "ca.partes_vinculadas",
        "ca.contingencias_memoria",
        "ca.compliance_revelaciones",
        "ca.medidas_reequilibrio"
      ],
      "artifacts": ["snapshot_ca", "hallazgos_ca", "red_flags_ca"],
      "dod_criteria": [
        {"check": "auditoria_analizada", "label": "Auditoria analizada", "required": true},
        {"check": "patrimonio_evaluado", "label": "Patrimonio neto evaluado", "required": true},
        {"check": "hallazgos_identificados", "label": "Hallazgos identificados", "required": true}
      ],
      "dor_criteria": [
        {"check": "datos_extraidos", "label": "Datos estructurados extraidos", "required": true}
      ],
      "kanban_start_state": "en_analisis",
      "kanban_end_state": "ia_propuesta",
      "hitl_required": false,
      "estimated_duration_hours": 8,
      "gateway_config": {"route": "completion", "grounding_mode": "vault_rag", "max_prompt_chars": 25000}
    },
    {
      "phase": "valoracion",
      "name": "HITL: Revision legal de hallazgos CA",
      "description": "Revision obligatoria por abogado societario: validacion de hallazgos criticos (auditoria, patrimonio, dividendos, partes vinculadas, contingencias, prestamos socios)",
      "inputs_required": ["hallazgos_ca", "red_flags_ca"],
      "skills": [],
      "artifacts": ["hallazgos_validados_ca", "findings_ranked_ca"],
      "dod_criteria": [
        {"check": "hitl_completed", "label": "HITL completado", "required": true},
        {"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}
      ],
      "dor_criteria": [
        {"check": "hallazgos_identificados", "label": "Hallazgos identificados", "required": true}
      ],
      "kanban_start_state": "hitl_revision",
      "kanban_end_state": "conclusion",
      "hitl_required": true,
      "estimated_duration_hours": 4,
      "gateway_config": {"route": "none", "grounding_mode": "none"}
    },
    {
      "phase": "tratamiento",
      "name": "Acciones y seccion de informe CA",
      "description": "Generar acciones de negociacion (CP, indemnities, escrow) y redactar seccion de informe de cuentas anuales",
      "inputs_required": ["hallazgos_validados_ca"],
      "skills": [],
      "artifacts": ["negotiation_actions_ca", "seccion_informe_ca"],
      "dod_criteria": [
        {"check": "actions_generated", "label": "Acciones generadas", "required": true},
        {"check": "report_section_ready", "label": "Seccion informe lista", "required": true}
      ],
      "dor_criteria": [
        {"check": "hitl_completed", "label": "HITL completado", "required": true}
      ],
      "kanban_start_state": "conclusion",
      "kanban_end_state": "integrado_en_informe",
      "hitl_required": false,
      "estimated_duration_hours": 4,
      "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}
    }
  ]'::JSONB,
  -- hitl_policy JSONB
  '{
    "required_areas": ["MERC"],
    "auto_approve_below_severity": "low",
    "reviewer_role": "abogado_societario",
    "escalation_after_hours": 48,
    "mandatory_hitl_fos": [
      "FO-MERC-CA-003",
      "FO-MERC-CA-004",
      "FO-MERC-CA-005",
      "FO-MERC-CA-007",
      "FO-MERC-CA-008",
      "FO-MERC-CA-PatNeto-002"
    ]
  }'::JSONB,
  -- input_schema
  '{"project_id": "string", "ejercicio_fiscal": "string", "sociedad_target": "string"}'::JSONB,
  -- output_schema
  '{"hallazgos_ca": "Finding[]", "negotiation_actions_ca": "NegotiationAction[]", "seccion_informe_ca": "string"}'::JSONB,
  -- feature_flag_key
  'WF_CUENTAS_ANUALES',
  -- is_published
  true,
  -- published_at
  NOW(),
  -- changelog
  'v1: Workflow inicial de Cuentas Anuales con 5 fases DD, 8 skills CA y HITL obligatorio para hallazgos criticos'
FROM dd_workflow_templates t
WHERE t.template_key = 'cuentas_anuales'
ON CONFLICT (template_id, version_number) DO NOTHING;

COMMIT;
