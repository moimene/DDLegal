-- ============================================================
-- Migration: 202602270007_area_skills_publish_wf07_12.sql
-- Purpose: Create 15 new skills for 6 area workflows,
--          wire skills into phases, publish WF-07 to WF-12
-- ============================================================

-- ============================================================
-- PART 1: Insert 15 new skills into dd_skills_catalog
-- ============================================================

-- WF-07 INM: 2 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('inmobiliario.titularidad_registral', 'Titularidad Registral',
 'Consulta y verifica la titularidad registral de los inmuebles del target en el Registro de la Propiedad',
 'inmobiliario', 'INM',
 'Analiza las notas simples proporcionadas. Para cada finca: (1) verifica la titularidad dominical, (2) identifica discrepancias entre titularidad registral y catastral, (3) detecta si hay limitaciones de poder de disposicion. Formato: tabla con finca_id, titular_registral, coincide_catastro (si/no), limitaciones.',
 true, 1, 'P1'),
('inmobiliario.cargas_gravamenes', 'Cargas y Gravamenes',
 'Identifica todas las cargas, gravamenes, servidumbres y limitaciones sobre los inmuebles',
 'inmobiliario', 'INM',
 'Analiza las notas simples y certificaciones registrales. Para cada finca: (1) lista hipotecas (acreedor, importe, vencimiento), (2) identifica servidumbres (tipo, beneficiario), (3) detecta embargos o anotaciones preventivas, (4) verifica afecciones urbanisticas. Clasifica cada carga por impacto en la transaccion: blocking / material / informational.',
 true, 1, 'P1');

-- WF-08 LIT: 2 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('litigios.reclamaciones_potenciales', 'Reclamaciones Potenciales',
 'Identifica reclamaciones potenciales no materializadas en procedimientos judiciales',
 'litigios', 'LIT',
 'Analiza la documentacion proporcionada (contratos, comunicaciones, actas) para identificar reclamaciones potenciales que aun no se han materializado en procedimientos. Para cada una: (1) descripcion del riesgo, (2) contrapartes potenciales, (3) cuantia estimada, (4) probabilidad de materializacion (alta/media/baja), (5) plazo estimado de prescripcion.',
 true, 1, 'P1'),
('litigios.arbitrajes', 'Arbitrajes',
 'Analiza procedimientos arbitrales activos y clausulas arbitrales en contratos del target',
 'litigios', 'LIT',
 'Revisa: (1) arbitrajes pendientes (institucion, cuantia, fase procesal, fecha estimada laudo), (2) clausulas arbitrales en contratos materiales (institucion, sede, idioma, ley aplicable), (3) laudos firmes pendientes de ejecucion. Clasifica por impacto economico y probabilidad de resultado adverso.',
 true, 1, 'P1');

-- WF-09 REG: 2 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('regulatorio.cumplimiento_sectorial', 'Cumplimiento Sectorial',
 'Evalua el cumplimiento de normativa sectorial especifica del target',
 'regulatorio', 'REG',
 'Identifica la normativa sectorial aplicable al target segun su actividad (financiero, energetico, salud, telecomunicaciones, etc). Para cada norma: (1) obligaciones principales, (2) estado de cumplimiento (cumple/parcial/no cumple), (3) organismo regulador competente, (4) riesgo de sancion. Genera tabla resumen con gap analysis.',
 true, 1, 'P1'),
('regulatorio.sanciones_historial', 'Historial de Sanciones',
 'Revisa el historial de sanciones administrativas e infracciones regulatorias',
 'regulatorio', 'REG',
 'Analiza: (1) sanciones administrativas firmes (organismo, cuantia, fecha, motivo), (2) expedientes sancionadores en curso, (3) requerimientos regulatorios pendientes de cumplimiento, (4) planes de correccion comprometidos. Clasifica por gravedad y potencial recurrencia.',
 true, 1, 'P1');

-- WF-10 ENV: 2 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('medioambiental.pasivos_ambientales', 'Pasivos Ambientales',
 'Identifica pasivos ambientales existentes y potenciales del target',
 'medioambiental', 'ENV',
 'Evalua: (1) pasivos ambientales conocidos (remediaciones pendientes, multas, compromisos), (2) riesgos ambientales potenciales por actividad historica, (3) seguros ambientales vigentes y cobertura, (4) provisiones contables por temas ambientales. Para cada pasivo: cuantificacion estimada, plazo de remediacion, responsable.',
 true, 1, 'P1'),
('medioambiental.suelos_contaminados', 'Suelos Contaminados',
 'Analiza el estado de contaminacion de suelos en inmuebles del target',
 'medioambiental', 'ENV',
 'Revisa: (1) estudios de suelos disponibles (fecha, laboratorio, resultados), (2) declaracion de suelos contaminados (registro CCAA), (3) obligaciones de descontaminacion pendientes, (4) actividades potencialmente contaminantes historicas en los emplazamientos. Clasifica cada emplazamiento: limpio / investigacion requerida / contaminado declarado.',
 true, 1, 'P1');

-- WF-11 DATA: 4 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('datos.registro_actividades', 'Registro de Actividades de Tratamiento',
 'Revisa el registro de actividades de tratamiento (RAT) del target conforme al art. 30 RGPD',
 'datos', 'DATA',
 'Analiza el RAT: (1) completitud (todos los tratamientos documentados), (2) base legal de cada tratamiento (consentimiento, interes legitimo, ejecucion contrato, etc), (3) categorias de datos tratados y si hay datos sensibles (art. 9), (4) plazos de conservacion definidos, (5) identificacion de encargados de tratamiento. Genera gap list con deficiencias.',
 true, 1, 'P1'),
('datos.base_legal_tratamiento', 'Base Legal del Tratamiento',
 'Verifica la base legal de los tratamientos de datos personales del target',
 'datos', 'DATA',
 'Para cada tratamiento identificado: (1) valida la base legal invocada (art. 6 RGPD), (2) verifica que el consentimiento (si aplica) cumple requisitos (libre, especifico, informado, inequivoco), (3) revisa clausulas informativas (arts. 13-14), (4) verifica existencia de evaluaciones de impacto (EIPD) cuando sean obligatorias. Clasifica riesgos: alto/medio/bajo.',
 true, 1, 'P1'),
('datos.transferencias_internacionales', 'Transferencias Internacionales',
 'Analiza las transferencias internacionales de datos del target',
 'datos', 'DATA',
 'Identifica: (1) transferencias a terceros paises (destino, base legal: decisiones adecuacion, clausulas contractuales tipo, BCR), (2) uso de proveedores cloud con servidores fuera del EEE, (3) cumplimiento post-Schrems II (medidas suplementarias), (4) mecanismos de transferencia contractuales vigentes. Genera mapa de flujos transfronterizos con evaluacion de riesgo.',
 true, 1, 'P1'),
('datos.brechas_historico', 'Historico de Brechas de Seguridad',
 'Revisa el historico de brechas de seguridad y procedimiento de notificacion',
 'datos', 'DATA',
 'Analiza: (1) registro de incidentes de seguridad (ultimos 5 anos), (2) brechas notificadas a AEPD (fecha, alcance, datos afectados), (3) notificaciones a interesados, (4) medidas correctivas implementadas, (5) procedimiento de gestion de brechas (deteccion, evaluacion, notificacion 72h). Evalua madurez del proceso: maduro/en desarrollo/inexistente.',
 true, 1, 'P1');

-- WF-12 COMP: 3 new skills
INSERT INTO dd_skills_catalog (skill_key, name, description, category, area_code, prompt_template, is_active, version, priority) VALUES
('competencia.notificacion_obligatoria', 'Notificacion Obligatoria de Concentracion',
 'Evalua si la operacion requiere notificacion previa ante autoridades de competencia',
 'competencia', 'COMP',
 'Analiza: (1) umbrales de notificacion (CNMC: volumen negocios combinado >240M o individual >60M; UE: Reglamento 139/2004), (2) ambito geografico relevante, (3) cuotas de mercado combinadas post-operacion, (4) timeline obligatorio (suspension de cierre hasta autorizacion). Determina: notificacion_obligatoria (si/no), jurisdicciones aplicables, tipo de procedimiento estimado (simplificado/ordinario).',
 true, 1, 'P1'),
('competencia.ayudas_estado', 'Ayudas de Estado',
 'Identifica ayudas de estado recibidas por el target y evalua riesgos de reembolso',
 'competencia', 'COMP',
 'Revisa: (1) subvenciones publicas recibidas (organismo, cuantia, finalidad, fecha), (2) beneficios fiscales especiales, (3) prestamos en condiciones ventajosas de entidades publicas, (4) si las ayudas fueron notificadas/autorizadas por la Comision Europea, (5) riesgo de calificacion como ayuda ilegal y obligacion de reembolso. Clasifica por riesgo de recovery.',
 true, 1, 'P1'),
('competencia.acuerdos_verticales', 'Acuerdos Verticales y Horizontales',
 'Analiza acuerdos restrictivos de la competencia en los que participa el target',
 'competencia', 'COMP',
 'Analiza: (1) acuerdos de distribucion exclusiva/selectiva, (2) clausulas de no competencia (duracion, ambito), (3) acuerdos de fijacion de precios o reparto de mercado, (4) intercambio de informacion competitivamente sensible, (5) programas de compliance de competencia existentes. Para cada acuerdo: evaluar si encaja en exencion por categorias (Reglamento 2022/720) o requiere evaluacion individual.',
 true, 1, 'P1');


-- ============================================================
-- PART 2: Create v2 versions with skills wired into phases + publish
-- ============================================================

-- WF-07 Inmobiliario — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  '2a641adf-946a-439b-b28e-0a8ebb0ee9e8', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-07.1 Consulta Registro Propiedad","phase":"obtencion","skills":["inmobiliario.titularidad_registral"],"artifacts":["notas_simples"],"description":"Obtener notas simples, cargas y certificaciones registrales","dod_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["fincas_ids"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-07.2 Inventario inmobiliario","phase":"gestion","skills":["inmobiliario.ficha_inmuebles"],"artifacts":["inventario_inm"],"description":"Crear inventario de activos inmobiliarios con datos registrales","dod_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"dor_criteria":[{"check":"registries_queried","label":"Registros consultados","required":true}],"hitl_required":false,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["notas_simples"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":4},
    {"name":"AP-07.3 Analisis titularidad y cargas","phase":"analisis","skills":["inmobiliario.cargas_gravamenes","inmobiliario.licencias_urbanisticas"],"artifacts":["analisis_inm"],"description":"Verificar titularidad, cargas, servidumbres y situacion urbanistica","dod_criteria":[{"check":"ownership_verified","label":"Titularidad verificada","required":true}],"dor_criteria":[{"check":"inventory_created","label":"Inventario creado","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["inventario_inm"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":6},
    {"name":"AP-07.4 Valoracion riesgos inmobiliarios","phase":"valoracion","skills":["inmobiliario.contingencias_inmobiliarias"],"artifacts":["findings_ranked"],"description":"Rankear hallazgos inmobiliarios por impacto","dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_inm"],"kanban_end_state":"conclusion","kanban_start_state":"ia_propuesta","estimated_duration_hours":2},
    {"name":"AP-07.5 Seccion informe inmobiliario","phase":"informe","skills":[],"artifacts":["seccion_informe_inm"],"description":"Generar seccion de informe inmobiliario","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-07.6 Acciones inmobiliarias","phase":"propuesta_transaccional","skills":["inmobiliario.arrendamientos"],"artifacts":["acciones_inm"],"description":"Proponer regularizaciones y clausulas SPA inmobiliarias","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":[],"auto_approve_confidence":0.85}'::jsonb,
  '{"fincas_ids":"string[]"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["notas_simples","certificaciones_registrales"]}'::jsonb,
  'rpt_area_inm', 'WF_INM'
);

-- WF-08 Litigios — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  '40afa5fb-b5de-440a-a518-cf693cf0efbb', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-08.1 Inventario procedimientos","phase":"obtencion","skills":["litigios.ficha_procedimientos"],"artifacts":["inventario_litigios"],"description":"Recopilar e inventariar todos los procedimientos activos","dod_criteria":[{"check":"procedures_inventoried","label":"Procedimientos inventariados","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["project_id"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-08.2 Identificacion reclamaciones potenciales","phase":"gestion","skills":["litigios.reclamaciones_potenciales"],"artifacts":["mapa_reclamaciones"],"description":"Identificar reclamaciones no materializadas en procedimientos","dod_criteria":[{"check":"claims_mapped","label":"Reclamaciones mapeadas","required":true}],"dor_criteria":[{"check":"procedures_inventoried","label":"Procedimientos inventariados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["inventario_litigios"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":4},
    {"name":"AP-08.3 Analisis contingencias y arbitrajes","phase":"analisis","skills":["litigios.contingencias_litigiosas","litigios.arbitrajes"],"artifacts":["analisis_litigios"],"description":"Analizar contingencias litigiosas y arbitrajes activos","dod_criteria":[{"check":"contingencies_analyzed","label":"Contingencias analizadas","required":true}],"dor_criteria":[{"check":"claims_mapped","label":"Reclamaciones mapeadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["inventario_litigios","mapa_reclamaciones"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":8},
    {"name":"AP-08.4 HITL revision hallazgos litigiosos","phase":"valoracion","skills":[],"artifacts":["findings_validated"],"description":"Abogado revisa y valida hallazgos litigiosos","dod_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true},{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"contingencies_analyzed","label":"Contingencias analizadas","required":true}],"hitl_required":true,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["analisis_litigios"],"kanban_end_state":"conclusion","kanban_start_state":"hitl_revision","estimated_duration_hours":4},
    {"name":"AP-08.5 Seccion informe litigios","phase":"informe","skills":[],"artifacts":["seccion_informe_lit"],"description":"Generar seccion de informe con mapa de litigios y contingencias","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"hitl_completed","label":"HITL completado","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_validated"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-08.6 Acciones litigiosas","phase":"propuesta_transaccional","skills":[],"artifacts":["negotiation_actions"],"description":"Proponer provisiones, indemnidades especificas y clausulas SPA","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_validated"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":["LIT"],"auto_approve_confidence":0.80}'::jsonb,
  '{"project_id":"uuid"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["escritos_demanda","sentencias","laudos"]}'::jsonb,
  'rpt_area_lit', 'WF_LIT'
);

-- WF-09 Regulatorio — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  'c986021f-d3c5-4c0b-b88a-9da4bc859051', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-09.1 Inventario licencias y permisos","phase":"obtencion","skills":["regulatorio.licencias_autorizaciones"],"artifacts":["inventario_licencias"],"description":"Recopilar licencias, autorizaciones y permisos del target","dod_criteria":[{"check":"licenses_inventoried","label":"Licencias inventariadas","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["project_id"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-09.2 Historial de sanciones","phase":"gestion","skills":["regulatorio.sanciones_historial"],"artifacts":["historial_sanciones"],"description":"Revisar historial de sanciones e infracciones regulatorias","dod_criteria":[{"check":"sanctions_reviewed","label":"Sanciones revisadas","required":true}],"dor_criteria":[{"check":"licenses_inventoried","label":"Licencias inventariadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["inventario_licencias"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":4},
    {"name":"AP-09.3 Analisis cumplimiento sectorial","phase":"analisis","skills":["regulatorio.cumplimiento_sectorial","regulatorio.contingencias_regulatorias"],"artifacts":["analisis_regulatorio"],"description":"Evaluar cumplimiento normativo sectorial y contingencias","dod_criteria":[{"check":"compliance_analyzed","label":"Cumplimiento analizado","required":true}],"dor_criteria":[{"check":"sanctions_reviewed","label":"Sanciones revisadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["inventario_licencias","historial_sanciones"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":6},
    {"name":"AP-09.4 Valoracion riesgos regulatorios","phase":"valoracion","skills":[],"artifacts":["findings_ranked"],"description":"Rankear hallazgos regulatorios por impacto y probabilidad","dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"compliance_analyzed","label":"Cumplimiento analizado","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_regulatorio"],"kanban_end_state":"conclusion","kanban_start_state":"ia_propuesta","estimated_duration_hours":2},
    {"name":"AP-09.5 Seccion informe regulatorio","phase":"informe","skills":[],"artifacts":["seccion_informe_reg"],"description":"Generar seccion de informe regulatorio","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-09.6 Acciones regulatorias","phase":"propuesta_transaccional","skills":[],"artifacts":["acciones_reg"],"description":"Proponer condiciones precedentes regulatorias y clausulas SPA","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":[],"auto_approve_confidence":0.85}'::jsonb,
  '{"project_id":"uuid"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["licencias","resoluciones_sancionadoras"]}'::jsonb,
  'rpt_area_reg', 'WF_REG'
);

-- WF-10 Medioambiental — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  '465ecdcb-7ec1-4d15-b677-c117c0005021', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-10.1 Inventario autorizaciones ambientales","phase":"obtencion","skills":["medioambiental.autorizaciones_ambientales"],"artifacts":["inventario_ambiental"],"description":"Recopilar autorizaciones ambientales, EIA y permisos","dod_criteria":[{"check":"env_permits_inventoried","label":"Autorizaciones inventariadas","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"none","grounding_mode":"none"},"inputs_required":["project_id"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-10.2 Analisis suelos contaminados","phase":"gestion","skills":["medioambiental.suelos_contaminados"],"artifacts":["informe_suelos"],"description":"Revisar estado de contaminacion de suelos en emplazamientos","dod_criteria":[{"check":"soil_analyzed","label":"Suelos analizados","required":true}],"dor_criteria":[{"check":"env_permits_inventoried","label":"Autorizaciones inventariadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["inventario_ambiental"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":4},
    {"name":"AP-10.3 Analisis pasivos ambientales","phase":"analisis","skills":["medioambiental.pasivos_ambientales","medioambiental.contingencias_ambientales"],"artifacts":["analisis_ambiental"],"description":"Identificar y cuantificar pasivos ambientales","dod_criteria":[{"check":"liabilities_analyzed","label":"Pasivos analizados","required":true}],"dor_criteria":[{"check":"soil_analyzed","label":"Suelos analizados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["inventario_ambiental","informe_suelos"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":6},
    {"name":"AP-10.4 Valoracion riesgos ambientales","phase":"valoracion","skills":[],"artifacts":["findings_ranked"],"description":"Rankear hallazgos ambientales por impacto y urgencia","dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"liabilities_analyzed","label":"Pasivos analizados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_ambiental"],"kanban_end_state":"conclusion","kanban_start_state":"ia_propuesta","estimated_duration_hours":2},
    {"name":"AP-10.5 Seccion informe medioambiental","phase":"informe","skills":[],"artifacts":["seccion_informe_env"],"description":"Generar seccion de informe medioambiental","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-10.6 Acciones ambientales","phase":"propuesta_transaccional","skills":[],"artifacts":["acciones_env"],"description":"Proponer indemnidades ambientales, due diligence tecnica, clausulas SPA","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":[],"auto_approve_confidence":0.85}'::jsonb,
  '{"project_id":"uuid"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["autorizaciones_ambientales","estudios_suelos"]}'::jsonb,
  'rpt_area_env', 'WF_ENV'
);

-- WF-11 Proteccion Datos — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  'e8ab6f5c-3f09-43bf-bb90-7ceba0f0fbc7', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-11.1 Registro actividades tratamiento","phase":"obtencion","skills":["datos.registro_actividades"],"artifacts":["rat_review"],"description":"Revisar el RAT conforme art. 30 RGPD","dod_criteria":[{"check":"rat_reviewed","label":"RAT revisado","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["project_id"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-11.2 Base legal tratamientos","phase":"gestion","skills":["datos.base_legal_tratamiento"],"artifacts":["analisis_base_legal"],"description":"Verificar base legal de cada tratamiento de datos","dod_criteria":[{"check":"legal_basis_verified","label":"Base legal verificada","required":true}],"dor_criteria":[{"check":"rat_reviewed","label":"RAT revisado","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["rat_review"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":6},
    {"name":"AP-11.3 Transferencias y compliance","phase":"analisis","skills":["datos.cumplimiento_rgpd","datos.transferencias_internacionales"],"artifacts":["analisis_data"],"description":"Analizar transferencias internacionales y cumplimiento RGPD global","dod_criteria":[{"check":"transfers_analyzed","label":"Transferencias analizadas","required":true}],"dor_criteria":[{"check":"legal_basis_verified","label":"Base legal verificada","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["rat_review","analisis_base_legal"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":6},
    {"name":"AP-11.4 Historico brechas y valoracion","phase":"valoracion","skills":["datos.brechas_historico"],"artifacts":["findings_ranked"],"description":"Revisar historico de brechas y rankear hallazgos","dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"transfers_analyzed","label":"Transferencias analizadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_data"],"kanban_end_state":"conclusion","kanban_start_state":"ia_propuesta","estimated_duration_hours":2},
    {"name":"AP-11.5 Seccion informe proteccion datos","phase":"informe","skills":[],"artifacts":["seccion_informe_data"],"description":"Generar seccion de informe de proteccion de datos","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-11.6 Acciones compliance datos","phase":"propuesta_transaccional","skills":["datos.compliance_penal"],"artifacts":["acciones_data"],"description":"Proponer plan de adecuacion post-cierre y clausulas SPA de datos","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":[],"auto_approve_confidence":0.85}'::jsonb,
  '{"project_id":"uuid"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["rat","politicas_privacidad","contratos_encargo"]}'::jsonb,
  'rpt_area_data', 'WF_DATA'
);

-- WF-12 Competencia — v2 published
INSERT INTO dd_workflow_template_versions (
  template_id, version_number, is_published, published_at, changelog,
  phases, hitl_policy, input_schema, output_schema, evidence_requirements,
  report_template_key, feature_flag_key
) VALUES (
  '37ac601e-2edc-4bff-8da5-4129b5968fc5', 2, true, NOW(),
  'v2: Skills asignados a fases, publicado',
  '[
    {"name":"AP-12.1 Analisis notificacion obligatoria","phase":"obtencion","skills":["competencia.notificacion_obligatoria"],"artifacts":["analisis_notificacion"],"description":"Evaluar si la operacion requiere notificacion previa de concentracion","dod_criteria":[{"check":"filing_assessed","label":"Notificacion evaluada","required":true}],"dor_criteria":[],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["project_id","deal_value"],"kanban_end_state":"info_recibida","kanban_start_state":"backlog","estimated_duration_hours":4},
    {"name":"AP-12.2 Revision acuerdos restrictivos","phase":"gestion","skills":["competencia.acuerdos_verticales"],"artifacts":["mapa_acuerdos"],"description":"Analizar acuerdos verticales y horizontales del target","dod_criteria":[{"check":"agreements_reviewed","label":"Acuerdos revisados","required":true}],"dor_criteria":[{"check":"filing_assessed","label":"Notificacion evaluada","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_notificacion"],"kanban_end_state":"lista_para_analisis","kanban_start_state":"info_recibida","estimated_duration_hours":4},
    {"name":"AP-12.3 Analisis ayudas de estado","phase":"analisis","skills":["competencia.ayudas_estado"],"artifacts":["analisis_competencia"],"description":"Identificar ayudas de estado y evaluar riesgos de recovery","dod_criteria":[{"check":"state_aid_analyzed","label":"Ayudas de estado analizadas","required":true}],"dor_criteria":[{"check":"agreements_reviewed","label":"Acuerdos revisados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag","max_prompt_chars":20000},"inputs_required":["mapa_acuerdos"],"kanban_end_state":"ia_propuesta","kanban_start_state":"en_analisis","estimated_duration_hours":6},
    {"name":"AP-12.4 Valoracion riesgos competencia","phase":"valoracion","skills":[],"artifacts":["findings_ranked"],"description":"Rankear hallazgos de competencia por impacto en la operacion","dod_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"dor_criteria":[{"check":"state_aid_analyzed","label":"Ayudas de estado analizadas","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["analisis_competencia"],"kanban_end_state":"conclusion","kanban_start_state":"ia_propuesta","estimated_duration_hours":2},
    {"name":"AP-12.5 Seccion informe competencia","phase":"informe","skills":[],"artifacts":["seccion_informe_comp"],"description":"Generar seccion de informe de competencia","dod_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"dor_criteria":[{"check":"findings_ranked","label":"Hallazgos rankeados","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"conclusion","estimated_duration_hours":2},
    {"name":"AP-12.6 Acciones competencia","phase":"propuesta_transaccional","skills":[],"artifacts":["acciones_comp"],"description":"Proponer condiciones precedentes de competencia y timeline de filing","dod_criteria":[{"check":"actions_proposed","label":"Acciones propuestas","required":true}],"dor_criteria":[{"check":"report_section_ready","label":"Seccion informe lista","required":true}],"hitl_required":false,"gateway_config":{"route":"completion","grounding_mode":"vault_rag"},"inputs_required":["findings_ranked"],"kanban_end_state":"integrado_en_informe","kanban_start_state":"integrado_en_informe","estimated_duration_hours":2}
  ]'::jsonb,
  '{"areas_hitl_required":[],"auto_approve_confidence":0.85}'::jsonb,
  '{"project_id":"uuid","deal_value":"number"}'::jsonb,
  '{"findings":"array","report_section":"string","negotiation_actions":"array"}'::jsonb,
  '{"mandatory_sources":["cuentas_anuales","contratos_distribucion"]}'::jsonb,
  'rpt_area_comp', 'WF_COMP'
);
