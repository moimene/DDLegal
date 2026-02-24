# Cuentas Anuales — Skills, Workflows y Flujos Operativos

**Version:** 1.0
**Date:** 2026-02-24
**Depends on:** CA_CATALOG_SEED.sql (15 FOs), WORKER_ARCHITECTURE_v1.md, CA_INTEGRATION_REQUIREMENT.md

---

## 1. Visión General

El análisis de Cuentas Anuales (CA) requiere una capa operativa compuesta por:

| Componente | Cantidad | Función |
|-----------|----------|---------|
| **Workflow Template** | 1 | `cuentas_anuales` — orquesta las 5 fases DD para el análisis CA |
| **Skills (dd_skills_catalog)** | 8 | Prompts especializados Harvey AI para cada eje de análisis |
| **Microtool (dd_tools)** | 1 | `cuentas-anuales` — punto de entrada en UI |
| **n8n Workflows** | 2 | `dd_ca_executor` + `dd_ca_report` — pipelines de ejecución y reporting |
| **FO → Skill mapping** | 15 | Conecta cada FO-MERC-CA-* a su skill correspondiente |

### 1.1 Relación con el workflow `societario` existente

El workflow `societario` (template_key: `societario`) cubre los FOs MERC-001 a MERC-008 (estructura corporativa, órganos, escrituras). El nuevo workflow `cuentas_anuales` cubre los FOs MERC-CA-001 a MERC-CA-014 + PatNeto-002 (ciclo contable-societario). Ambos comparten `area_codes: {MERC}` pero tienen scope disjunto:

```
societario       → Estructura legal: constitución, órganos, poderes, cargas, pactos
cuentas_anuales  → Ciclo contable: aprobación, auditoría, patrimonio, distribución, memoria
```

En muchos deals se ejecutan ambos workflows para cobertura completa del área MERC.

---

## 2. Catálogo de 8 Skills

### 2.1 Arquitectura de Skills

Cada skill sigue el patrón establecido en `dd_skills_catalog`:

```
area_code       → 'MERC'
skill_key       → 'ca.{nombre_skill}'
category        → 'extraccion' | 'analisis' | 'verificacion'
prompt_template → Prompt Harvey AI completo
output_schema   → JSON Schema validable
evidence_req    → Documentos fuente requeridos
agent_pipeline  → {"paranoico", "validador", "sanitizer"}
```

### 2.2 Tabla Resumen de Skills

| # | skill_key | Nombre | Categoría | FOs que cubre | HITL |
|---|-----------|--------|-----------|---------------|------|
| 1 | `ca.extraccion_cuentas` | Extracción de Cuentas Anuales | extraccion | CA-001, CA-014 | No |
| 2 | `ca.analisis_auditoria` | Análisis de Auditoría | analisis | CA-002, CA-003 | Sí |
| 3 | `ca.patrimonio_neto` | Diagnóstico de Patrimonio Neto | verificacion | CA-004 | Sí |
| 4 | `ca.aplicacion_resultado` | Legalidad de Aplicación del Resultado | analisis | CA-005, CA-006 | Sí |
| 5 | `ca.partes_vinculadas` | Conciliación de Partes Vinculadas | analisis | CA-007 | Sí |
| 6 | `ca.contingencias_memoria` | Compromisos, Contingencias y Hechos Posteriores | analisis | CA-008, CA-009 | Sí |
| 7 | `ca.compliance_revelaciones` | Compliance de Revelaciones en Memoria | verificacion | CA-010, CA-011, CA-012, CA-013 | No |
| 8 | `ca.medidas_reequilibrio` | Medidas Obligatorias de Reequilibrio | verificacion | CA-PatNeto-002 | Sí |

### 2.3 Detalle de Cada Skill

---

#### Skill 1: `ca.extraccion_cuentas`

**Propósito:** Extraer datos estructurados de las cuentas anuales (balance, P&L, memoria) y del certificado de depósito en RM. Es el skill "base" que alimenta a todos los demás.

**Categoría:** `extraccion`

**FOs cubiertos:** CA-001 (aprobación/depósito), CA-014 (coherencia cuentas-libros-RM)

**Inputs requeridos:** Cuentas anuales completas, acta de junta, justificante de depósito RM

**Output schema (campos clave):**
```json
{
  "ejercicio": "string",
  "fecha_formulacion": "date",
  "fecha_aprobacion": "date",
  "fecha_deposito_rm": "date",
  "estado_deposito": "enum(depositado|pendiente|defectuoso|no_depositado)",
  "patrimonio_neto": "number",
  "capital_social": "number",
  "reserva_legal": "number",
  "reservas_indisponibles": "number",
  "resultado_ejercicio": "number",
  "aplicacion_resultado": {
    "dividendos": "number",
    "reservas": "number",
    "compensacion_perdidas": "number",
    "remanente": "number"
  },
  "autocartera": { "existe": "boolean", "importe": "number" },
  "auditoria": {
    "existe": "boolean",
    "auditor": "string",
    "tipo_opinion": "enum(favorable|salvedades|desfavorable|denegada)",
    "going_concern": "boolean",
    "KAM": ["string"],
    "enfasis": ["string"]
  },
  "concordancia_acta_deposito": "boolean",
  "defectos_registrales": ["string"],
  "evidencias": [{"doc_id": "string", "pagina": "string", "snippet": "string"}]
}
```

**Prompt template (resumen):** _"Eres un analista legal especializado en cuentas anuales. Extrae de forma exhaustiva los datos del ciclo de formulación, aprobación y depósito. No inventes datos. Cita página y sección. Si hay discrepancias entre acta y depósito, márcalas como 'discrepancia_detectada'."_

---

#### Skill 2: `ca.analisis_auditoria`

**Propósito:** Analizar el informe de auditoría: tipo de opinión, KAM, salvedades, énfasis, going concern. Determinar obligatoriedad de auditoría y vigencia del nombramiento.

**Categoría:** `analisis`

**FOs cubiertos:** CA-002 (obligación/nombramiento), CA-003 (opinión/KAM/continuidad)

**HITL obligatorio:** Sí — interpretación de opiniones y párrafos de énfasis requiere juicio legal

**Inputs requeridos:** Informe de auditoría, nombramiento del auditor, cartas de independencia

**Output schema (campos clave):**
```json
{
  "obligacion_auditoria": {
    "es_obligatoria": "boolean",
    "base_legal": "string",
    "umbrales_superados": ["string"]
  },
  "auditor": {
    "nombre": "string",
    "nombramiento_valido": "boolean",
    "fecha_nombramiento": "date",
    "vigencia_hasta": "date",
    "independencia_acreditada": "boolean"
  },
  "opinion": {
    "tipo": "enum(favorable|salvedades|desfavorable|denegada)",
    "salvedades": [{"descripcion": "string", "impacto_estimado": "number"}],
    "enfasis": [{"descripcion": "string", "es_going_concern": "boolean"}],
    "KAM": [{"titulo": "string", "descripcion": "string", "riesgo_transaccional": "string"}]
  },
  "going_concern": {
    "mencionado": "boolean",
    "tipo": "enum(incertidumbre_material|enfasis|no_mencionado)",
    "plan_viabilidad_existe": "boolean",
    "plan_viabilidad_creible": "boolean|null"
  },
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

#### Skill 3: `ca.patrimonio_neto`

**Propósito:** Diagnosticar la situación del patrimonio neto y evaluar si se activan deberes legales de reequilibrio o disolución. Aplica el mapa de 5 escenarios del catálogo.

**Categoría:** `verificacion`

**FOs cubiertos:** CA-004 (situación patrimonial/disolución)

**HITL obligatorio:** Sí — determinación de si el desequilibrio activa causa de disolución

**Inputs requeridos:** Cuentas anuales, memoria (sección patrimonio), actas de medidas

**Output schema (campos clave):**
```json
{
  "patrimonio_neto": "number",
  "capital_social": "number",
  "ratio_pn_cs": "number",
  "escenario_mapa": "enum(holgado|perdida_coyuntural|deterioro_incipiente|desequilibrio_activo|persistencia_sin_medidas)",
  "causa_disolucion_activada": "boolean",
  "senales_alarma": ["string"],
  "covenants_afectados": [{"covenant": "string", "estado": "string"}],
  "medidas_detectadas": {
    "convocatoria": "boolean",
    "acuerdo_adoptado": "boolean",
    "tipo_medida": "enum(reduccion|aumento|aportacion|disolucion|ninguna)",
    "ejecucion_material": "boolean",
    "inscripcion_rm": "boolean"
  },
  "severidad_sugerida": "string",
  "activa_fo_patneto_002": "boolean",
  "evidencias": []
}
```

**Lógica de activación:** Si `escenario_mapa` ∈ {`desequilibrio_activo`, `persistencia_sin_medidas`} → `activa_fo_patneto_002 = true` → se encadena skill `ca.medidas_reequilibrio`.

---

#### Skill 4: `ca.aplicacion_resultado`

**Propósito:** Verificar legalidad de la distribución de resultados y reservas, y comprobar cumplimiento de autocartera.

**Categoría:** `analisis`

**FOs cubiertos:** CA-005 (dividendos/reservas), CA-006 (autocartera/reservas indisponibles)

**HITL obligatorio:** Sí — evaluación de restricciones legales sobre reparto

**Output schema (campos clave):**
```json
{
  "aplicacion_resultado": {
    "dividendos_brutos": "number",
    "dividendos_a_cuenta": "number",
    "dotacion_reserva_legal": "number",
    "reservas_voluntarias": "number"
  },
  "restricciones_reparto": {
    "reserva_legal_suficiente": "boolean",
    "resultado_positivo": "boolean",
    "patrimonio_post_reparto_ok": "boolean",
    "restricciones_estatutarias": ["string"],
    "restricciones_contractuales": ["string"]
  },
  "cumplimiento": "boolean",
  "autocartera": {
    "existe": "boolean",
    "importe": "number",
    "dentro_limites": "boolean",
    "reserva_indisponible_dotada": "boolean",
    "autorizacion_societaria": "boolean"
  },
  "trazabilidad_pagos": {
    "pagos_documentados": "boolean",
    "fechas_pago": ["date"]
  },
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

#### Skill 5: `ca.partes_vinculadas`

**Propósito:** Conciliar operaciones y saldos con partes vinculadas revelados en memoria con contratos y aprobaciones societarias.

**Categoría:** `analisis`

**FOs cubiertos:** CA-007 (partes vinculadas)

**HITL obligatorio:** Sí — evaluación de condiciones a mercado (arm's length)

**Cross-area:** Se cruza con `contratos.acuerdos_intragrupo` (CONT) y `fiscal.precios_transferencia` (FISC)

**Output schema (campos clave):**
```json
{
  "partes_vinculadas_identificadas": [{
    "parte": "string",
    "relacion": "string",
    "operaciones": [{"tipo": "string", "importe": "number"}],
    "saldo_vivo": "number"
  }],
  "conciliacion": {
    "total_operaciones_memoria": "number",
    "total_operaciones_contratos": "number",
    "discrepancias": ["string"]
  },
  "condiciones_mercado": {
    "todas_arms_length": "boolean",
    "operaciones_atipicas": [{"operacion": "string", "motivo": "string"}]
  },
  "aprobaciones_societarias": {
    "todas_aprobadas": "boolean",
    "sin_aprobacion": [{"operacion": "string", "importe": "number"}]
  },
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

#### Skill 6: `ca.contingencias_memoria`

**Propósito:** Identificar compromisos y contingencias fuera de balance, y verificar hechos posteriores al cierre con impacto legal.

**Categoría:** `analisis`

**FOs cubiertos:** CA-008 (contingencias), CA-009 (hechos posteriores)

**HITL obligatorio:** Sí — probabilidad de materialización de contingencias

**Cross-area:** Se cruza con `LIT-001` (litigios) y `FISC-*` (contingencias fiscales)

**Output schema (campos clave):**
```json
{
  "contingencias": [{
    "tipo": "enum(garantia|aval|litigio|compromiso|otro)",
    "descripcion": "string",
    "importe": "number",
    "probabilidad": "enum(probable|posible|remoto)",
    "provision_contabilizada": "number",
    "soporte_documental": "boolean"
  }],
  "total_contingencias": "number",
  "hechos_posteriores": [{
    "evento": "string",
    "tipo": "enum(ajuste|no_ajuste)",
    "impacto_legal": "string",
    "revelado_en_memoria": "boolean",
    "medidas_adoptadas": "boolean"
  }],
  "cruces_litigios": {
    "contingencias_sin_litigio_asociado": ["string"],
    "litigios_sin_contingencia": ["string"]
  },
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

#### Skill 7: `ca.compliance_revelaciones`

**Propósito:** Verificar cumplimiento de las obligaciones de revelación en memoria: cambios de criterios, EINF/ESG, remuneración de administradores, préstamos a socios.

**Categoría:** `verificacion`

**FOs cubiertos:** CA-010 (cambios criterios), CA-011 (EINF/ESG), CA-012 (remuneración), CA-013 (préstamos)

**HITL obligatorio:** No (verificación documental, escalable a HITL si se detectan gaps)

**Output schema (campos clave):**
```json
{
  "cambios_criterio": [{
    "criterio": "string",
    "justificacion_adecuada": "boolean",
    "efecto_cuantificado": "boolean",
    "importe_efecto": "number"
  }],
  "einf": {
    "obligacion_aplica": "boolean",
    "presentado": "boolean",
    "aseguramiento": "boolean",
    "cumplimiento": "enum(completo|parcial|ausente)"
  },
  "remuneracion_administradores": {
    "revelada_en_memoria": "boolean",
    "aprobacion_societaria": "boolean",
    "coherencia_importes": "boolean",
    "importe_total": "number"
  },
  "prestamos_socios_admin": {
    "existen": "boolean",
    "importe_total": "number",
    "condiciones_mercado": "boolean",
    "aprobacion_societaria": "boolean",
    "detalle": [{"beneficiario": "string", "importe": "number", "condiciones": "string"}]
  },
  "gaps_revelacion": ["string"],
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

#### Skill 8: `ca.medidas_reequilibrio`

**Propósito:** Verificar adopción, ejecución e inscripción de medidas obligatorias ante desequilibrio patrimonial (reducción/aumento de capital, aportaciones, disolución). Se activa condicionalmente desde `ca.patrimonio_neto`.

**Categoría:** `verificacion`

**FOs cubiertos:** CA-PatNeto-002

**HITL obligatorio:** Sí — idoneidad de la medida adoptada y riesgo de responsabilidad de administradores

**Inputs requeridos:** Actas, escrituras, justificantes de desembolso, asientos de presentación/inscripción RM

**Output schema (campos clave):**
```json
{
  "medida_adoptada": {
    "tipo": "enum(reduccion_capital|aumento_capital|aportacion_socios|disolucion|combinada|ninguna)",
    "fecha_acuerdo": "date",
    "dentro_plazo_legal": "boolean"
  },
  "ejecucion": {
    "desembolsos_efectuados": "boolean",
    "escritura_otorgada": "boolean",
    "importe_ejecutado": "number"
  },
  "proteccion_acreedores": {
    "aplica": "boolean",
    "publicaciones_realizadas": "boolean",
    "oposiciones_existentes": "boolean",
    "garantias_constituidas": "boolean"
  },
  "inscripcion_registral": {
    "asiento_presentacion": "boolean",
    "inscrito": "boolean",
    "fecha_inscripcion": "date",
    "defectos": ["string"]
  },
  "riesgo_responsabilidad_administradores": {
    "omision_convocatoria": "boolean",
    "actos_posteriores_sin_remedio": "boolean",
    "nivel": "enum(alto|medio|bajo|no_aplica)"
  },
  "severidad_sugerida": "string",
  "evidencias": []
}
```

---

## 3. Workflow Template: `cuentas_anuales`

### 3.1 Definición del Template

```sql
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category)
VALUES (
  'cuentas_anuales',
  'Cuentas Anuales',
  'Revisión legal de cuentas anuales: aprobación, depósito, auditoría, patrimonio, distribución, revelaciones y coherencia registral',
  '{MERC}',
  'transactional'
);
```

### 3.2 Fases del Workflow (5 fases DD estándar)

#### Fase 1: OBTENCIÓN

| Campo | Valor |
|-------|-------|
| **Nombre** | Recopilación documental CA |
| **Descripción** | Obtener cuentas anuales, informes de auditoría, actas de junta, justificantes de depósito y documentación soporte |
| **Inputs** | `project_id`, `ejercicios` (array de ejercicios a revisar) |
| **Skills** | — (fase documental) |
| **Artifacts** | `docs_ca_indexed`, `gap_list_ca` |
| **DoD** | Cuentas anuales completas disponibles; informe de auditoría si procede; actas de junta |
| **HITL** | No |
| **Duración est.** | 4h |
| **Gateway** | `route: none` |

#### Fase 2: GESTIÓN

| Campo | Valor |
|-------|-------|
| **Nombre** | Extracción y normalización |
| **Descripción** | Extraer datos estructurados de cuentas, auditoría y documentos societarios. Clasificar y vincular |
| **Inputs** | `docs_ca_indexed` |
| **Skills** | `ca.extraccion_cuentas` |
| **Artifacts** | `datos_ca_estructurados`, `timeline_societario` |
| **DoD** | Datos extraídos para todos los ejercicios; sin campos "no_consta" en datos críticos |
| **DoR** | Documentación completa verificada en Fase 1 |
| **HITL** | No |
| **Duración est.** | 6h |
| **Gateway** | `route: completion, grounding_mode: vault_rag` |

#### Fase 3: ANÁLISIS

| Campo | Valor |
|-------|-------|
| **Nombre** | Evaluación legal CA |
| **Descripción** | Ejecutar los 15 FOs de Cuentas Anuales: auditoría, patrimonio, distribución, vinculadas, contingencias, revelaciones, coherencia |
| **Inputs** | `datos_ca_estructurados` |
| **Skills** | `ca.analisis_auditoria`, `ca.patrimonio_neto`, `ca.aplicacion_resultado`, `ca.partes_vinculadas`, `ca.contingencias_memoria`, `ca.compliance_revelaciones`, `ca.medidas_reequilibrio` |
| **Artifacts** | `findings_ca_raw`, `coverage_ca` |
| **DoD** | 15 FOs evaluados; cobertura ≥ 85%; findings clasificados por severidad |
| **DoR** | Datos CA extraídos y validados en Fase 2 |
| **HITL** | No (HITL viene en Fase 4) |
| **Duración est.** | 8h |
| **Gateway** | `route: completion, grounding_mode: vault_rag, max_prompt_chars: 25000` |

**Orden de ejecución de skills en Fase 3:**

```
Wave 1 (paralelo):
  ca.extraccion_cuentas → datos base (si no se ejecutó en Fase 2)
  ca.compliance_revelaciones → CA-010, CA-011, CA-012, CA-013

Wave 2 (requiere Wave 1):
  ca.analisis_auditoria → CA-002, CA-003
  ca.patrimonio_neto → CA-004
  ca.aplicacion_resultado → CA-005, CA-006
  ca.partes_vinculadas → CA-007
  ca.contingencias_memoria → CA-008, CA-009

Wave 3 (condicional, requiere Wave 2):
  ca.medidas_reequilibrio → CA-PatNeto-002
    [solo si ca.patrimonio_neto.activa_fo_patneto_002 = true]
```

#### Fase 4: VALORACIÓN (HITL)

| Campo | Valor |
|-------|-------|
| **Nombre** | HITL: Revisión legal de hallazgos CA |
| **Descripción** | El abogado societario revisa y valida los findings IA: approve/correct/reject/escalate |
| **Inputs** | `findings_ca_raw`, `coverage_ca` |
| **Skills** | — (fase humana) |
| **Artifacts** | `findings_ca_validated` |
| **DoD** | Todos los findings CRITICAL y HIGH revisados; decisiones documentadas |
| **DoR** | Cobertura ≥ 85% en Fase 3 |
| **HITL** | **Sí — obligatorio** |
| **Duración est.** | 4h |
| **Gateway** | `route: none` |

**Áreas de HITL prioritarias:**
1. Interpretación de opiniones de auditoría y going concern (CA-003)
2. Determinación de causa legal de disolución (CA-004, PatNeto-002)
3. Evaluación de legalidad de repartos (CA-005)
4. Condiciones a mercado en partes vinculadas (CA-007)
5. Probabilidad de materialización de contingencias (CA-008)

#### Fase 5: TRATAMIENTO

| Campo | Valor |
|-------|-------|
| **Nombre** | Acciones y sección de informe CA |
| **Descripción** | Generar acciones transaccionales, remediation plan y sección del informe DD |
| **Inputs** | `findings_ca_validated` |
| **Skills** | — (generación basada en findings validados) |
| **Artifacts** | `acciones_ca`, `seccion_informe_ca`, `remediation_plan_ca` |
| **DoD** | Sección de informe lista; acciones vinculadas a cláusulas SPA si aplica |
| **DoR** | HITL completado en Fase 4 |
| **HITL** | No |
| **Duración est.** | 4h |
| **Gateway** | `route: completion, grounding_mode: vault_rag` |

### 3.3 HITL Policy

```json
{
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
}
```

---

## 4. Microtool: `cuentas-anuales`

```sql
INSERT INTO dd_tools (slug, name, description, icon, area_codes, skills_used, requires_project, sort_order)
VALUES (
  'cuentas-anuales',
  'Revisión Cuentas Anuales',
  'Analiza cuentas anuales completas: aprobación, auditoría, patrimonio neto, distribución de resultados, partes vinculadas, contingencias y coherencia registral. Cubre 15 FOs del catálogo MERC-CA.',
  'FileSpreadsheet',
  '{"MERC"}',
  '{"ca.extraccion_cuentas","ca.analisis_auditoria","ca.patrimonio_neto","ca.aplicacion_resultado","ca.partes_vinculadas","ca.contingencias_memoria","ca.compliance_revelaciones","ca.medidas_reequilibrio"}',
  true,
  5
);
```

---

## 5. FO → Skill Mapping

Cada FO necesita su `skill_key` actualizado en `dd_finding_objectives`:

```sql
-- Actualizar skill_key para los 15 CA FOs
UPDATE dd_finding_objectives SET skill_key = 'ca.extraccion_cuentas'
WHERE objective_key IN ('FO-MERC-CA-001', 'FO-MERC-CA-014');

UPDATE dd_finding_objectives SET skill_key = 'ca.analisis_auditoria'
WHERE objective_key IN ('FO-MERC-CA-002', 'FO-MERC-CA-003');

UPDATE dd_finding_objectives SET skill_key = 'ca.patrimonio_neto'
WHERE objective_key = 'FO-MERC-CA-004';

UPDATE dd_finding_objectives SET skill_key = 'ca.aplicacion_resultado'
WHERE objective_key IN ('FO-MERC-CA-005', 'FO-MERC-CA-006');

UPDATE dd_finding_objectives SET skill_key = 'ca.partes_vinculadas'
WHERE objective_key = 'FO-MERC-CA-007';

UPDATE dd_finding_objectives SET skill_key = 'ca.contingencias_memoria'
WHERE objective_key IN ('FO-MERC-CA-008', 'FO-MERC-CA-009');

UPDATE dd_finding_objectives SET skill_key = 'ca.compliance_revelaciones'
WHERE objective_key IN ('FO-MERC-CA-010', 'FO-MERC-CA-011', 'FO-MERC-CA-012', 'FO-MERC-CA-013');

UPDATE dd_finding_objectives SET skill_key = 'ca.medidas_reequilibrio'
WHERE objective_key = 'FO-MERC-CA-PatNeto-002';
```

---

## 6. Flujos n8n

### 6.1 `dd_ca_executor.workflow.json`

Pipeline de ejecución de skills CA vía n8n (cuando `HARVEY_FF_WF_CUENTAS_ANUALES = 'n8n'`):

```
[Webhook: POST /dd-workflow-cuentas_anuales]
    │
    ├─► [Extract Phase & Skills Config]
    │       Consulta dd_workflow_template_versions + dd_skills_catalog
    │
    ├─► [Route by Phase]
    │   ├─ gestion → [Execute: ca.extraccion_cuentas]
    │   │               └─► Harvey API → Validate Schema → Store dd_document_facts
    │   │
    │   ├─ analisis → [Skill Wave Orchestrator]
    │   │   ├─ Wave 1: [ca.compliance_revelaciones] (paralelo)
    │   │   ├─ Wave 2: [ca.analisis_auditoria, ca.patrimonio_neto,
    │   │   │           ca.aplicacion_resultado, ca.partes_vinculadas,
    │   │   │           ca.contingencias_memoria] (paralelo)
    │   │   └─ Wave 3: [ca.medidas_reequilibrio] (condicional)
    │   │       └─► Para cada skill:
    │   │           Harvey API → Paranoico → Validador → Sanitizer
    │   │           → Dual-write dd_findings
    │   │
    │   └─ tratamiento → [Generate Report Section]
    │                       └─► Harvey API → Format → Store artifact
    │
    └─► [Respond: execution_result]
```

### 6.2 `dd_ca_report.workflow.json`

Pipeline de generación de sección de informe CA:

```
[Webhook: POST /dd-ca-report]
    │
    ├─► [Load validated findings for project + area MERC + CA FOs]
    │
    ├─► [Group findings by sub-section]
    │   ├─ Aprobación y depósito
    │   ├─ Auditoría
    │   ├─ Patrimonio neto y medidas
    │   ├─ Distribución de resultados
    │   ├─ Partes vinculadas
    │   ├─ Contingencias y hechos posteriores
    │   └─ Revelaciones y coherencia
    │
    ├─► [Harvey: Generate narrative per sub-section]
    │
    ├─► [Compile: seccion_informe_ca]
    │
    └─► [Store artifact + Respond]
```

---

## 7. Integración con Worker Architecture

### 7.1 Fase SENSE

El Worker detectará documentos de tipo "cuentas anuales" en el VDR y los asociará con los CA FOs. El `FOCatalogWatcher` identificará los 15 FOs CA como pendientes de evaluación.

### 7.2 Fase NORMALIZE

El skill `ca.extraccion_cuentas` alimenta directamente la tabla `dd_document_facts`:
- `document_type = 'cuentas_anuales'`
- `area_codes = {'MERC'}`
- Los campos extraídos se mapean a las columnas JSONB de `dd_document_facts`

### 7.3 Fase EVALUATE

Los 8 skills se ejecutan en el orden de waves definido en §3.2. Cada skill produce findings que se escriben en `dd_findings` con referencia al FO evaluado y al skill usado.

### 7.4 Fase CONCLUDE

Los findings CA contribuyen a `dd_area_conclusions` para el área MERC. La cobertura CA se calcula como: `fos_evaluados_ca / 15`.

---

## 8. Feature Flags

| Flag | Default | Propósito |
|------|---------|-----------|
| `HARVEY_FF_WF_CUENTAS_ANUALES` | `gateway` | Routing: Harvey Gateway vs n8n |
| `CA_SKILLS_ENABLED` | `true` | Activar/desactivar skills CA |
| `CA_PATNETO_AUTO_CHAIN` | `true` | Auto-activar ca.medidas_reequilibrio si patrimonio neto detecta desequilibrio |

---

## 9. Resumen de Migraciones Necesarias

| # | Migración | Contenido |
|---|-----------|-----------|
| 1 | `CA_CATALOG_SEED.sql` | 15 FOs (ya creado) |
| 2 | `seed_ca_skills.sql` | 8 skills en dd_skills_catalog |
| 3 | `seed_ca_workflow_template.sql` | 1 workflow template + version con 5 fases |
| 4 | `seed_ca_tool.sql` | 1 microtool en dd_tools |
| 5 | `update_ca_fo_skill_mapping.sql` | UPDATE skill_key en 15 FOs |

### Orden de aplicación:
```
1. CA_CATALOG_SEED.sql (FOs)
2. seed_ca_skills.sql (skills catalog)
3. seed_ca_workflow_template.sql (workflow template)
4. seed_ca_tool.sql (microtool)
5. update_ca_fo_skill_mapping.sql (linking)
```

---

## 10. Diagrama de Arquitectura Completa

```
┌─────────────────────────────────────────────────────────────────┐
│                      UI: War Room / Tools                        │
│  ┌──────────────┐                                                │
│  │ Microtool:   │                                                │
│  │ cuentas-     │──► Instantiate workflow: cuentas_anuales       │
│  │ anuales      │                                                │
│  └──────────────┘                                                │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│            Workflow Template: cuentas_anuales                     │
│                                                                   │
│  OBTENCIÓN ──► GESTIÓN ──► ANÁLISIS ──► VALORACIÓN ──► TRATAM.  │
│  (docs)        (extract)   (8 skills)   (HITL)        (report)   │
│                   │            │                                   │
│                   ▼            ▼                                   │
│            ┌──────────┐  ┌──────────────────────────────────┐    │
│            │ ca.      │  │ Wave 1: compliance_revelaciones  │    │
│            │ extrac-  │  │ Wave 2: auditoria, patrimonio,   │    │
│            │ cion_    │  │         resultado, vinculadas,    │    │
│            │ cuentas  │  │         contingencias             │    │
│            └──────────┘  │ Wave 3: medidas_reequilibrio     │    │
│                          │         (condicional)             │    │
│                          └──────────────────────────────────┘    │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Harvey AI Gateway                              │
│  prompt_builder.ts → buildHarveyWorkflowPrompt()                 │
│  Skills CA: prompt_template + output_schema + evidence_req       │
│  Pipeline: paranoico → validador → sanitizer                     │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Persistence Layer                                │
│                                                                   │
│  dd_findings ◄── dual-write ──► dd_finding_objectives (15 CA)   │
│       │                              │                            │
│       ▼                              ▼                            │
│  dd_kanban_tasks              dd_fo_document_status               │
│  dd_evidence                  dd_rule_executions                  │
│                                                                   │
│  [Worker Architecture]                                            │
│  dd_document_facts ◄── ca.extraccion_cuentas                    │
│  dd_area_conclusions ◄── MERC area (incl. CA coverage)          │
│  dd_worker_runs ◄── cycle tracking                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Cross-References

| Document | Relation |
|----------|----------|
| `CA_CATALOG_SEED.sql` | 15 FOs — the "what to check" |
| `CA_INTEGRATION_REQUIREMENT.md` | Dependencies, document mapping |
| `WORKER_ARCHITECTURE_v1.md` | Autonomous execution model |
| `LEGAL_CATALOG_SEED.sql` | Original 54 FOs |
| `202602270003_seed_workflow_templates.sql` | Template pattern reference |
| `202602200003_seed_tools_skills.sql` | Skill pattern reference |
| `202602210003_seed_fmc_skills.sql` | FMC skills pattern reference |
