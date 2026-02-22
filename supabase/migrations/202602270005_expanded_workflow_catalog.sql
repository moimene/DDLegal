-- ============================================================================
-- Migration: 202602270005_expanded_workflow_catalog.sql
-- Task A.4 — Seed expanded 16-workflow catalog from YAML v1
--
-- 1. Expands category CHECK constraint to support new workflow types
-- 2. Upserts 16 workflow templates (WF-01 through WF-16)
-- 3. Creates template versions with 6-phase definitions
--
-- For original 6 templates (WF-01..WF-06): version 2 (6-phase upgrade)
-- For new templates (WF-07..WF-16): version 1
--
-- Idempotent: all INSERTs use ON CONFLICT ... DO UPDATE SET
-- ============================================================================

BEGIN;

-- ============================================================================
-- Part A: Expand category CHECK constraint
-- ============================================================================
ALTER TABLE dd_workflow_templates
  DROP CONSTRAINT IF EXISTS dd_workflow_templates_category_check;

ALTER TABLE dd_workflow_templates
  ADD CONSTRAINT dd_workflow_templates_category_check
  CHECK (category IN (
    'transactional', 'compliance', 'operational',
    'transversal', 'area', 'area_multi',
    'synthesis', 'deliverable', 'negotiation'
  ));

-- ============================================================================
-- Part B: Upsert 16 workflow templates + versions
-- ============================================================================

-- ============================================================
-- WF-01: Arranque DD + Backlog (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_01_kickoff_backlog',
  'WF-01 Arranque DD + Backlog',
  'Genera scope inicial, backlog, listas de solicitud y kick-off del equipo DD',
  '{GENERAL}',
  'transversal'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_01_kickoff_backlog'),
  2,
  '[
    {"phase":"obtencion","name":"AP-01.1 Recepcion de mandato","description":"Recopilar informacion basica del target, alcance del deal y expectativas del cliente","inputs_required":["target_company","sector","deal_type","client_brief"],"skills":[],"artifacts":["ficha_mandato","engagement_letter"],"dod_criteria":[{"check":"target_identified","label":"Target identificado","required":true},{"check":"deal_type_confirmed","label":"Tipo de deal confirmado","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-01.2 Generacion de backlog","description":"Crear estructura de areas DD, tareas por area, cronograma y matriz RACI","inputs_required":["ficha_mandato"],"skills":[],"artifacts":["backlog_tareas","cronograma","raci_matrix"],"dod_criteria":[{"check":"backlog_created","label":"Backlog generado","required":true},{"check":"areas_assigned","label":"Areas asignadas","required":true},{"check":"raci_defined","label":"RACI definido","required":true}],"dor_criteria":[{"check":"target_identified","label":"Target identificado","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"none"}},
    {"phase":"analisis","name":"AP-01.3 Revision de scope","description":"Validar que el backlog cubre todos los deal breakers y areas criticas","inputs_required":["backlog_tareas"],"skills":[],"artifacts":["scope_validado"],"dod_criteria":[{"check":"scope_reviewed","label":"Scope revisado","required":true},{"check":"deal_breakers_covered","label":"Deal breakers cubiertos","required":true}],"dor_criteria":[{"check":"backlog_created","label":"Backlog generado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"none"}},
    {"phase":"valoracion","name":"AP-01.4 Priorizacion de areas","description":"Priorizar areas segun riesgo del sector y tipo de deal","inputs_required":["scope_validado"],"skills":[],"artifacts":["priority_matrix"],"dod_criteria":[{"check":"priorities_set","label":"Prioridades establecidas","required":true}],"dor_criteria":[{"check":"scope_reviewed","label":"Scope revisado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Documento de arranque","description":"Generar documento de arranque con scope, cronograma y asignaciones","inputs_required":["scope_validado","priority_matrix","raci_matrix"],"skills":[],"artifacts":["kick_off_deck"],"dod_criteria":[{"check":"doc_generated","label":"Documento generado","required":true}],"dor_criteria":[{"check":"priorities_set","label":"Prioridades establecidas","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Kick-off con equipo","description":"Distribuir backlog, confirmar cronograma y publicar en War Room","inputs_required":["kick_off_deck","backlog_tareas","raci_matrix"],"skills":[],"artifacts":["acta_kickoff"],"dod_criteria":[{"check":"team_notified","label":"Equipo notificado","required":true}],"dor_criteria":[{"check":"doc_generated","label":"Documento generado","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"informational"}'::JSONB,
  '{"target_company":"string","sector":"string","deal_type":"string"}'::JSONB,
  '{"backlog_tasks":"DDKanbanTask[]","areas_created":"string[]"}'::JSONB,
  '[]'::JSONB,
  NULL, 'WF_ARRANQUE',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  input_schema = EXCLUDED.input_schema,
  output_schema = EXCLUDED.output_schema,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-02: VDR + Gap List (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_02_vdr_gap_management',
  'WF-02 VDR + Gap List',
  'Gestion de data room virtual, analisis de gaps documentales y seguimiento de solicitudes',
  '{GENERAL}',
  'transversal'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_02_vdr_gap_management'),
  2,
  '[
    {"phase":"obtencion","name":"AP-02.1 Ingestion de documentos","description":"Subir documentos al VDR, iniciar ingestion y vectorizacion","inputs_required":["project_id"],"skills":[],"artifacts":["vdr_indexed"],"dod_criteria":[{"check":"docs_uploaded","label":"Documentos subidos","required":true},{"check":"vectorization_complete","label":"Vectorizacion completada","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-02.2 Clasificacion y gap analysis","description":"Clasificar documentos por area y detectar gaps documentales","inputs_required":["vdr_indexed"],"skills":[],"artifacts":["gap_list","doc_classification"],"dod_criteria":[{"check":"gaps_identified","label":"Gaps identificados","required":true},{"check":"docs_classified","label":"Documentos clasificados","required":true}],"dor_criteria":[{"check":"docs_uploaded","label":"Documentos subidos","required":true}],"kanban_start_state":"lista_para_analisis","kanban_end_state":"en_analisis","hitl_required":false,"estimated_duration_hours":8,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"analisis","name":"AP-02.3 Solicitudes de informacion","description":"Generar request list para documentos faltantes y enviar al target","inputs_required":["gap_list"],"skills":[],"artifacts":["request_list"],"dod_criteria":[{"check":"requests_sent","label":"Solicitudes enviadas","required":true}],"dor_criteria":[{"check":"gaps_identified","label":"Gaps identificados","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"info_solicitada","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"AP-02.4 Evaluacion de completitud","description":"Medir cobertura documental por area y evaluar calidad","inputs_required":["gap_list","request_list"],"skills":[],"artifacts":["cobertura_report"],"dod_criteria":[{"check":"coverage_measured","label":"Cobertura medida","required":true}],"dor_criteria":[],"kanban_start_state":"conclusion","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Reporte de cobertura VDR","description":"Generar seccion de informe con estado del VDR y gaps pendientes","inputs_required":["cobertura_report","gap_list"],"skills":[],"artifacts":["seccion_vdr_informe"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"coverage_measured","label":"Cobertura medida","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Seguimiento de gaps","description":"Monitorizar respuestas, re-solicitar y publicar estado en War Room","inputs_required":["request_list"],"skills":[],"artifacts":["gap_tracking"],"dod_criteria":[{"check":"all_tracked","label":"Todos los gaps trackeados","required":true}],"dor_criteria":[],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":0,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"informational"}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{"gap_list":"GapItem[]","coverage_pct":"number"}'::JSONB,
  '[]'::JSONB,
  NULL, 'WF_GAP_LIST',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-03: Societario (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_03_merc_societario',
  'WF-03 Societario',
  'Analisis completo de estructura societaria: BORME, organos, socios, discrepancias',
  '{MERC}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_03_merc_societario'),
  2,
  '[
    {"phase":"obtencion","name":"AP-03.1 Consulta registral","description":"Obtener BORME, escrituras, certificaciones del Registro Mercantil","inputs_required":["cif","denominacion"],"skills":["societario.consulta_borme"],"artifacts":["borme_data","escrituras"],"dod_criteria":[{"check":"borme_obtained","label":"BORME consultado","required":true},{"check":"escrituras_obtained","label":"Escrituras obtenidas","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"direct"}},
    {"phase":"gestion","name":"AP-03.2 Organizacion documental","description":"Indexar y vincular documentos societarios en VDR","inputs_required":["borme_data"],"skills":[],"artifacts":["doc_index"],"dod_criteria":[{"check":"docs_indexed","label":"Documentos indexados","required":true}],"dor_criteria":[{"check":"borme_obtained","label":"BORME consultado","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"AP-03.3 Snapshot societario","description":"Generar ficha societaria, cuadro socios, organos de gobierno, detectar discrepancias","inputs_required":["borme_data","escrituras"],"skills":["societario.consulta_borme","societario.analisis_organos"],"artifacts":["snapshot_societario","discrepancias"],"dod_criteria":[{"check":"snapshot_generated","label":"Snapshot generado","required":true},{"check":"discrepancies_checked","label":"Discrepancias verificadas","required":true}],"dor_criteria":[{"check":"docs_indexed","label":"Documentos indexados","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"valoracion","name":"AP-03.4 Red flags societarios","description":"Identificar y rankear hallazgos criticos con impacto en el deal","inputs_required":["snapshot_societario","discrepancias"],"skills":[],"artifacts":["red_flags_merc","findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"snapshot_generated","label":"Snapshot generado","required":true}],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"AP-03.5 Seccion informe societario","description":"Generar seccion de informe con snapshot, hallazgos y recomendaciones","inputs_required":["red_flags_merc","snapshot_societario"],"skills":[],"artifacts":["seccion_informe_merc"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Acciones societarias","description":"Proponer CP, regularizaciones, acciones post-closing y publicar en War Room","inputs_required":["red_flags_merc","seccion_informe_merc"],"skills":[],"artifacts":["acciones_societarias"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"cif":"string","denominacion":"string"}'::JSONB,
  '{"snapshot":"object","findings":"Finding[]"}'::JSONB,
  '[]'::JSONB,
  'rpt_societario', 'WF_SOCIETARIO',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-04: Contratos Materiales — HITL (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_04_cont_material_contracts',
  'WF-04 Contratos Materiales (HITL)',
  'Revision de contratos materiales: clausulas criticas, change of control, scoring de riesgo',
  '{CONT}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_04_cont_material_contracts'),
  2,
  '[
    {"phase":"obtencion","name":"AP-04.1 Recopilacion de contratos","description":"Identificar y recopilar contratos materiales del VDR","inputs_required":["project_id"],"skills":[],"artifacts":["lista_contratos"],"dod_criteria":[{"check":"contracts_listed","label":"Contratos identificados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-04.2 Clasificacion y priorizacion","description":"Clasificar por tipo, monto, vencimiento; priorizar change of control","inputs_required":["lista_contratos"],"skills":[],"artifacts":["contratos_priorizados"],"dod_criteria":[{"check":"contracts_classified","label":"Contratos clasificados","required":true}],"dor_criteria":[{"check":"contracts_listed","label":"Contratos identificados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"AP-04.3 Extraccion IA clausulas + CoC","description":"IA extrae clausulas criticas: CoC, terminacion, penalidades, exclusividad, non-compete","inputs_required":["contratos_priorizados"],"skills":["cont_extractor_clausulas","cont_change_of_control","cont_scoring_riesgo","cont_tabla_contratos"],"artifacts":["tabla_clausulas","coc_analysis","risk_scores"],"dod_criteria":[{"check":"clauses_extracted","label":"Clausulas extraidas","required":true},{"check":"coc_analyzed","label":"Change of control analizado","required":true},{"check":"risk_scored","label":"Riesgo puntuado","required":true}],"dor_criteria":[{"check":"contracts_classified","label":"Contratos clasificados","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":8,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000}},
    {"phase":"valoracion","name":"AP-04.4 HITL revision de hallazgos","description":"Abogado revisa y valida hallazgos IA; approve/correct/reject","inputs_required":["tabla_clausulas","coc_analysis","risk_scores"],"skills":[],"artifacts":["findings_validated"],"dod_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true},{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"clauses_extracted","label":"Clausulas extraidas","required":true}],"kanban_start_state":"hitl_revision","kanban_end_state":"conclusion","hitl_required":true,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe contratos","description":"Generar seccion de informe con tabla de contratos, hallazgos y CoC","inputs_required":["findings_validated","tabla_clausulas"],"skills":[],"artifacts":["seccion_informe_cont"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Acciones negociacion contratos","description":"Generar acciones de negociacion, vincular a clausulas SPA y publicar en War Room","inputs_required":["findings_validated"],"skills":[],"artifacts":["negotiation_actions"],"dod_criteria":[{"check":"actions_generated","label":"Acciones generadas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":["CONT"],"auto_approve_below_severity":"low","reviewer_role":"abogado_area","escalation_after_hours":48}'::JSONB,
  '{"project_id":"string","contract_ids":"string[]"}'::JSONB,
  '{"findings":"Finding[]","negotiation_actions":"NegotiationAction[]"}'::JSONB,
  '[]'::JSONB,
  'rpt_contratos', 'WF_CONTRATOS',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog — HITL obligatorio'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-05: IP Titularidad (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_05_pi_ip_ownership',
  'WF-05 IP Titularidad',
  'Analisis de titularidad IP: marcas, patentes, dominios, licencias y encumbrances',
  '{PI}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_05_pi_ip_ownership'),
  2,
  '[
    {"phase":"obtencion","name":"AP-05.1 Consulta registral PI","description":"Consultar OEPM, EUIPO, WIPO para marcas, patentes y disenos","inputs_required":["titular_name"],"skills":["ip_radar"],"artifacts":["registros_pi"],"dod_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"direct"}},
    {"phase":"gestion","name":"AP-05.2 Inventario PI","description":"Crear inventario de activos PI: marcas, patentes, dominios, software, secretos comerciales","inputs_required":["registros_pi"],"skills":[],"artifacts":["inventario_pi"],"dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"AP-05.3 Analisis de riesgo PI","description":"Verificar titularidad, cargas, conflictos, licencias y libertad de operacion","inputs_required":["inventario_pi"],"skills":["ip_radar"],"artifacts":["snapshot_pi","risk_analysis"],"dod_criteria":[{"check":"ownership_verified","label":"Titularidad verificada","required":true},{"check":"encumbrances_checked","label":"Cargas verificadas","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"valoracion","name":"AP-05.4 Red flags PI","description":"Rankear hallazgos PI por impacto en el deal y probabilidad de materializacion","inputs_required":["risk_analysis"],"skills":[],"artifacts":["red_flags_pi","findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"ownership_verified","label":"Titularidad verificada","required":true}],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"Seccion informe PI","description":"Generar seccion de informe con inventario, hallazgos y recomendaciones PI","inputs_required":["red_flags_pi","snapshot_pi"],"skills":[],"artifacts":["seccion_informe_pi"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Acciones PI","description":"Regularizaciones, protecciones, IP warranties y publicar en War Room","inputs_required":["red_flags_pi","seccion_informe_pi"],"skills":[],"artifacts":["acciones_pi"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"titular_name":"string"}'::JSONB,
  '{"snapshot":"object","findings":"Finding[]"}'::JSONB,
  '[]'::JSONB,
  'rpt_ip', 'WF_IP',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-06: Laboral & Fiscal — HITL (IMPLEMENTED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_06_lab_fisc_risk_register',
  'WF-06 Laboral & Fiscal (HITL)',
  'Analisis de contingencias laborales y fiscales con revision obligatoria HITL',
  '{LAB,FISC}',
  'area_multi'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_06_lab_fisc_risk_register'),
  2,
  '[
    {"phase":"obtencion","name":"AP-06.L1 Recopilacion laboral/fiscal","description":"Obtener contratos laborales, nominas, actas inspeccion, declaraciones fiscales, certificados SS","inputs_required":["project_id"],"skills":[],"artifacts":["docs_lab_fisc"],"dod_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":8,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-06.L2 Clasificacion contingencias","description":"Clasificar: laboral (litigios, inspecciones, contratos) y fiscal (impuestos, sanciones, procedimientos)","inputs_required":["docs_lab_fisc"],"skills":[],"artifacts":["contingencias_clasificadas"],"dod_criteria":[{"check":"classified","label":"Contingencias clasificadas","required":true}],"dor_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"AP-06.F1 Analisis IA contingencias","description":"IA analiza riesgo: probabilidad, impacto economico, prescripcion, provisiones","inputs_required":["contingencias_clasificadas"],"skills":["lab_contingencias_laborales","lab_contingencias_estimador","fisc_contingencias_fiscales","fisc_riesgo_inspeccion"],"artifacts":["risk_register","estimacion_economica"],"dod_criteria":[{"check":"risks_analyzed","label":"Riesgos analizados","required":true},{"check":"amounts_estimated","label":"Montos estimados","required":true}],"dor_criteria":[{"check":"classified","label":"Contingencias clasificadas","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":8,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000}},
    {"phase":"valoracion","name":"AP-06.F2 HITL revision obligatoria","description":"Abogado laboral/fiscal valida hallazgos, montos y clasificacion de probabilidad","inputs_required":["risk_register","estimacion_economica"],"skills":[],"artifacts":["findings_validated"],"dod_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true},{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"risks_analyzed","label":"Riesgos analizados","required":true}],"kanban_start_state":"hitl_revision","kanban_end_state":"conclusion","hitl_required":true,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"AP-06.F3 Seccion informe lab/fisc","description":"Generar seccion de informe con risk register, estimaciones y recomendaciones","inputs_required":["findings_validated","risk_register"],"skills":[],"artifacts":["seccion_informe_lab_fisc"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Mitigacion y negociacion lab/fisc","description":"Proponer indemnidades, caps, escrow, clausulas SPA y publicar en War Room","inputs_required":["findings_validated","seccion_informe_lab_fisc"],"skills":[],"artifacts":["negotiation_actions"],"dod_criteria":[{"check":"actions_generated","label":"Acciones generadas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":["LAB","FISC"],"auto_approve_below_severity":"low","reviewer_role":"abogado_area","escalation_after_hours":48}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{"risk_register":"RiskItem[]","findings":"Finding[]"}'::JSONB,
  '[]'::JSONB,
  'rpt_lab_fisc', 'WF_LAB_FISC',
  true, NOW(), 'v2: 6-phase upgrade from YAML v1 catalog — HITL obligatorio LAB/FISC'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-07: Inmobiliario (PLANNED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_07_inm_real_estate',
  'WF-07 Inmobiliario',
  'Analisis de activos inmobiliarios: titularidad, cargas, urbanismo, arrendamientos',
  '{INM}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_07_inm_real_estate'),
  1,
  '[
    {"phase":"obtencion","name":"AP-07.1 Consulta Registro Propiedad","description":"Obtener notas simples, cargas y certificaciones registrales","inputs_required":["fincas_ids"],"skills":[],"artifacts":["notas_simples"],"dod_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-07.2 Inventario inmobiliario","description":"Crear inventario de activos inmobiliarios con datos registrales","inputs_required":["notas_simples"],"skills":[],"artifacts":["inventario_inm"],"dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis titularidad y cargas","description":"Verificar titularidad, cargas, servidumbres y situacion urbanistica","inputs_required":["inventario_inm"],"skills":[],"artifacts":["analisis_inm"],"dod_criteria":[{"check":"ownership_verified","label":"Titularidad verificada","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"Valoracion riesgos inmobiliarios","description":"Rankear hallazgos inmobiliarios por impacto","inputs_required":["analisis_inm"],"skills":[],"artifacts":["findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe inmobiliario","description":"Generar seccion de informe inmobiliario","inputs_required":["findings_ranked"],"skills":[],"artifacts":["seccion_informe_inm"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones inmobiliarias","description":"Proponer regularizaciones y clausulas SPA inmobiliarias","inputs_required":["findings_ranked"],"skills":[],"artifacts":["acciones_inm"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"fincas_ids":"string[]"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-08: Litigios — HITL (PLANNED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_08_litigation',
  'WF-08 Litigios (HITL)',
  'Analisis de litigios y procedimientos judiciales/arbitrales con HITL obligatorio',
  '{LIT}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_08_litigation'),
  1,
  '[
    {"phase":"obtencion","name":"AP-08.1 Recopilacion litigios","description":"Obtener demandas, laudos, actas de conciliacion y expedientes judiciales","inputs_required":["project_id"],"skills":[],"artifacts":["expedientes_lit"],"dod_criteria":[{"check":"cases_collected","label":"Expedientes recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-08.2 Clasificacion litigios","description":"Clasificar por tipo, jurisdiccion, cuantia y estado procesal","inputs_required":["expedientes_lit"],"skills":[],"artifacts":["litigios_clasificados"],"dod_criteria":[{"check":"cases_classified","label":"Litigios clasificados","required":true}],"dor_criteria":[{"check":"cases_collected","label":"Expedientes recopilados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis riesgo procesal","description":"Evaluar probabilidad de perdida, impacto economico y prescripcion","inputs_required":["litigios_clasificados"],"skills":[],"artifacts":["risk_register_lit"],"dod_criteria":[{"check":"risks_analyzed","label":"Riesgos analizados","required":true}],"dor_criteria":[{"check":"cases_classified","label":"Litigios clasificados","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":8,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"HITL revision litigios","description":"Abogado procesal valida hallazgos y estimaciones","inputs_required":["risk_register_lit"],"skills":[],"artifacts":["findings_validated"],"dod_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true}],"dor_criteria":[{"check":"risks_analyzed","label":"Riesgos analizados","required":true}],"kanban_start_state":"hitl_revision","kanban_end_state":"conclusion","hitl_required":true,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe litigios","description":"Generar seccion de informe con risk register de litigios","inputs_required":["findings_validated"],"skills":[],"artifacts":["seccion_informe_lit"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones litigios","description":"Proponer indemnidades, escrow y clausulas SPA para litigios","inputs_required":["findings_validated"],"skills":[],"artifacts":["acciones_lit"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":["LIT"],"auto_approve_below_severity":"low","reviewer_role":"abogado_area","escalation_after_hours":48}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog — HITL obligatorio'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-09: Regulatorio (PLANNED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_09_regulatory_licenses',
  'WF-09 Regulatorio',
  'Analisis de licencias, autorizaciones y cumplimiento regulatorio sectorial',
  '{REG}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_09_regulatory_licenses'),
  1,
  '[
    {"phase":"obtencion","name":"AP-09.1 Recopilacion regulatoria","description":"Obtener licencias, autorizaciones, permisos y comunicaciones regulatorias","inputs_required":["project_id"],"skills":[],"artifacts":["docs_reg"],"dod_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"AP-09.2 Inventario licencias","description":"Crear inventario de licencias con fechas de vigencia y condiciones","inputs_required":["docs_reg"],"skills":[],"artifacts":["inventario_licencias"],"dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis cumplimiento regulatorio","description":"Verificar cumplimiento, change of control regulatorio y riesgos de revocacion","inputs_required":["inventario_licencias"],"skills":[],"artifacts":["analisis_reg"],"dod_criteria":[{"check":"compliance_verified","label":"Cumplimiento verificado","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"Valoracion riesgos regulatorios","description":"Rankear hallazgos regulatorios por impacto en el deal","inputs_required":["analisis_reg"],"skills":[],"artifacts":["findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe regulatorio","description":"Generar seccion de informe regulatorio","inputs_required":["findings_ranked"],"skills":[],"artifacts":["seccion_informe_reg"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones regulatorias","description":"Proponer CP regulatorias y clausulas SPA","inputs_required":["findings_ranked"],"skills":[],"artifacts":["acciones_reg"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-10: Medioambiental (PLANNED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_10_environmental',
  'WF-10 Medioambiental',
  'Analisis de riesgos medioambientales: permisos, suelos contaminados, emisiones',
  '{ENV}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_10_environmental'),
  1,
  '[
    {"phase":"obtencion","name":"AP-10.1 Recopilacion medioambiental","description":"Obtener licencias ambientales, estudios de impacto, informes de suelos","inputs_required":["project_id"],"skills":[],"artifacts":["docs_env"],"dod_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"Inventario permisos ambientales","description":"Crear inventario de permisos, autorizaciones y obligaciones ambientales","inputs_required":["docs_env"],"skills":[],"artifacts":["inventario_env"],"dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis riesgo ambiental","description":"Evaluar riesgos de contaminacion, cumplimiento y pasivos ambientales","inputs_required":["inventario_env"],"skills":[],"artifacts":["analisis_env"],"dod_criteria":[{"check":"risks_analyzed","label":"Riesgos analizados","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"Valoracion riesgos ambientales","description":"Rankear hallazgos ambientales por impacto economico y regulatorio","inputs_required":["analisis_env"],"skills":[],"artifacts":["findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe medioambiental","description":"Generar seccion de informe medioambiental","inputs_required":["findings_ranked"],"skills":[],"artifacts":["seccion_informe_env"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones medioambientales","description":"Proponer indemnidades ambientales y clausulas SPA","inputs_required":["findings_ranked"],"skills":[],"artifacts":["acciones_env"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-11: Proteccion Datos (PLANNED)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_11_data_privacy_compliance',
  'WF-11 Proteccion Datos',
  'Analisis de cumplimiento en proteccion de datos: RGPD, transferencias internacionales, DPO',
  '{DATA}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_11_data_privacy_compliance'),
  1,
  '[
    {"phase":"obtencion","name":"AP-11.1 Recopilacion proteccion datos","description":"Obtener registros de actividades, contratos de encargado, politicas de privacidad","inputs_required":["project_id"],"skills":[],"artifacts":["docs_data"],"dod_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"gestion","name":"Inventario tratamientos datos","description":"Crear inventario de tratamientos, bases legitimadoras y transferencias","inputs_required":["docs_data"],"skills":[],"artifacts":["inventario_data"],"dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"kanban_start_state":"info_recibida","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis cumplimiento RGPD","description":"Evaluar cumplimiento RGPD, transferencias internacionales y brechas de seguridad","inputs_required":["inventario_data"],"skills":[],"artifacts":["analisis_data"],"dod_criteria":[{"check":"compliance_verified","label":"Cumplimiento verificado","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"Valoracion riesgos datos","description":"Rankear hallazgos de proteccion de datos por impacto sancionador","inputs_required":["analisis_data"],"skills":[],"artifacts":["findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe proteccion datos","description":"Generar seccion de informe de proteccion de datos","inputs_required":["findings_ranked"],"skills":[],"artifacts":["seccion_informe_data"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones proteccion datos","description":"Proponer remediation plan y clausulas SPA de proteccion de datos","inputs_required":["findings_ranked"],"skills":[],"artifacts":["acciones_data"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"project_id":"string"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-12: Competencia (PLANNED) — 5 phases (no gestion)
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_12_competition_filing',
  'WF-12 Competencia',
  'Analisis de competencia: filing obligations, merger control, concentraciones',
  '{COMP}',
  'area'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_12_competition_filing'),
  1,
  '[
    {"phase":"obtencion","name":"AP-12.1 Recopilacion competencia","description":"Obtener datos de mercado, cuotas, notificaciones previas y acuerdos verticales","inputs_required":["project_id","sector"],"skills":[],"artifacts":["docs_comp"],"dod_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"info_recibida","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis filing obligations","description":"Evaluar obligaciones de notificacion en jurisdicciones relevantes","inputs_required":["docs_comp"],"skills":[],"artifacts":["analisis_comp"],"dod_criteria":[{"check":"filing_analyzed","label":"Filing analizado","required":true}],"dor_criteria":[{"check":"docs_collected","label":"Documentos recopilados","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":6,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"valoracion","name":"Valoracion riesgos competencia","description":"Evaluar riesgo de objecion, remedies y timing","inputs_required":["analisis_comp"],"skills":[],"artifacts":["findings_ranked"],"dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"informe","name":"Seccion informe competencia","description":"Generar seccion de informe de competencia","inputs_required":["findings_ranked"],"skills":[],"artifacts":["seccion_informe_comp"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"propuesta_transaccional","name":"Acciones competencia","description":"Proponer CP de filing, remedies y clausulas SPA de competencia","inputs_required":["findings_ranked"],"skills":[],"artifacts":["acciones_comp"],"dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"project_id":"string","sector":"string"}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB,
  NULL, NULL,
  false, NULL, 'v1: planned — skeleton from YAML v1 catalog — 5 phases (no gestion)'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-13: Consolidacion Contingencias (SYNTHESIS — IMPLEMENTED)
-- 5 phases: gestion, analisis, valoracion, informe, propuesta_transaccional
-- Dependencies: wf_03, wf_04, wf_05, wf_06
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_13_cross_contingencies_register',
  'WF-13 Consolidacion Contingencias',
  'Consolidar contingencias de todas las areas en un registro unico con valoracion economica agregada',
  '{GENERAL}',
  'synthesis'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_13_cross_contingencies_register'),
  1,
  '[
    {"phase":"gestion","name":"Recopilacion cross-area","description":"Consolidar hallazgos y contingencias de WF-03 societario, WF-04 contratos, WF-05 IP y WF-06 laboral/fiscal","inputs_required":["wf_03_findings","wf_04_findings","wf_05_findings","wf_06_findings"],"skills":[],"artifacts":["consolidated_findings"],"dod_criteria":[{"check":"all_areas_consolidated","label":"Todas las areas consolidadas","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Analisis cruzado contingencias","description":"Detectar solapamientos, dependencias entre contingencias y patrones cross-area","inputs_required":["consolidated_findings"],"skills":[],"artifacts":["cross_analysis","dependency_map"],"dod_criteria":[{"check":"cross_analysis_done","label":"Analisis cruzado completado","required":true},{"check":"dependencies_mapped","label":"Dependencias mapeadas","required":true}],"dor_criteria":[{"check":"all_areas_consolidated","label":"Todas las areas consolidadas","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"valoracion","name":"Valoracion economica agregada","description":"Calcular impacto economico total, categorizar por probabilidad y generar rango de contingencias","inputs_required":["cross_analysis"],"skills":[],"artifacts":["contingency_register","economic_summary"],"dod_criteria":[{"check":"total_impact_calculated","label":"Impacto total calculado","required":true},{"check":"ranges_defined","label":"Rangos definidos","required":true}],"dor_criteria":[{"check":"cross_analysis_done","label":"Analisis cruzado completado","required":true}],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"Seccion registro contingencias","description":"Generar seccion de informe con registro consolidado de contingencias","inputs_required":["contingency_register","economic_summary"],"skills":[],"artifacts":["seccion_contingencias"],"dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"total_impact_calculated","label":"Impacto total calculado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Propuesta transaccional consolidada","description":"Generar propuesta transaccional consolidada con impacto en precio, indemnidades y escrow","inputs_required":["contingency_register","economic_summary"],"skills":[],"artifacts":["propuesta_consolidada"],"dod_criteria":[{"check":"proposal_generated","label":"Propuesta generada","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"low"}'::JSONB,
  '{"wf_instance_ids":"string[]"}'::JSONB,
  '{"contingency_register":"ContingencyItem[]","total_impact":"EconomicRange"}'::JSONB,
  '[]'::JSONB,
  'rpt_contingencias', 'WF_CONTINGENCIAS',
  true, NOW(), 'v1: synthesis workflow — depends on WF-03, WF-04, WF-05, WF-06'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-14: Red Flag Report (DELIVERABLE — IMPLEMENTED)
-- 4 phases: analisis, valoracion, informe, propuesta_transaccional
-- Dependencies: wf_13
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_14_red_flag_report',
  'WF-14 Red Flag Report',
  'Generar Red Flag Report ejecutivo con deal breakers y recomendaciones go/no-go',
  '{GENERAL}',
  'deliverable'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_14_red_flag_report'),
  1,
  '[
    {"phase":"analisis","name":"Seleccion red flags","description":"Filtrar hallazgos criticos y deal breakers del registro de contingencias","inputs_required":["contingency_register"],"skills":[],"artifacts":["red_flags_selected"],"dod_criteria":[{"check":"red_flags_filtered","label":"Red flags filtrados","required":true}],"dor_criteria":[],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"valoracion","name":"Scoring deal breakers","description":"Asignar scoring go/no-go a cada red flag con justificacion","inputs_required":["red_flags_selected"],"skills":[],"artifacts":["scored_red_flags"],"dod_criteria":[{"check":"scoring_complete","label":"Scoring completado","required":true}],"dor_criteria":[{"check":"red_flags_filtered","label":"Red flags filtrados","required":true}],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"Generacion Red Flag Report","description":"Generar documento ejecutivo Red Flag Report con formato estandar","inputs_required":["scored_red_flags"],"skills":[],"artifacts":["red_flag_report"],"dod_criteria":[{"check":"report_generated","label":"Report generado","required":true}],"dor_criteria":[{"check":"scoring_complete","label":"Scoring completado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Recomendaciones go/no-go","description":"Publicar Red Flag Report en War Room con recomendacion go/no-go","inputs_required":["red_flag_report"],"skills":[],"artifacts":["war_room_decision"],"dod_criteria":[{"check":"published_to_war_room","label":"Publicado en War Room","required":true}],"dor_criteria":[{"check":"report_generated","label":"Report generado","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":1,"gateway_config":{"route":"none","grounding_mode":"none"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"informational"}'::JSONB,
  '{"contingency_register_id":"string"}'::JSONB,
  '{"red_flag_report":"Report","recommendation":"string"}'::JSONB,
  '[]'::JSONB,
  'rpt_red_flag', 'WF_RED_FLAG',
  true, NOW(), 'v1: deliverable workflow — depends on WF-13'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-15: Mapeo SPA (NEGOTIATION — IMPLEMENTED)
-- 4 phases: analisis, valoracion, propuesta_transaccional, informe
-- Dependencies: wf_13
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_15_spa_mapping',
  'WF-15 Mapeo SPA',
  'Mapear hallazgos DD a clausulas SPA: reps&warranties, indemnidades, CP, covenants',
  '{GENERAL}',
  'negotiation'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_15_spa_mapping'),
  1,
  '[
    {"phase":"analisis","name":"Mapeo findings a clausulas","description":"Vincular cada hallazgo/contingencia a clausulas SPA relevantes","inputs_required":["contingency_register","spa_template"],"skills":[],"artifacts":["finding_clause_map"],"dod_criteria":[{"check":"mapping_complete","label":"Mapeo completado","required":true}],"dor_criteria":[],"kanban_start_state":"en_analisis","kanban_end_state":"ia_propuesta","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"valoracion","name":"Priorizacion clausulas SPA","description":"Priorizar clausulas por impacto economico y riesgo de negociacion","inputs_required":["finding_clause_map"],"skills":[],"artifacts":["prioritized_clauses"],"dod_criteria":[{"check":"clauses_prioritized","label":"Clausulas priorizadas","required":true}],"dor_criteria":[{"check":"mapping_complete","label":"Mapeo completado","required":true}],"kanban_start_state":"ia_propuesta","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"propuesta_transaccional","name":"Propuesta negociacion SPA","description":"Generar propuesta de redaccion de clausulas SPA con posiciones y fallback","inputs_required":["prioritized_clauses"],"skills":[],"artifacts":["spa_negotiation_pack"],"dod_criteria":[{"check":"proposal_generated","label":"Propuesta generada","required":true}],"dor_criteria":[{"check":"clauses_prioritized","label":"Clausulas priorizadas","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"SPA Markup Document","description":"Generar documento de markup SPA con clausulas propuestas y justificaciones","inputs_required":["spa_negotiation_pack"],"skills":[],"artifacts":["spa_markup_doc"],"dod_criteria":[{"check":"markup_generated","label":"Markup generado","required":true}],"dor_criteria":[{"check":"proposal_generated","label":"Propuesta generada","required":true}],"kanban_start_state":"integrado_en_informe","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"informational"}'::JSONB,
  '{"contingency_register_id":"string","spa_template_id":"string"}'::JSONB,
  '{"spa_markup":"Document","negotiation_actions":"NegotiationAction[]"}'::JSONB,
  '[]'::JSONB,
  'rpt_spa_mapping', 'WF_SPA_MAPPING',
  true, NOW(), 'v1: negotiation workflow — depends on WF-13'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

-- ============================================================
-- WF-16: Informe Final (DELIVERABLE — IMPLEMENTED)
-- 3 phases: gestion, analisis, informe
-- Dependencies: wf_03, wf_04, wf_05, wf_06
-- ============================================================
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'wf_16_final_report_pack',
  'WF-16 Informe Final',
  'Compilar informe final de DD con todas las secciones, executive summary y evidence pack',
  '{GENERAL}',
  'deliverable'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_codes = EXCLUDED.area_codes,
  category = EXCLUDED.category;

INSERT INTO dd_workflow_template_versions (
  template_id, version_number, phases, hitl_policy,
  input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key,
  is_published, published_at, changelog
) VALUES (
  (SELECT id FROM dd_workflow_templates WHERE template_key = 'wf_16_final_report_pack'),
  1,
  '[
    {"phase":"gestion","name":"Recopilacion secciones","description":"Recopilar todas las secciones de informe generadas por WF-03 a WF-06 y WF-13","inputs_required":["wf_03_report_section","wf_04_report_section","wf_05_report_section","wf_06_report_section","wf_13_contingency_section"],"skills":[],"artifacts":["collected_sections"],"dod_criteria":[{"check":"all_sections_collected","label":"Todas las secciones recopiladas","required":true}],"dor_criteria":[],"kanban_start_state":"backlog","kanban_end_state":"lista_para_analisis","hitl_required":false,"estimated_duration_hours":2,"gateway_config":{"route":"none","grounding_mode":"none"}},
    {"phase":"analisis","name":"Executive summary + consistencia","description":"Generar executive summary, verificar consistencia entre secciones y compilar evidence pack","inputs_required":["collected_sections"],"skills":[],"artifacts":["executive_summary","consistency_check","evidence_pack"],"dod_criteria":[{"check":"executive_summary_generated","label":"Executive summary generado","required":true},{"check":"consistency_verified","label":"Consistencia verificada","required":true},{"check":"evidence_pack_compiled","label":"Evidence pack compilado","required":true}],"dor_criteria":[{"check":"all_sections_collected","label":"Todas las secciones recopiladas","required":true}],"kanban_start_state":"en_analisis","kanban_end_state":"conclusion","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}},
    {"phase":"informe","name":"Compilacion informe final","description":"Compilar documento final con portada, indice, executive summary, secciones y anexos","inputs_required":["executive_summary","collected_sections","evidence_pack"],"skills":[],"artifacts":["informe_final","report_pack"],"dod_criteria":[{"check":"final_report_compiled","label":"Informe final compilado","required":true},{"check":"report_pack_ready","label":"Report pack listo","required":true}],"dor_criteria":[{"check":"executive_summary_generated","label":"Executive summary generado","required":true}],"kanban_start_state":"conclusion","kanban_end_state":"integrado_en_informe","hitl_required":false,"estimated_duration_hours":4,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"}}
  ]'::JSONB,
  '{"required_areas":[],"auto_approve_below_severity":"informational"}'::JSONB,
  '{"wf_instance_ids":"string[]"}'::JSONB,
  '{"informe_final":"Report","evidence_pack":"EvidencePack"}'::JSONB,
  '[]'::JSONB,
  'rpt_informe_final', 'WF_INFORME_FINAL',
  true, NOW(), 'v1: deliverable workflow — depends on WF-03, WF-04, WF-05, WF-06'
)
ON CONFLICT (template_id, version_number) DO UPDATE SET
  phases = EXCLUDED.phases,
  hitl_policy = EXCLUDED.hitl_policy,
  changelog = EXCLUDED.changelog;

COMMIT;
