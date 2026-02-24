-- Migration: seed_ca_skills
-- Purpose: Seed 8 Cuentas Anuales (CA) skills for due diligence analysis
-- Date: 2026-02-28
-- Depends on: CA FOs must exist (Task 1 - CA_CATALOG_SEED.sql)
-- Reference: docs/architecture/CA_SKILLS_WORKFLOWS.md

BEGIN;

-- ============================================================
-- Seed 8 CA Skills for Cuentas Anuales analysis
-- Area: MERC (Mercantil/Societario)
-- Categories: extraccion, analisis, verificacion
-- ============================================================

INSERT INTO public.dd_skills_catalog (
  area_code,
  skill_key,
  name,
  description,
  category,
  prompt_template,
  expected_output_schema,
  evidence_requirements,
  agent_pipeline,
  is_active
) VALUES

-- ============================================================
-- Skill 1: ca.extraccion_cuentas (extraccion)
-- FOs cubiertos: CA-001 (aprobacion/deposito), CA-014 (coherencia)
-- ============================================================
(
  'MERC',
  'ca.extraccion_cuentas',
  'Extraccion de Cuentas Anuales',
  'Extrae datos estructurados de las cuentas anuales (balance, P&L, memoria) y del certificado de deposito en el Registro Mercantil. Es el skill base que alimenta a todos los demas skills CA.',
  'extraccion',
  E'Eres un analista legal especializado en cuentas anuales espanolas conforme al Plan General de Contabilidad y la Ley de Sociedades de Capital. Analiza las cuentas anuales de [sociedad_target] (ejercicio: [ejercicio]) y extrae de forma exhaustiva los siguientes datos estructurados.\n\n**INSTRUCCIONES CRITICAS:**\n- No inventes datos. Si un campo no aparece en los documentos, indica "no_consta".\n- Cita siempre pagina y seccion para cada dato extraido.\n- Si hay discrepancias entre el acta de junta y el deposito registral, marcalas como "discrepancia_detectada" y documenta ambas versiones.\n\n**CAMPOS A EXTRAER:**\n\n1. **Datos del ejercicio:**\n   - ejercicio: ano fiscal\n   - fecha_formulacion: fecha de formulacion por el organo de administracion\n   - fecha_aprobacion: fecha de aprobacion por la junta general\n   - fecha_deposito_rm: fecha de presentacion en el Registro Mercantil\n   - estado_deposito: depositado | pendiente | defectuoso | no_depositado\n\n2. **Magnitudes patrimoniales:**\n   - patrimonio_neto: importe total del patrimonio neto\n   - capital_social: importe del capital social\n   - reserva_legal: importe de la reserva legal\n   - reservas_indisponibles: total de reservas indisponibles (art. 148 y ss. LSC)\n   - resultado_ejercicio: resultado del ejercicio (beneficio/perdida)\n\n3. **Aplicacion del resultado:**\n   - dividendos: importe destinado a dividendos\n   - reservas: importe destinado a reservas voluntarias\n   - compensacion_perdidas: importe destinado a compensar perdidas de ejercicios anteriores\n   - remanente: importe pendiente de aplicacion\n\n4. **Autocartera:**\n   - existe: si la sociedad posee acciones/participaciones propias\n   - importe: valor de la autocartera\n\n5. **Auditoria (si procede):**\n   - existe: si las cuentas estan auditadas\n   - auditor: denominacion del auditor\n   - tipo_opinion: favorable | salvedades | desfavorable | denegada\n   - going_concern: si existe mencion a principio de empresa en funcionamiento\n   - KAM: cuestiones clave de auditoria identificadas\n   - enfasis: parrafos de enfasis\n\n6. **Verificacion registral:**\n   - concordancia_acta_deposito: si el contenido del deposito coincide con el acta de junta\n   - defectos_registrales: lista de defectos o discrepancias detectadas\n\nIncluye array "evidencias" con doc_id, pagina, seccion y snippet para cada dato critico.',
  '{"type":"object","required":["ejercicio","patrimonio_neto","capital_social"],"properties":{"ejercicio":{"type":"string"},"fecha_formulacion":{"type":"string","format":"date"},"fecha_aprobacion":{"type":"string","format":"date"},"fecha_deposito_rm":{"type":"string","format":"date"},"estado_deposito":{"type":"string","enum":["depositado","pendiente","defectuoso","no_depositado"]},"patrimonio_neto":{"type":"number"},"capital_social":{"type":"number"},"reserva_legal":{"type":"number"},"reservas_indisponibles":{"type":"number"},"resultado_ejercicio":{"type":"number"},"aplicacion_resultado":{"type":"object","properties":{"dividendos":{"type":"number"},"reservas":{"type":"number"},"compensacion_perdidas":{"type":"number"},"remanente":{"type":"number"}}},"autocartera":{"type":"object","properties":{"existe":{"type":"boolean"},"importe":{"type":"number"}}},"auditoria":{"type":"object","properties":{"existe":{"type":"boolean"},"auditor":{"type":"string"},"tipo_opinion":{"type":"string","enum":["favorable","salvedades","desfavorable","denegada"]},"going_concern":{"type":"boolean"},"KAM":{"type":"array","items":{"type":"string"}},"enfasis":{"type":"array","items":{"type":"string"}}}},"concordancia_acta_deposito":{"type":"boolean"},"defectos_registrales":{"type":"array","items":{"type":"string"}},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"seccion":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"cuentas_anuales","required":true},{"type":"document","source":"acta_junta","required":true},{"type":"document","source":"justificante_deposito_rm","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 2: ca.analisis_auditoria (analisis)
-- FOs cubiertos: CA-002 (obligacion/nombramiento), CA-003 (opinion/KAM/continuidad)
-- HITL obligatorio: Si
-- ============================================================
(
  'MERC',
  'ca.analisis_auditoria',
  'Analisis de Auditoria',
  'Analiza el informe de auditoria: tipo de opinion, KAM, salvedades, enfasis, going concern. Determina obligatoriedad de auditoria y vigencia del nombramiento del auditor.',
  'analisis',
  E'Eres un abogado especialista en derecho societario y auditoria de cuentas. Analiza el informe de auditoria y documentacion de nombramiento del auditor de [sociedad_target] (ejercicio: [ejercicio]).\n\n**INSTRUCCIONES CRITICAS:**\n- Evalua si la sociedad tiene obligacion de auditar conforme al art. 263 LSC (limites: activo >4M EUR, cifra negocios >8M EUR, trabajadores >50).\n- Analiza la vigencia del nombramiento del auditor (art. 264 LSC: minimo 3 anios, maximo 9).\n- Interpreta la opinion de auditoria con rigor tecnico.\n- Las cuestiones clave de auditoria (KAM) y parrafos de enfasis requieren analisis legal detallado.\n\n**AREAS DE ANALISIS:**\n\n1. **Obligacion de auditoria:**\n   - es_obligatoria: si la sociedad supera umbrales o tiene obligacion especial\n   - base_legal: articulo o norma aplicable\n   - umbrales_superados: cuales de los 3 umbrales supera\n\n2. **Auditor:**\n   - nombre: denominacion del auditor\n   - nombramiento_valido: si el nombramiento cumple requisitos legales\n   - fecha_nombramiento: cuando fue nombrado\n   - vigencia_hasta: cuando expira el nombramiento\n   - independencia_acreditada: si existe carta de independencia\n\n3. **Opinion de auditoria:**\n   - tipo: favorable | salvedades | desfavorable | denegada\n   - salvedades: descripcion e impacto estimado de cada salvedad\n   - enfasis: parrafos de enfasis con indicacion de si afectan a going concern\n   - KAM: cuestiones clave con descripcion y riesgo transaccional\n\n4. **Going concern (empresa en funcionamiento):**\n   - mencionado: si hay mencion al principio de empresa en funcionamiento\n   - tipo: incertidumbre_material | enfasis | no_mencionado\n   - plan_viabilidad_existe: si existe plan de viabilidad\n   - plan_viabilidad_creible: evaluacion de la credibilidad del plan\n\n5. **Severidad sugerida:** critical | high | medium | low | informational\n\nIncluye evidencias con referencias a paginas del informe de auditoria.',
  '{"type":"object","required":["opinion"],"properties":{"obligacion_auditoria":{"type":"object","properties":{"es_obligatoria":{"type":"boolean"},"base_legal":{"type":"string"},"umbrales_superados":{"type":"array","items":{"type":"string"}}}},"auditor":{"type":"object","properties":{"nombre":{"type":"string"},"nombramiento_valido":{"type":"boolean"},"fecha_nombramiento":{"type":"string","format":"date"},"vigencia_hasta":{"type":"string","format":"date"},"independencia_acreditada":{"type":"boolean"}}},"opinion":{"type":"object","required":["tipo"],"properties":{"tipo":{"type":"string","enum":["favorable","salvedades","desfavorable","denegada"]},"salvedades":{"type":"array","items":{"type":"object","properties":{"descripcion":{"type":"string"},"impacto_estimado":{"type":"number"}}}},"enfasis":{"type":"array","items":{"type":"object","properties":{"descripcion":{"type":"string"},"es_going_concern":{"type":"boolean"}}}},"KAM":{"type":"array","items":{"type":"object","properties":{"titulo":{"type":"string"},"descripcion":{"type":"string"},"riesgo_transaccional":{"type":"string"}}}}}},"going_concern":{"type":"object","properties":{"mencionado":{"type":"boolean"},"tipo":{"type":"string","enum":["incertidumbre_material","enfasis","no_mencionado"]},"plan_viabilidad_existe":{"type":"boolean"},"plan_viabilidad_creible":{"type":"boolean"}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"informe_auditoria","required":true},{"type":"document","source":"nombramiento_auditor","required":false},{"type":"document","source":"carta_independencia","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 3: ca.patrimonio_neto (verificacion)
-- FOs cubiertos: CA-004 (situacion patrimonial/disolucion)
-- HITL obligatorio: Si
-- ============================================================
(
  'MERC',
  'ca.patrimonio_neto',
  'Diagnostico de Patrimonio Neto',
  'Diagnostica la situacion del patrimonio neto y evalua si se activan deberes legales de reequilibrio o disolucion conforme a los arts. 363, 365 y 367 LSC.',
  'verificacion',
  E'Eres un abogado especialista en derecho de sociedades. Analiza la situacion patrimonial de [sociedad_target] (ejercicio: [ejercicio]) para determinar si existe causa legal de disolucion o riesgo de responsabilidad de administradores.\n\n**MARCO LEGAL:**\n- Art. 363.1.e) LSC: causa de disolucion por perdidas que reduzcan el patrimonio neto por debajo de la mitad del capital social.\n- Art. 365 LSC: obligacion de convocar junta en 2 meses para adoptar medidas.\n- Art. 367 LSC: responsabilidad solidaria de administradores por deudas sociales.\n\n**MAPA DE 5 ESCENARIOS:**\n1. **Holgado**: PN/CS > 66% - Sin riesgo\n2. **Perdida coyuntural**: 50% < PN/CS < 66% - Vigilancia\n3. **Deterioro incipiente**: PN/CS cercano a 50% - Alerta temprana\n4. **Desequilibrio activo**: PN/CS < 50% - Causa de disolucion activada\n5. **Persistencia sin medidas**: PN/CS < 50% sin medidas adoptadas - Responsabilidad administradores\n\n**CAMPOS A ANALIZAR:**\n\n1. **Magnitudes:**\n   - patrimonio_neto: importe total\n   - capital_social: importe capital social\n   - ratio_pn_cs: patrimonio neto / capital social (expresado en %)\n\n2. **Escenario:** Uno de los 5 del mapa\n\n3. **Causa de disolucion:**\n   - causa_disolucion_activada: si PN < CS/2\n\n4. **Senales de alarma:**\n   - fondos propios negativos\n   - perdidas acumuladas superiores a reservas disponibles\n   - going concern en auditoria\n   - retrasos en pagos a proveedores/acreedores\n\n5. **Covenants afectados:**\n   - covenant: descripcion del covenant financiero\n   - estado: cumplido | incumplido | en riesgo\n\n6. **Medidas detectadas:**\n   - convocatoria: si se ha convocado junta para tratar la situacion\n   - acuerdo_adoptado: si se ha adoptado acuerdo\n   - tipo_medida: reduccion | aumento | aportacion | disolucion | ninguna\n   - ejecucion_material: si la medida se ha ejecutado\n   - inscripcion_rm: si la medida esta inscrita en el RM\n\n7. **Activacion skill encadenado:**\n   - activa_fo_patneto_002: true si escenario es desequilibrio_activo o persistencia_sin_medidas\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":["patrimonio_neto","capital_social","ratio_pn_cs","escenario_mapa"],"properties":{"patrimonio_neto":{"type":"number"},"capital_social":{"type":"number"},"ratio_pn_cs":{"type":"number"},"escenario_mapa":{"type":"string","enum":["holgado","perdida_coyuntural","deterioro_incipiente","desequilibrio_activo","persistencia_sin_medidas"]},"causa_disolucion_activada":{"type":"boolean"},"senales_alarma":{"type":"array","items":{"type":"string"}},"covenants_afectados":{"type":"array","items":{"type":"object","properties":{"covenant":{"type":"string"},"estado":{"type":"string","enum":["cumplido","incumplido","en_riesgo"]}}}},"medidas_detectadas":{"type":"object","properties":{"convocatoria":{"type":"boolean"},"acuerdo_adoptado":{"type":"boolean"},"tipo_medida":{"type":"string","enum":["reduccion","aumento","aportacion","disolucion","combinada","ninguna"]},"ejecucion_material":{"type":"boolean"},"inscripcion_rm":{"type":"boolean"}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"activa_fo_patneto_002":{"type":"boolean"},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"cuentas_anuales","required":true},{"type":"document","source":"memoria","required":true},{"type":"document","source":"actas_medidas","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 4: ca.aplicacion_resultado (analisis)
-- FOs cubiertos: CA-005 (dividendos/reservas), CA-006 (autocartera/reservas indisponibles)
-- HITL obligatorio: Si
-- ============================================================
(
  'MERC',
  'ca.aplicacion_resultado',
  'Legalidad de Aplicacion del Resultado',
  'Verifica la legalidad de la distribucion de resultados y reservas, y comprueba el cumplimiento de los limites de autocartera y reservas indisponibles.',
  'analisis',
  E'Eres un abogado especialista en derecho de sociedades y distribucion de dividendos. Analiza la propuesta de aplicacion del resultado de [sociedad_target] (ejercicio: [ejercicio]).\n\n**MARCO LEGAL:**\n- Art. 273 LSC: requisitos para distribuir dividendos (beneficio o reservas disponibles, reserva legal dotada, perdidas compensadas).\n- Art. 274 LSC: dotacion obligatoria reserva legal (10% beneficio hasta 20% capital social).\n- Art. 148 LSC: reservas indisponibles por autocartera.\n- Art. 276 LSC: patrimonio neto post-reparto no inferior a capital social.\n\n**ANALISIS REQUERIDO:**\n\n1. **Aplicacion del resultado:**\n   - dividendos_brutos: importe propuesto para dividendos\n   - dividendos_a_cuenta: si hubo anticipos de dividendos\n   - dotacion_reserva_legal: importe destinado a reserva legal\n   - reservas_voluntarias: importe destinado a reservas voluntarias\n\n2. **Restricciones al reparto:**\n   - reserva_legal_suficiente: si alcanza el 20% del capital social\n   - resultado_positivo: si hay beneficio a repartir\n   - patrimonio_post_reparto_ok: si PN > CS tras el reparto\n   - restricciones_estatutarias: limitaciones en estatutos\n   - restricciones_contractuales: covenants de financiacion que limiten reparto\n\n3. **Cumplimiento:** si la propuesta cumple todos los requisitos legales\n\n4. **Autocartera:**\n   - existe: si hay acciones/participaciones propias\n   - importe: valor de la autocartera\n   - dentro_limites: si cumple el limite del 20% (SA) o 10% (SL)\n   - reserva_indisponible_dotada: si existe reserva indisponible equivalente\n   - autorizacion_societaria: si la adquisicion fue autorizada por junta\n\n5. **Trazabilidad de pagos:**\n   - pagos_documentados: si existen justificantes de pago\n   - fechas_pago: cuando se efectuaron los pagos\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":["aplicacion_resultado","cumplimiento"],"properties":{"aplicacion_resultado":{"type":"object","properties":{"dividendos_brutos":{"type":"number"},"dividendos_a_cuenta":{"type":"number"},"dotacion_reserva_legal":{"type":"number"},"reservas_voluntarias":{"type":"number"}}},"restricciones_reparto":{"type":"object","properties":{"reserva_legal_suficiente":{"type":"boolean"},"resultado_positivo":{"type":"boolean"},"patrimonio_post_reparto_ok":{"type":"boolean"},"restricciones_estatutarias":{"type":"array","items":{"type":"string"}},"restricciones_contractuales":{"type":"array","items":{"type":"string"}}}},"cumplimiento":{"type":"boolean"},"autocartera":{"type":"object","properties":{"existe":{"type":"boolean"},"importe":{"type":"number"},"dentro_limites":{"type":"boolean"},"reserva_indisponible_dotada":{"type":"boolean"},"autorizacion_societaria":{"type":"boolean"}}},"trazabilidad_pagos":{"type":"object","properties":{"pagos_documentados":{"type":"boolean"},"fechas_pago":{"type":"array","items":{"type":"string","format":"date"}}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"cuentas_anuales","required":true},{"type":"document","source":"propuesta_aplicacion_resultado","required":true},{"type":"document","source":"acta_junta","required":true},{"type":"document","source":"contratos_financiacion","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 5: ca.partes_vinculadas (analisis)
-- FOs cubiertos: CA-007 (partes vinculadas)
-- HITL obligatorio: Si
-- Cross-area: CONT (acuerdos intragrupo), FISC (precios transferencia)
-- ============================================================
(
  'MERC',
  'ca.partes_vinculadas',
  'Conciliacion de Partes Vinculadas',
  'Concilia las operaciones y saldos con partes vinculadas revelados en memoria con los contratos y aprobaciones societarias correspondientes.',
  'analisis',
  E'Eres un abogado especialista en operaciones vinculadas y gobierno corporativo. Analiza las transacciones con partes vinculadas de [sociedad_target] (ejercicio: [ejercicio]).\n\n**MARCO LEGAL:**\n- Art. 231 LSC: concepto de persona vinculada\n- Art. 229 LSC: deber de comunicacion de situaciones de conflicto\n- Art. 230 LSC: dispensa y autorizacion de operaciones con partes vinculadas\n- NRV 15 PGC: informacion sobre partes vinculadas en memoria\n- Art. 18 LIS: operaciones vinculadas a efectos fiscales\n\n**ANALISIS REQUERIDO:**\n\n1. **Partes vinculadas identificadas:**\n   - parte: denominacion de la parte vinculada\n   - relacion: tipo de vinculacion (socio, administrador, grupo, familiar)\n   - operaciones: tipo e importe de cada transaccion\n   - saldo_vivo: saldo pendiente al cierre\n\n2. **Conciliacion:**\n   - total_operaciones_memoria: importe total revelado en memoria\n   - total_operaciones_contratos: importe total en contratos aportados\n   - discrepancias: diferencias detectadas entre memoria y contratos\n\n3. **Condiciones de mercado:**\n   - todas_arms_length: si todas las operaciones son a precio de mercado\n   - operaciones_atipicas: operaciones con condiciones no justificadas\n\n4. **Aprobaciones societarias:**\n   - todas_aprobadas: si todas las operaciones tienen aprobacion\n   - sin_aprobacion: operaciones sin autorizacion societaria\n\nEste skill se cruza con:\n- contratos.acuerdos_intragrupo (area CONT)\n- fiscal.precios_transferencia (area FISC)\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":["partes_vinculadas_identificadas"],"properties":{"partes_vinculadas_identificadas":{"type":"array","items":{"type":"object","required":["parte","relacion"],"properties":{"parte":{"type":"string"},"relacion":{"type":"string"},"operaciones":{"type":"array","items":{"type":"object","properties":{"tipo":{"type":"string"},"importe":{"type":"number"}}}},"saldo_vivo":{"type":"number"}}}},"conciliacion":{"type":"object","properties":{"total_operaciones_memoria":{"type":"number"},"total_operaciones_contratos":{"type":"number"},"discrepancias":{"type":"array","items":{"type":"string"}}}},"condiciones_mercado":{"type":"object","properties":{"todas_arms_length":{"type":"boolean"},"operaciones_atipicas":{"type":"array","items":{"type":"object","properties":{"operacion":{"type":"string"},"motivo":{"type":"string"}}}}}},"aprobaciones_societarias":{"type":"object","properties":{"todas_aprobadas":{"type":"boolean"},"sin_aprobacion":{"type":"array","items":{"type":"object","properties":{"operacion":{"type":"string"},"importe":{"type":"number"}}}}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"memoria","required":true},{"type":"document","source":"contratos_vinculados","required":false},{"type":"document","source":"actas_aprobacion","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 6: ca.contingencias_memoria (analisis)
-- FOs cubiertos: CA-008 (contingencias), CA-009 (hechos posteriores)
-- HITL obligatorio: Si
-- Cross-area: LIT (litigios), FISC (contingencias fiscales)
-- ============================================================
(
  'MERC',
  'ca.contingencias_memoria',
  'Compromisos, Contingencias y Hechos Posteriores',
  'Identifica compromisos y contingencias fuera de balance, y verifica los hechos posteriores al cierre con impacto legal.',
  'analisis',
  E'Eres un abogado especialista en contingencias societarias y hechos posteriores al cierre. Analiza la memoria de [sociedad_target] (ejercicio: [ejercicio]) para identificar pasivos contingentes y hechos relevantes.\n\n**MARCO LEGAL:**\n- NIC 37/NRV 15 PGC: provisiones, activos y pasivos contingentes\n- NIC 10: hechos posteriores al cierre del ejercicio\n\n**ANALISIS REQUERIDO:**\n\n1. **Contingencias:**\n   - tipo: garantia | aval | litigio | compromiso | otro\n   - descripcion: detalle de la contingencia\n   - importe: cuantia estimada\n   - probabilidad: probable (>50%) | posible (20-50%) | remoto (<20%)\n   - provision_contabilizada: importe provisionado en balance\n   - soporte_documental: si existe documentacion de respaldo\n\n2. **Total contingencias:** suma de importes contingentes\n\n3. **Hechos posteriores:**\n   - evento: descripcion del hecho\n   - tipo: ajuste (afecta a estados financieros) | no_ajuste (solo revelacion)\n   - impacto_legal: implicaciones juridicas del hecho\n   - revelado_en_memoria: si se ha incluido en la memoria\n   - medidas_adoptadas: si se han tomado acciones\n\n4. **Cruces con litigios:**\n   - contingencias_sin_litigio_asociado: contingencias sin procedimiento judicial\n   - litigios_sin_contingencia: procedimientos no provisionados\n\nEste skill se cruza con:\n- litigios.ficha_procedimientos (area LIT)\n- fiscal.contingencias_fiscales (area FISC)\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":["contingencias"],"properties":{"contingencias":{"type":"array","items":{"type":"object","required":["tipo","descripcion","importe","probabilidad"],"properties":{"tipo":{"type":"string","enum":["garantia","aval","litigio","compromiso","otro"]},"descripcion":{"type":"string"},"importe":{"type":"number"},"probabilidad":{"type":"string","enum":["probable","posible","remoto"]},"provision_contabilizada":{"type":"number"},"soporte_documental":{"type":"boolean"}}}},"total_contingencias":{"type":"number"},"hechos_posteriores":{"type":"array","items":{"type":"object","properties":{"evento":{"type":"string"},"tipo":{"type":"string","enum":["ajuste","no_ajuste"]},"impacto_legal":{"type":"string"},"revelado_en_memoria":{"type":"boolean"},"medidas_adoptadas":{"type":"boolean"}}}},"cruces_litigios":{"type":"object","properties":{"contingencias_sin_litigio_asociado":{"type":"array","items":{"type":"string"}},"litigios_sin_contingencia":{"type":"array","items":{"type":"string"}}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"memoria","required":true},{"type":"document","source":"informe_auditoria","required":false},{"type":"document","source":"listado_litigios","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 7: ca.compliance_revelaciones (verificacion)
-- FOs cubiertos: CA-010 (cambios criterios), CA-011 (EINF/ESG),
--                CA-012 (remuneracion), CA-013 (prestamos)
-- HITL obligatorio: No (verificacion documental)
-- ============================================================
(
  'MERC',
  'ca.compliance_revelaciones',
  'Compliance de Revelaciones en Memoria',
  'Verifica el cumplimiento de las obligaciones de revelacion en memoria: cambios de criterios contables, EINF/ESG, remuneracion de administradores y prestamos a socios.',
  'verificacion',
  E'Eres un analista legal de cumplimiento de revelaciones en cuentas anuales. Verifica que [sociedad_target] cumple las obligaciones de informacion en memoria (ejercicio: [ejercicio]).\n\n**OBLIGACIONES A VERIFICAR:**\n\n1. **Cambios de criterio contable (NRV 22 PGC):**\n   - criterio: que criterio se ha modificado\n   - justificacion_adecuada: si se explica el motivo del cambio\n   - efecto_cuantificado: si se cuantifica el impacto\n   - importe_efecto: cuantia del efecto en patrimoniol neto y resultados\n\n2. **Estado de Informacion No Financiera - EINF (Ley 11/2018):**\n   - obligacion_aplica: si supera umbrales (>500 empleados o entidad de interes publico)\n   - presentado: si se ha incluido EINF\n   - aseguramiento: si hay verificacion externa\n   - cumplimiento: completo | parcial | ausente\n\n3. **Remuneracion de administradores (art. 260 LSC):**\n   - revelada_en_memoria: si consta el detalle\n   - aprobacion_societaria: si hay acuerdo de junta\n   - coherencia_importes: si los importes coinciden con actas\n   - importe_total: cuantia total de retribuciones\n\n4. **Prestamos a socios y administradores (art. 162 LSC, art. 260 LSC):**\n   - existen: si hay anticipos, creditos o garantias\n   - importe_total: cuantia agregada\n   - condiciones_mercado: si se han otorgado en condiciones de mercado\n   - aprobacion_societaria: si cuentan con autorizacion\n   - detalle: beneficiario, importe y condiciones de cada operacion\n\n5. **Gaps de revelacion:** lista de incumplimientos detectados\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":[],"properties":{"cambios_criterio":{"type":"array","items":{"type":"object","properties":{"criterio":{"type":"string"},"justificacion_adecuada":{"type":"boolean"},"efecto_cuantificado":{"type":"boolean"},"importe_efecto":{"type":"number"}}}},"einf":{"type":"object","properties":{"obligacion_aplica":{"type":"boolean"},"presentado":{"type":"boolean"},"aseguramiento":{"type":"boolean"},"cumplimiento":{"type":"string","enum":["completo","parcial","ausente"]}}},"remuneracion_administradores":{"type":"object","properties":{"revelada_en_memoria":{"type":"boolean"},"aprobacion_societaria":{"type":"boolean"},"coherencia_importes":{"type":"boolean"},"importe_total":{"type":"number"}}},"prestamos_socios_admin":{"type":"object","properties":{"existen":{"type":"boolean"},"importe_total":{"type":"number"},"condiciones_mercado":{"type":"boolean"},"aprobacion_societaria":{"type":"boolean"},"detalle":{"type":"array","items":{"type":"object","properties":{"beneficiario":{"type":"string"},"importe":{"type":"number"},"condiciones":{"type":"string"}}}}}},"gaps_revelacion":{"type":"array","items":{"type":"string"}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"memoria","required":true},{"type":"document","source":"cuentas_anuales","required":true},{"type":"document","source":"einf","required":false},{"type":"document","source":"actas_junta","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
),

-- ============================================================
-- Skill 8: ca.medidas_reequilibrio (verificacion)
-- FOs cubiertos: CA-PatNeto-002
-- HITL obligatorio: Si
-- Se activa condicionalmente desde ca.patrimonio_neto
-- ============================================================
(
  'MERC',
  'ca.medidas_reequilibrio',
  'Medidas Obligatorias de Reequilibrio',
  'Verifica la adopcion, ejecucion e inscripcion de las medidas obligatorias de reequilibrio patrimonial (reduccion/aumento de capital, aportaciones de socios, disolucion).',
  'verificacion',
  E'Eres un abogado especialista en reestructuracion societaria y responsabilidad de administradores. Analiza las medidas adoptadas por [sociedad_target] para remediar el desequilibrio patrimonial.\n\n**MARCO LEGAL:**\n- Art. 363.1.e) LSC: causa de disolucion por perdidas\n- Art. 365 LSC: obligacion de convocar junta en 2 meses\n- Art. 366 LSC: solicitud de disolucion judicial\n- Art. 367 LSC: responsabilidad solidaria de administradores\n- Arts. 317-345 LSC: reduccion y aumento de capital\n\n**ANALISIS REQUERIDO:**\n\n1. **Medida adoptada:**\n   - tipo: reduccion_capital | aumento_capital | aportacion_socios | disolucion | combinada | ninguna\n   - fecha_acuerdo: cuando se adopto el acuerdo\n   - dentro_plazo_legal: si se adopto dentro de los 2 meses del art. 365 LSC\n\n2. **Ejecucion:**\n   - desembolsos_efectuados: si se han realizado las aportaciones acordadas\n   - escritura_otorgada: si se ha formalizado en escritura publica\n   - importe_ejecutado: cuantia efectivamente ejecutada\n\n3. **Proteccion de acreedores (art. 334 LSC):**\n   - aplica: si la operacion requiere derecho de oposicion de acreedores\n   - publicaciones_realizadas: si se han hecho las publicaciones legales\n   - oposiciones_existentes: si algun acreedor se ha opuesto\n   - garantias_constituidas: si se han constituido garantias para acreedores\n\n4. **Inscripcion registral:**\n   - asiento_presentacion: si se ha presentado en el Registro\n   - inscrito: si esta inscrito\n   - fecha_inscripcion: cuando se inscribio\n   - defectos: calificacion negativa o defectos del registrador\n\n5. **Riesgo de responsabilidad de administradores:**\n   - omision_convocatoria: si no se convoco junta en plazo\n   - actos_posteriores_sin_remedio: si hay actos sociales posteriores al desequilibrio sin medida\n   - nivel: alto | medio | bajo | no_aplica\n\nIncluye severidad_sugerida y evidencias.',
  '{"type":"object","required":["medida_adoptada"],"properties":{"medida_adoptada":{"type":"object","required":["tipo"],"properties":{"tipo":{"type":"string","enum":["reduccion_capital","aumento_capital","aportacion_socios","disolucion","combinada","ninguna"]},"fecha_acuerdo":{"type":"string","format":"date"},"dentro_plazo_legal":{"type":"boolean"}}},"ejecucion":{"type":"object","properties":{"desembolsos_efectuados":{"type":"boolean"},"escritura_otorgada":{"type":"boolean"},"importe_ejecutado":{"type":"number"}}},"proteccion_acreedores":{"type":"object","properties":{"aplica":{"type":"boolean"},"publicaciones_realizadas":{"type":"boolean"},"oposiciones_existentes":{"type":"boolean"},"garantias_constituidas":{"type":"boolean"}}},"inscripcion_registral":{"type":"object","properties":{"asiento_presentacion":{"type":"boolean"},"inscrito":{"type":"boolean"},"fecha_inscripcion":{"type":"string","format":"date"},"defectos":{"type":"array","items":{"type":"string"}}}},"riesgo_responsabilidad_administradores":{"type":"object","properties":{"omision_convocatoria":{"type":"boolean"},"actos_posteriores_sin_remedio":{"type":"boolean"},"nivel":{"type":"string","enum":["alto","medio","bajo","no_aplica"]}}},"severidad_sugerida":{"type":"string","enum":["critical","high","medium","low","informational"]},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"pagina":{"type":"string"},"snippet":{"type":"string"}}}}}}',
  '[{"type":"document","source":"actas_junta","required":true},{"type":"document","source":"escritura_medida","required":false},{"type":"document","source":"justificante_desembolso","required":false},{"type":"document","source":"asiento_rm","required":false}]',
  '{"paranoico","validador","sanitizer"}',
  true
)

ON CONFLICT (skill_key) DO NOTHING;

COMMIT;
