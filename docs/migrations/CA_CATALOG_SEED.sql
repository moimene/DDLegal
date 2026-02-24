-- =============================================================================
-- CUENTAS ANUALES (CA) FINDING OBJECTIVES CATALOG - SEED DATA
-- =============================================================================
-- Purpose: SQL seed for 15 Finding Objectives covering legal review of
-- Annual Accounts (Cuentas Anuales) in M&A due diligence
--
-- Source: Legal team catalog v2 (February 2026)
-- Area: MERC (sub-category CA - Cuentas Anuales)
-- Covers: FO-MERC-CA-001 through FO-MERC-CA-014 + FO-MERC-CA-PatNeto-002
--
-- Dependencies: Requires LEGAL_CATALOG_SEED.sql to be applied first
--               (existing 54 FOs including FO-MERC-001 through FO-MERC-008)
--
-- Note: All IDs generated using gen_random_uuid()
--       Materiality thresholds in EUR where specified
--       JSONB fields store structured evaluation/severity data
--       depends_on references other FO objective_keys for Worker dependency graph
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-001: Aprobación y depósito de cuentas, auditoría y aplicación del resultado
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-001', '1.0',
  'Aprobación y depósito de cuentas, auditoría y aplicación del resultado',
  'Verificar que las cuentas han sido aprobadas en plazo, depositadas correctamente, que el informe de auditoría (si procede) es adecuado y que la aplicación del resultado respeta restricciones legales y estatutarias',
  'MERC', 'Cumplimiento societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Aprobación en tiempo y forma", "weight": 0.30, "eval_type": "document_review"},
    {"criterion": "Depósito completo y en plazo", "weight": 0.30, "eval_type": "registry_check"},
    {"criterion": "Tipo de opinión y salvedades/énfasis", "weight": 0.25, "eval_type": "document_review"},
    {"criterion": "Legalidad del reparto y reservas", "weight": 0.15, "eval_type": "document_verification"}
  ]'::jsonb,
  '[
    {"doc_type": "Cuentas anuales y memoria", "sample": "all", "extractions": ["fecha_formulacion", "fecha_aprobacion", "cifras_clave"]},
    {"doc_type": "Informe de gestión", "sample": "all", "extractions": ["riesgos", "evolución"]},
    {"doc_type": "Informe de auditoría", "sample": "all", "extractions": ["tipo_opinion", "salvedades", "enfasis", "KAM"]},
    {"doc_type": "Acta y certificado de junta", "sample": "all", "extractions": ["acuerdos", "aplicacion_resultado"]},
    {"doc_type": "Justificante de depósito RM", "sample": "all", "extractions": ["fecha_deposito", "estado"]},
    {"doc_type": "Evidencia de pago de dividendos", "sample": "material", "extractions": ["importes", "fechas_pago"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Opinión desfavorable/denegada o falta de depósito", "action": "upgrade_to_critical", "justification": "Bloqueo registral o defecto esencial"},
    {"condition": "Subsanación aceptada por el Registro", "action": "downgrade_to_medium", "justification": "Riesgo en proceso de mitigación"},
    {"condition": "Salvedades menores con plan de remediación", "action": "downgrade_to_medium", "justification": "Impacto limitado y controlado"}
  ]'::jsonb,
  ARRAY['Cuentas aprobadas fuera de plazo, no depositadas y opinión con salvedades significativas'],
  ARRAY['Cuentas depositadas en plazo; opinión limpia; reparto conforme a reservas'],
  ARRAY['Revisión limitada confundida con auditoría legal; asiento de presentación aún no reflejado en el sistema'],
  'Legislación societaria aplicable; normativa contable; práctica registral', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-002: Obligación de auditoría, nombramiento y vigencia del auditor
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-002', '1.0',
  'Obligación de auditoría, nombramiento y vigencia del auditor',
  'Confirmar si existe obligación de auditoría, la validez del nombramiento, su vigencia e idoneidad formal del aseguramiento',
  'MERC', 'Compliance societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Obligatoriedad y alcance de auditoría", "weight": 0.35, "eval_type": "document_review"},
    {"criterion": "Nombramiento y vigencia del auditor", "weight": 0.35, "eval_type": "registry_check"},
    {"criterion": "Independencia y salvaguardas formales", "weight": 0.30, "eval_type": "document_verification"}
  ]'::jsonb,
  '[
    {"doc_type": "Nombramiento/reelección de auditor", "sample": "all", "extractions": ["auditor", "periodo", "inscripcion"]},
    {"doc_type": "Contratos de auditoría", "sample": "all", "extractions": ["alcance", "vigencia"]},
    {"doc_type": "Cartas de independencia", "sample": "all", "extractions": ["declaraciones", "salvaguardas"]},
    {"doc_type": "Certificación Registro Mercantil", "sample": "all", "extractions": ["inscripcion_auditor"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Falta de nombramiento siendo obligatorio", "action": "upgrade_to_high", "justification": "Incumplimiento legal sustantivo"},
    {"condition": "Subsanación con designación válida", "action": "downgrade_to_low", "justification": "Riesgo resuelto"}
  ]'::jsonb,
  ARRAY['Sociedad obligada sin auditor nombrado para el ejercicio vigente'],
  ARRAY['Auditor designado y vigente con independencia acreditada'],
  ARRAY['Informe de procedimientos acordados tomado por auditoría legal'],
  'Legislación societaria aplicable; estándares de aseguramiento', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-003: Opinión de auditoría, KAM e incertidumbre sobre continuidad
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-003', '1.0',
  'Opinión de auditoría, KAM e incertidumbre sobre continuidad',
  'Evaluar tipo de opinión, cuestiones clave de auditoría y referencias a empresa en funcionamiento y su mitigación',
  'MERC', 'Red flag societaria/financiera',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Tipo de opinión del auditor", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "KAM relevantes identificados", "weight": 0.30, "eval_type": "document_review"},
    {"criterion": "Incertidumbre material sobre continuidad y planes de mitigación", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Informe de auditoría", "sample": "all", "extractions": ["tipo_opinion", "KAM", "going_concern", "enfasis"]},
    {"doc_type": "Plan de viabilidad", "sample": "all", "extractions": ["medidas", "horizonte", "viabilidad"]},
    {"doc_type": "Cartas de representación", "sample": "material", "extractions": ["declaraciones_gestion"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Opinión desfavorable/denegada o incertidumbre sin plan creíble", "action": "upgrade_to_critical", "justification": "Riesgo estructural para la operación"},
    {"condition": "Plan de viabilidad validado y en ejecución", "action": "downgrade_to_medium", "justification": "Mitigación acreditada"}
  ]'::jsonb,
  ARRAY['Opinión con incertidumbre sobre continuidad sin medidas creíbles adoptadas'],
  ARRAY['Opinión limpia sin KAM críticos'],
  ARRAY['Énfasis informativo confundido con salvedad'],
  'Normativa contable; estándares de auditoría', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-004: Situación patrimonial y posible causa legal de disolución
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-004', '1.0',
  'Situación patrimonial y posible causa legal de disolución',
  'Verificar si la sociedad incurre en desequilibrios patrimoniales que activen deberes legales de reequilibrio o disolución y evaluar medidas adoptadas',
  'MERC', 'Deal breaker societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Patrimonio neto vs. capital social y señales de alarma", "weight": 0.45, "eval_type": "document_review"},
    {"criterion": "Existencia y adecuación de medidas adoptadas", "weight": 0.35, "eval_type": "document_verification"},
    {"criterion": "Revelación adecuada en memoria y auditoría", "weight": 0.20, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Cuentas anuales", "sample": "all", "extractions": ["patrimonio_neto", "capital_social", "reservas", "resultados"]},
    {"doc_type": "Memoria", "sample": "all", "extractions": ["senales_alarma", "going_concern", "medidas_previstas"]},
    {"doc_type": "Actas de medidas adoptadas", "sample": "all", "extractions": ["acuerdos", "tipo_medida", "plazos"]},
    {"doc_type": "Certificación Registro Mercantil", "sample": "all", "extractions": ["inscripciones", "estado"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Medidas aprobadas y en ejecución acreditada", "action": "downgrade_to_high", "justification": "Remediación en curso reduce urgencia"},
    {"condition": "Regularización ya inscrita en RM", "action": "downgrade_to_medium", "justification": "Situación resuelta formalmente"}
  ]'::jsonb,
  ARRAY['Patrimonio neto que evidencia desequilibrio sin medidas acordadas ni convocatoria de junta'],
  ARRAY['Patrimonio suficiente y sin señales de alarma'],
  ARRAY['Pérdida puntual no representativa tomada por desequilibrio estructural'],
  'Legislación societaria aplicable; práctica registral', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-005: Legalidad de dividendos y distribución de reservas
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-005', '1.0',
  'Legalidad de dividendos y distribución de reservas',
  'Comprobar que la distribución de resultados y reservas respeta restricciones legales y estatutarias y que existe trazabilidad de los pagos',
  'MERC', 'Contingencia societaria',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Restricciones aplicables y su cumplimiento", "weight": 0.40, "eval_type": "document_verification"},
    {"criterion": "Trazabilidad de pagos efectuados", "weight": 0.30, "eval_type": "document_review"},
    {"criterion": "Documentación soporte completa", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Acta de aplicación del resultado", "sample": "all", "extractions": ["acuerdo", "importes", "destinos"]},
    {"doc_type": "Memoria", "sample": "all", "extractions": ["restricciones", "reservas_indisponibles"]},
    {"doc_type": "Justificantes de pago de dividendos", "sample": "material", "extractions": ["fechas", "importes", "beneficiarios"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Regularización o reintegro documentado", "action": "downgrade_to_medium", "justification": "Corrección acreditada"},
    {"condition": "Ausencia de reparto pese a restricciones vigentes", "action": "downgrade_to_medium", "justification": "Sin impacto económico real"}
  ]'::jsonb,
  ARRAY['Dividendos aprobados sin respetar restricciones legales aplicables sobre reserva legal o reservas indisponibles'],
  ARRAY['Distribución conforme a restricciones y correctamente documentada'],
  ARRAY['Propuesta de reparto no ejecutada tomada por reparto indebido'],
  'Legislación societaria aplicable; normativa contable', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-006: Acciones/participaciones propias y reservas indisponibles
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-006', '1.0',
  'Acciones/participaciones propias y reservas indisponibles asociadas',
  'Verificar existencia de autocartera y cumplimiento de límites legales y reservas indisponibles vinculadas',
  'MERC', 'Compliance societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia y cuantía de autocartera", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Cumplimiento de límites legales y reservas indisponibles", "weight": 0.40, "eval_type": "document_verification"},
    {"criterion": "Autorizaciones societarias formales", "weight": 0.20, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Cuentas anuales", "sample": "all", "extractions": ["autocartera", "reservas_indisponibles"]},
    {"doc_type": "Memoria", "sample": "all", "extractions": ["detalle_autocartera", "movimientos"]},
    {"doc_type": "Actas de junta", "sample": "material", "extractions": ["autorizaciones", "limites"]},
    {"doc_type": "Certificación Registro Mercantil", "sample": "all", "extractions": ["inscripciones"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Exceso sobre límites legales o falta de reserva indisponible", "action": "upgrade_to_high", "justification": "Incumplimiento legal directo"},
    {"condition": "Regularización previa al signing", "action": "downgrade_to_low", "justification": "Riesgo resuelto en el contexto de la operación"}
  ]'::jsonb,
  ARRAY['Autocartera sin dotación de reserva indisponible asociada'],
  ARRAY['Autocartera dentro de límites legales y con reserva indisponible dotada'],
  ARRAY['Reserva genérica confundida con reserva indisponible específica de autocartera'],
  'Legislación societaria aplicable; práctica registral', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-007: Partes vinculadas: conciliación de operaciones y gobierno
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-007', '1.0',
  'Partes vinculadas: conciliación de operaciones y gobierno',
  'Contrastar operaciones y saldos con partes vinculadas revelados en memoria con contratos subyacentes y aprobaciones societarias',
  'MERC', 'Red flag de conflicto de interés',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Identificación completa y cuantía de operaciones", "weight": 0.35, "eval_type": "document_review"},
    {"criterion": "Condiciones a mercado y justificación", "weight": 0.35, "eval_type": "document_verification"},
    {"criterion": "Aprobaciones societarias y transparencia", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - sección partes vinculadas", "sample": "all", "extractions": ["partes", "operaciones", "saldos", "condiciones"]},
    {"doc_type": "Listados y detalle de vinculadas", "sample": "all", "extractions": ["identificacion", "relacion"]},
    {"doc_type": "Contratos con partes vinculadas", "sample": "material", "extractions": ["terminos", "precios", "vigencia"]},
    {"doc_type": "Actas de aprobación", "sample": "material", "extractions": ["acuerdos", "abstenciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Operaciones materiales sin aprobación o fuera de condiciones de mercado", "action": "upgrade_to_critical", "justification": "Conflicto de interés con impacto en valoración"},
    {"condition": "Terminación de operaciones al closing", "action": "downgrade_to_medium", "justification": "Riesgo eliminado en el contexto de la transacción"}
  ]'::jsonb,
  ARRAY['Servicios con vinculada sin aprobación corporativa y precio atípico respecto de mercado'],
  ARRAY['Operaciones a condiciones de mercado con aprobación y revelación adecuadas'],
  ARRAY['Proveedor clave sin relación real de vinculación tratado como parte vinculada'],
  'Normativa de partes vinculadas; normativa contable', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-008: Compromisos y contingencias fuera de balance
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-008', '1.0',
  'Compromisos y contingencias fuera de balance',
  'Identificar garantías, avales, litigios y otros compromisos revelados en memoria y evaluar su soporte documental e impacto potencial',
  'MERC', 'Pasivo contingente',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Existencia, identificación y cuantía de compromisos", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Soporte documental y probabilidad de materialización", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Impactos cruzados con litigios y otras áreas", "weight": 0.30, "eval_type": "cross_area_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - compromisos y contingencias", "sample": "all", "extractions": ["garantias", "avales", "litigios", "compromisos"]},
    {"doc_type": "Pólizas y contratos de garantía", "sample": "material", "extractions": ["limites", "beneficiarios", "vigencia"]},
    {"doc_type": "Comunicaciones de reclamaciones", "sample": "material", "extractions": ["reclamante", "importe", "estado"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Medidas cautelares o importes superiores a materialidad significativa", "action": "upgrade_to_critical", "justification": "Impacto económico potencialmente desproporcionado"},
    {"condition": "Seguros vigentes o acuerdos de limitación", "action": "downgrade_to_medium", "justification": "Mitigación acreditada"}
  ]'::jsonb,
  ARRAY['Avales significativos otorgados a favor de terceros sin límites claros ni contragarantías'],
  ARRAY['Sin contingencias materiales identificadas y con soporte documental adecuado'],
  ARRAY['Reclamaciones informales sin soporte jurídico tratadas como contingencia probable'],
  'Normativa contable; estándares de aseguramiento', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-009: Hechos posteriores al cierre con impacto legal
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-009', '1.0',
  'Hechos posteriores al cierre con impacto legal',
  'Verificar eventos subsecuentes al cierre del ejercicio con relevancia jurídica, su revelación adecuada y decisiones societarias relacionadas',
  'MERC', 'Red flag de validación',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Identificación del evento posterior y su naturaleza", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Revelación y/o ajuste en cuentas", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Decisiones societarias adoptadas ante el evento", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - hechos posteriores", "sample": "all", "extractions": ["eventos", "naturaleza", "impacto"]},
    {"doc_type": "Actas posteriores al cierre", "sample": "material", "extractions": ["acuerdos", "medidas"]},
    {"doc_type": "Comunicaciones con auditor", "sample": "material", "extractions": ["notificaciones", "modificaciones"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Evento material sin revelación ni acuerdo societario", "action": "upgrade_to_high", "justification": "Omisión relevante con posible impacto en fiabilidad"},
    {"condition": "Revelación oportuna y medidas adoptadas", "action": "downgrade_to_low", "justification": "Gestión adecuada del evento"}
  ]'::jsonb,
  ARRAY['Pérdida de contrato clave posterior al cierre sin revelación en memoria ni medidas societarias'],
  ARRAY['Hecho posterior identificado, revelado y con medidas aprobadas por el órgano competente'],
  ARRAY['Evento no ajustable tratado erróneamente como ajuste del cierre'],
  'Normativa contable; práctica societaria', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-010: Cambios de criterios y estimaciones contables
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-010', '1.0',
  'Cambios de criterios y estimaciones contables',
  'Evaluar cambios de criterios contables y estimaciones significativas, su revelación en memoria y coherencia temporal entre ejercicios',
  'MERC', 'Compliance contable-legal',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Identificación y justificación del cambio", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Efecto cuantificado y revelado", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Consistencia temporal y revelación adecuada", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - políticas contables", "sample": "all", "extractions": ["cambios_criterio", "estimaciones", "efectos"]},
    {"doc_type": "Informe de auditoría", "sample": "all", "extractions": ["menciones_cambio", "KAM_relacionados"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Cambios materiales sin revelación ni justificación", "action": "upgrade_to_high", "justification": "Opacidad en información financiera relevante"},
    {"condition": "Auditoría sin salvedades sobre el cambio", "action": "downgrade_to_low", "justification": "Validación externa del cambio"}
  ]'::jsonb,
  ARRAY['Cambio de criterio contable material sin justificación adecuada ni revelación en memoria'],
  ARRAY['Cambio menor debidamente revelado y consistente entre ejercicios'],
  ARRAY['Reexpresión por reclasificación contable tomada como cambio de criterio sustantivo'],
  'Normativa contable; estándares de auditoría', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-011: Estado de Información No Financiera / ESG
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-011', '1.0',
  'Estado de Información No Financiera / ESG cuando aplica',
  'Verificar obligación de presentar EINF/informe ESG, su contenido mínimo y, en su caso, aseguramiento externo',
  'MERC', 'Compliance regulatorio',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Obligación aplicable y cumplimiento", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Presentación y contenido mínimo", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Aseguramiento externo si procede", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "EINF o informe ESG", "sample": "all", "extractions": ["contenido", "indicadores", "materialidad"]},
    {"doc_type": "Evidencias de publicación", "sample": "all", "extractions": ["fecha", "medio"]},
    {"doc_type": "Informe de aseguramiento", "sample": "all", "extractions": ["alcance", "conclusion"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Entidad obligada sin EINF presentado", "action": "upgrade_to_high", "justification": "Incumplimiento regulatorio directo"},
    {"condition": "Presentación y aseguramiento adecuados", "action": "downgrade_to_low", "justification": "Cumplimiento completo"}
  ]'::jsonb,
  ARRAY['Entidad obligada por su tamaño sin EINF publicado ni presentado'],
  ARRAY['EINF presentado conforme a requisitos legales y con aseguramiento independiente'],
  ARRAY['Informe de sostenibilidad voluntario no equivalente a EINF obligatorio'],
  'Normativa de información no financiera aplicable; directivas ESG', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-012: Remuneración de administradores y políticas asociadas
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-012', '1.0',
  'Remuneración de administradores y políticas asociadas',
  'Confirmar revelación adecuada y aprobación societaria de la retribución de administradores conforme al régimen legal aplicable',
  'MERC', 'Compliance societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Revelación adecuada en memoria y cuentas", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Aprobación conforme al régimen legal/estatutario", "weight": 0.40, "eval_type": "document_verification"},
    {"criterion": "Coherencia entre importes revelados y pagos efectivos", "weight": 0.20, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - remuneración administradores", "sample": "all", "extractions": ["importes", "conceptos", "beneficiarios"]},
    {"doc_type": "Políticas retributivas", "sample": "all", "extractions": ["sistema", "limites", "aprobacion"]},
    {"doc_type": "Actas de junta y consejo", "sample": "material", "extractions": ["acuerdos_retribucion", "votaciones"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Pagos sin cobertura societaria ni revelación", "action": "upgrade_to_high", "justification": "Posible retribución irregular"},
    {"condition": "Regularización documental completada", "action": "downgrade_to_low", "justification": "Defecto formal subsanado"}
  ]'::jsonb,
  ARRAY['Bonificaciones pagadas a administradores sin cobertura societaria revelada en memoria'],
  ARRAY['Remuneración revelada y aprobada según régimen legal aplicable'],
  ARRAY['Política retributiva general interpretada como aprobación específica de pago individual'],
  'Legislación societaria aplicable; práctica societaria', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-013: Préstamos y anticipos a socios/administradores
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-013', '1.0',
  'Préstamos y anticipos a socios/administradores',
  'Verificar existencia, condiciones y revelación de préstamos y anticipos a personas vinculadas con deberes fiduciarios',
  'MERC', 'Contingencia societaria',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 50000,
  '[
    {"criterion": "Existencia y cuantía de préstamos/anticipos", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Condiciones y justificación económica", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Aprobación societaria y revelación en memoria", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Memoria - saldos con socios y administradores", "sample": "all", "extractions": ["prestamos", "anticipos", "saldos"]},
    {"doc_type": "Contratos de préstamo", "sample": "material", "extractions": ["condiciones", "tipo_interes", "vencimiento"]},
    {"doc_type": "Actas de aprobación", "sample": "material", "extractions": ["acuerdos", "autorizaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Importes elevados sin aprobación societaria", "action": "upgrade_to_critical", "justification": "Riesgo de asistencia financiera prohibida o conflicto de interés"},
    {"condition": "Cancelación previa al closing", "action": "downgrade_to_medium", "justification": "Riesgo eliminado en el contexto de la transacción"}
  ]'::jsonb,
  ARRAY['Anticipos a administrador sin acuerdo societario ni condiciones de mercado'],
  ARRAY['Préstamo a condiciones de mercado con aprobación societaria y revelación adecuada'],
  ARRAY['Gastos reintegrables por actividad social confundidos con préstamo a administrador'],
  'Legislación societaria aplicable; normativa contable', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-014: Coherencia cuentas - libros sociales - Registro Mercantil
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-014', '1.0',
  'Coherencia cuentas - libros sociales - Registro Mercantil',
  'Detectar incoherencias entre lo aprobado en junta, lo depositado en Registro Mercantil y lo reflejado en las cuentas anuales',
  'MERC', 'Red flag registral',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Concordancia entre acuerdos de junta y depósito", "weight": 0.40, "eval_type": "registry_check"},
    {"criterion": "Ausencia de defectos registrales", "weight": 0.30, "eval_type": "registry_check"},
    {"criterion": "Trazabilidad documental completa", "weight": 0.30, "eval_type": "document_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Cuentas anuales depositadas", "sample": "all", "extractions": ["cifras", "firma", "fecha"]},
    {"doc_type": "Actas y certificaciones de junta", "sample": "all", "extractions": ["acuerdos", "aplicacion_resultado"]},
    {"doc_type": "Notas simples del Registro Mercantil", "sample": "all", "extractions": ["depositos", "defectos", "observaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Subsanación presentada y aceptada por el Registro", "action": "downgrade_to_medium", "justification": "Defecto en proceso de corrección"},
    {"condition": "Incoherencias menores sin impacto en la operación", "action": "downgrade_to_low", "justification": "Impacto no material"}
  ]'::jsonb,
  ARRAY['Aplicación del resultado aprobada en junta que no coincide con lo depositado en Registro Mercantil'],
  ARRAY['Concordancia plena entre actas, cuentas anuales y Registro Mercantil'],
  ARRAY['Documento histórico de ejercicios anteriores tomado por vigente sin verificar actualización'],
  'Práctica registral; gobernanza societaria', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-PatNeto-002: Medidas obligatorias ante desequilibrio patrimonial
-- (FO complementario al CA-004 - mide consecuencias y ejecución de medidas)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-PatNeto-002', '1.0',
  'Medidas obligatorias: reducción/aumento de capital, aportaciones o disolución',
  'Verificar que, constatado el desequilibrio patrimonial, el órgano de administración convocó y la junta acordó en plazo legal una medida idónea de reequilibrio (reducción y/o aumento de capital, aportaciones de socios) o, en su defecto, la disolución; comprobar ejecución efectiva, protección de acreedores cuando proceda e inscripción registral',
  'MERC', 'Deal breaker societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Adopción de acuerdo idóneo dentro del plazo legal aplicable", "weight": 0.35, "eval_type": "document_verification"},
    {"criterion": "Ejecución material del acuerdo (reducción/aumento/aportación)", "weight": 0.35, "eval_type": "document_verification"},
    {"criterion": "Protección de acreedores y formalidades esenciales", "weight": 0.15, "eval_type": "document_review"},
    {"criterion": "Inscripción registral o asiento de presentación con trazabilidad", "weight": 0.15, "eval_type": "registry_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Actas de convocatoria y acuerdos de junta", "sample": "all", "extractions": ["convocatoria", "acuerdos", "tipo_medida", "plazos"]},
    {"doc_type": "Informes y certificados del órgano de administración", "sample": "all", "extractions": ["valoracion", "idoneidad"]},
    {"doc_type": "Escrituras públicas de reducción/aumento", "sample": "all", "extractions": ["cifras", "condiciones", "otorgamiento"]},
    {"doc_type": "Justificantes bancarios de desembolsos", "sample": "material", "extractions": ["importes", "fechas"]},
    {"doc_type": "Anuncios y evidencias de protección de acreedores", "sample": "material", "extractions": ["publicaciones", "oposiciones", "garantias"]},
    {"doc_type": "Asientos de presentación/inscripción en RM", "sample": "all", "extractions": ["estado", "fecha", "observaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Ausencia de acuerdo o acuerdo fuera de plazo con efectos pendientes", "action": "upgrade_to_critical", "justification": "Posible responsabilidad de administradores y bloqueo de operación"},
    {"condition": "Ejecución completa e inscripción registral", "action": "downgrade_to_medium", "justification": "Situación regularizada"},
    {"condition": "Asiento de presentación con ejecución material acreditada", "action": "downgrade_one_level", "justification": "Proceso en curso con sustancia"},
    {"condition": "Riesgo de responsabilidad de administradores por omisión de convocatoria", "action": "upgrade_one_level", "justification": "Exposición personal de los administradores agrava el riesgo"},
    {"condition": "Medidas paliativas no idóneas sin reequilibrio real", "action": "no_mitigation", "justification": "No corrigen la causa del desequilibrio"}
  ]'::jsonb,
  ARRAY['Constatado el desequilibrio, no consta convocatoria ni acuerdo; se siguieron aprobando operaciones sin remedio; severidad: CRITICAL'],
  ARRAY['Constatado el desequilibrio, la junta acordó reducción y aumento en bloque; desembolsos efectuados; escritura inscrita; severidad: MEDIUM'],
  ARRAY['Borrador de acta sin firma ni adopción formal tomado como acuerdo eficaz; severidad corregida a HIGH hasta aportar evidencia'],
  'Legislación societaria aplicable; práctica registral', true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Summary: 15 FOs inserted for Cuentas Anuales sub-category
-- ─────────────────────────────────────────────────────────────────────────────
-- FO-MERC-CA-001  Aprobación y depósito de cuentas                   HIGH
-- FO-MERC-CA-002  Obligación de auditoría y auditor                  MEDIUM
-- FO-MERC-CA-003  Opinión de auditoría, KAM, continuidad             HIGH
-- FO-MERC-CA-004  Situación patrimonial / disolución                 CRITICAL
-- FO-MERC-CA-005  Legalidad de dividendos y reservas                 HIGH
-- FO-MERC-CA-006  Autocartera y reservas indisponibles               MEDIUM
-- FO-MERC-CA-007  Partes vinculadas: conciliación                    HIGH
-- FO-MERC-CA-008  Compromisos y contingencias fuera de balance       HIGH
-- FO-MERC-CA-009  Hechos posteriores al cierre                       MEDIUM
-- FO-MERC-CA-010  Cambios de criterios y estimaciones                MEDIUM
-- FO-MERC-CA-011  EINF / ESG                                        MEDIUM
-- FO-MERC-CA-012  Remuneración de administradores                    MEDIUM
-- FO-MERC-CA-013  Préstamos y anticipos a socios/admin               HIGH
-- FO-MERC-CA-014  Coherencia cuentas-libros-RM                       HIGH
-- FO-MERC-CA-PatNeto-002  Medidas obligatorias reequilibrio          HIGH
-- ─────────────────────────────────────────────────────────────────────────────
-- Severity distribution: 1 CRITICAL, 7 HIGH, 6 MEDIUM, 1 HIGH (PatNeto)
-- Total with existing catalog: 54 + 15 = 69 FOs
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;
