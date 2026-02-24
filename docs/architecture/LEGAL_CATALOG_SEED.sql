-- =============================================================================
-- LEGAL FINDING OBJECTIVES CATALOG - SEED DATA
-- =============================================================================
-- Purpose: Comprehensive SQL seed file for 54 Finding Objectives (FOs)
-- covering all legal due diligence areas in M&A transactions
--
-- Auto-generated from DD Legal PMO Catalog v1.0
-- Covers: MERC (8), CONT (10), FISC (8), LAB (8), PI (6), LIT (8), ADM (6)
--
-- Note: All IDs generated using gen_random_uuid()
--       Materiality thresholds in EUR where specified
--       JSONB fields store structured evaluation/severity data
-- =============================================================================

BEGIN;

-- MERC: Mercantile/Corporate Law (8 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-001', '1.0',
  'Existencia y vigencia de escritura de constitución',
  'Verificar que la sociedad existe válidamente y que su escritura y estatutos vigentes coinciden con la realidad jurídica actual',
  'MERC', 'Validez corporativa',
  ARRAY['M&A', 'Merger', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia y vigencia registral", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Coherencia entre estatutos y realidad", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Ausencia de impugnaciones o nulidades", "weight": 0.30, "eval_type": "litigation_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Escritura constitución", "sample": "all", "extractions": ["fecha", "otorgantes", "estatutos"]},
    {"doc_type": "Certificación Registro Mercantil", "sample": "all", "extractions": ["acuerdos", "inscripciones"]},
    {"doc_type": "Libros sociales", "sample": "material", "extractions": ["asambleas", "modificaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Ausencia de inscripción o defectos insubsanables", "action": "upgrade_to_critical", "justification": "Afecta validez fundamental de la sociedad"},
    {"condition": "Subsanación registrada", "action": "downgrade_to_medium", "justification": "Riesgo mitigado"}
  ]'::jsonb,
  ARRAY['La hoja registral no refleja la última modificación estatutaria aprobada y hay defecto de inscripción pendiente'],
  ARRAY['Escritura y estatutos inscritos y actualizados; sin defectos'],
  ARRAY['Escritura histórica aportada además de la vigente, sin confusión'],
  'LSC; CC; prácticas registrales', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-002', '1.0',
  'Concordancia estatutos vs. órganos sociales',
  'Verificar que la estructura de administración real coincide con lo previsto estatutariamente',
  'MERC', 'Gobierno corporativo',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Órgano previsto y existente", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Vigencia de cargos", "weight": 0.30, "eval_type": "document_verification"},
    {"criterion": "Inscripciones acordes", "weight": 0.30, "eval_type": "registry_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Estatutos vigentes", "sample": "all", "extractions": ["órganos", "estructura"]},
    {"doc_type": "Nombramientos y ceses inscritos", "sample": "all", "extractions": ["fechas", "cargos"]},
    {"doc_type": "Actas de junta/consejo", "sample": "material", "extractions": ["decisiones", "mandatos"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Cargos caducados o no inscritos", "action": "upgrade_to_high", "justification": "Defectos en representación"},
    {"condition": "Regularización previa al signing", "action": "downgrade_to_low", "justification": "Riesgo negociado"}
  ]'::jsonb,
  ARRAY['Administradores con plazo expirado y sin reelección inscrita'],
  ARRAY['Órgano y cargos vigentes e inscritos'],
  ARRAY['Cambio de denominación del órgano sin alterar su naturaleza'],
  'LSC; RM', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-003', '1.0',
  'Inscripción en Registro Mercantil actualizada',
  'Confirmar que todos los acuerdos inscribibles están debidamente inscritos',
  'MERC', 'Red flag registral',
  ARRAY['M&A'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Inscripción de acuerdos relevantes", "weight": 0.50, "eval_type": "registry_check"},
    {"criterion": "Inexistencia de defectos", "weight": 0.25, "eval_type": "document_review"},
    {"criterion": "Plazos cumplidos", "weight": 0.25, "eval_type": "timeline_verification"}
  ]'::jsonb,
  '[
    {"doc_type": "Certificación Registro Mercantil", "sample": "all", "extractions": ["asientos", "fechas"]},
    {"doc_type": "Notas simples", "sample": "all", "extractions": ["defectos", "observaciones"]},
    {"doc_type": "Justificantes de inscripción", "sample": "material", "extractions": ["acuerdos", "documentos"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Defecto que afecte transmisibilidad", "action": "upgrade_to_critical", "justification": "Bloquea la operación"},
    {"condition": "Subsanación en curso", "action": "downgrade_to_medium", "justification": "Proceso avanzado"}
  ]'::jsonb,
  ARRAY['Ampliación de capital pendiente de inscripción que afecta al cap table'],
  ARRAY['Todos los acuerdos inscribibles constan inscritos'],
  ARRAY['Asiento de presentación por cambio de domicilio sin impacto'],
  'LSC; RM', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-004', '1.0',
  'Quórum y mayorías en acuerdos de junta',
  'Verificar cumplimiento de quórum y mayorías reforzadas en acuerdos críticos',
  'MERC', 'Validez de acuerdos',
  ARRAY['M&A', 'Merger'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Quórum legal/estatutario", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Mayorías requeridas", "weight": 0.40, "eval_type": "voting_verification"},
    {"criterion": "Notificaciones/convocatorias válidas", "weight": 0.20, "eval_type": "procedural_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Actas de junta", "sample": "all", "extractions": ["asistentes", "votos"]},
    {"doc_type": "Listas de asistentes", "sample": "all", "extractions": ["socios", "representación"]},
    {"doc_type": "Estatutos", "sample": "all", "extractions": ["quórum", "mayorías"]},
    {"doc_type": "Certificados de acuerdos", "sample": "material", "extractions": ["validación", "aprobación"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Incumplimiento en acuerdos estructurales", "action": "upgrade_to_critical", "justification": "Nulidad potencial"},
    {"condition": "Ratificación viable", "action": "downgrade_to_low", "justification": "Riesgo procedural subsanable"}
  ]'::jsonb,
  ARRAY['Aprobación de escisión sin mayorías reforzadas exigibles por estatutos'],
  ARRAY['Juntas con quórum y mayorías conformes'],
  ARRAY['Error material en convocatoria sin afectar asistencia ni voto'],
  'LSC; CC', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-005', '1.0',
  'Pactos de socios y restricciones de transmisión',
  'Identificar restricciones contractuales o estatutarias que impidan o condicionen la transmisión',
  'MERC', 'Deal blocker',
  ARRAY['M&A', 'LBO', 'VC'], ARRAY['ES', 'UE', 'UK'], NULL,
  '[
    {"criterion": "Existencia de derechos de veto/preferencia/drag/tag", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Condiciones y umbrales", "weight": 0.30, "eval_type": "contract_analysis"},
    {"criterion": "Necesidad de consentimientos", "weight": 0.30, "eval_type": "consent_mapping"}
  ]'::jsonb,
  '[
    {"doc_type": "Pactos parasociales", "sample": "all", "extractions": ["derechos", "restricciones"]},
    {"doc_type": "Estatutos", "sample": "all", "extractions": ["transmisión", "limitaciones"]},
    {"doc_type": "Contratos de inversión", "sample": "material", "extractions": ["preferencias", "protecciones"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Consentimiento no obtenido", "action": "maintain_critical", "justification": "Bloquea operación"},
    {"condition": "Existencia de waiver previo", "action": "downgrade_to_medium", "justification": "Riesgo negociado"}
  ]'::jsonb,
  ARRAY['Pacto parasocial con derecho de veto a la transmisión sin consentimiento de minoría'],
  ARRAY['No existen restricciones más allá de tag/drag estándar ejecutables'],
  ARRAY['Derecho de tanteo caducado por plazo vencido'],
  'LSC; práctica parasocial', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-006', '1.0',
  'Poderes, suficiencia y revocaciones',
  'Verificar poderes vigentes y su suficiencia para actos relevantes, y revocaciones',
  'MERC', 'Capacidad de representación',
  ARRAY['M&A', 'Financiero'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Vigencia y alcance del poder", "weight": 0.50, "eval_type": "document_review"},
    {"criterion": "Ausencia de revocación", "weight": 0.25, "eval_type": "registry_check"},
    {"criterion": "Adecuación al acto", "weight": 0.25, "eval_type": "scope_verification"}
  ]'::jsonb,
  '[
    {"doc_type": "Escrituras de poder", "sample": "all", "extractions": ["facultades", "límites"]},
    {"doc_type": "Inscripciones", "sample": "all", "extractions": ["vigencia", "alcance"]},
    {"doc_type": "Certificaciones", "sample": "material", "extractions": ["validez", "revocaciones"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Poder general omitido y necesario", "action": "upgrade_to_high", "justification": "Capacidad limitada"},
    {"condition": "Poderes específicos complementarios", "action": "downgrade_to_low", "justification": "Cobertura suficiente"}
  ]'::jsonb,
  ARRAY['Apoderado firma contratos materiales sin facultades suficientes'],
  ARRAY['Poderes vigentes, suficientes e inscritos'],
  ARRAY['Revocación de poder ajeno a materias del deal'],
  'CC; LSC', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-007', '1.0',
  'Cargas y gravámenes sobre participaciones',
  'Detectar prenda, embargo u otras cargas sobre participaciones/acciones',
  'MERC', 'Red flag de transmisibilidad',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia de carga", "weight": 0.50, "eval_type": "registry_check"},
    {"criterion": "Rango/prioridad", "weight": 0.25, "eval_type": "lien_analysis"},
    {"criterion": "Condiciones de liberación", "weight": 0.25, "eval_type": "release_terms"}
  ]'::jsonb,
  '[
    {"doc_type": "Registro de bienes muebles", "sample": "all", "extractions": ["prendas", "anotaciones"]},
    {"doc_type": "Pactos de prenda", "sample": "all", "extractions": ["condiciones", "beneficiario"]},
    {"doc_type": "Notas judiciales", "sample": "material", "extractions": ["embargos", "anotaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Imposibilidad de liberar antes de closing", "action": "upgrade_to_critical", "justification": "Bloquea transmisión"},
    {"condition": "Acuerdo de payoff", "action": "downgrade_to_medium", "justification": "Riesgo mitigado"}
  ]'::jsonb,
  ARRAY['Prenda a favor de banco con covenant que impide transmisión sin cancelación'],
  ARRAY['No constan gravámenes; certificado limpio'],
  ARRAY['Anotación de embargo ya alzada sin asiento vigente'],
  'RM; RRBM; práctica bancaria', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-008', '1.0',
  'Prestaciones accesorias y obligaciones de socios',
  'Identificar obligaciones personales de socios que afecten valoración o gestión',
  'MERC', 'Best practice',
  ARRAY['M&A', 'VC'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia y contenido de prestaciones", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Transmisibilidad condicionada", "weight": 0.30, "eval_type": "transferability_check"},
    {"criterion": "Impacto económico", "weight": 0.30, "eval_type": "valuation_impact"}
  ]'::jsonb,
  '[
    {"doc_type": "Estatutos", "sample": "all", "extractions": ["prestaciones", "obligaciones"]},
    {"doc_type": "Pactos de socios", "sample": "all", "extractions": ["servicios", "términos"]},
    {"doc_type": "Contratos de prestación", "sample": "material", "extractions": ["compensación", "condiciones"]}
  ]'::jsonb,
  'low',
  '[
    {"condition": "Prestaciones onerosas y esenciales", "action": "upgrade_to_medium", "justification": "Impacto valorativo"},
    {"condition": "Prestaciones simbólicas", "action": "maintain_low", "justification": "Riesgo mínimo"}
  ]'::jsonb,
  ARRAY['Estatutos imponen prestación de servicios clave no delegable'],
  ARRAY['No existen prestaciones accesorias inscritas'],
  ARRAY['Cláusula de meras recomendaciones sin obligatoriedad'],
  'LSC; doctrina registral', true
);

-- CONT: Contractual (10 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-001', '1.0',
  'Cláusulas de cambio de control en contratos materiales',
  'Verificar existencia, requisitos de consentimiento y consecuencias de cláusulas CoC',
  'CONT', 'Terminación contractual',
  ARRAY['M&A', 'Asset Purchase', 'LBO', 'Merger'], ARRAY['ES', 'UE', 'UK', 'US'], 500000,
  '[
    {"criterion": "Presencia de CoC", "weight": 0.40, "eval_type": "contract_scan"},
    {"criterion": "Necesidad de consentimiento", "weight": 0.30, "eval_type": "consent_mapping"},
    {"criterion": "Consecuencias de trigger", "weight": 0.30, "eval_type": "impact_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos clientes", "sample": "material", "extractions": ["CoC", "terminación"]},
    {"doc_type": "Contratos proveedores", "sample": "material", "extractions": ["CoC", "consentimiento"]},
    {"doc_type": "Licencias", "sample": "all", "extractions": ["transmisión", "condiciones"]},
    {"doc_type": "Documentos de financiación", "sample": "all", "extractions": ["CoC", "aceleración"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Valor >5× umbral o contraparte >30% ingresos", "action": "upgrade_to_critical", "justification": "Riesgo material"},
    {"condition": "CoC solo notificación", "action": "downgrade_to_low", "justification": "Sin consecuencias"},
    {"condition": "Waiver firmado", "action": "downgrade_to_informational", "justification": "Riesgo eliminado"}
  ]'::jsonb,
  ARRAY['Contrato por EUR 2,3M permite terminación unilateral tras CoC sin penalidad'],
  ARRAY['Todos los contratos requieren sola notificación sin derecho de terminación'],
  ARRAY['Cláusula de cambio de domicilio confundida con CoC'],
  'CC; práctica contractual; ISAE 3000', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-002', '1.0',
  'Terminación anticipada y penalidades',
  'Identificar cláusulas de early termination, penalidades y liquidated damages',
  'CONT', 'Red flag económica',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE', 'UK', 'US'], 500000,
  '[
    {"criterion": "Causales de terminación", "weight": 0.40, "eval_type": "contract_review"},
    {"criterion": "Penalidades y cuantías", "weight": 0.30, "eval_type": "financial_analysis"},
    {"criterion": "Preavisos/plazos", "weight": 0.30, "eval_type": "timeline_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos materiales", "sample": "all", "extractions": ["terminación", "penalidades"]},
    {"doc_type": "T&Cs", "sample": "material", "extractions": ["condiciones", "sanciones"]},
    {"doc_type": "SOWs", "sample": "material", "extractions": ["términos", "penalizaciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Penalidad >10% del valor anual", "action": "upgrade_to_critical", "justification": "Impacto económico severo"},
    {"condition": "Preaviso ≥90 días", "action": "downgrade_to_medium", "justification": "Tiempo suficiente"},
    {"condition": "Cláusulas recíprocas", "action": "downgrade_impact", "justification": "Riesgo mutuo"}
  ]'::jsonb,
  ARRAY['Acuerdo con penalidad del 20% por terminación por conveniencia post-deal'],
  ARRAY['Sin penalidades, con preaviso de 60 días y no exclusividad'],
  ARRAY['Penalidad aplicable solo a incumplimiento grave ajeno a la transacción'],
  'CC; doctrina LD', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-003', '1.0',
  'Garantías e indemnidades a terceros',
  'Revisar obligaciones de warranty/indemnity asumidas frente a terceros',
  'CONT', 'Pasivo contingente',
  ARRAY['M&A', 'Financiero', 'Comercial'], ARRAY['ES', 'UE', 'UK', 'US'], 250000,
  '[
    {"criterion": "Alcance de warranty", "weight": 0.40, "eval_type": "scope_analysis"},
    {"criterion": "Límites y caps", "weight": 0.30, "eval_type": "financial_review"},
    {"criterion": "Carve-outs y survival", "weight": 0.30, "eval_type": "temporal_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos marco", "sample": "all", "extractions": ["garantías", "límites"]},
    {"doc_type": "SLAs", "sample": "material", "extractions": ["compromisos", "penalizaciones"]},
    {"doc_type": "MSAs", "sample": "all", "extractions": ["indemnidades", "carve-outs"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Ausencia de caps", "action": "upgrade_to_critical", "justification": "Exposición ilimitada"},
    {"condition": "Caps ≤10%", "action": "downgrade_to_medium", "justification": "Riesgo limitado"},
    {"condition": "Survival >36 meses", "action": "increase_risk", "justification": "Exposición prolongada"}
  ]'::jsonb,
  ARRAY['Indemnidad ilimitada por IP infringement en MSA crítico'],
  ARRAY['Caps al 15% con survival 18 meses y carve-outs estándar'],
  ARRAY['Indemnidad limitada a daños directos excluyendo lucro cesante en contratos menores'],
  'CC; práctica W&I', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-004', '1.0',
  'No competencia vigente',
  'Identificar restricciones de non-compete aplicables al target',
  'CONT', 'Restricción operativa',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE'], 500000,
  '[
    {"criterion": "Existencia y alcance", "weight": 0.50, "eval_type": "contract_scan"},
    {"criterion": "Ámbito temporal/geográfico", "weight": 0.25, "eval_type": "scope_analysis"},
    {"criterion": "Sanciones y enforcement", "weight": 0.25, "eval_type": "legal_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos laborales clave", "sample": "material", "extractions": ["restricciones", "duración"]},
    {"doc_type": "Acuerdos comerciales", "sample": "material", "extractions": ["no competencia", "territorios"]},
    {"doc_type": "Pactos", "sample": "all", "extractions": ["prohibiciones", "alcance"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Restricción >24 meses o cobertura geográfica amplia", "action": "upgrade_to_high", "justification": "Severidad temporal"},
    {"condition": "Nulidad probable", "action": "downgrade_to_low", "justification": "Defensa viable"}
  ]'::jsonb,
  ARRAY['Acuerdo comercial prohíbe competir en UE por 36 meses post-CoC'],
  ARRAY['No existen restricciones o son ≤12 meses y acotadas'],
  ARRAY['NDA con cláusula de no solicitación malinterpretada como non-compete'],
  'CC; LDC; práctica antitrust', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-005', '1.0',
  'Contratos con partes vinculadas',
  'Detectar related-party agreements y condiciones no a mercado',
  'CONT', 'Conflicto/traslación de valor',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Identificación de vinculación", "weight": 0.40, "eval_type": "stakeholder_analysis"},
    {"criterion": "Condiciones a mercado", "weight": 0.30, "eval_type": "pricing_analysis"},
    {"criterion": "Terminabilidad", "weight": 0.30, "eval_type": "exit_terms"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos intra-grupo", "sample": "all", "extractions": ["términos", "precios"]},
    {"doc_type": "Servicios compartidos", "sample": "all", "extractions": ["asignaciones", "costos"]},
    {"doc_type": "Arrendamientos", "sample": "material", "extractions": ["rentas", "condiciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "No terminables o precios off-market", "action": "upgrade_to_critical", "justification": "Riesgo estructural"},
    {"condition": "Terminación al closing", "action": "downgrade_to_medium", "justification": "Solución identificada"}
  ]'::jsonb,
  ARRAY['SLA con matriz no terminable y fee 30% sobre mercado'],
  ARRAY['Servicios intra-grupo terminables con 30 días sin penalidad'],
  ARRAY['Contrato con proveedor habitual sin vinculación real'],
  'CC; normas partes vinculadas', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-006', '1.0',
  'Licencias de software críticas',
  'Verificar licencias clave, condiciones de uso, transferencia y auditoría',
  'CONT', 'Riesgo operativo/PI',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE', 'US'], NULL,
  '[
    {"criterion": "Transferibilidad y sublicencia", "weight": 0.40, "eval_type": "license_review"},
    {"criterion": "Límites de usuarios/métricas", "weight": 0.30, "eval_type": "usage_analysis"},
    {"criterion": "Auditorías y penalidades", "weight": 0.30, "eval_type": "compliance_check"}
  ]'::jsonb,
  '[
    {"doc_type": "EULAs", "sample": "all", "extractions": ["transferencia", "sublicencia"]},
    {"doc_type": "Contratos SaaS", "sample": "material", "extractions": ["capacidad", "términos"]},
    {"doc_type": "Licencias on-prem", "sample": "all", "extractions": ["usuarios", "auditoría"]},
    {"doc_type": "Licencias base de datos", "sample": "material", "extractions": ["asignación", "costos"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "No transferible", "action": "upgrade_to_high", "justification": "Interrupción operativa"},
    {"condition": "Auditoría punitiva", "action": "upgrade_to_high", "justification": "Riesgo sancionador"},
    {"condition": "Licencias enterprise con asignación", "action": "downgrade_to_low", "justification": "Flexible"}
  ]'::jsonb,
  ARRAY['Licencia core no transferible requiere novación con vendor'],
  ARRAY['Licencias corporate con consentimiento ya obtenido'],
  ARRAY['OSS confundido con licencia comercial'],
  'PI; contratos software', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-007', '1.0',
  'Duración indefinida sin cláusula de salida',
  'Identificar contratos indefinidos sin terminación por conveniencia razonable',
  'CONT', 'Rigidez contractual',
  ARRAY['M&A'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Ausencia de terminación por conveniencia", "weight": 0.50, "eval_type": "contract_review"},
    {"criterion": "Plazos de preaviso", "weight": 0.25, "eval_type": "timeline_check"},
    {"criterion": "Penalidades", "weight": 0.25, "eval_type": "financial_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos marco", "sample": "all", "extractions": ["duración", "terminación"]},
    {"doc_type": "Servicios recurrentes", "sample": "material", "extractions": ["vigencia", "salida"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Sin salida y penalidad >10%", "action": "upgrade_to_high", "justification": "Rigidez severa"},
    {"condition": "Preaviso ≥90 días", "action": "downgrade_to_low", "justification": "Viable"}
  ]'::jsonb,
  ARRAY['Contrato indefinido sin salida y penalidad del 15%'],
  ARRAY['Indefinido con salida 60 días sin penalidad'],
  ARRAY['Cláusula de revisión de precios confundida con terminación'],
  'CC', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-008', '1.0',
  'Exclusividades limitantes',
  'Revisar exclusividades que restrinjan operación o expansión',
  'CONT', 'Deal blocker comercial',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE'], 500000,
  '[
    {"criterion": "Alcance producto/territorio", "weight": 0.40, "eval_type": "scope_analysis"},
    {"criterion": "Duración", "weight": 0.30, "eval_type": "timeline_review"},
    {"criterion": "Sanciones", "weight": 0.30, "eval_type": "remedies_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Distribución", "sample": "all", "extractions": ["exclusividad", "territorios"]},
    {"doc_type": "Agencia", "sample": "all", "extractions": ["productos", "restricciones"]},
    {"doc_type": "Franquicia", "sample": "material", "extractions": ["exclusiva", "duración"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Exclusividad >3 años o territorial UE", "action": "upgrade_to_critical", "justification": "Restricción severa"},
    {"condition": "Exclusividad no absoluta", "action": "downgrade_to_medium", "justification": "Flexibilidad"}
  ]'::jsonb,
  ARRAY['Exclusividad UE por 5 años con penalidad del 20%'],
  ARRAY['Exclusividades limitadas a provincia 12 meses'],
  ARRAY['Preferencia de compra sin exclusividad confundida'],
  'LDC; antitrust UE', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-009', '1.0',
  'Vencimientos próximos 12 meses',
  'Detectar expiración o renovación automática en período crítico post-closing',
  'CONT', 'Continuidad operativa',
  ARRAY['M&A'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Vencimiento ≤12 meses", "weight": 0.50, "eval_type": "timeline_scan"},
    {"criterion": "Renovación automática y condiciones", "weight": 0.25, "eval_type": "renewal_check"},
    {"criterion": "Requisitos de aviso", "weight": 0.25, "eval_type": "notice_terms"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos top", "sample": "all", "extractions": ["vencimiento", "renovación"]},
    {"doc_type": "Calendario de vencimientos", "sample": "all", "extractions": ["fechas", "acciones"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Vencimiento <3 meses y sin renovación", "action": "upgrade_to_high", "justification": "Riesgo urgente"},
    {"condition": "Renovación automática favorable", "action": "downgrade_to_low", "justification": "Continuidad asegurada"}
  ]'::jsonb,
  ARRAY['Contrato core vence en 2 meses sin opción de renovación'],
  ARRAY['Renovación automática por 2 años con mismas condiciones'],
  ARRAY['Opción de prórroga ya ejercida documentalmente'],
  'CC; práctica comercial', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-CONT-010', '1.0',
  'Financiación: vencimiento por CoC',
  'Identificar change-of-control en deuda y covenants de aceleración',
  'CONT', 'Deal blocker financiero',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE', 'UK', 'US'], NULL,
  '[
    {"criterion": "CoC con aceleración", "weight": 0.50, "eval_type": "facility_review"},
    {"criterion": "Obligaciones de prepayment", "weight": 0.30, "eval_type": "covenant_analysis"},
    {"criterion": "Necesidad de consentimiento", "weight": 0.20, "eval_type": "consent_mapping"}
  ]'::jsonb,
  '[
    {"doc_type": "Facility agreements", "sample": "all", "extractions": ["CoC", "aceleración"]},
    {"doc_type": "Notas", "sample": "all", "extractions": ["restricciones", "condiciones"]},
    {"doc_type": "Security docs", "sample": "material", "extractions": ["garantías", "eventos"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Prepayment obligatorio sin waiver", "action": "maintain_critical", "justification": "Bloquea deal"},
    {"condition": "Cartas de consentimiento", "action": "downgrade_to_medium", "justification": "Riesgo mitigado"}
  ]'::jsonb,
  ARRAY['Crédito sindicado acelera por CoC sin posibilidad de waiver'],
  ARRAY['CoC con notificación y waiver obtenido de agentes'],
  ARRAY['Covenant de información confundido con CoC'],
  'Práctica financiera; LMA', true
);

-- FISC: Fiscal (8 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-001', '1.0',
  'Contingencias por ejercicios abiertos',
  'Identificar riesgos en ejercicios no prescritos y actas/inspecciones en curso',
  'FISC', 'Contingencia cuantificable',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Ejercicios abiertos y riesgos", "weight": 0.50, "eval_type": "tax_review"},
    {"criterion": "Importes y probabilidad", "weight": 0.30, "eval_type": "risk_assessment"},
    {"criterion": "Provisiones", "weight": 0.20, "eval_type": "accounting_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Declaraciones", "sample": "all", "extractions": ["ejercicios", "bases"]},
    {"doc_type": "Libros", "sample": "material", "extractions": ["registros", "operaciones"]},
    {"doc_type": "Requerimientos", "sample": "all", "extractions": ["conceptos", "cuantías"]},
    {"doc_type": "Actas de inspección", "sample": "all", "extractions": ["hallazgos", "sanciones"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Acta de inspección con propuesta", "action": "upgrade_to_critical", "justification": "Formalización avanzada"},
    {"condition": "Provisión adecuada", "action": "downgrade_to_medium", "justification": "Riesgo acotado"}
  ]'::jsonb,
  ARRAY['Requerimiento por IVA con riesgo estimado de EUR 1M sin provisión'],
  ARRAY['Sin actuaciones ni riesgos significativos'],
  ARRAY['Requerimientos informativos sin propuesta de liquidación'],
  'LGT; LIS; ISAE 3000', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-002', '1.0',
  'Consolidación fiscal y efectos del deal',
  'Evaluar la pertenencia a grupos fiscales y impactos por salida/entrada',
  'FISC', 'Red flag estructural',
  ARRAY['M&A', 'Merger'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Pertenencia y perímetro", "weight": 0.40, "eval_type": "group_analysis"},
    {"criterion": "Efectos por cambio de control", "weight": 0.30, "eval_type": "impact_modeling"},
    {"criterion": "Riesgos por pérdida de beneficios", "weight": 0.30, "eval_type": "deduction_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Acuerdos de grupo", "sample": "all", "extractions": ["miembros", "regímenes"]},
    {"doc_type": "Liquidaciones", "sample": "all", "extractions": ["consolidación", "cuotas"]},
    {"doc_type": "Detalle perímetro", "sample": "material", "extractions": ["entidades", "porcentajes"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Regularización significativa", "action": "upgrade_to_critical", "justification": "Impacto fiscal severo"},
    {"condition": "Neutralidad garantizada", "action": "downgrade_to_medium", "justification": "Riesgo mitigado"}
  ]'::jsonb,
  ARRAY['Pérdida de régimen con regularización de deducciones relevantes'],
  ARRAY['No pertenecen a grupo o transición neutra'],
  ARRAY['Mención histórica de grupo ya extinto'],
  'LIS; LGT', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-003', '1.0',
  'Precios de transferencia',
  'Revisar cumplimiento de documentación y condiciones arm''s length',
  'FISC', 'Red flag TP',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Documentación completa", "weight": 0.40, "eval_type": "documentation_review"},
    {"criterion": "Consistencia económica", "weight": 0.30, "eval_type": "pricing_analysis"},
    {"criterion": "Riesgos de ajuste", "weight": 0.30, "eval_type": "exposure_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Master file", "sample": "all", "extractions": ["grupo", "políticas"]},
    {"doc_type": "Local file", "sample": "all", "extractions": ["transacciones", "justificación"]},
    {"doc_type": "Acuerdos", "sample": "all", "extractions": ["términos", "precios"]},
    {"doc_type": "Benchmarking", "sample": "material", "extractions": ["comparables", "márgenes"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Ausencia de documentación y márgenes fuera de rango", "action": "upgrade_to_critical", "justification": "Riesgo ajuste severo"},
    {"condition": "APA vigente", "action": "downgrade_to_medium", "justification": "Certeza regulatoria"}
  ]'::jsonb,
  ARRAY['Sin local file y servicios intra-grupo con mark-up atípico'],
  ARRAY['Documentación completa y comparables sólidos'],
  ARRAY['Operaciones no vinculadas clasificadas erróneamente'],
  'LIS; reglamento TP', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-004', '1.0',
  'Incentivos fiscales y requisitos',
  'Verificar incentivos aplicados y cumplimiento de condiciones',
  'FISC', 'Contingencia condicional',
  ARRAY['M&A'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Existencia de incentivos", "weight": 0.30, "eval_type": "document_scan"},
    {"criterion": "Cumplimiento de requisitos", "weight": 0.40, "eval_type": "compliance_check"},
    {"criterion": "Riesgos de reintegro", "weight": 0.30, "eval_type": "contingency_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Certificados", "sample": "all", "extractions": ["incentivos", "importes"]},
    {"doc_type": "Resoluciones", "sample": "all", "extractions": ["condiciones", "períodos"]},
    {"doc_type": "Trazabilidad inversiones/empleo", "sample": "material", "extractions": ["comprobantes", "registros"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Incumplimiento probable", "action": "upgrade_to_high", "justification": "Riesgo reintegro"},
    {"condition": "Plazos cumplidos y auditorías superadas", "action": "downgrade_to_low", "justification": "Bajo riesgo"}
  ]'::jsonb,
  ARRAY['Deducción I+D aplicada sin evidencia técnica suficiente'],
  ARRAY['Incentivos con validación y seguimiento documentado'],
  ARRAY['Beneficio fiscal ya prescrito sin riesgo actual'],
  'LIS; LGT', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-005', '1.0',
  'IVA y regularización de bienes de inversión',
  'Evaluar régimen de IVA y ajustes de bienes de inversión',
  'FISC', 'Contingencia IVA',
  ARRAY['Asset Purchase', 'M&A'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Régimen aplicable", "weight": 0.30, "eval_type": "regime_check"},
    {"criterion": "Ajustes pendientes", "weight": 0.40, "eval_type": "adjustment_review"},
    {"criterion": "Riesgos en prorrata", "weight": 0.30, "eval_type": "allocation_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Libros IVA", "sample": "all", "extractions": ["operaciones", "bases"]},
    {"doc_type": "Modelos", "sample": "all", "extractions": ["declaraciones", "cuotas"]},
    {"doc_type": "Detalle activos", "sample": "material", "extractions": ["categorías", "valores"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Ajustes significativos", "action": "upgrade_to_high", "justification": "Impacto económico"},
    {"condition": "TOGC aplicable", "action": "downgrade_to_low", "justification": "Régimen favorable"}
  ]'::jsonb,
  ARRAY['Ajustes de bienes de inversión no practicados'],
  ARRAY['Sin ajustes pendientes; prorrata correcta'],
  ARRAY['Confundir rotación de activos con regularización'],
  'LIVA; doctrina', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-006', '1.0',
  'Retenciones y pagos a cuenta',
  'Comprobar cumplimiento formal y material de retenciones',
  'FISC', 'Compliance',
  ARRAY['M&A'], ARRAY['ES'], 50000,
  '[
    {"criterion": "Presentación y pago", "weight": 0.40, "eval_type": "filing_check"},
    {"criterion": "Cruces de bases", "weight": 0.30, "eval_type": "data_validation"},
    {"criterion": "Certificados a perceptores", "weight": 0.30, "eval_type": "documentation_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Modelos 111/115/123", "sample": "all", "extractions": ["retenciones", "ingresos"]},
    {"doc_type": "Certificados", "sample": "all", "extractions": ["montos", "perceptores"]}
  ]'::jsonb,
  'low',
  '[
    {"condition": "Falta sistemática", "action": "upgrade_to_medium", "justification": "Patrón incumplimiento"},
    {"condition": "Regularización voluntaria", "action": "downgrade_impact", "justification": "Buena fe"}
  ]'::jsonb,
  ARRAY['Falta de ingreso de retenciones de alquiler 12 meses'],
  ARRAY['Cumplimiento regular sin sanciones'],
  ARRAY['Retrasos puntuales regularizados'],
  'LGT; reglamentos', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-007', '1.0',
  'BINs pendientes de compensar',
  'Verificar existencia, cuantía y límites de aprovechamiento',
  'FISC', 'Activo fiscal',
  ARRAY['M&A', 'LBO'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Cuantía y plazo", "weight": 0.40, "eval_type": "balance_review"},
    {"criterion": "Límites y restricciones", "weight": 0.30, "eval_type": "restriction_analysis"},
    {"criterion": "Probabilidad de uso", "weight": 0.30, "eval_type": "utilization_forecast"}
  ]'::jsonb,
  '[
    {"doc_type": "Liquidaciones IS", "sample": "all", "extractions": ["pérdidas", "años"]},
    {"doc_type": "Detalle BINs", "sample": "all", "extractions": ["cuantías", "vencimientos"]},
    {"doc_type": "Límites aplicables", "sample": "material", "extractions": ["restricciones", "cambio control"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Límites severos o cambio de control con restricción", "action": "upgrade_to_high", "justification": "Utilización comprometida"},
    {"condition": "Business plan solvente", "action": "downgrade_to_low", "justification": "Viabilidad probable"}
  ]'::jsonb,
  ARRAY['BINs relevantes con limitación por cambio de control'],
  ARRAY['BINs documentadas y usables según proyección'],
  ARRAY['BINs prescritas ya no aprovechables'],
  'LIS', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-FISC-008', '1.0',
  'Operaciones en jurisdicciones de riesgo',
  'Detectar estructuras y operaciones con riesgo fiscal o sancionador',
  'FISC', 'Red flag jurisdiccional',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Identificación de jurisdicción", "weight": 0.40, "eval_type": "entity_review"},
    {"criterion": "Sustancia económica", "weight": 0.30, "eval_type": "substance_analysis"},
    {"criterion": "Riesgos BEPS", "weight": 0.30, "eval_type": "compliance_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Listados jurisdiccionales", "sample": "all", "extractions": ["entidades", "ubicación"]},
    {"doc_type": "Operaciones", "sample": "material", "extractions": ["transacciones", "términos"]},
    {"doc_type": "Facturación", "sample": "all", "extractions": ["ingresos", "gastos"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Falta de sustancia", "action": "upgrade_to_critical", "justification": "Riesgo BEPS severo"},
    {"condition": "Sustancia acreditada y CbCR", "action": "downgrade_to_medium", "justification": "Cumplimiento documentado"}
  ]'::jsonb,
  ARRAY['Filial en jurisdicción de riesgo sin personal ni medios'],
  ARRAY['Estructuras con sustancia y funciones reales'],
  ARRAY['Servicio off-shore de bajo riesgo mal catalogado'],
  'Directrices OCDE; LGT', true
);

-- LAB: Labor (8 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-001', '1.0',
  'Litigios laborales y contingencias',
  'Identificar litigios en curso y contingencias probables',
  'LAB', 'Contingencia cuantificable',
  ARRAY['M&A', 'LBO'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Número y cuantía", "weight": 0.40, "eval_type": "litigation_review"},
    {"criterion": "Probabilidad", "weight": 0.40, "eval_type": "legal_assessment"},
    {"criterion": "Provisiones", "weight": 0.20, "eval_type": "accounting_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Relación de pleitos", "sample": "all", "extractions": ["demandas", "cuantías"]},
    {"doc_type": "Provisiones", "sample": "all", "extractions": ["importes", "conceptos"]},
    {"doc_type": "Dictámenes", "sample": "material", "extractions": ["probabilidad", "evaluación"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Alta probabilidad sin provisión", "action": "upgrade_to_critical", "justification": "Pasivo no contabilizado"},
    {"condition": "Baja probabilidad y provisión adecuada", "action": "downgrade_to_medium", "justification": "Riesgo acotado"}
  ]'::jsonb,
  ARRAY['Demanda colectiva con riesgo de EUR 1,2M sin provisión'],
  ARRAY['Litigios menores con baja probabilidad y provisionados'],
  ARRAY['Reclamaciones internas no formalizadas judicialmente'],
  'ET; LRJS', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-002', '1.0',
  'Plan de igualdad',
  'Verificar obligación y cumplimiento del plan de igualdad',
  'LAB', 'Compliance',
  ARRAY['M&A'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Obligación aplicable", "weight": 0.30, "eval_type": "threshold_check"},
    {"criterion": "Existencia y registro", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "Implementación", "weight": 0.30, "eval_type": "operational_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Plan de igualdad", "sample": "all", "extractions": ["medidas", "objetivos"]},
    {"doc_type": "Políticas", "sample": "all", "extractions": ["procedimientos", "responsabilidades"]},
    {"doc_type": "Registro", "sample": "all", "extractions": ["depósito", "vigencia"]},
    {"doc_type": "Auditorías retributivas", "sample": "material", "extractions": ["análisis", "resultados"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Incumplimiento con inspección", "action": "upgrade_to_high", "justification": "Sanción iniciada"},
    {"condition": "Plan vigente y auditado", "action": "downgrade_to_low", "justification": "Cumplimiento demostrado"}
  ]'::jsonb,
  ARRAY['Sin plan pese a plantilla >200; riesgo sancionador'],
  ARRAY['Plan registrado y auditado'],
  ARRAY['Política de diversidad no equivale a plan de igualdad'],
  'ET; normativa igualdad', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-003', '1.0',
  'Retención de personal clave',
  'Identificar falta de cláusulas de permanencia/non-compete en key employees',
  'LAB', 'Riesgo de talento',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Identificación de key roles", "weight": 0.30, "eval_type": "organizational_review"},
    {"criterion": "Existencia de cláusulas", "weight": 0.40, "eval_type": "contract_scan"},
    {"criterion": "Enforceability y duración", "weight": 0.30, "eval_type": "legal_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos directivos", "sample": "all", "extractions": ["cargos", "términos"]},
    {"doc_type": "Side letters", "sample": "material", "extractions": ["acuerdos", "condiciones"]},
    {"doc_type": "Incentivos", "sample": "material", "extractions": ["vesting", "trigger"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Ausencia generalizada", "action": "upgrade_to_critical", "justification": "Riesgo talento severo"},
    {"condition": "Retention agreements previos", "action": "downgrade_to_medium", "justification": "Mitigación existente"}
  ]'::jsonb,
  ARRAY['CTO sin non-compete ni permanencia y con vesting por change-of-control'],
  ARRAY['Equipo clave con retención de 18 meses'],
  ARRAY['NDA confundida con non-compete'],
  'ET; práctica directivos', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-004', '1.0',
  'Cesión ilegal de trabajadores',
  'Detectar estructuras de subcontratación con riesgo de cesión ilegal',
  'LAB', 'Deal breaker laboral',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Indicios de cesión", "weight": 0.50, "eval_type": "operational_review"},
    {"criterion": "Dependencia y ajenidad", "weight": 0.30, "eval_type": "control_analysis"},
    {"criterion": "Sanciones y deudas", "weight": 0.20, "eval_type": "compliance_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos de servicios", "sample": "all", "extractions": ["términos", "control"]},
    {"doc_type": "Organigramas", "sample": "all", "extractions": ["reportes", "dependencias"]},
    {"doc_type": "Control efectivo", "sample": "material", "extractions": ["decisiones", "instrucciones"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Masividad y prolongación", "action": "maintain_critical", "justification": "Exposición severa"},
    {"condition": "Regularización y ETT autorizada", "action": "downgrade_to_high", "justification": "Estructura lícita"}
  ]'::jsonb,
  ARRAY['Personal externo bajo órdenes directas del target sin medios propios'],
  ARRAY['Subcontratación lícita con organización propia'],
  ARRAY['Outsourcing de obra/servicio genuino mal interpretado'],
  'ET; doctrina cesión ilegal', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-005', '1.0',
  'Convenio colectivo y CMBs',
  'Verificar convenio aplicable y condiciones más beneficiosas',
  'LAB', 'Contingencia',
  ARRAY['M&A'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Identificación convenio", "weight": 0.40, "eval_type": "document_review"},
    {"criterion": "CMBS relevantes", "weight": 0.30, "eval_type": "benefit_analysis"},
    {"criterion": "Riesgos de absorción/compensación", "weight": 0.30, "eval_type": "impact_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Convenios", "sample": "all", "extractions": ["aplicable", "vigencia"]},
    {"doc_type": "Nóminas", "sample": "material", "extractions": ["complementos", "conceptos"]},
    {"doc_type": "Políticas", "sample": "all", "extractions": ["beneficios", "términos"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "CMBS onerosas generalizadas", "action": "upgrade_to_high", "justification": "Impacto económico"},
    {"condition": "Homogeneización pactada", "action": "downgrade_to_low", "justification": "Solución negociada"}
  ]'::jsonb,
  ARRAY['Complementos ad personam inabsorbibles amplios'],
  ARRAY['Convenio claro y sin CMBS significativas'],
  ARRAY['Mejora voluntaria transitoria ya suprimida'],
  'ET; negociación colectiva', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-006', '1.0',
  'Variable y stock options',
  'Revisar planes de retribución variable y equity pendientes',
  'LAB', 'Pasivo laboral diferido',
  ARRAY['M&A', 'LBO', 'VC'], ARRAY['ES', 'UE', 'US'], 100000,
  '[
    {"criterion": "Existencia y devengo", "weight": 0.40, "eval_type": "plan_review"},
    {"criterion": "Aceleración por CoC", "weight": 0.40, "eval_type": "trigger_analysis"},
    {"criterion": "Cuantía pendiente", "weight": 0.20, "eval_type": "financial_calculation"}
  ]'::jsonb,
  '[
    {"doc_type": "Planes", "sample": "all", "extractions": ["reglas", "triggers"]},
    {"doc_type": "Acuerdos", "sample": "all", "extractions": ["términos", "condiciones"]},
    {"doc_type": "Cap table", "sample": "all", "extractions": ["opciones", "vesting"]},
    {"doc_type": "Devengos", "sample": "material", "extractions": ["cantidades", "fechas"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Aceleración 100% al CoC", "action": "upgrade_to_high", "justification": "Costo significativo"},
    {"condition": "Planes cash-settled con provisión", "action": "downgrade_to_low", "justification": "Riesgo contabilizado"}
  ]'::jsonb,
  ARRAY['Plan con aceleración 100% al CoC por EUR 2M'],
  ARRAY['Planes sin aceleración y con topes'],
  ARRAY['Bonus discrecional sin compromiso contractual firme'],
  'ET; práctica compensación', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-007', '1.0',
  'Sucesión de empresa',
  'Evaluar obligaciones por transmisión de unidad productiva',
  'LAB', 'Red flag',
  ARRAY['Asset Purchase', 'M&A'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Existencia de sucesión", "weight": 0.40, "eval_type": "structural_analysis"},
    {"criterion": "Pasivos asumidos", "weight": 0.40, "eval_type": "liability_review"},
    {"criterion": "Comunicaciones a RLT", "weight": 0.20, "eval_type": "procedural_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Listado de plantilla", "sample": "all", "extractions": ["personas", "funciones"]},
    {"doc_type": "Pasivos", "sample": "all", "extractions": ["deudas", "conceptos"]},
    {"doc_type": "Comunicaciones", "sample": "material", "extractions": ["notificaciones", "fechas"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Pasivos significativos", "action": "upgrade_to_critical", "justification": "Asunción onerosa"},
    {"condition": "Acuerdos de transición", "action": "downgrade_to_medium", "justification": "Mitigación"}
  ]'::jsonb,
  ARRAY['Asunción de antigüedad y deudas salariales cuantiosas'],
  ARRAY['No hay transmisión de unidad autónoma'],
  ARRAY['Cambio societario sin afectación a relaciones laborales'],
  'ET', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LAB-008', '1.0',
  'Representación legal y negociación colectiva',
  'Revisar RLT, comités y procesos de negociación',
  'LAB', 'Best practice',
  ARRAY['M&A'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Existencia y funcionamiento", "weight": 0.40, "eval_type": "organizational_check"},
    {"criterion": "Procesos abiertos", "weight": 0.30, "eval_type": "procedural_review"},
    {"criterion": "Riesgos de conflicto", "weight": 0.30, "eval_type": "risk_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Actas de RLT", "sample": "material", "extractions": ["decisiones", "acuerdos"]},
    {"doc_type": "Comunicaciones", "sample": "all", "extractions": ["notificaciones", "respuestas"]},
    {"doc_type": "Composición RLT", "sample": "all", "extractions": ["representantes", "mandatos"]}
  ]'::jsonb,
  'low',
  '[
    {"condition": "Conflictos abiertos", "action": "upgrade_to_medium", "justification": "Riesgo laboral"},
    {"condition": "Relaciones fluidas", "action": "maintain_low", "justification": "Cooperación"}
  ]'::jsonb,
  ARRAY['Negociación de ERTE en curso con riesgos'],
  ARRAY['Sin procesos activos ni sanciones ITSS'],
  ARRAY['Comité de seguridad y salud confundido con RLT'],
  'ET; LRJS', true
);

-- PI: Intellectual Property (6 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-001', '1.0',
  'Titularidad de patentes y modelos',
  'Verificar que las patentes y modelos críticos son titularidad del target',
  'PI', 'Deal blocker IP',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE', 'US'], NULL,
  '[
    {"criterion": "Titularidad y registros al día", "weight": 0.50, "eval_type": "title_review"},
    {"criterion": "Chain of title completa", "weight": 0.30, "eval_type": "assignment_verification"},
    {"criterion": "Gravámenes/licencias", "weight": 0.20, "eval_type": "lien_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Títulos de patente", "sample": "all", "extractions": ["número", "titular"]},
    {"doc_type": "Registros", "sample": "all", "extractions": ["estado", "vigencia"]},
    {"doc_type": "Cesiones", "sample": "all", "extractions": ["cedentes", "celedarios"]},
    {"doc_type": "Chain of title", "sample": "all", "extractions": ["historial", "validez"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Titularidad en terceros sin licencia", "action": "maintain_critical", "justification": "Bloquea operación"},
    {"condition": "Cesión pendiente de inscripción", "action": "downgrade_to_high", "justification": "Subsanable"}
  ]'::jsonb,
  ARRAY['Patente core figura a nombre de fundador sin cesión'],
  ARRAY['Titularidad clara y sin cargas'],
  ARRAY['Solicitud en trámite confundida con derecho concedido'],
  'Ley de Patentes; EPO/USPTO', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-002', '1.0',
  'Marcas registradas',
  'Confirmar titularidad y vigencia de marcas clave',
  'PI', 'Red flag IP',
  ARRAY['M&A'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Titularidad", "weight": 0.40, "eval_type": "ownership_check"},
    {"criterion": "Vigencia/renovación", "weight": 0.30, "eval_type": "status_review"},
    {"criterion": "Oposiciones/litigios", "weight": 0.30, "eval_type": "litigation_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Certificados de marca", "sample": "all", "extractions": ["número", "vigencia"]},
    {"doc_type": "Expedientes", "sample": "all", "extractions": ["estado", "decisiones"]},
    {"doc_type": "Renovaciones", "sample": "material", "extractions": ["fechas", "tramitación"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Renovación próxima sin plan", "action": "upgrade_to_high", "justification": "Riesgo inminente"},
    {"condition": "Renovada y sin conflictos", "action": "downgrade_to_low", "justification": "Bajo riesgo"}
  ]'::jsonb,
  ARRAY['Marca principal caduca en 2 meses sin renovación'],
  ARRAY['Marcas renovadas y sin oposiciones'],
  ARRAY['Marca defensiva no utilizada sin riesgo material'],
  'Ley Marcas; EUIPO', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-003', '1.0',
  'Cesión de PI por empleados/contratistas',
  'Verificar IP assignment adecuado en creaciones protegidas',
  'PI', 'Deal blocker IP',
  ARRAY['M&A', 'LBO', 'VC'], ARRAY['ES', 'UE', 'US'], NULL,
  '[
    {"criterion": "Existencia de cesión", "weight": 0.50, "eval_type": "document_scan"},
    {"criterion": "Alcance y remuneración", "weight": 0.30, "eval_type": "term_analysis"},
    {"criterion": "Excepciones de moral rights", "weight": 0.20, "eval_type": "legal_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos laborales", "sample": "all", "extractions": ["cláusulas IP", "asignación"]},
    {"doc_type": "Acuerdos de cesión", "sample": "all", "extractions": ["alcance", "compensación"]},
    {"doc_type": "Consultores", "sample": "material", "extractions": ["cesión", "derechos"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Falta de cesiones en desarrollos core", "action": "maintain_critical", "justification": "Riesgo titularidad"},
    {"condition": "Cesiones retroactivas firmadas", "action": "downgrade_to_high", "justification": "Validez pendiente"}
  ]'::jsonb,
  ARRAY['Código fuente desarrollado por contratista sin cesión'],
  ARRAY['Cesiones claras y suficientes'],
  ARRAY['NDA sin cláusula de cesión interpretada como tal'],
  'PI; software', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-004', '1.0',
  'Licencias recibidas: restricciones',
  'Revisar licencias de PI y su transferibilidad/sublicenciabilidad',
  'PI', 'Red flag operativo',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE', 'US'], NULL,
  '[
    {"criterion": "Transferibilidad", "weight": 0.40, "eval_type": "license_review"},
    {"criterion": "Restricciones de uso", "weight": 0.30, "eval_type": "scope_analysis"},
    {"criterion": "Terminación por CoC", "weight": 0.30, "eval_type": "trigger_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Contratos de licencia", "sample": "all", "extractions": ["transferencia", "restricciones"]},
    {"doc_type": "Term sheets", "sample": "all", "extractions": ["condiciones", "alcance"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "No transferible y core", "action": "upgrade_to_critical", "justification": "Bloquea operación"},
    {"condition": "Sublicencia permitida", "action": "downgrade_to_medium", "justification": "Flexible"}
  ]'::jsonb,
  ARRAY['Licencia de tecnología core no transferible por CoC'],
  ARRAY['Licencia transferible con notificación'],
  ARRAY['Cláusula de publicidad mal entendida como restricción de uso'],
  'Contratos PI', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-005', '1.0',
  'Litigios de PI',
  'Identificar litigios o amenazas por infracción/validez',
  'PI', 'Red flag litigiosa',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE', 'US'], 100000,
  '[
    {"criterion": "Existencia y estado", "weight": 0.40, "eval_type": "litigation_review"},
    {"criterion": "Cuantía/impacto", "weight": 0.30, "eval_type": "damages_assessment"},
    {"criterion": "Defensas/seguros", "weight": 0.30, "eval_type": "mitigation_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Demandas", "sample": "all", "extractions": ["acusaciones", "estado"]},
    {"doc_type": "Cartas de cese", "sample": "material", "extractions": ["reclamaciones", "bases"]},
    {"doc_type": "Seguros IP", "sample": "all", "extractions": ["cobertura", "límites"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Medidas cautelares o riesgo de injunction", "action": "upgrade_to_critical", "justification": "Operación comprometida"},
    {"condition": "Acuerdos standstill", "action": "downgrade_to_medium", "justification": "Riesgo pospuesto"}
  ]'::jsonb,
  ARRAY['Carta de cese por infracción de patente clave en curso'],
  ARRAY['Sin litigios ni amenazas creíbles'],
  ARRAY['Reclamación genérica sin base técnica'],
  'Proced. civiles PI', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-PI-006', '1.0',
  'Secretos industriales',
  'Evaluar medidas para proteger know-how y trade secrets',
  'PI', 'Contingencia operativa',
  ARRAY['M&A'], ARRAY['ES', 'UE', 'US'], NULL,
  '[
    {"criterion": "Medidas organizativas/técnicas", "weight": 0.40, "eval_type": "control_review"},
    {"criterion": "NDAs con empleados/terceros", "weight": 0.30, "eval_type": "document_check"},
    {"criterion": "Incidentes", "weight": 0.30, "eval_type": "incident_history"}
  ]'::jsonb,
  '[
    {"doc_type": "Políticas", "sample": "all", "extractions": ["procedimientos", "responsabilidades"]},
    {"doc_type": "NDAs", "sample": "all", "extractions": ["alcance", "duración"]},
    {"doc_type": "Controles de acceso", "sample": "material", "extractions": ["sistemas", "logs"]},
    {"doc_type": "Logs", "sample": "material", "extractions": ["accesos", "cambios"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Fugas previas o controles débiles", "action": "upgrade_to_high", "justification": "Vulnerabilidad documentada"},
    {"condition": "Certificaciones y DLP robusto", "action": "downgrade_to_low", "justification": "Medidas probadas"}
  ]'::jsonb,
  ARRAY['Acceso generalizado a repos sin control ni logs'],
  ARRAY['NDAs universales y segregación de accesos'],
  ARRAY['Política sin implementación real'],
  'Ley de Secretos Empresariales; RGPD', true
);

-- LIT: Litigation & Compliance (8 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-001', '1.0',
  'Litigios civiles/mercantiles',
  'Identificar pleitos relevantes en curso y su exposición',
  'LIT', 'Contingencia litigiosa',
  ARRAY['M&A', 'LBO'], ARRAY['ES'], 100000,
  '[
    {"criterion": "Estado procesal", "weight": 0.40, "eval_type": "procedural_review"},
    {"criterion": "Cuantía", "weight": 0.40, "eval_type": "financial_assessment"},
    {"criterion": "Probabilidad", "weight": 0.20, "eval_type": "legal_opinion"}
  ]'::jsonb,
  '[
    {"doc_type": "Relación de pleitos", "sample": "all", "extractions": ["demandas", "estado"]},
    {"doc_type": "Escritos", "sample": "all", "extractions": ["alegaciones", "pretensiones"]},
    {"doc_type": "Provisiones", "sample": "material", "extractions": ["importes", "justificación"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Medidas cautelares", "action": "upgrade_to_critical", "justification": "Ejecución inmediata posible"},
    {"condition": "Acuerdos avanzados de transacción", "action": "downgrade_to_medium", "justification": "Resolución en curso"}
  ]'::jsonb,
  ARRAY['Demanda por incumplimiento con solicitud de embargo preventivo'],
  ARRAY['Pleitos menores provisionados'],
  ARRAY['Reclamaciones extrajudiciales sin demanda'],
  'LEC; ISAE 3000', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-002', '1.0',
  'Sancionadores administrativos',
  'Revisar procedimientos y resoluciones administrativas',
  'LIT', 'Red flag regulatorio',
  ARRAY['M&A'], ARRAY['ES', 'UE'], 50000,
  '[
    {"criterion": "Existencia y gravedad", "weight": 0.40, "eval_type": "sanction_review"},
    {"criterion": "Estado y recurribilidad", "weight": 0.30, "eval_type": "procedural_check"},
    {"criterion": "Reincidencia", "weight": 0.30, "eval_type": "pattern_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Expedientes", "sample": "all", "extractions": ["hechos", "infracciones"]},
    {"doc_type": "Resoluciones", "sample": "all", "extractions": ["sanciones", "importes"]},
    {"doc_type": "Recursos", "sample": "material", "extractions": ["estado", "plazos"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Reincidencia o cuantías altas", "action": "upgrade_to_critical", "justification": "Patrón grave"},
    {"condition": "Archivo reciente", "action": "downgrade_to_low", "justification": "Riesgo superado"}
  ]'::jsonb,
  ARRAY['Sanción en curso por consumo con multa potencial elevada'],
  ARRAY['Sin expedientes activos'],
  ARRAY['Acta de inspección sin propuesta sancionadora'],
  'Ley procedimiento sancionador sectorial', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-003', '1.0',
  'Investigaciones penales',
  'Detectar investigaciones o imputaciones a sociedad/administradores',
  'LIT', 'Deal breaker penal',
  ARRAY['M&A', 'LBO'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Existencia de investigación", "weight": 0.60, "eval_type": "case_review"},
    {"criterion": "Alcance y tipología", "weight": 0.20, "eval_type": "crime_analysis"},
    {"criterion": "Cobertura aseguradora", "weight": 0.20, "eval_type": "insurance_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Diligencias", "sample": "all", "extractions": ["hechos", "acusados"]},
    {"doc_type": "Comunicaciones", "sample": "all", "extractions": ["imputaciones", "cargos"]},
    {"doc_type": "Pólizas", "sample": "all", "extractions": ["cobertura", "límites"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Hechos recientes y graves", "action": "maintain_critical", "justification": "Riesgo penal elevado"},
    {"condition": "Sobreseimiento provisional", "action": "downgrade_to_high", "justification": "Suspensión temporal"}
  ]'::jsonb,
  ARRAY['Diligencias por blanqueo en curso contra la sociedad'],
  ARRAY['Sin investigaciones ni antecedentes'],
  ARRAY['Denuncias archivadas hace años'],
  'CP; compliance penal', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-004', '1.0',
  'Programa de compliance penal',
  'Evaluar existencia y efectividad del programa',
  'LIT', 'Compliance estructural',
  ARRAY['M&A'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Existencia y actualización", "weight": 0.30, "eval_type": "document_review"},
    {"criterion": "Efectividad/monitoring", "weight": 0.40, "eval_type": "operational_check"},
    {"criterion": "Cultura y reporting", "weight": 0.30, "eval_type": "cultural_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Políticas", "sample": "all", "extractions": ["procedimientos", "roles"]},
    {"doc_type": "Mapa de riesgos", "sample": "all", "extractions": ["áreas", "controles"]},
    {"doc_type": "Controles", "sample": "material", "extractions": ["mecanismos", "verificación"]},
    {"doc_type": "Formación", "sample": "material", "extractions": ["programas", "registros"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Programa certificado y testado", "action": "downgrade_to_low", "justification": "Evidencia de efectividad"},
    {"condition": "Ausencia total", "action": "upgrade_to_high", "justification": "Brecha material"}
  ]'::jsonb,
  ARRAY['Programa desactualizado sin training ni canal operativo'],
  ARRAY['Programa robusto con evidencias'],
  ARRAY['Código ético sin implementación'],
  'CP; UNE/ISO compliance', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-005', '1.0',
  'Canal de denuncias',
  'Verificar implantación y registros de canal',
  'LIT', 'Compliance',
  ARRAY['M&A'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia y confidencialidad", "weight": 0.40, "eval_type": "system_review"},
    {"criterion": "Gestión de casos", "weight": 0.30, "eval_type": "case_handling"},
    {"criterion": "Protección al denunciante", "weight": 0.30, "eval_type": "safeguard_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Política", "sample": "all", "extractions": ["procedimiento", "confidencialidad"]},
    {"doc_type": "Plataforma", "sample": "all", "extractions": ["acceso", "funcionalidad"]},
    {"doc_type": "Registros", "sample": "material", "extractions": ["denuncias", "resolución"]},
    {"doc_type": "Reportes", "sample": "material", "extractions": ["estadísticas", "seguimiento"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Casos no gestionados", "action": "upgrade_to_high", "justification": "Inefectividad comprobada"},
    {"condition": "Plataforma externa y métricas", "action": "downgrade_to_low", "justification": "Sistema robusto"}
  ]'::jsonb,
  ARRAY['Canal sin trazabilidad ni cierres documentados'],
  ARRAY['Canal con SLAs y métricas'],
  ARRAY['Buzón de sugerencias interpretado como canal formal'],
  'Normativa whistleblowing UE/ES', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-006', '1.0',
  'Protección de datos (RGPD)',
  'Evaluar cumplimiento RGPD: registros, bases legitimación y DPO',
  'LIT', 'Compliance RGPD',
  ARRAY['M&A'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Registro y mapeo", "weight": 0.30, "eval_type": "mapping_review"},
    {"criterion": "Tratamientos y bases", "weight": 0.40, "eval_type": "processing_analysis"},
    {"criterion": "DPO/encargados", "weight": 0.30, "eval_type": "governance_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Registro de actividades", "sample": "all", "extractions": ["tratamientos", "bases"]},
    {"doc_type": "Políticas", "sample": "all", "extractions": ["privacidad", "procedimientos"]},
    {"doc_type": "Contratos encargo", "sample": "material", "extractions": ["procesadores", "obligaciones"]},
    {"doc_type": "EIPD", "sample": "material", "extractions": ["riesgos", "medidas"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "EIPD omitida en alto riesgo", "action": "upgrade_to_critical", "justification": "Incumplimiento grave"},
    {"condition": "Certificaciones", "action": "downgrade_to_medium", "justification": "Validación externa"}
  ]'::jsonb,
  ARRAY['Tratamientos alto riesgo sin EIPD ni DPO'],
  ARRAY['Cumplimiento sustantivo y contratos adecuados'],
  ARRAY['Política web confusa sin incidencia real'],
  'RGPD; LOPDGDD', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-007', '1.0',
  'Medioambiente y pasivos',
  'Identificar riesgos y pasivos ambientales',
  'LIT', 'Red flag ambiental',
  ARRAY['M&A'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Cumplimiento licencias", "weight": 0.30, "eval_type": "compliance_check"},
    {"criterion": "Pasivos y sanciones", "weight": 0.40, "eval_type": "liability_review"},
    {"criterion": "Seguros/cautelas", "weight": 0.30, "eval_type": "mitigation_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Licencias", "sample": "all", "extractions": ["autorización", "condiciones"]},
    {"doc_type": "Informes", "sample": "material", "extractions": ["auditoría ambiental", "hallazgos"]},
    {"doc_type": "Sanciones", "sample": "all", "extractions": ["infracciones", "multas"]},
    {"doc_type": "Seguros", "sample": "material", "extractions": ["cobertura", "límites"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Suelos contaminados o sanciones graves", "action": "upgrade_to_critical", "justification": "Remediación onerosa"},
    {"condition": "Auditorías limpias", "action": "downgrade_to_medium", "justification": "Riesgo bajo"}
  ]'::jsonb,
  ARRAY['Pasivo por suelos contaminados en plantas activas'],
  ARRAY['Cumplimiento y sin pasivos'],
  ARRAY['Incidencia menor ya subsanada'],
  'Normativa ambiental sectorial', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-LIT-008', '1.0',
  'Normativa sectorial',
  'Revisar cumplimiento con reguladores sectoriales',
  'LIT', 'Contingencia sectorial',
  ARRAY['M&A'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Licencias/altas", "weight": 0.40, "eval_type": "licensing_check"},
    {"criterion": "Inspecciones y hallazgos", "weight": 0.30, "eval_type": "inspection_review"},
    {"criterion": "Reporting", "weight": 0.30, "eval_type": "compliance_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Licencias sectoriales", "sample": "all", "extractions": ["autorización", "vigencia"]},
    {"doc_type": "Inspecciones", "sample": "material", "extractions": ["fecha", "hallazgos"]},
    {"doc_type": "Reportes", "sample": "material", "extractions": ["periodicidad", "contenido"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Sanciones previas y deficiencias sistémicas", "action": "upgrade_to_high", "justification": "Patrón incumplimiento"},
    {"condition": "Cumplimiento certificado", "action": "downgrade_to_low", "justification": "Validación externa"}
  ]'::jsonb,
  ARRAY['Deficiencias reiteradas en reporting regulatorio'],
  ARRAY['Cumplimiento y sin hallazgos'],
  ARRAY['Requerimiento informativo sin sanción'],
  'Regulatorio sectorial (CNMV, CNMC)', true
);

-- ADM: Administrative (6 Finding Objectives)

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-001', '1.0',
  'Licencias y autorizaciones vigentes',
  'Verificar existencia y vigencia de licencias operativas',
  'ADM', 'Red flag operativo',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Existencia", "weight": 0.40, "eval_type": "document_scan"},
    {"criterion": "Vigencia y condiciones", "weight": 0.40, "eval_type": "compliance_check"},
    {"criterion": "Sanciones/inspecciones", "weight": 0.20, "eval_type": "sanction_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Licencias", "sample": "all", "extractions": ["número", "vigencia"]},
    {"doc_type": "Resoluciones", "sample": "all", "extractions": ["otorgante", "condiciones"]},
    {"doc_type": "Pagos de tasas", "sample": "material", "extractions": ["fechas", "comprobantes"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Licencia esencial caducada", "action": "upgrade_to_critical", "justification": "Cierre operativo"},
    {"condition": "Prórroga en curso", "action": "downgrade_to_medium", "justification": "Transición controlada"}
  ]'::jsonb,
  ARRAY['Licencia de actividad caducada sin renovación'],
  ARRAY['Licencias al día y sin sanciones'],
  ARRAY['Licencia de almacén secundario no esencial'],
  'Leyes sectoriales locales', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-002', '1.0',
  'Concesiones y contratos públicos',
  'Revisar transmisibilidad, subrogación y CoC en contratos públicos',
  'ADM', 'Deal blocker público',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES', 'UE'], 250000,
  '[
    {"criterion": "Cláusulas de transmisión", "weight": 0.50, "eval_type": "contract_review"},
    {"criterion": "Necesidad de autorización", "weight": 0.30, "eval_type": "approval_mapping"},
    {"criterion": "Sanciones", "weight": 0.20, "eval_type": "enforcement_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Pliegos", "sample": "all", "extractions": ["cláusulas", "restricciones"]},
    {"doc_type": "Adjudicaciones", "sample": "all", "extractions": ["términos", "obligaciones"]},
    {"doc_type": "Contratos", "sample": "material", "extractions": ["cesión", "consentimiento"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Necesidad de autorización previa sin margen", "action": "maintain_critical", "justification": "Deal dependiente"},
    {"condition": "Autorización obtenida", "action": "downgrade_to_high", "justification": "Requisito cumplido"}
  ]'::jsonb,
  ARRAY['Pliego prohíbe cesión sin autorización del órgano de contratación'],
  ARRAY['Autorización concedida antes de closing'],
  ARRAY['Modificación no sustancial confundida con cesión'],
  'LCSP; práctica concesional', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-003', '1.0',
  'Subvenciones y obligaciones',
  'Verificar subvenciones, compromisos de mantenimiento y reintegros',
  'ADM', 'Contingencia pública',
  ARRAY['M&A'], ARRAY['ES', 'UE'], 100000,
  '[
    {"criterion": "Existencia y cuantía", "weight": 0.30, "eval_type": "document_scan"},
    {"criterion": "Condiciones/mantenimiento", "weight": 0.40, "eval_type": "obligation_review"},
    {"criterion": "Riesgo de reintegro", "weight": 0.30, "eval_type": "contingency_assessment"}
  ]'::jsonb,
  '[
    {"doc_type": "Resoluciones", "sample": "all", "extractions": ["concesión", "condiciones"]},
    {"doc_type": "Justificaciones", "sample": "material", "extractions": ["cumplimiento", "documentación"]},
    {"doc_type": "Auditorías", "sample": "material", "extractions": ["resultado", "hallazgos"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Incumplimiento de mantenimiento", "action": "upgrade_to_critical", "justification": "Reintegro probable"},
    {"condition": "Cumplimientos acreditados", "action": "downgrade_to_medium", "justification": "Riesgo bajo"}
  ]'::jsonb,
  ARRAY['Subvención con obligación de empleo incumplida'],
  ARRAY['Subvenciones justificadas y vigentes'],
  ARRAY['Subvención solicitada pero no concedida'],
  'Ley subvenciones; fondos UE', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-004', '1.0',
  'Urbanismo y licencias de actividad',
  'Evaluar autorizaciones urbanísticas y licencias asociadas a inmuebles',
  'ADM', 'Contingencia urbanística',
  ARRAY['M&A', 'Asset Purchase'], ARRAY['ES'], NULL,
  '[
    {"criterion": "Conformidad urbanística", "weight": 0.40, "eval_type": "zoning_check"},
    {"criterion": "Licencias y usos", "weight": 0.40, "eval_type": "license_review"},
    {"criterion": "Incidencias/sanciones", "weight": 0.20, "eval_type": "enforcement_check"}
  ]'::jsonb,
  '[
    {"doc_type": "Licencias", "sample": "all", "extractions": ["uso", "condiciones"]},
    {"doc_type": "ITE", "sample": "material", "extractions": ["estado", "deficiencias"]},
    {"doc_type": "Cédulas", "sample": "all", "extractions": ["datos", "superficies"]},
    {"doc_type": "Planeamiento", "sample": "material", "extractions": ["clasificación", "usos permitidos"]}
  ]'::jsonb,
  'medium',
  '[
    {"condition": "Infracción urbanística grave", "action": "upgrade_to_high", "justification": "Demolición/sanciones posibles"},
    {"condition": "Subsanación aprobada", "action": "downgrade_to_low", "justification": "Riesgo mitigado"}
  ]'::jsonb,
  ARRAY['Actividad operativa sin licencia actualizada'],
  ARRAY['Todo en regla según planeamiento'],
  ARRAY['Licencia de obras menor ya caducada sin impacto'],
  'Normas urbanísticas locales', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-005', '1.0',
  'Control de inversiones extranjeras',
  'Verificar sujeción a FDI screening y autorizaciones',
  'ADM', 'Deal breaker FDI',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Sujeción por sector/umbral", "weight": 0.50, "eval_type": "sector_analysis"},
    {"criterion": "Necesidad de autorización", "weight": 0.30, "eval_type": "threshold_check"},
    {"criterion": "Tiempos/procedimiento", "weight": 0.20, "eval_type": "timeline_review"}
  ]'::jsonb,
  '[
    {"doc_type": "Estructura accionarial", "sample": "all", "extractions": ["nacionalidad", "control"]},
    {"doc_type": "Sectores sensibles", "sample": "material", "extractions": ["actividad", "clasificación"]},
    {"doc_type": "Umbrales", "sample": "all", "extractions": ["control", "influencia"]}
  ]'::jsonb,
  'high',
  '[
    {"condition": "Operaciones en sectores estratégicos", "action": "upgrade_to_critical", "justification": "Screening obligatorio"},
    {"condition": "No sujeción clara", "action": "downgrade_to_low", "justification": "Fuera de ámbito"}
  ]'::jsonb,
  ARRAY['Target en sector crítico requiere autorización previa'],
  ARRAY['Operación fuera de ámbitos de control'],
  ARRAY['Notificación voluntaria confundida con autorización'],
  'Régimen FDI ES/UE', true
);

INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-ADM-006', '1.0',
  'Autorizaciones de concentración',
  'Evaluar necesidad de merger control ante autoridades de competencia',
  'ADM', 'Deal blocker competencia',
  ARRAY['M&A', 'Merger', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[
    {"criterion": "Umbrales de notificación", "weight": 0.40, "eval_type": "threshold_calculation"},
    {"criterion": "Jurisdicciones afectadas", "weight": 0.30, "eval_type": "jurisdiction_mapping"},
    {"criterion": "Timings/remedios", "weight": 0.30, "eval_type": "procedure_analysis"}
  ]'::jsonb,
  '[
    {"doc_type": "Ingresos", "sample": "all", "extractions": ["mundial", "jurisdiccional"]},
    {"doc_type": "Cuotas", "sample": "material", "extractions": ["mercado", "competidores"]},
    {"doc_type": "Umbrales", "sample": "all", "extractions": ["aplicables", "superación"]},
    {"doc_type": "Jurisdicciones", "sample": "material", "extractions": ["actividad", "filing"]}
  ]'::jsonb,
  'critical',
  '[
    {"condition": "Multijurisdiccional y solapamientos fuertes", "action": "maintain_critical", "justification": "Riesgo competencial elevado"},
    {"condition": "Pre-notificación temprana", "action": "downgrade_to_high", "justification": "Proceso avanzado"}
  ]'::jsonb,
  ARRAY['Umbrales superados CNMC y obligación UE'],
  ARRAY['No se alcanzan umbrales; no hay filing'],
  ARRAY['Umbral local confundido con UE'],
  'Normativa competencia ES/UE', true
);

COMMIT;

-- =============================================================================
-- End of LEGAL_CATALOG_SEED.sql
-- All 54 Finding Objectives inserted successfully
-- =============================================================================
