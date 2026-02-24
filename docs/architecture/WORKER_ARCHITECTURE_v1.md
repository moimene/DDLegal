# DD Legal PMO — Worker Architecture v1.0
## Sistema AI-Driven de Due Diligence

**Fecha**: 24 febrero 2026
**Estado**: Diseño arquitectónico — Pre-implementación
**Prerequisitos**: Fases A-E.2.5 completadas, FINDINGS_FIRST=on, FINDING_OBJECTIVES=on

---

## 1. Visión: De Request/Response a Worker Autónomo

### 1.1 Estado actual

El sistema opera en modo **request/response**: un usuario invoca un workflow, el engine ejecuta una iteración contra Harvey, persiste findings, y espera la siguiente invocación manual. El `fo-analysis-worker` (cron cada 5 min) añade una capa de automatismo limitado: procesa pares documento×FO pendientes en batches de 10 con máximo 5 llamadas AI por ejecución.

```
ESTADO ACTUAL (v2.5)
═══════════════════════════════════════════════════════════════

  Usuario ──invoke──→ Workflow Engine ──→ Harvey ──→ Findings
     ↑                                                  │
     └──────────── espera manual ──────────────────────┘

  Cron (5min) ──→ FO Analysis Worker ──→ 10 docs×FOs ──→ Findings
                    (batch limitado)
```

**Limitaciones del modelo actual:**

1. **Sin orquestación end-to-end**: No existe un proceso que gobierne el ciclo completo de DD desde la carga de documentos hasta las conclusiones negociables.
2. **Sin gestión de dependencias entre FOs**: Los 54 Finding Objectives se evalúan independientemente sin considerar que el resultado de un FO puede condicionar la aplicabilidad o severidad de otro.
3. **Sin normalización previa de datos**: El rule-evaluator opera sobre chunks crudos; no hay extracción estructurada de hechos (parties, amounts, dates, clauses) antes de la evaluación.
4. **Sin convergencia a conclusiones**: Los findings se generan pero no se sintetizan automáticamente en conclusiones por área ni en recomendaciones transaccionales consolidadas.
5. **Sin gestión de cobertura activa**: El sistema no detecta proactivamente qué FOs faltan por evaluar, qué documentos faltan por cargar, ni prioriza el trabajo pendiente.

### 1.2 Visión del Worker

Convertir DD Legal PMO en un **Worker autónomo de DD** que, dado un proyecto y su contexto transaccional, ejecute el ciclo completo de due diligence de forma continua, trazable y convergente:

```
VISIÓN: WORKER AUTÓNOMO (v3.0)
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │                    DD WORKER LOOP                        │
  │                                                         │
  │  ┌──────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐ │
  │  │SENSE │──→│ NORMALIZE│──→│ EVALUATE │──→│CONCLUDE │ │
  │  │      │   │          │   │          │   │         │ │
  │  │VDR   │   │Facts     │   │Rules +   │   │Synthesis│ │
  │  │Events│   │Entities  │   │Harvey    │   │Rankings │ │
  │  │Gaps  │   │Clauses   │   │Criteria  │   │Red Flags│ │
  │  └──────┘   └──────────┘   └──────────┘   └─────────┘ │
  │       ↑                                        │        │
  │       └────────── feedback loop ───────────────┘        │
  │                                                         │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │              PERSISTENCE LAYER                    │   │
  │  │  dd_findings · dd_rule_executions · dd_reports   │   │
  │  │  dd_fo_document_status · dd_document_facts       │   │
  │  └──────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura del Worker: Cuatro Fases Continuas

El Worker opera como un **loop continuo** con cuatro fases que se retroalimentan. No es una pipeline lineal: cada fase puede generar trabajo para las demás.

### 2.1 Fase SENSE — Percepción del Entorno

**Responsabilidad**: Detectar cambios en el universo de datos del proyecto y determinar qué trabajo es necesario.

```
┌─────────────────────────────────────────────────┐
│                   SENSE PHASE                    │
│                                                  │
│  Inputs:                                         │
│  ├─ VDR Events (new doc, updated doc, deleted)   │
│  ├─ FO Catalog Changes (new FO, deactivated FO)  │
│  ├─ Project Context Changes (deal_type, juris.)   │
│  └─ Manual Triggers (user requests analysis)      │
│                                                  │
│  Outputs:                                        │
│  ├─ Work Queue: [{doc_id, fo_id, priority}]      │
│  ├─ Gap Report: [{fo_id, missing_data}]          │
│  ├─ Coverage Map: {area → %coverage}             │
│  └─ Stale Evaluations: [{rule_exec_id, reason}]  │
│                                                  │
│  Estado persistido en:                           │
│  └─ dd_worker_state (nueva tabla)                │
└─────────────────────────────────────────────────┘
```

**Componentes del Sense:**

| Componente | Función | Trigger |
|------------|---------|---------|
| `VDRWatcher` | Detecta docs nuevos/modificados via content_hash | DB trigger `trg_vdr_doc_new` / `trg_vdr_doc_content_change` |
| `FOCatalogWatcher` | Detecta FOs nuevos/modificados | DB trigger `trg_new_finding_objective` |
| `CoverageAnalyzer` | Calcula cobertura por área y FO | Cada ciclo del worker |
| `GapDetector` | Identifica FOs sin datos suficientes | Cada ciclo del worker |
| `PriorityCalculator` | Ordena work queue por severidad×cobertura×aging | Cada ciclo del worker |

**Algoritmo de priorización:**

```typescript
interface WorkItem {
  document_id: string;
  objective_id: string;
  priority_score: number;  // 0-100
  reason: string;
}

function calculatePriority(fo: FindingObjective, doc: VDRDocument): number {
  let score = 0;

  // Severidad base del FO (máximo impacto potencial)
  const severityWeight = { critical: 40, high: 30, medium: 20, low: 10, informational: 5 };
  score += severityWeight[fo.severity_if_positive];

  // Cobertura del área (áreas con menos cobertura = más prioridad)
  const areaCoverage = getCoverageForArea(fo.area_code);
  score += (1 - areaCoverage) * 30;  // 0-30 puntos

  // Antigüedad del documento (docs más nuevos = datos más frescos)
  const daysSinceUpload = daysBetween(doc.uploaded_at, now());
  score += Math.min(daysSinceUpload * 2, 20);  // 0-20 puntos

  // Bonus si el FO tiene dependencias resueltas
  if (allDependenciesResolved(fo)) score += 10;

  return Math.min(score, 100);
}
```

### 2.2 Fase NORMALIZE — Extracción Estructurada de Hechos

**Responsabilidad**: Transformar documentos crudos del VDR en hechos estructurados que el Rule Engine pueda evaluar determinísticamente.

```
┌─────────────────────────────────────────────────┐
│                NORMALIZE PHASE                   │
│                                                  │
│  Input: VDR Document (chunks + metadata)         │
│                                                  │
│  Pipeline:                                       │
│  ┌───────────────┐                               │
│  │ 1. CLASSIFY   │ doc_type, area_codes,         │
│  │               │ jurisdiction, language         │
│  └───────┬───────┘                               │
│          ▼                                       │
│  ┌───────────────┐                               │
│  │ 2. EXTRACT    │ parties, dates, amounts,       │
│  │               │ clauses, obligations           │
│  └───────┬───────┘                               │
│          ▼                                       │
│  ┌───────────────┐                               │
│  │ 3. NORMALIZE  │ entity linking, ISO dates,     │
│  │               │ currency normalization          │
│  └───────┬───────┘                               │
│          ▼                                       │
│  ┌───────────────┐                               │
│  │ 4. COMPILE    │ dd_document_facts (UPSERT)     │
│  │   FACTS       │ content_hash → cache key       │
│  └───────────────┘                               │
│                                                  │
│  Output: dd_document_facts (structured facts)     │
│  Cache: content_hash match → skip re-extraction   │
└─────────────────────────────────────────────────┘
```

**Modelo de datos: `dd_document_facts`** (nueva tabla)

```sql
CREATE TABLE dd_document_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id),
  project_id UUID NOT NULL REFERENCES dd_projects(id),

  -- Clasificación automática
  document_type VARCHAR(50),           -- contrato_material, acta_junta, escritura...
  document_subtype VARCHAR(50),        -- suministro, servicios, laboral...
  area_codes TEXT[] DEFAULT '{}',      -- ["CONT", "LAB"]
  jurisdiction VARCHAR(10),            -- ES, UE, UK, US
  language VARCHAR(5) DEFAULT 'es',

  -- Entidades extraídas
  parties JSONB DEFAULT '[]',
  -- [{ name, role, normalized_id, is_target, is_counterparty }]

  -- Fechas clave
  effective_date DATE,
  expiration_date DATE,
  signing_date DATE,
  key_dates JSONB DEFAULT '[]',
  -- [{ type, date, description }]

  -- Importes
  amounts JSONB DEFAULT '[]',
  -- [{ type, amount, currency, description, annualized }]
  total_value NUMERIC,
  total_value_currency VARCHAR(3) DEFAULT 'EUR',

  -- Cláusulas identificadas
  clauses JSONB DEFAULT '[]',
  -- [{ clause_type, present, page, excerpt, confidence }]
  -- clause_type: coc, non_compete, indemnity, warranty, termination, ip_assignment...

  -- Obligaciones y restricciones
  obligations JSONB DEFAULT '[]',
  -- [{ type, description, party, deadline, consequence }]

  -- Metadatos de extracción
  extraction_method VARCHAR(30),        -- ai_harvey, rule_based, manual, hybrid
  extraction_confidence NUMERIC(3,2),
  extraction_model VARCHAR(50),         -- modelo Harvey usado
  extracted_at TIMESTAMPTZ DEFAULT now(),
  source_content_hash VARCHAR(64),      -- cache key (SHA-256 del documento)

  -- Versionado
  version INTEGER DEFAULT 1,
  previous_version_id UUID,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_confidence CHECK (extraction_confidence BETWEEN 0 AND 1),
  CONSTRAINT uq_doc_project UNIQUE (document_id, project_id)
);

CREATE INDEX idx_df_project ON dd_document_facts(project_id);
CREATE INDEX idx_df_document ON dd_document_facts(document_id);
CREATE INDEX idx_df_type ON dd_document_facts(document_type);
CREATE INDEX idx_df_area ON dd_document_facts USING GIN(area_codes);
CREATE INDEX idx_df_clauses ON dd_document_facts USING GIN(clauses);
CREATE INDEX idx_df_hash ON dd_document_facts(source_content_hash);
```

**Prompt estructurado para Harvey (extracción):**

```
[DOCUMENT FACT EXTRACTION]
Document: {filename} ({document_id})
Pages: {page_count}
Content (chunked): {chunks_text}

Extract the following structured information:

1. CLASSIFICATION
   - document_type: one of [contrato_material, contrato_menor, acta_junta, escritura_constitucion,
     certificado_registro, informe_fiscal, nomina, convenio_colectivo, patente, marca, licencia,
     poliza_seguro, permiso_administrativo, resolucion_judicial, otro]
   - area_codes: array of [MERC, CONT, FISC, LAB, PI, LIT, ADM]
   - jurisdiction: ES | UE | UK | US | otro

2. PARTIES
   For each party: { name, role (vendor/client/employer/employee/licensor/licensee/other),
   is_target (boolean), is_counterparty (boolean) }

3. KEY DATES
   - effective_date, expiration_date, signing_date
   - Additional key dates with type and description

4. AMOUNTS
   For each amount: { type (contract_value/penalty/cap/deductible/salary/fee),
   amount (numeric), currency, annualized (boolean) }

5. CLAUSES
   For each relevant clause type, indicate: { clause_type, present (boolean),
   page (number), excerpt (max 200 chars), confidence (0-1) }

   Check for: coc (change of control), non_compete, termination, indemnity,
   warranty, ip_assignment, confidentiality, exclusivity, most_favored_nation,
   liquidated_damages, force_majeure, governing_law, arbitration

6. OBLIGATIONS
   Key obligations: { type, description, party, deadline, consequence_if_breach }

RESPONSE FORMAT: JSON object matching the extraction schema.
```

### 2.3 Fase EVALUATE — Motor de Reglas + AI Híbrido

**Responsabilidad**: Evaluar cada FO aplicable contra los hechos estructurados, generando findings con trazabilidad completa.

```
┌─────────────────────────────────────────────────────────────┐
│                     EVALUATE PHASE                           │
│                                                              │
│  For each (document, applicable_FO) pair:                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 1: RESOLVE APPLICABILITY                         │   │
│  │   objective-resolver.ts                               │   │
│  │   ├─ deal_type filter                                 │   │
│  │   ├─ jurisdiction filter                              │   │
│  │   ├─ materiality threshold                            │   │
│  │   └─ applies_when JSON rules against deal context     │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 2: VERIFY DATA REQUIREMENTS                      │   │
│  │   ├─ Check dd_document_facts for required doc_types   │   │
│  │   ├─ Check extracted clauses vs required extractions  │   │
│  │   ├─ If insufficient → generate GAP finding           │   │
│  │   └─ If sufficient → compile evaluation facts         │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 3: EVALUATE CRITERIA (hybrid)                    │   │
│  │                                                        │   │
│  │   ┌─ document_review:    facts.clauses lookup         │   │
│  │   ├─ threshold_calc:     facts.amounts comparison     │   │
│  │   ├─ compliance_check:   rules engine (boolean)       │   │
│  │   ├─ semantic_analysis:  Harvey structured prompt ──┐ │   │
│  │   ├─ litigation_review:  Harvey + rules hybrid    ──┤ │   │
│  │   └─ jurisdiction_map:   rules + registry lookup    │ │   │
│  │                                                 ┌───┘ │   │
│  │   AI calls tracked: max per batch, rate limited │     │   │
│  └──────────────────────┬──────────────────────────┘─────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 4: SEVERITY CLASSIFICATION                       │   │
│  │   ├─ Base severity from FO definition                 │   │
│  │   ├─ Apply severity_modifiers (decision table)        │   │
│  │   ├─ Apply dd_scoring_config weights                  │   │
│  │   └─ Compute final severity + justification           │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 5: PERSIST                                       │   │
│  │   ├─ dd_findings (with objective_id, rule_exec_id)    │   │
│  │   ├─ dd_rule_executions (audit trail completo)        │   │
│  │   ├─ dd_finding_evidence (link to VDR chunks)         │   │
│  │   └─ dd_fo_document_status → 'analyzed'               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Mejora clave sobre el estado actual**: El `rule-evaluator.ts` actual solo implementa `document_review` (verifica que chunks existan). La arquitectura Worker extiende todos los `eval_type` con evaluación real:

| eval_type | Estado Actual | Worker v3.0 |
|-----------|--------------|-------------|
| `document_review` | ✅ Chunk existence check | + Clause presence from dd_document_facts |
| `document_verification` | ✅ Chunk existence check | + Cross-reference against registros |
| `semantic_analysis` | ❌ TODO | Harvey structured prompt con facts |
| `threshold_calculation` | ❌ TODO | Numeric comparison from dd_document_facts.amounts |
| `compliance_check` | ❌ TODO | Boolean rules engine against extracted obligations |
| `litigation_review` | ❌ TODO | Harvey + procedural rules hybrid |
| `jurisdiction_mapping` | ❌ TODO | Rules engine + jurisdiction DB |
| `procedure_analysis` | ❌ TODO | Harvey with regulatory framework context |

### 2.4 Fase CONCLUDE — Síntesis y Convergencia

**Responsabilidad**: Transformar findings individuales en conclusiones accionables por área y consolidadas para la transacción.

```
┌─────────────────────────────────────────────────────────────┐
│                    CONCLUDE PHASE                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 1: AREA SYNTHESIS                                │   │
│  │   For each area (MERC, CONT, FISC, LAB, PI, LIT, ADM)│   │
│  │   ├─ Group findings by FO                             │   │
│  │   ├─ Identify patterns (recurring issues)             │   │
│  │   ├─ Calculate area risk score                        │   │
│  │   ├─ Generate area conclusion narrative               │   │
│  │   └─ Identify area-level recommendations              │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 2: RED FLAG CONSOLIDATION                        │   │
│  │   ├─ Extract Tier 1 (Decisorio) findings              │   │
│  │   ├─ Cross-reference across areas                     │   │
│  │   ├─ Detect compounding risks                         │   │
│  │   ├─ Classify: deal_breaker vs negotiable             │   │
│  │   └─ Generate negotiation action proposals            │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 3: DEAL RISK SCORING                             │   │
│  │   ├─ Apply dd_scoring_config (parametrizable)         │   │
│  │   ├─ severity × probability × timing × area_weight    │   │
│  │   ├─ Compute recommendation: go / conditional / no_go │   │
│  │   └─ Generate executive summary                       │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 4: REPORT GENERATION                             │   │
│  │   ├─ Area reports (per-area conclusion sections)      │   │
│  │   ├─ Red flags report (consolidated, ranked)          │   │
│  │   ├─ Executive summary (deal recommendation)          │   │
│  │   ├─ Evidence pack (traceability chain)               │   │
│  │   └─ War Room update (dashboard refresh)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Modelo de datos: `dd_area_conclusions`** (nueva tabla)

```sql
CREATE TABLE dd_area_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id),
  area_code VARCHAR(10) NOT NULL,

  -- Resumen del área
  conclusion_narrative TEXT,             -- Narrativa generada
  risk_level VARCHAR(20),                -- critical, high, medium, low
  risk_score NUMERIC(5,2),               -- 0-100

  -- Estadísticas
  findings_total INTEGER DEFAULT 0,
  findings_critical INTEGER DEFAULT 0,
  findings_high INTEGER DEFAULT 0,
  findings_medium INTEGER DEFAULT 0,
  findings_low INTEGER DEFAULT 0,
  deal_breakers INTEGER DEFAULT 0,

  -- Cobertura
  fos_applicable INTEGER DEFAULT 0,      -- FOs que aplican a esta área/deal
  fos_evaluated INTEGER DEFAULT 0,       -- FOs efectivamente evaluados
  fos_with_findings INTEGER DEFAULT 0,   -- FOs que generaron finding
  fos_with_gaps INTEGER DEFAULT 0,       -- FOs sin datos suficientes
  coverage_pct NUMERIC(5,2),             -- fos_evaluated / fos_applicable * 100

  -- Recomendaciones
  recommendations JSONB DEFAULT '[]',
  -- [{ type: 'mitigation'|'negotiation'|'condition_precedent'|'indemnity',
  --    description, priority, estimated_cost, related_findings[] }]

  -- Patrones detectados
  patterns JSONB DEFAULT '[]',
  -- [{ pattern_type, description, affected_findings[], severity_impact }]

  -- Versionado
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by VARCHAR(50) DEFAULT 'worker',

  -- HITL
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(20) DEFAULT 'pending',
  -- pending, approved, corrected, rejected

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_project_area_version UNIQUE (project_id, area_code, version)
);
```

---

## 3. Orquestación: El Worker Controller

### 3.1 Modelo de Ejecución

El Worker Controller es el componente central que orquesta las cuatro fases. Opera como un **state machine persistente** con ciclos de ejecución controlados.

```
┌─────────────────────────────────────────────────────────────┐
│                   WORKER CONTROLLER                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              dd_worker_runs (state machine)          │    │
│  │                                                      │    │
│  │  run_id: UUID                                        │    │
│  │  project_id: UUID                                    │    │
│  │  status: idle|sensing|normalizing|evaluating|        │    │
│  │          concluding|paused|error|completed           │    │
│  │  current_phase: sense|normalize|evaluate|conclude    │    │
│  │  phase_progress: { items_total, items_done, % }      │    │
│  │  ai_budget_remaining: 15                             │    │
│  │  started_at, last_heartbeat_at                       │    │
│  │  cycle_count: 47                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Execution Modes:                                            │
│  ├─ CONTINUOUS: Loop indefinido (cron-triggered, 5 min)      │
│  ├─ TARGETED:   Un área o FO específico                      │
│  ├─ FULL_SWEEP: Reevaluar todo el proyecto                   │
│  └─ ON_DEMAND:  Trigger manual por usuario                   │
│                                                              │
│  Rate Limiting:                                              │
│  ├─ Harvey calls per cycle: configurable (default 15)        │
│  ├─ Documents per cycle: configurable (default 20)           │
│  ├─ Respects Harvey gateway: completion=5, vault=3 concurrent│
│  └─ Backoff on 429: exponential, max 5 retries              │
│                                                              │
│  Convergence Detection:                                      │
│  ├─ All FOs evaluated for all docs → area complete           │
│  ├─ All areas complete → project complete                    │
│  ├─ New doc uploaded → re-enter SENSE                        │
│  └─ Coverage threshold met → trigger CONCLUDE                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 State Machine del Worker

```
                    ┌──────────┐
            ┌──────→│  IDLE    │◄──────────────────────┐
            │       └─────┬────┘                        │
            │             │ trigger (cron/manual/event)  │
            │             ▼                              │
            │       ┌──────────┐                        │
            │  ┌───→│ SENSING  │                        │
            │  │    └─────┬────┘                        │
            │  │          │ work_queue generated         │
            │  │          ▼                              │
            │  │    ┌─────────────┐                     │
            │  │    │NORMALIZING  │──── no pending ─────→│
            │  │    └─────┬───────┘     docs             │
            │  │          │ facts extracted               │
            │  │          ▼                              │
            │  │    ┌─────────────┐                     │
            │  │    │ EVALUATING  │──── budget ─────────→│
            │  │    └─────┬───────┘     exhausted        │
            │  │          │ findings generated            │
            │  │          ▼                              │
            │  │    ┌─────────────┐                     │
            │  │    │ CONCLUDING  │                     │
            │  │    └─────┬───────┘                     │
            │  │          │                              │
            │  │          ├── coverage < threshold ──┐   │
            │  │          │                          │   │
            │  │          ▼                          ▼   │
            │  │    ┌──────────┐              back to    │
            │  └────│ cycle++  │              SENSING    │
            │       └──────────┘                        │
            │                                            │
            │       ┌──────────┐                        │
            ├───────│  PAUSED  │  (user/admin action)   │
            │       └──────────┘                        │
            │       ┌──────────┐                        │
            └───────│  ERROR   │  (unrecoverable)       │
                    └──────────┘
```

### 3.3 Persistencia del Estado: `dd_worker_runs`

```sql
CREATE TABLE dd_worker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id),

  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  -- idle, sensing, normalizing, evaluating, concluding, paused, error, completed
  current_phase VARCHAR(20),

  -- Progreso
  phase_progress JSONB DEFAULT '{}',
  -- { items_total, items_done, items_error, percentage }
  cycle_count INTEGER DEFAULT 0,

  -- Presupuesto AI
  ai_budget_total INTEGER DEFAULT 15,    -- llamadas Harvey por ciclo
  ai_budget_used INTEGER DEFAULT 0,
  ai_budget_reset_at TIMESTAMPTZ,

  -- Cobertura
  coverage_snapshot JSONB DEFAULT '{}',
  -- { by_area: { MERC: 85, CONT: 72, ... }, overall: 78 }

  -- Work Queue (snapshot del ciclo actual)
  work_queue JSONB DEFAULT '[]',
  -- [{ document_id, objective_id, priority_score, status }]

  -- Ejecución
  execution_mode VARCHAR(20) DEFAULT 'continuous',
  -- continuous, targeted, full_sweep, on_demand
  execution_config JSONB DEFAULT '{}',
  -- { target_area?, target_fo?, coverage_threshold: 80 }

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  error_message TEXT,

  -- Métricas del ciclo
  metrics JSONB DEFAULT '{}',
  -- { docs_normalized, fos_evaluated, findings_created, findings_updated,
  --   conclusions_generated, ai_calls_total, duration_ms }

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wr_project ON dd_worker_runs(project_id);
CREATE INDEX idx_wr_status ON dd_worker_runs(status) WHERE status != 'completed';
CREATE INDEX idx_wr_heartbeat ON dd_worker_runs(last_heartbeat_at)
  WHERE status IN ('sensing', 'normalizing', 'evaluating', 'concluding');
```

### 3.4 Worker Controller: TypeScript Interface

```typescript
// src/lib/worker/worker-controller.ts

export interface WorkerConfig {
  projectId: string;
  mode: 'continuous' | 'targeted' | 'full_sweep' | 'on_demand';
  aiBudgetPerCycle: number;          // default: 15
  docsPerCycle: number;              // default: 20
  coverageThreshold: number;         // default: 80 (%)
  targetArea?: string;               // for 'targeted' mode
  targetObjectiveKey?: string;       // for 'targeted' mode
}

export interface WorkerCycleResult {
  runId: string;
  cycleNumber: number;
  phase: 'sense' | 'normalize' | 'evaluate' | 'conclude';

  // Métricas del ciclo
  docsNormalized: number;
  fosEvaluated: number;
  findingsCreated: number;
  findingsUpdated: number;
  conclusionsGenerated: number;
  aiCallsMade: number;
  durationMs: number;

  // Estado de convergencia
  coverageByArea: Record<string, number>;
  overallCoverage: number;
  pendingWorkItems: number;

  // Siguiente acción
  nextAction: 'continue' | 'wait' | 'pause' | 'complete';
  nextActionReason: string;
}

export async function runWorkerCycle(config: WorkerConfig): Promise<WorkerCycleResult>;
export async function pauseWorker(projectId: string, reason: string): Promise<void>;
export async function resumeWorker(projectId: string): Promise<void>;
export async function getWorkerStatus(projectId: string): Promise<WorkerRunStatus>;
```

---

## 4. Consistencia de la Cadena Agentic

### 4.1 El Problema de la Consistencia

En un sistema agentic, múltiples ciclos del Worker operan sobre los mismos datos a lo largo del tiempo. Los desafíos clave:

1. **Idempotencia**: Evaluar el mismo doc×FO dos veces no debe crear findings duplicados.
2. **Monotonía**: Los findings no deben "desaparecer" entre ciclos — solo pueden transicionar de estado.
3. **Causalidad**: Cada finding debe poder trazar su cadena completa: doc → facts → rule_execution → finding → conclusion.
4. **Consistencia eventual**: Cuando un documento cambia, todas las evaluaciones dependientes deben invalidarse y re-ejecutarse.

### 4.2 Invariantes del Sistema

```
INVARIANTE 1: Idempotencia de Evaluación
═══════════════════════════════════════════
Para un par (document_content_hash, objective_key):
  - Si dd_fo_document_status.status = 'analyzed'
    Y source_content_hash no ha cambiado
  → SKIP (no re-evaluar)

INVARIANTE 2: Trazabilidad Completa
═══════════════════════════════════════════
Todo dd_findings DEBE tener:
  - objective_id → dd_finding_objectives (qué se buscó)
  - rule_execution_id → dd_rule_executions (cómo se evaluó)
  - source_evidence → dd_finding_evidence → vdr_chunks (de dónde vino)

INVARIANTE 3: Monotonía de Findings
═══════════════════════════════════════════
Un finding solo puede:
  - Crearse (identified)
  - Transicionar forward en el lifecycle
  - Actualizarse en severity (via severity_modifiers)
  - NUNCA eliminarse (solo dismissed/resolved)

INVARIANTE 4: Invalidación en Cascada
═══════════════════════════════════════════
Cuando content_hash de un documento cambia:
  1. dd_document_facts.source_content_hash → mismatch → re-extract
  2. dd_fo_document_status → reset to 'pending' para todos los FOs
  3. dd_rule_executions con input_data_hash viejo → marked 'superseded'
  4. Findings existentes → mantienen estado pero se marcan 'needs_reeval'

INVARIANTE 5: Convergencia Medible
═══════════════════════════════════════════
coverage(area) = fos_evaluated / fos_applicable × 100
El Worker DEBE converger: coverage debe ser monótonamente creciente
(salvo nuevo doc que genera nuevo trabajo)
```

### 4.3 Diagrama de Trazabilidad End-to-End

```
VDR Document ──────────────────────────────────────────────────────
  │ (upload/update)
  │ content_hash: SHA-256
  ▼
dd_document_facts ─────────────────────────────────────────────────
  │ (NORMALIZE phase)
  │ source_content_hash → cache key
  │ parties, dates, amounts, clauses
  ▼
dd_fo_document_status ─────────────────────────────────────────────
  │ (SENSE phase: pending → EVALUATE phase: analyzing → analyzed)
  │ document_id × objective_id
  ▼
dd_rule_executions ────────────────────────────────────────────────
  │ (EVALUATE phase)
  │ objective_id, deal_context snapshot
  │ evaluation_results (per-criterion), severity_computed
  │ input_data_hash → idempotencia
  ▼
dd_findings ───────────────────────────────────────────────────────
  │ (EVALUATE phase: persist)
  │ objective_id, rule_execution_id
  │ severity, probability, timing, tier
  │ 10-state lifecycle
  ├──→ dd_finding_evidence (N:M → vdr_chunks)
  ├──→ dd_report_findings (N:M → dd_reports)
  └──→ dd_deal_risk_scores (scoring input)
  ▼
dd_area_conclusions ───────────────────────────────────────────────
  │ (CONCLUDE phase)
  │ conclusion_narrative, risk_score, coverage_pct
  │ recommendations[], patterns[]
  ▼
dd_reports + War Room ─────────────────────────────────────────────
  (CONCLUDE phase: output)
  Area reports, Red flags report, Executive summary
  Negotiation actions, Deal recommendation
```

### 4.4 Manejo de Conflictos y Re-evaluación

```typescript
// src/lib/worker/consistency.ts

/**
 * Cuando un documento cambia (content_hash diferente):
 * 1. Invalidar facts
 * 2. Resetear evaluaciones
 * 3. Marcar findings para re-evaluación
 * 4. NO borrar findings existentes
 */
export async function handleDocumentChange(
  documentId: string,
  oldHash: string,
  newHash: string
): Promise<InvalidationResult> {

  // 1. Mark dd_document_facts as stale
  await supabase.from('dd_document_facts')
    .update({ source_content_hash: 'STALE:' + oldHash })
    .eq('document_id', documentId);

  // 2. Reset all FO evaluations for this doc
  await supabase.from('dd_fo_document_status')
    .update({ status: 'pending', results: null })
    .eq('document_id', documentId)
    .in('status', ['analyzed', 'skipped']);

  // 3. Mark existing rule executions as superseded
  await supabase.from('dd_rule_executions')
    .update({ metadata: { ...metadata, superseded: true, superseded_at: now() } })
    .eq('document_id', documentId);

  // 4. Findings persist — they represent historical analysis
  // New cycle will either confirm or create new findings

  return { invalidated_facts: 1, reset_evaluations: n, superseded_executions: m };
}
```

---

## 5. Integración con el Sistema Existente

### 5.1 Coexistencia con Workflow Engine Actual

El Worker **no reemplaza** el Workflow Engine — lo complementa:

```
┌─────────────────────────────────────────────────────────────┐
│                  DUAL EXECUTION MODEL                        │
│                                                              │
│  ┌─────────────────────┐    ┌───────────────────────┐       │
│  │  WORKFLOW ENGINE     │    │   WORKER               │       │
│  │  (Human-triggered)   │    │   (Autonomous)         │       │
│  │                      │    │                        │       │
│  │  16 templates        │    │   54 FOs               │       │
│  │  6 DD phases         │    │   4 continuous phases  │       │
│  │  Harvey prompts      │    │   Rules + Harvey       │       │
│  │  → dd_findings       │    │   → dd_findings        │       │
│  │    (source: workflow) │    │     (source: worker)   │       │
│  └──────────┬───────────┘    └────────────┬──────────┘       │
│             │                              │                  │
│             └──────────┬───────────────────┘                  │
│                        ▼                                      │
│              ┌──────────────────┐                             │
│              │  UNIFIED FINDINGS │                             │
│              │  dd_findings      │                             │
│              │  (single source   │                             │
│              │   of truth)       │                             │
│              └──────────────────┘                             │
│                        │                                      │
│                        ▼                                      │
│              ┌──────────────────┐                             │
│              │  CONSUMERS        │                             │
│              │  Scoring, Reports,│                             │
│              │  War Room, Kanban │                             │
│              └──────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

**Reglas de coexistencia:**

| Aspecto | Workflow Engine | Worker |
|---------|---------------|--------|
| Trigger | Manual (user invokes) | Automático (cron + events) |
| Scope | 1 workflow, 1 phase | All FOs, all docs |
| AI model | Harvey (generic prompts) | Harvey (structured FO prompts) |
| Finding source | `source_type: 'workflow_execution'` | `source_type: 'worker_analysis'` |
| Dedup | `external_ref` pattern | `objective_id + document_id` unique |
| HITL | Per-phase (hitl_required flag) | Per-finding (severity-based) |
| Speed | Fast (single call) | Thorough (multi-criterion) |

### 5.2 API del Worker

```
── Worker Management ──────────────────────────────────────────

POST /api/worker/start
  Body: { project_id, mode, config? }
  → { run_id, status: 'sensing' }

GET  /api/worker/status?project_id=X
  → { run_id, status, phase, coverage, metrics, work_queue_size }

POST /api/worker/pause
  Body: { project_id, reason }
  → { success }

POST /api/worker/resume
  Body: { project_id }
  → { success, status }

── Worker Cron ────────────────────────────────────────────────

GET  /api/cron/worker-cycle
  (Protected by CRON_SECRET, runs every 5 min)
  → Executes one cycle for all active worker runs

── Coverage & Progress ────────────────────────────────────────

GET  /api/worker/coverage?project_id=X
  → { by_area: {...}, by_fo: {...}, overall, gaps[] }

GET  /api/worker/conclusions?project_id=X&area_code=CONT
  → { conclusion, findings[], recommendations[], coverage }
```

### 5.3 Feature Flags

```
DD_WORKER=true                    # Habilita el Worker autónomo
DD_WORKER_AUTO_START=true         # Auto-start cuando se crea proyecto
DD_WORKER_AI_BUDGET=15            # Llamadas Harvey por ciclo
DD_WORKER_COVERAGE_THRESHOLD=80   # % cobertura para trigger CONCLUDE
DD_WORKER_NORMALIZE=true          # Habilita fase NORMALIZE (dd_document_facts)
DD_WORKER_CONCLUDE=true           # Habilita fase CONCLUDE (area conclusions)
```

---

## 6. Gestión de Dependencias entre FOs

### 6.1 El Grafo de Dependencias

Algunos Finding Objectives tienen dependencias lógicas:

```
FO-MERC-001 (Escritura constitución)
  └──→ FO-MERC-002 (Estatutos vigentes)
        └──→ FO-MERC-003 (Órgano de administración)
              └──→ FO-MERC-004 (Poderes y delegaciones)

FO-CONT-001 (Contratos materiales identificados)
  ├──→ FO-CONT-002 (Cláusulas CoC)
  ├──→ FO-CONT-003 (Cláusulas terminación)
  └──→ FO-CONT-004 (Contratos partes vinculadas)

FO-LAB-001 (Plantilla y tipos contrato)
  └──→ FO-LAB-002 (Litigiosidad laboral)
        └──→ FO-LAB-003 (Plan de igualdad)
```

### 6.2 Modelo de Dependencias

```sql
-- Extensión de dd_finding_objectives
ALTER TABLE dd_finding_objectives
  ADD COLUMN depends_on TEXT[] DEFAULT '{}';
  -- Array de objective_keys que deben evaluarse primero

-- Ejemplo:
-- FO-MERC-002.depends_on = ['FO-MERC-001']
-- FO-CONT-002.depends_on = ['FO-CONT-001']
```

### 6.3 Resolución Topológica

```typescript
// src/lib/worker/dependency-resolver.ts

/**
 * Ordena FOs por dependencias (topological sort)
 * para garantizar evaluación en orden correcto
 */
export function resolveEvaluationOrder(
  applicableFOs: FindingObjective[]
): FindingObjective[][] {
  // Returns "waves" of FOs that can execute in parallel
  // Wave 0: FOs sin dependencias
  // Wave 1: FOs que dependen de Wave 0
  // Wave N: FOs que dependen de Wave N-1

  const waves: FindingObjective[][] = [];
  const resolved = new Set<string>();
  let remaining = [...applicableFOs];

  while (remaining.length > 0) {
    const wave = remaining.filter(fo =>
      fo.depends_on.every(dep => resolved.has(dep))
    );

    if (wave.length === 0) {
      // Circular dependency — log warning, add remaining as final wave
      waves.push(remaining);
      break;
    }

    waves.push(wave);
    wave.forEach(fo => resolved.add(fo.objective_key));
    remaining = remaining.filter(fo => !resolved.has(fo.objective_key));
  }

  return waves;
}
```

---

## 7. Mantenimiento Continuo

### 7.1 Ciclo de Vida del Worker por Proyecto

```
Proyecto creado
  │
  ├─ DD_WORKER_AUTO_START=true → Worker inicia automáticamente
  │
  ▼
FASE 1: Bootstrapping (primeras horas)
  ├─ Documentos empiezan a cargarse en VDR
  ├─ Worker SENSE detecta docs nuevos
  ├─ Worker NORMALIZE extrae facts iniciales
  ├─ Coverage: 0% → crece gradualmente
  └─ No se ejecuta CONCLUDE (insuficiente cobertura)

FASE 2: Análisis Activo (días 1-14)
  ├─ Bulk de documentos cargado
  ├─ Worker evalúa FOs incrementalmente
  ├─ Findings empiezan a generarse
  ├─ Coverage: 20% → 60% → 80%
  ├─ CONCLUDE empieza a generar conclusiones parciales
  └─ War Room se alimenta automáticamente

FASE 3: Convergencia (días 14-21)
  ├─ Documentos faltantes identificados (gaps)
  ├─ Team carga documentos faltantes
  ├─ Re-evaluaciones donde datos cambiaron
  ├─ Coverage: 80% → 95%+
  ├─ CONCLUDE genera conclusiones completas
  └─ Reports listos para revisión humana

FASE 4: Mantenimiento (ongoing)
  ├─ Worker en modo low-frequency (1 ciclo/hora)
  ├─ Detecta cambios en docs existentes
  ├─ Re-evalúa solo lo que cambió
  ├─ Actualiza conclusiones si severity cambia
  └─ Hasta que proyecto pasa a 'completed'
```

### 7.2 Alertas y Observabilidad del Worker

```typescript
// src/lib/worker/alerts.ts

interface WorkerAlert {
  type: 'stalled' | 'error_rate' | 'coverage_regression' | 'ai_budget_exceeded';
  severity: 'warning' | 'critical';
  projectId: string;
  message: string;
  metadata: Record<string, unknown>;
}

// Alertas automáticas:
// 1. Worker stalled: no heartbeat en 15 min → critical
// 2. Error rate > 20% en último ciclo → warning
// 3. Coverage bajó entre ciclos → warning
// 4. AI budget agotado antes de completar wave → warning
// 5. FO con > 3 intentos fallidos → warning
```

---

## 8. Diagrama Completo de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DD LEGAL PMO — WORKER ARCHITECTURE           │
│                                                                     │
│  ┌─────────────┐                                                    │
│  │    USER      │                                                    │
│  │  (Abogado,   │──── invoke workflow ──→ WORKFLOW ENGINE           │
│  │   PM, CLO)   │──── start worker ────→ WORKER CONTROLLER         │
│  └──────┬───────┘──── upload docs ─────→ VDR                       │
│         │                                                           │
│         │ view results                                              │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     PRESENTATION LAYER                       │   │
│  │  War Room · Kanban · Reports · Coverage Dashboard            │   │
│  └─────────────────────────┬───────────────────────────────────┘   │
│                            │                                        │
│  ══════════════════════════╪════════════════════════════════════    │
│                            │                                        │
│  ┌─────────────────────────┴───────────────────────────────────┐   │
│  │                     WORKER CONTROLLER                        │   │
│  │              (Orchestrates 4 continuous phases)               │   │
│  │                                                              │   │
│  │  ┌──────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   │   │
│  │  │SENSE │──→│ NORMALIZE │──→│ EVALUATE │──→│ CONCLUDE │   │   │
│  │  └──┬───┘   └─────┬─────┘   └─────┬────┘   └─────┬────┘   │   │
│  │     │              │               │              │         │   │
│  └─────┼──────────────┼───────────────┼──────────────┼─────────┘   │
│        │              │               │              │              │
│  ══════╪══════════════╪═══════════════╪══════════════╪══════════    │
│        │              │               │              │              │
│  ┌─────┴──────────────┴───────────────┴──────────────┴─────────┐   │
│  │                     DATA LAYER (Supabase)                    │   │
│  │                                                              │   │
│  │  Existing:                    New:                           │   │
│  │  ├─ vdr_documents             ├─ dd_document_facts          │   │
│  │  ├─ vdr_chunks                ├─ dd_area_conclusions        │   │
│  │  ├─ dd_finding_objectives     ├─ dd_worker_runs             │   │
│  │  ├─ dd_findings               └─ dd_finding_objectives      │   │
│  │  ├─ dd_rule_executions            .depends_on (column)      │   │
│  │  ├─ dd_fo_document_status                                   │   │
│  │  ├─ dd_scoring_config                                       │   │
│  │  └─ dd_reports                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│  ══════════════════════════╪════════════════════════════════════    │
│                            │                                        │
│  ┌─────────────────────────┴───────────────────────────────────┐   │
│  │                     AI LAYER                                 │   │
│  │                                                              │   │
│  │  Harvey Gateway ─── structured FO prompts ──→ evaluation     │   │
│  │       │                                                      │   │
│  │       ├─ Rate limits: completion=5, vault=3 concurrent       │   │
│  │       ├─ Circuit breaker: 30% threshold, 60s cooldown        │   │
│  │       ├─ Retry-After: exponential backoff on 429             │   │
│  │       └─ Budget: configurable per worker cycle               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Plan de Implementación

### Fase F.1: Document Facts Pipeline (2 semanas)

| Entregable | Descripción |
|------------|-------------|
| Migration `dd_document_facts` | Tabla + índices + RLS |
| `fact-extractor.ts` | Servicio de extracción con Harvey |
| `document-classifier.ts` | Clasificación automática doc → type/area |
| Prompt template de extracción | Structured prompt para Harvey |
| Integration con VDR pipeline | Post-chunking hook |
| Tests | E2E extraction + classification accuracy |

### Fase F.2: Worker Controller (2 semanas)

| Entregable | Descripción |
|------------|-------------|
| Migration `dd_worker_runs` | Tabla + índices + RLS |
| `worker-controller.ts` | State machine + cycle orchestration |
| `sense-phase.ts` | VDR watcher + coverage analyzer + priority calculator |
| `normalize-phase.ts` | Orchestration de fact-extractor por batch |
| API routes | `/api/worker/start|status|pause|resume` |
| Cron route | `/api/cron/worker-cycle` (5 min) |
| Feature flags | DD_WORKER, DD_WORKER_AUTO_START |
| Tests | State machine transitions, idempotencia |

### Fase F.3: Enhanced Evaluation (2 semanas)

| Entregable | Descripción |
|------------|-------------|
| `rule-evaluator.ts` enhanced | Implementar todos los eval_types |
| `dependency-resolver.ts` | Topological sort de FOs |
| `dd_finding_objectives.depends_on` | Migration + seed update |
| `evaluate-phase.ts` | Orchestration con dependencias + facts |
| Structured prompts por eval_type | Templates Harvey específicos |
| Tests | Cross-FO dependencies, severity modifiers |

### Fase F.4: Conclusions Engine (2 semanas)

| Entregable | Descripción |
|------------|-------------|
| Migration `dd_area_conclusions` | Tabla + índices + RLS |
| `conclude-phase.ts` | Area synthesis + red flag consolidation |
| `conclusion-generator.ts` | Harvey-assisted narrative generation |
| Deal Risk Score v2 | Read from dd_scoring_config |
| Report integration | Auto-generate area reports from conclusions |
| War Room auto-feed | Push conclusions to War Room dashboard |
| Tests | Convergence detection, coverage thresholds |

### Fase F.5: Observabilidad y UI (1 semana)

| Entregable | Descripción |
|------------|-------------|
| Worker Dashboard UI | Coverage map, progress, alerts |
| Coverage visualization | Per-area, per-FO coverage chart |
| Alert system | Stalled, error rate, regression alerts |
| Worker logs | Structured logging con correlation IDs |

---

## 10. Métricas de Éxito

| Métrica | Target | Medición |
|---------|--------|----------|
| Coverage convergence | 80% en ≤ 72h desde bulk upload | dd_worker_runs.coverage_snapshot |
| Finding quality | < 15% HITL correction rate | dd_hitl_decisions vs dd_findings |
| Extraction accuracy | > 85% clause detection F1 | Manual audit sample |
| Idempotencia | 0 findings duplicados | COUNT DISTINCT vs COUNT en dd_findings |
| Trazabilidad | 100% findings con rule_execution_id | NULL check en dd_findings |
| Convergence | Coverage monótonamente creciente | dd_worker_runs time series |
| Rate limit compliance | 0 Harvey 429s no gestionados | dd_gateway_telemetry |
| Worker availability | > 99% uptime | Heartbeat monitoring |

---

## Apéndice A: Glosario

| Término | Definición |
|---------|-----------|
| **Finding Objective (FO)** | Especificación declarativa de qué constituye un hallazgo. No es un hallazgo — es la definición de qué buscar. |
| **Finding** | Hallazgo concreto identificado al evaluar un FO contra datos reales. |
| **Fact** | Dato estructurado extraído de un documento (party, date, amount, clause). |
| **Rule Execution** | Registro inmutable de una evaluación FO+documento con resultados. |
| **Area Conclusion** | Síntesis de todos los findings de un área en narrativa + recomendaciones. |
| **Coverage** | % de FOs aplicables que han sido evaluados con datos suficientes. |
| **Worker Cycle** | Una ejecución completa de las 4 fases (SENSE → NORMALIZE → EVALUATE → CONCLUDE). |
| **Wave** | Grupo de FOs que pueden evaluarse en paralelo (sin dependencias entre sí). |
| **Gap** | FO aplicable que no puede evaluarse por falta de documentación. |
| **Convergence** | Punto donde coverage ≥ threshold y no hay trabajo pendiente. |

## Apéndice B: Compatibilidad con Tablas Existentes

| Tabla Existente | Cambio Necesario | Impacto |
|----------------|-----------------|---------|
| `dd_findings` | Añadir `source_type: 'worker_analysis'` al CHECK constraint | Migration |
| `dd_finding_objectives` | Añadir columna `depends_on TEXT[] DEFAULT '{}'` | Migration |
| `dd_fo_document_status` | Sin cambios (ya tiene el modelo correcto) | Ninguno |
| `dd_rule_executions` | Añadir columna `superseded BOOLEAN DEFAULT false` | Migration |
| `dd_scoring_config` | Sin cambios (ya parametrizable) | Ninguno |
| `vdr_documents` | Sin cambios (content_hash ya existe) | Ninguno |

## Apéndice C: Relación con IMPLEMENTATION_PROMPT_FASE_E

Este documento extiende las Fases E.1-E.4 (Finding Objectives) con las Fases F.1-F.5 (Worker Architecture). Las fases F asumen que E.1-E.2.5 están completadas (✅) y que E.3-E.4 se completan como prerequisito.

```
TIMELINE
════════════════════════════════════════════
E.1-E.2.5  ✅ Completado (FO Catalog + Iterative Analysis)
E.3        ⬜ Validar consumidores con FINDINGS_FIRST=on
E.4        ⬜ Deprecar legacy JSONB paths
F.1        ⬜ Document Facts Pipeline
F.2        ⬜ Worker Controller
F.3        ⬜ Enhanced Evaluation
F.4        ⬜ Conclusions Engine
F.5        ⬜ Observabilidad y UI
```
