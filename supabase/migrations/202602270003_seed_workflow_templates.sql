-- ============================================================================
-- Migration: 202602270003_seed_workflow_templates.sql
-- Task A.2 — Seed 6 MVP workflows as versionable templates
--
-- Converts the 6 hardcoded workflows from src/lib/workflows/constants.ts
-- into dd_workflow_templates + dd_workflow_template_versions rows.
-- Each template has version 1 with 5 DD phases:
--   obtencion > gestion > analisis > valoracion > tratamiento
--
-- Idempotent: all INSERTs use ON CONFLICT DO NOTHING.
-- ============================================================================

-- Template 1: Arranque DD + Backlog
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('arranque_dd', 'Arranque DD + Backlog', 'Genera scope inicial, backlog y listas de solicitud', '{GENERAL}', 'operational')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, output_schema,
  feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'arranque_dd'),
  1,
  '[
    {"phase": "obtencion", "name": "Recepcion de mandato", "description": "Recopilar informacion basica del target y alcance del deal", "inputs_required": ["target_company", "sector", "deal_type"], "skills": [], "artifacts": ["ficha_mandato"], "dod_criteria": [{"check": "target_identified", "label": "Target identificado", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "none"}},
    {"phase": "gestion", "name": "Generacion de backlog", "description": "Crear estructura de areas, tareas y cronograma", "inputs_required": ["ficha_mandato"], "skills": ["general.digest_red_flags", "general.watcher_bloqueos"], "artifacts": ["backlog_tareas", "cronograma", "raci"], "dod_criteria": [{"check": "backlog_created", "label": "Backlog generado", "required": true}, {"check": "areas_assigned", "label": "Areas asignadas", "required": true}], "dor_criteria": [{"check": "target_identified", "label": "Target identificado", "required": true}], "kanban_start_state": "info_recibida", "kanban_end_state": "lista_para_analisis", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "completion", "grounding_mode": "none"}},
    {"phase": "analisis", "name": "Revision de scope", "description": "Validar que el backlog cubre todos los deal breakers", "inputs_required": ["backlog_tareas"], "skills": [], "artifacts": ["scope_validado"], "dod_criteria": [{"check": "scope_reviewed", "label": "Scope revisado", "required": true}], "dor_criteria": [{"check": "backlog_created", "label": "Backlog generado", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "conclusion", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "none"}},
    {"phase": "valoracion", "name": "N/A para arranque", "description": "No aplica en arranque DD", "inputs_required": [], "skills": [], "artifacts": [], "dod_criteria": [], "dor_criteria": [], "kanban_start_state": "conclusion", "kanban_end_state": "conclusion", "hitl_required": false, "estimated_duration_hours": 0, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "tratamiento", "name": "Kick-off con equipo", "description": "Distribuir backlog y confirmar cronograma", "inputs_required": ["backlog_tareas", "raci"], "skills": [], "artifacts": ["acta_kickoff"], "dod_criteria": [{"check": "team_notified", "label": "Equipo notificado", "required": true}], "dor_criteria": [{"check": "scope_reviewed", "label": "Scope revisado", "required": true}], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 1, "gateway_config": {"route": "none", "grounding_mode": "none"}}
  ]'::JSONB,
  '{"required_areas": [], "auto_approve_below_severity": "informational"}'::JSONB,
  '{"target_company": "string", "sector": "string", "deal_type": "string"}'::JSONB,
  '{"backlog_tasks": "DDKanbanTask[]", "areas_created": "string[]"}'::JSONB,
  'WF_ARRANQUE', true, NOW(), 'v1: Migrado desde constants.ts'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Template 2: Data Room + Gap List
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('data_room_gap', 'Data Room + Gap List', 'Analiza data room y genera gap list', '{GENERAL}', 'operational')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'data_room_gap'),
  1,
  '[
    {"phase": "obtencion", "name": "Ingestion de documentos", "description": "Subir documentos al VDR e iniciar ingestion", "inputs_required": ["project_id"], "skills": [], "artifacts": ["vdr_indexed"], "dod_criteria": [{"check": "docs_uploaded", "label": "Documentos subidos", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "gestion", "name": "Clasificacion y gap analysis", "description": "Clasificar documentos por area y detectar gaps", "inputs_required": ["vdr_indexed"], "skills": ["general.consistencia_crosscheck", "general.qa_proactiva"], "artifacts": ["gap_list", "doc_classification"], "dod_criteria": [{"check": "gaps_identified", "label": "Gaps identificados", "required": true}], "dor_criteria": [{"check": "docs_uploaded", "label": "Documentos subidos", "required": true}], "kanban_start_state": "lista_para_analisis", "kanban_end_state": "en_analisis", "hitl_required": false, "estimated_duration_hours": 8, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}},
    {"phase": "analisis", "name": "Solicitudes de informacion", "description": "Generar requests para documentos faltantes", "inputs_required": ["gap_list"], "skills": [], "artifacts": ["request_list"], "dod_criteria": [{"check": "requests_sent", "label": "Solicitudes enviadas", "required": true}], "dor_criteria": [{"check": "gaps_identified", "label": "Gaps identificados", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "info_solicitada", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "valoracion", "name": "Evaluacion de completitud", "description": "Medir cobertura documental por area", "inputs_required": ["gap_list", "request_list"], "skills": [], "artifacts": ["cobertura_report"], "dod_criteria": [{"check": "coverage_measured", "label": "Cobertura medida", "required": true}], "dor_criteria": [], "kanban_start_state": "conclusion", "kanban_end_state": "conclusion", "hitl_required": false, "estimated_duration_hours": 1, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "tratamiento", "name": "Seguimiento de gaps", "description": "Monitorizar respuestas y re-solicitar", "inputs_required": ["request_list"], "skills": [], "artifacts": ["gap_tracking"], "dod_criteria": [{"check": "all_tracked", "label": "Todos los gaps trackeados", "required": true}], "dor_criteria": [], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 0, "gateway_config": {"route": "none", "grounding_mode": "none"}}
  ]'::JSONB,
  '{"required_areas": [], "auto_approve_below_severity": "informational"}'::JSONB,
  '{"project_id": "string"}'::JSONB,
  'WF_GAP_LIST', true, NOW(), 'v1: Migrado desde constants.ts'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Template 3: Societario
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('societario', 'Societario', 'Analisis de estructura societaria', '{MERC}', 'transactional')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'societario'),
  1,
  '[
    {"phase": "obtencion", "name": "Consulta registral", "description": "Obtener BORME, escrituras, certificaciones", "inputs_required": ["cif", "denominacion"], "skills": ["societario.consulta_borme"], "artifacts": ["borme_data", "escrituras"], "dod_criteria": [{"check": "borme_obtained", "label": "BORME consultado", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "direct"}},
    {"phase": "gestion", "name": "Organizacion documental", "description": "Indexar y vincular documentos societarios", "inputs_required": ["borme_data"], "skills": [], "artifacts": ["doc_index"], "dod_criteria": [{"check": "docs_indexed", "label": "Documentos indexados", "required": true}], "dor_criteria": [{"check": "borme_obtained", "label": "BORME consultado", "required": true}], "kanban_start_state": "info_recibida", "kanban_end_state": "lista_para_analisis", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "analisis", "name": "Snapshot societario + discrepancias", "description": "Generar ficha societaria, cuadro socios, organos de gobierno, detectar discrepancias", "inputs_required": ["borme_data", "escrituras"], "skills": ["societario.consulta_borme", "societario.analisis_organos"], "artifacts": ["snapshot_societario", "discrepancias"], "dod_criteria": [{"check": "snapshot_generated", "label": "Snapshot generado", "required": true}, {"check": "discrepancies_checked", "label": "Discrepancias verificadas", "required": true}], "dor_criteria": [{"check": "docs_indexed", "label": "Documentos indexados", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "ia_propuesta", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}},
    {"phase": "valoracion", "name": "Red flags societarios", "description": "Identificar y rankear hallazgos criticos", "inputs_required": ["snapshot_societario", "discrepancias"], "skills": [], "artifacts": ["red_flags_merc", "findings_ranked"], "dod_criteria": [{"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "dor_criteria": [{"check": "snapshot_generated", "label": "Snapshot generado", "required": true}], "kanban_start_state": "ia_propuesta", "kanban_end_state": "conclusion", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}},
    {"phase": "tratamiento", "name": "Acciones societarias", "description": "Proponer CP, regularizaciones, acciones post-closing", "inputs_required": ["red_flags_merc"], "skills": [], "artifacts": ["acciones_societarias", "seccion_informe"], "dod_criteria": [{"check": "actions_proposed", "label": "Acciones propuestas", "required": true}, {"check": "report_section_ready", "label": "Seccion informe lista", "required": true}], "dor_criteria": [{"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}}
  ]'::JSONB,
  '{"required_areas": [], "auto_approve_below_severity": "low"}'::JSONB,
  '{"cif": "string", "denominacion": "string"}'::JSONB,
  'WF_SOCIETARIO', true, NOW(), 'v1: Migrado desde constants.ts'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Template 4: Contratos Materiales (HITL obligatorio)
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('contratos_materiales', 'Contratos Materiales', 'Revision de contratos materiales y change of control', '{CONT}', 'transactional')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'contratos_materiales'),
  1,
  '[
    {"phase": "obtencion", "name": "Recopilacion de contratos", "description": "Identificar y recopilar contratos materiales del VDR", "inputs_required": ["project_id"], "skills": [], "artifacts": ["lista_contratos"], "dod_criteria": [{"check": "contracts_listed", "label": "Contratos identificados", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "gestion", "name": "Clasificacion y priorizacion", "description": "Clasificar por tipo, monto, vencimiento; priorizar change of control", "inputs_required": ["lista_contratos"], "skills": [], "artifacts": ["contratos_priorizados"], "dod_criteria": [{"check": "contracts_classified", "label": "Contratos clasificados", "required": true}], "dor_criteria": [{"check": "contracts_listed", "label": "Contratos identificados", "required": true}], "kanban_start_state": "info_recibida", "kanban_end_state": "lista_para_analisis", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "analisis", "name": "Extraccion de clausulas + change of control", "description": "IA extrae clausulas criticas: CoC, terminacion, penalidades, exclusividad", "inputs_required": ["contratos_priorizados"], "skills": ["contratos.extraccion_clausulas", "contratos.cambio_control", "contratos.analisis_riesgo"], "artifacts": ["tabla_clausulas", "coc_analysis"], "dod_criteria": [{"check": "clauses_extracted", "label": "Clausulas extraidas", "required": true}, {"check": "coc_analyzed", "label": "Change of control analizado", "required": true}], "dor_criteria": [{"check": "contracts_classified", "label": "Contratos clasificados", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "ia_propuesta", "hitl_required": false, "estimated_duration_hours": 8, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag", "max_prompt_chars": 20000}},
    {"phase": "valoracion", "name": "HITL revision de hallazgos", "description": "Abogado revisa y valida hallazgos IA; approve/correct/reject", "inputs_required": ["tabla_clausulas", "coc_analysis"], "skills": [], "artifacts": ["findings_validated"], "dod_criteria": [{"check": "hitl_completed", "label": "HITL completado", "required": true}, {"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "dor_criteria": [{"check": "clauses_extracted", "label": "Clausulas extraidas", "required": true}], "kanban_start_state": "hitl_revision", "kanban_end_state": "conclusion", "hitl_required": true, "estimated_duration_hours": 4, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "tratamiento", "name": "Negotiation actions + informe", "description": "Generar acciones de negociacion, vincular a clausulas SPA, seccion de informe", "inputs_required": ["findings_validated"], "skills": [], "artifacts": ["negotiation_actions", "seccion_informe_cont"], "dod_criteria": [{"check": "actions_generated", "label": "Acciones generadas", "required": true}, {"check": "report_section_ready", "label": "Seccion informe lista", "required": true}], "dor_criteria": [{"check": "hitl_completed", "label": "HITL completado", "required": true}], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}}
  ]'::JSONB,
  '{"required_areas": ["CONT"], "auto_approve_below_severity": "low", "reviewer_role": "abogado_area", "escalation_after_hours": 48}'::JSONB,
  '{"project_id": "string", "contract_ids": "string[]"}'::JSONB,
  'WF_CONTRATOS', true, NOW(), 'v1: Migrado desde constants.ts — HITL obligatorio'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Template 5: IP Titularidad
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('ip_titularidad', 'IP Titularidad/Licencias', 'Analisis de titularidad IP y licencias', '{PI}', 'transactional')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'ip_titularidad'),
  1,
  '[
    {"phase": "obtencion", "name": "Consulta registral PI", "description": "Consultar OEPM, EUIPO, WIPO", "inputs_required": ["titular_name"], "skills": ["marcas.consulta_oepm"], "artifacts": ["registros_pi"], "dod_criteria": [{"check": "registries_queried", "label": "Registros consultados", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "direct"}},
    {"phase": "gestion", "name": "Inventario PI", "description": "Crear inventario de activos PI: marcas, patentes, dominios, software", "inputs_required": ["registros_pi"], "skills": [], "artifacts": ["inventario_pi"], "dod_criteria": [{"check": "inventory_created", "label": "Inventario creado", "required": true}], "dor_criteria": [{"check": "registries_queried", "label": "Registros consultados", "required": true}], "kanban_start_state": "info_recibida", "kanban_end_state": "lista_para_analisis", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "analisis", "name": "Analisis de riesgo PI", "description": "Verificar titularidad, encumbrances, conflictos, licencias", "inputs_required": ["inventario_pi"], "skills": ["marcas.consulta_oepm", "marcas.analisis_riesgo_pi"], "artifacts": ["snapshot_pi", "risk_analysis"], "dod_criteria": [{"check": "ownership_verified", "label": "Titularidad verificada", "required": true}, {"check": "encumbrances_checked", "label": "Cargas verificadas", "required": true}], "dor_criteria": [{"check": "inventory_created", "label": "Inventario creado", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "ia_propuesta", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}},
    {"phase": "valoracion", "name": "Red flags PI", "description": "Rankear hallazgos PI por impacto en deal", "inputs_required": ["risk_analysis"], "skills": [], "artifacts": ["red_flags_pi", "findings_ranked"], "dod_criteria": [{"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "dor_criteria": [{"check": "ownership_verified", "label": "Titularidad verificada", "required": true}], "kanban_start_state": "ia_propuesta", "kanban_end_state": "conclusion", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}},
    {"phase": "tratamiento", "name": "Acciones PI + informe", "description": "Regularizaciones, protecciones, seccion informe", "inputs_required": ["red_flags_pi"], "skills": [], "artifacts": ["acciones_pi", "seccion_informe_pi"], "dod_criteria": [{"check": "actions_proposed", "label": "Acciones propuestas", "required": true}, {"check": "report_section_ready", "label": "Seccion informe lista", "required": true}], "dor_criteria": [{"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 2, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}}
  ]'::JSONB,
  '{"required_areas": [], "auto_approve_below_severity": "low"}'::JSONB,
  '{"titular_name": "string"}'::JSONB,
  'WF_IP', true, NOW(), 'v1: Migrado desde constants.ts'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Template 6: Laboral & Fiscal (HITL obligatorio)
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES ('laboral_fiscal', 'Laboral & Fiscal Contingencias', 'Analisis de contingencias laborales y fiscales', '{LAB,FISC}', 'transactional')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy, input_schema, feature_flag_key, is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'laboral_fiscal'),
  1,
  '[
    {"phase": "obtencion", "name": "Recopilacion laboral/fiscal", "description": "Obtener contratos laborales, nominas, actas inspeccion, declaraciones fiscales", "inputs_required": ["project_id"], "skills": [], "artifacts": ["docs_lab_fisc"], "dod_criteria": [{"check": "docs_collected", "label": "Documentos recopilados", "required": true}], "dor_criteria": [], "kanban_start_state": "backlog", "kanban_end_state": "info_recibida", "hitl_required": false, "estimated_duration_hours": 8, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "gestion", "name": "Clasificacion por tipo de contingencia", "description": "Clasificar: laboral (litigios, inspecciones, contratos) y fiscal (impuestos, sanciones)", "inputs_required": ["docs_lab_fisc"], "skills": [], "artifacts": ["contingencias_clasificadas"], "dod_criteria": [{"check": "classified", "label": "Contingencias clasificadas", "required": true}], "dor_criteria": [{"check": "docs_collected", "label": "Documentos recopilados", "required": true}], "kanban_start_state": "info_recibida", "kanban_end_state": "lista_para_analisis", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "analisis", "name": "Analisis IA de contingencias", "description": "IA analiza riesgo: probabilidad, impacto economico, prescripcion", "inputs_required": ["contingencias_clasificadas"], "skills": ["laboral.contingencias_laborales", "laboral.contingencias_estimador", "fiscal.contingencias_fiscales", "fiscal.riesgo_inspeccion"], "artifacts": ["risk_register", "estimacion_economica"], "dod_criteria": [{"check": "risks_analyzed", "label": "Riesgos analizados", "required": true}, {"check": "amounts_estimated", "label": "Montos estimados", "required": true}], "dor_criteria": [{"check": "classified", "label": "Contingencias clasificadas", "required": true}], "kanban_start_state": "en_analisis", "kanban_end_state": "ia_propuesta", "hitl_required": false, "estimated_duration_hours": 8, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag", "max_prompt_chars": 20000}},
    {"phase": "valoracion", "name": "HITL revision obligatoria", "description": "Abogado laboral/fiscal valida hallazgos y montos", "inputs_required": ["risk_register", "estimacion_economica"], "skills": [], "artifacts": ["findings_validated"], "dod_criteria": [{"check": "hitl_completed", "label": "HITL completado", "required": true}, {"check": "findings_ranked", "label": "Hallazgos rankeados", "required": true}], "dor_criteria": [{"check": "risks_analyzed", "label": "Riesgos analizados", "required": true}], "kanban_start_state": "hitl_revision", "kanban_end_state": "conclusion", "hitl_required": true, "estimated_duration_hours": 6, "gateway_config": {"route": "none", "grounding_mode": "none"}},
    {"phase": "tratamiento", "name": "Mitigacion + negociacion + informe", "description": "Proponer indemnidades, caps, escrow, clausulas SPA, seccion de informe", "inputs_required": ["findings_validated"], "skills": [], "artifacts": ["negotiation_actions", "seccion_informe_lab_fisc"], "dod_criteria": [{"check": "actions_generated", "label": "Acciones generadas", "required": true}, {"check": "report_section_ready", "label": "Seccion informe lista", "required": true}], "dor_criteria": [{"check": "hitl_completed", "label": "HITL completado", "required": true}], "kanban_start_state": "conclusion", "kanban_end_state": "integrado_en_informe", "hitl_required": false, "estimated_duration_hours": 4, "gateway_config": {"route": "completion", "grounding_mode": "vault_rag"}}
  ]'::JSONB,
  '{"required_areas": ["LAB", "FISC"], "auto_approve_below_severity": "low", "reviewer_role": "abogado_area", "escalation_after_hours": 48}'::JSONB,
  '{"project_id": "string"}'::JSONB,
  'WF_LAB_FISC', true, NOW(), 'v1: Migrado desde constants.ts — HITL obligatorio LAB/FISC'
)
ON CONFLICT (template_id, version_number) DO NOTHING;
