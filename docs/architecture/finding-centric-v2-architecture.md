# Finding-Centric Architecture v2.0 — Motor de Reglas Declarativo

**DD Legal PMO — Documento de Arquitectura**
**Fecha: 24 febrero 2026**
**Autor: Claude Opus 4.6 + Moi64**

---

## 1. Diagnostico del Estado Actual

### Lo que tenemos (v1.0 Finding-Centric)

| Capa | Estado | Limitacion |
|------|--------|------------|
| **dd_findings** (30+ columnas, 10 estados, 3 tiers) | Operativo | Findings se generan como texto libre del LLM — no hay reglas que los definan a priori |
| **Workflow Engine** (16 templates, 6 fases) | Operativo | Las fases son orquestacion, no logica de analisis — Harvey decide que findings produce |
| **Skills Catalog** (63 skills) | Operativo | Prompts como texto libre en `prompt_template` — no hay estructura declarativa de que buscar |
| **Scoring Engine** (severity x probability x timing x area) | Operativo | Pesos hardcodeados en TS — no parametrizables por deal type ni jurisdiccion |
| **VDR + RAG** (pgvector, chunking adaptativo) | Operativo | Chunking por tipo de documento pero sin normalizacion semantica previa |
| **Reporting** (35 templates, 5 familias) | Operativo | Templates definen secciones pero no que findings deben aparecer en cada una |

### El problema fundamental

**Harvey (o cualquier LLM) no sabe que debe buscar.** El sistema actual le da un prompt generico por skill y espera que el modelo "descubra" hallazgos. Esto produce:

1. **Hallazgos inconsistentes** — dos ejecuciones del mismo workflow sobre los mismos documentos producen findings diferentes
2. **Cobertura no medible** — no sabemos si el analisis cubrio todos los puntos de revision necesarios
3. **No auditable** — un auditor no puede trazar "por que se busco X" ni "por que no se detecto Y"
4. **No parametrizable** — cambiar el deal type o la jurisdiccion no modifica el analisis

---

## 2. Vision: Arquitectura de Tres Capas

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 1: CATALOGO DE OBJETIVOS (Finding Catalog)       │
│  "Que debe buscarse"                                    │
│  ─────────────────────────────────────────              │
│  Objetivos parametrizados por area, jurisdiccion,       │
│  deal type. Cada objetivo define criterios de           │
│  evaluacion, ejemplos positivos/negativos, severidad    │
│  esperada, documentos requeridos.                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  CAPA 2: MOTOR DE REGLAS (Rule Engine)                  │
│  "Como debe evaluarse"                                  │
│  ─────────────────────────────────────────              │
│  Reglas declarativas tipo Catala/OPA que codifican      │
│  la logica de evaluacion. Patron: condicion →           │
│  severidad → accion. Con default logic y excepciones.   │
│  Cada ejecucion genera audit trail completo.            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  CAPA 3: PIPELINE DE DATOS (Data Pipeline)              │
│  "Sobre que informacion"                                │
│  ─────────────────────────────────────────              │
│  Normalizacion del data room: OCR, DLA, extraccion      │
│  de clausulas, entity linking, canonicalizacion.        │
│  Prepara hechos estructurados para el motor de reglas.  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Capa 1: Catalogo de Objetivos de Finding (Finding Objective Catalog)

### 3.1 Concepto

Un **Finding Objective** (FO) es la especificacion declarativa de un hallazgo que el sistema debe buscar. No es un hallazgo — es la *definicion* de que constituye un hallazgo.

```
Finding Objective = "Busca si los contratos materiales tienen clausula de cambio de control"
Finding            = "El contrato con Proveedor X por EUR 2.3M no tiene clausula CoC"
```

### 3.2 Estructura del Finding Objective

```typescript
interface FindingObjective {
  // Identidad
  id: string;                          // "FO-CONT-COC-001"
  version: string;                     // "2.1"
  title: string;                       // "Clausula de cambio de control en contratos materiales"
  description: string;                 // Descripcion larga

  // Clasificacion
  area_code: AreaCode;                 // "CONT"
  risk_category: string;               // "contract_termination_risk"
  dd_phase: WorkflowPhase;             // "analisis"

  // Aplicabilidad
  deal_types: DealType[];              // ["M&A", "asset_purchase"]
  jurisdictions: string[];             // ["ES", "EU", "US"]
  materiality_threshold?: MoneyAmount; // { amount: 500000, currency: "EUR" }
  applies_when: ApplicabilityRule[];   // Condiciones de cuando aplica este FO

  // Evaluacion
  evaluation_criteria: EvaluationCriterion[];
  data_required: DataRequirement[];

  // Severidad esperada
  severity_if_positive: Severity;      // "high"
  severity_modifiers: SeverityModifier[];

  // Ejemplos (para el LLM y para audit)
  positive_examples: string[];         // Hallazgo encontrado
  negative_examples: string[];         // Hallazgo no encontrado (conforme)
  false_positive_examples: string[];   // Situaciones que parecen hallazgo pero no lo son

  // Audit
  source_standard?: string;            // "ISAE-3000" | "ISA-620" | "internal"
  regulatory_basis?: string;           // "Art. 227 LSC"
  last_reviewed_by?: string;           // UUID del partner que valido
  last_reviewed_at?: string;           // ISO timestamp
}
```

### 3.3 Criterios de Evaluacion

```typescript
interface EvaluationCriterion {
  id: string;                          // "EC-001"
  description: string;                 // "Contrato contiene clausula CoC"
  evaluation_type: EvaluationType;     // "clause_presence" | "numeric_threshold" | "date_check" | "entity_match" | "semantic_analysis"

  // Para clause_presence
  target_clauses?: string[];           // ["cambio de control", "change of control", "CoC"]
  target_document_types?: string[];    // ["contrato_suministro", "contrato_cliente"]

  // Para numeric_threshold
  field?: string;                      // "contract_value"
  operator?: "gt" | "lt" | "gte" | "lte" | "eq";
  threshold?: number;

  // Para semantic_analysis (delegado a Harvey)
  semantic_query?: string;             // Query para Harvey
  confidence_threshold?: number;       // 0.85

  // Resultado
  weight: number;                      // 0.0-1.0 peso en la evaluacion
  required: boolean;                   // Si es criterio obligatorio
}
```

### 3.4 Requisitos de Datos

```typescript
interface DataRequirement {
  document_type: string;               // "contrato_material"
  sample_strategy: "all" | "materiality" | "random_sample";
  sample_size?: number;                // Para random_sample
  materiality_field?: string;          // "contract_value"
  materiality_threshold?: number;      // 1000000
  required_extractions: string[];      // ["clausula_coc", "valor_contrato", "contraparte"]
}
```

### 3.5 Tabla en Supabase

```sql
CREATE TABLE dd_finding_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_key VARCHAR(50) UNIQUE NOT NULL,  -- "FO-CONT-COC-001"
  version VARCHAR(10) NOT NULL DEFAULT '1.0',
  title TEXT NOT NULL,
  description TEXT,

  -- Clasificacion
  area_code VARCHAR(10) NOT NULL REFERENCES dd_areas(code),
  risk_category VARCHAR(100),
  dd_phase dd_workflow_phase,

  -- Aplicabilidad
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  materiality_threshold_amount NUMERIC,
  materiality_threshold_currency VARCHAR(3) DEFAULT 'EUR',
  applies_when JSONB DEFAULT '[]',

  -- Evaluacion
  evaluation_criteria JSONB NOT NULL DEFAULT '[]',
  data_required JSONB NOT NULL DEFAULT '[]',

  -- Severidad
  severity_if_positive VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity_modifiers JSONB DEFAULT '[]',

  -- Ejemplos
  positive_examples TEXT[] DEFAULT '{}',
  negative_examples TEXT[] DEFAULT '{}',
  false_positive_examples TEXT[] DEFAULT '{}',

  -- Audit
  source_standard VARCHAR(100),
  regulatory_basis VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_severity CHECK (severity_if_positive IN ('critical', 'high', 'medium', 'low', 'informational'))
);

CREATE INDEX idx_fo_area ON dd_finding_objectives(area_code) WHERE is_active;
CREATE INDEX idx_fo_deal_types ON dd_finding_objectives USING GIN(deal_types);
CREATE INDEX idx_fo_jurisdictions ON dd_finding_objectives USING GIN(jurisdictions);
```

### 3.6 Ejemplo Concreto: Catalogo por Area

**MERC (Societario):**
- FO-MERC-001: Verificar existencia y vigencia de escritura de constitucion
- FO-MERC-002: Verificar concordancia entre estatutos y estructura de organos
- FO-MERC-003: Verificar inscripcion en Registro Mercantil
- FO-MERC-004: Verificar que acuerdos de junta cumplen quorum
- FO-MERC-005: Verificar pactos de socios y restricciones de transmision
- FO-MERC-006: Verificar poderes vigentes y revocaciones
- FO-MERC-007: Verificar situacion de cargas y gravamenes

**CONT (Contratos):**
- FO-CONT-001: Clausula de cambio de control en contratos materiales
- FO-CONT-002: Clausulas de terminacion anticipada y penalidades
- FO-CONT-003: Garantias e indemnidades otorgadas
- FO-CONT-004: Compromisos de no competencia
- FO-CONT-005: Contratos con partes vinculadas
- FO-CONT-006: Licencias de software criticas y condiciones

**FISC (Fiscal):**
- FO-FISC-001: Contingencias fiscales por ejercicios abiertos
- FO-FISC-002: Verificar regimen de consolidacion fiscal
- FO-FISC-003: Operaciones intragrupo y precios de transferencia
- FO-FISC-004: Incentivos fiscales y cumplimiento de requisitos

**LAB (Laboral):**
- FO-LAB-001: Litigios laborales pendientes y contingencias
- FO-LAB-002: Cumplimiento de planes de igualdad
- FO-LAB-003: Personal clave sin clausulas de permanencia
- FO-LAB-004: Subcontratacion y cesion ilegal de trabajadores

---

## 4. Capa 2: Motor de Reglas Declarativo

### 4.1 Eleccion Tecnologica

Despues de evaluar Catala, OPA/Rego, Drools, DMN y JSON Rules Engine, la recomendacion es un **enfoque hibrido**:

| Componente | Tecnologia | Justificacion |
|-----------|-----------|---------------|
| Reglas de aplicabilidad | **JSON Rules (Supabase JSONB)** | Reglas simples de cuando aplica un FO — parametrizables sin codigo |
| Reglas de evaluacion | **OPA/Rego lite (compilado a TS)** | Logica de "default + excepcion" para evaluacion compleja |
| Reglas de severidad | **Decision Tables (JSONB)** | Tablas de decision parametrizables por deal type |
| Ejecucion semantica | **Harvey AI (via prompts estructurados)** | Analisis NLP que no puede codificarse en reglas booleanas |

### 4.2 Patron de Ejecucion

```
Para cada Finding Objective activo para este deal:
  1. APLICABILIDAD: Evaluar applies_when contra contexto del deal
     → Si no aplica, skip (registrar en audit: "FO-XXX skipped: deal_type not in scope")

  2. DATOS: Verificar data_required contra VDR normalizado
     → Si faltan datos, generar finding de tipo "gap" con severity=informational
     → Si datos disponibles, extraer hechos estructurados

  3. EVALUACION: Ejecutar evaluation_criteria sobre hechos
     → Criterios booleanos: reglas declarativas (JSON/OPA)
     → Criterios semanticos: delegados a Harvey con prompt estructurado
     → Resultado: score por criterio, score agregado

  4. CLASIFICACION: Aplicar severity_modifiers sobre resultado base
     → Decision table: contexto del deal → ajuste de severidad
     → Resultado: severity final + justificacion

  5. GENERACION: Crear dd_findings con trazabilidad completa
     → finding.objective_id = FO-XXX (FK a dd_finding_objectives)
     → finding.rule_execution_id = RE-YYY (FK a dd_rule_executions)
     → finding.evaluation_detail = { criteria_results[], score, confidence }
```

### 4.3 Ejemplo de Regla en JSON (Aplicabilidad)

```json
{
  "objective_key": "FO-CONT-COC-001",
  "applies_when": [
    {
      "all": [
        { "field": "deal.deal_type", "op": "in", "value": ["M&A", "asset_purchase", "merger"] },
        { "field": "deal.target_jurisdiction", "op": "in", "value": ["ES", "EU"] },
        { "field": "deal.has_material_contracts", "op": "eq", "value": true }
      ]
    }
  ]
}
```

### 4.4 Ejemplo de Decision Table (Severidad)

```json
{
  "objective_key": "FO-CONT-COC-001",
  "severity_modifiers": [
    {
      "condition": { "field": "contract_value", "op": "gte", "value": 5000000 },
      "action": "upgrade_severity",
      "to": "critical",
      "reason": "Contrato supera 5x el umbral de materialidad"
    },
    {
      "condition": { "field": "counterparty_concentration", "op": "gte", "value": 0.30 },
      "action": "upgrade_severity",
      "to": "critical",
      "reason": "Contraparte representa >30% de ingresos"
    },
    {
      "condition": {
        "all": [
          { "field": "coc_clause_present", "op": "eq", "value": true },
          { "field": "coc_requires_consent", "op": "eq", "value": false }
        ]
      },
      "action": "downgrade_severity",
      "to": "low",
      "reason": "CoC presente y no requiere consentimiento — riesgo bajo"
    }
  ]
}
```

### 4.5 Prompt Estructurado para Harvey (Evaluacion Semantica)

En vez del prompt generico actual, el motor genera prompts especificos por FO:

```
[FINDING OBJECTIVE: FO-CONT-COC-001]
Titulo: Clausula de cambio de control en contratos materiales
Area: CONT (Contratos)

[CRITERIOS DE EVALUACION]
1. (weight: 0.4) Determinar si el contrato contiene clausula de cambio de control
   - Buscar: "cambio de control", "change of control", "CoC", "transferencia de acciones"
2. (weight: 0.3) Si existe CoC, determinar si requiere consentimiento previo
3. (weight: 0.3) Evaluar consecuencias del trigger (terminacion, penalidad, renegociacion)

[DOCUMENTOS A ANALIZAR]
- Contrato con Proveedor Alpha (doc-123, paginas 1-45)
- Contrato con Cliente Beta (doc-456, paginas 1-32)

[FORMATO DE RESPUESTA REQUERIDO]
{
  "criteria_results": [
    { "criterion_id": "EC-001", "result": true|false, "confidence": 0.0-1.0, "evidence": "..." },
    { "criterion_id": "EC-002", "result": true|false, "confidence": 0.0-1.0, "evidence": "..." }
  ],
  "overall_assessment": "positive|negative|inconclusive",
  "narrative": "Descripcion del hallazgo"
}

[EJEMPLOS]
Hallazgo positivo: "El contrato con Proveedor Alpha por EUR 2.3M contiene clausula CoC
  (Clausula 12.3) que permite terminacion unilateral sin penalidad en caso de cambio de
  control. Dado que el contrato representa 15% de los ingresos, la severidad es HIGH."

Hallazgo negativo: "Todos los contratos materiales revisados contienen clausulas CoC
  que solo requieren notificacion, sin derecho de terminacion."

[FALSOS POSITIVOS A EVITAR]
- Clausulas de "cambio de domicilio" no son clausulas de cambio de control
- Referencias genericas a "modificaciones del contrato" sin mencion especifica a control
```

### 4.6 Audit Trail del Motor de Reglas

```sql
CREATE TABLE dd_rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id),
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  objective_version VARCHAR(10) NOT NULL,

  -- Contexto
  deal_context JSONB NOT NULL,           -- Snapshot del contexto del deal
  input_data_hash VARCHAR(64) NOT NULL,  -- SHA-256 de los datos de entrada

  -- Resultado
  applicability_result BOOLEAN NOT NULL,
  applicability_reason TEXT,
  evaluation_results JSONB,              -- Resultado por criterio
  severity_computed VARCHAR(20),
  severity_modifiers_applied JSONB,
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),

  -- Ejecucion
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by VARCHAR(100),              -- 'system' | user_id
  execution_duration_ms INTEGER,
  ai_calls_made INTEGER DEFAULT 0,

  -- Audit
  rule_source_hash VARCHAR(64),          -- Hash del FO+reglas en el momento de ejecucion

  CONSTRAINT chk_severity CHECK (severity_computed IS NULL OR severity_computed IN ('critical','high','medium','low','informational'))
);

CREATE INDEX idx_re_project ON dd_rule_executions(project_id);
CREATE INDEX idx_re_objective ON dd_rule_executions(objective_id);
CREATE INDEX idx_re_finding ON dd_rule_executions(finding_id) WHERE finding_id IS NOT NULL;
```

---

## 5. Capa 3: Pipeline de Datos (Data Normalization)

### 5.1 Estado Actual vs. Objetivo

| Aspecto | Actual | Objetivo |
|---------|--------|----------|
| Chunking | Adaptativo por tipo de documento | + Extraccion de clausulas estructuradas |
| Embeddings | pgvector 1536d para busqueda semantica | + Hechos estructurados para reglas |
| Normalizacion | Ninguna | Entity linking, fechas ISO, importes normalizados |
| Clasificacion | Manual (upload a carpeta) | Auto-clasificacion por tipo de documento |
| Gap analysis | Documentos esperados vs. recibidos | + Clausulas esperadas vs. encontradas |

### 5.2 Pipeline de Normalizacion

```
Documento sube al VDR
       │
       ▼
[1. CLASIFICACION AUTOMATICA]
  - Tipo de documento (contrato, acta, escritura, certificado, financiero)
  - Area probable (MERC, CONT, LAB, FISC, PI)
  - Jurisdiccion (ES, US, UK, EU)
  - Idioma
  → Almacenar en vdr_documents.document_metadata
       │
       ▼
[2. EXTRACCION ESTRUCTURADA]
  - Partes del documento (quienes)
  - Fechas clave (cuando)
  - Importes (cuanto)
  - Clausulas identificadas (que)
  → Almacenar en nueva tabla: dd_document_facts
       │
       ▼
[3. NORMALIZACION]
  - Entity linking: "ACME Corp" = "Acme Corporation S.L." = target.company
  - Fechas: DD/MM/YYYY → ISO 8601
  - Importes: "2,3 millones EUR" → { amount: 2300000, currency: "EUR" }
  - Clausulas: mapear a taxonomia estandar
  → Actualizar dd_document_facts con valores normalizados
       │
       ▼
[4. HECHOS PARA MOTOR DE REGLAS]
  - Compilar hechos por Finding Objective
  - Evaluar data_required: que FOs tienen datos suficientes
  - Generar gap findings para datos faltantes
  → Almacenar en dd_fact_sets (snapshot de hechos por ejecucion)
```

### 5.3 Tabla de Hechos Estructurados

```sql
CREATE TABLE dd_document_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id),
  project_id UUID NOT NULL REFERENCES dd_projects(id),

  -- Clasificacion
  document_type VARCHAR(50),            -- "contrato_material", "acta_junta", "escritura"
  document_subtype VARCHAR(50),         -- "suministro", "servicios", "arrendamiento"
  area_codes TEXT[],                    -- ["CONT", "LAB"]
  jurisdiction VARCHAR(10),             -- "ES"
  language VARCHAR(5),                  -- "es"

  -- Partes
  parties JSONB,                        -- [{ name, role, normalized_id }]

  -- Fechas
  effective_date DATE,
  expiration_date DATE,
  signing_date DATE,

  -- Importes
  amounts JSONB,                        -- [{ type, amount, currency, description }]
  total_value NUMERIC,
  total_value_currency VARCHAR(3),

  -- Clausulas extraidas
  clauses JSONB,                        -- [{ clause_type, present, page, text_excerpt, confidence }]

  -- Metadata de extraccion
  extraction_method VARCHAR(20),        -- "ai_harvey" | "rule_based" | "manual"
  extraction_confidence NUMERIC(3,2),   -- 0.00-1.00
  extracted_at TIMESTAMPTZ DEFAULT now(),

  -- Content hash para cache
  source_content_hash VARCHAR(64),

  CONSTRAINT chk_confidence CHECK (extraction_confidence BETWEEN 0 AND 1)
);

CREATE INDEX idx_df_project ON dd_document_facts(project_id);
CREATE INDEX idx_df_document ON dd_document_facts(document_id);
CREATE INDEX idx_df_type ON dd_document_facts(document_type);
CREATE INDEX idx_df_clauses ON dd_document_facts USING GIN(clauses);
```

---

## 6. Integracion con Sistema Actual

### 6.1 Cambios en el Flujo de Ejecucion

```
ACTUAL:
  User → Instantiate WF → Execute → Harvey genera findings libremente → dd_findings

PROPUESTO (v2):
  User → Instantiate WF
    → Resolver FOs aplicables para este deal (Capa 1)
    → Verificar datos disponibles por FO (Capa 3)
    → Ejecutar motor de reglas por FO (Capa 2)
      → Reglas booleanas: evaluacion directa
      → Reglas semanticas: prompt estructurado a Harvey
    → Generar dd_findings con objective_id + rule_execution_id
    → Generar gap findings para FOs sin datos suficientes
```

### 6.2 Impacto en Archivos Existentes

| Archivo | Cambio |
|---------|--------|
| `findings-service.ts` | Añadir `objective_id`, `rule_execution_id` a PersistFindingInput |
| `engine.ts` | Nuevo path: `executeWithObjectives()` que resuelve FOs antes de llamar a Harvey |
| `prompt-builder.ts` | Nuevo builder: `buildObjectivePrompt(fo, facts)` que genera prompt estructurado por FO |
| `deal-risk-score.ts` | Leer pesos de area desde BD en vez de constantes hardcodeadas |
| `instance-runner.ts` | Paso previo: resolver FOs aplicables y verificar datos |
| `template-types.ts` | Añadir `finding_objectives: string[]` a PhaseDefinition |

### 6.3 Feature Flag

```
FINDING_OBJECTIVES=true  → Usa catalogo de FOs + motor de reglas
FINDING_OBJECTIVES=false → Comportamiento actual (Harvey genera findings libremente)
```

### 6.4 Compatibilidad con FINDINGS_FIRST

Los dos feature flags son ortogonales:
- `FINDINGS_FIRST` controla de donde se LEEN findings
- `FINDING_OBJECTIVES` controla como se GENERAN findings

Combinaciones validas:
| FINDINGS_FIRST | FINDING_OBJECTIVES | Comportamiento |
|:-:|:-:|---|
| OFF | OFF | v1.0 actual (legacy reads, Harvey libre) |
| ON | OFF | v1.5 (dd_findings reads, Harvey libre) |
| ON | ON | **v2.0 completo** (dd_findings reads, FO-driven generation) |
| OFF | ON | No recomendado (genera con FOs pero lee legacy) |

---

## 7. Modelo de Scoring Parametrizable

### 7.1 Tabla de Configuracion de Scoring

```sql
CREATE TABLE dd_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(50) UNIQUE NOT NULL,  -- "default", "ma_spain", "vc_us"
  name VARCHAR(200),

  -- Pesos por severidad
  severity_weights JSONB NOT NULL DEFAULT '{
    "critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.15, "informational": 0.0
  }',

  -- Pesos por probabilidad
  probability_weights JSONB NOT NULL DEFAULT '{
    "certain": 1.0, "alta": 0.9, "probable": 0.75, "media": 0.5, "baja": 0.2, "remote": 0.15
  }',

  -- Multiplicadores por timing
  timing_multipliers JSONB NOT NULL DEFAULT '{
    "blocking": 1.5, "pre_closing": 1.2, "post_closing": 1.0, "ongoing": 0.8
  }',

  -- Pesos por area (normalizados)
  area_weights JSONB NOT NULL DEFAULT '{
    "MERC": 1.0, "CONT": 1.2, "LAB": 0.8, "FISC": 1.0, "PI": 0.7, "LIT": 1.1, "GENERAL": 0.5
  }',

  -- Umbrales de recomendacion
  recommendation_thresholds JSONB NOT NULL DEFAULT '{
    "go_below": 30, "no_go_above": 65
  }',

  -- Reglas de deal breaker
  deal_breaker_rules JSONB NOT NULL DEFAULT '{
    "severity": "critical", "probability_min": "alta", "timing": "blocking"
  }',

  -- Tier calculation
  tier_rules JSONB NOT NULL DEFAULT '{
    "tier_1": { "severity": ["critical"], "or_conditions": [{"severity": "high", "probability": "alta"}] },
    "tier_2": { "severity": ["high", "medium"], "requires_economic_impact": true },
    "tier_3": { "default": true }
  }',

  -- Metadata
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.2 Uso en Codigo

```typescript
// Antes (hardcodeado):
const SEVERITY_WEIGHTS = { critical: 1.0, high: 0.75, ... };

// Despues (parametrizable):
const config = await loadScoringConfig(projectId); // Busca por deal_type + jurisdiction, fallback a default
const rawScore = config.severity_weights[finding.severity]
               * config.probability_weights[finding.probability]
               * config.timing_multipliers[finding.timing || 'post_closing']
               * 100;
```

---

## 8. Integracion con Reporting

### 8.1 Report Template → Finding Objectives

Cada report template define que FOs deben estar cubiertos en sus secciones:

```typescript
interface ReportSection {
  section_key: string;                 // "ip_ownership"
  title: string;
  required_objectives: string[];       // ["FO-PI-001", "FO-PI-002", "FO-PI-003"]
  optional_objectives: string[];       // ["FO-PI-004"]
}
```

### 8.2 Coverage Analysis

Al generar un informe, el sistema calcula cobertura:

```
Para cada seccion del report template:
  - FOs requeridos: N
  - FOs con finding generado: M
  - FOs con gap (sin datos): G
  - FOs skipped (no aplica): S

  Cobertura = M / (N - S) * 100

  Si cobertura < 80% → Warning en informe
  Si cobertura < 50% → Seccion marcada como "incompleta"
```

---

## 9. Conformidad con Estandares de Auditoria

### 9.1 Trazabilidad End-to-End

```
Documento VDR (content_hash)
  → dd_document_facts (hechos extraidos)
    → dd_rule_executions (regla evaluada, resultado, duracion)
      → dd_findings (hallazgo generado, con objective_id + rule_execution_id)
        → dd_finding_evidence (enlace a chunks VDR)
          → dd_report_findings (inclusion en informe)
```

Cada eslabón tiene: timestamp, actor (user/system), hash de entrada, hash de salida.

### 9.2 Alineacion con ISAE 3000 / SOC 2

| Requisito ISAE 3000 | Implementacion |
|---------------------|----------------|
| Evidencia suficiente y adecuada | dd_finding_evidence + dd_document_facts |
| Evaluacion de riesgos de informacion incorrecta | dd_rule_executions.evaluation_results + confidence_score |
| Documentacion del trabajo | dd_rule_executions + dd_findings audit trail |
| Revision de calidad | HITL decisions + tier override justification |
| Independencia | Separacion finding objectives (que buscar) vs. ejecucion (como buscar) |

### 9.3 Retencion y Acceso

- `dd_rule_executions`: retencion minima 7 años (configurable)
- `dd_finding_objectives`: versionado inmutable (nunca se borran, se desactivan)
- Export en formato CSV/JSON para auditor externo via `/api/audit/export`

---

## 10. Roadmap de Implementacion

### Fase E.1: Finding Objectives MVP (2 semanas)

1. Crear tabla `dd_finding_objectives` (migracion)
2. Seed de 20-30 FOs para areas MERC, CONT, FISC, LAB
3. Añadir `objective_id` a dd_findings (FK nullable, migracion)
4. Modificar `prompt-builder.ts` para generar prompts estructurados cuando hay FOs
5. Feature flag `FINDING_OBJECTIVES`

### Fase E.2: Motor de Reglas + Audit Trail (2 semanas)

1. Crear tabla `dd_rule_executions` (migracion)
2. Crear tabla `dd_scoring_config` (migracion)
3. Implementar `objective-resolver.ts`: resuelve FOs aplicables para un deal
4. Implementar `rule-evaluator.ts`: ejecuta reglas booleanas + decision tables
5. Migrar scoring engine a leer pesos de BD

### Fase E.3: Data Pipeline (2 semanas)

1. Crear tabla `dd_document_facts` (migracion)
2. Implementar `fact-extractor.ts`: extrae hechos de documentos via Harvey
3. Implementar `document-classifier.ts`: clasifica documentos automaticamente
4. Integrar con pipeline VDR existente (post-chunking)

### Fase E.4: Reporting + Coverage (1 semana)

1. Añadir `required_objectives` a report sections
2. Implementar coverage analysis en report-generator.ts
3. Dashboard de cobertura en War Room

---

## 11. Diagrama de Dependencias

```
dd_finding_objectives (Catalogo)
       │
       ├──→ applies_when (JSON Rules)
       │       │
       │       ▼
       │    [Aplicabilidad evaluada contra deal context]
       │
       ├──→ evaluation_criteria
       │       │
       │       ├──→ clause_presence → dd_document_facts.clauses
       │       ├──→ numeric_threshold → dd_document_facts.amounts
       │       └──→ semantic_analysis → Harvey AI (prompt estructurado)
       │
       ├──→ severity_modifiers (Decision Table)
       │       │
       │       ▼
       │    dd_scoring_config (pesos parametrizables)
       │
       └──→ dd_rule_executions (Audit Trail)
               │
               ▼
            dd_findings (Hallazgo con trazabilidad)
               │
               ├──→ dd_finding_evidence (chunks VDR)
               ├──→ dd_report_findings (informes)
               └──→ dd_deal_risk_scores (scoring)
```

---

*Este documento define la arquitectura objetivo. Los detalles de implementacion se refinaran en cada fase con PRs especificas.*
