# Finding-Centric Architecture v2.0 — Diseño Iterativo + Incremental

**Fecha:** 24 febrero 2026
**Estado:** Aprobado
**Prioridad:** Auditabilidad y compliance
**Timeline:** 2-3 semanas

---

## 1. Resumen Ejecutivo

Evolución del sistema DD Legal PMO para implementar un **motor de reglas declarativo** con:

1. **Catálogo de Finding Objectives (54 FOs)** — Define QUÉ debe buscarse
2. **Motor de Reglas + Audit Trail** — Define CÓMO evaluar y registra cada ejecución
3. **Flujo Iterativo por Documento** — Análisis incremental N docs × M FOs
4. **Data Pipeline** — Extracción de hechos estructurados
5. **Coverage Analysis** — Métricas de cobertura por FO/skill/fase

---

## 2. Arquitectura

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE ORQUESTACIÓN                              │
│  Workflow (16 templates) → Fase (6) → Skill (63) → FO (54)               │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────┐
│                     CAPA DE CATÁLOGO (Finding Objectives)                │
│  dd_finding_objectives: 54 FOs, 7 áreas, applies_when, evaluation_criteria│
│  Cada FO define QUÉ buscar + criterios + ejemplos + severidad esperada   │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────┐
│                     CAPA DE EJECUCIÓN (Iterativa)                        │
│  dd_fo_document_status: tracking N documentos × M FOs                    │
│  Worker procesa batch pending → Harvey → dd_rule_executions → dd_findings│
│  Cache L1 (content_hash) evita re-análisis innecesario                   │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────┐
│                     CAPA DE AUDIT TRAIL                                  │
│  dd_rule_executions: cada evaluación FO+doc con input_hash, results,     │
│  severity_computed, duration_ms, ai_calls_made                           │
│  Trazabilidad completa: documento → FO → ejecución → finding → report    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Schema de Base de Datos

### 3.1 Tablas Nuevas

#### dd_finding_objectives (Catálogo)

```sql
CREATE TABLE dd_finding_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_key VARCHAR(50) UNIQUE NOT NULL,  -- "FO-CONT-COC-001"
  version VARCHAR(10) NOT NULL DEFAULT '1.0',
  title TEXT NOT NULL,
  description TEXT,

  -- Clasificacion
  area_code VARCHAR(10) NOT NULL REFERENCES dd_areas(code),
  skill_key VARCHAR(100) REFERENCES dd_skills_catalog(skill_key),
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
CREATE INDEX idx_fo_skill ON dd_finding_objectives(skill_key) WHERE is_active;
CREATE INDEX idx_fo_deal_types ON dd_finding_objectives USING GIN(deal_types);
CREATE INDEX idx_fo_jurisdictions ON dd_finding_objectives USING GIN(jurisdictions);
```

#### dd_rule_executions (Audit Trail)

```sql
CREATE TABLE dd_rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id),
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID REFERENCES vdr_documents(id),
  objective_version VARCHAR(10) NOT NULL,

  -- Contexto
  deal_context JSONB NOT NULL,
  input_data_hash VARCHAR(64) NOT NULL,

  -- Resultado
  applicability_result BOOLEAN NOT NULL,
  applicability_reason TEXT,
  evaluation_results JSONB,
  severity_computed VARCHAR(20),
  severity_modifiers_applied JSONB,
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),

  -- Ejecucion
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by VARCHAR(100),
  execution_duration_ms INTEGER,
  ai_calls_made INTEGER DEFAULT 0,

  -- Audit
  rule_source_hash VARCHAR(64),

  CONSTRAINT chk_severity CHECK (severity_computed IS NULL OR severity_computed IN ('critical','high','medium','low','informational'))
);

CREATE INDEX idx_re_project ON dd_rule_executions(project_id);
CREATE INDEX idx_re_objective ON dd_rule_executions(objective_id);
CREATE INDEX idx_re_document ON dd_rule_executions(document_id);
CREATE INDEX idx_re_finding ON dd_rule_executions(finding_id) WHERE finding_id IS NOT NULL;
```

#### dd_fo_document_status (Tracking Iterativo)

```sql
CREATE TABLE dd_fo_document_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id),
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID NOT NULL REFERENCES vdr_documents(id),

  -- Cache
  content_hash_at_analysis VARCHAR(64),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Resultado
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),
  rule_execution_id UUID REFERENCES dd_rule_executions(id),

  -- Timestamps
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, objective_id, document_id),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'analyzing', 'analyzed', 'skipped', 'error'))
);

CREATE INDEX idx_fods_project ON dd_fo_document_status(project_id);
CREATE INDEX idx_fods_objective ON dd_fo_document_status(objective_id);
CREATE INDEX idx_fods_pending ON dd_fo_document_status(project_id, status) WHERE status = 'pending';
```

#### dd_scoring_config (Pesos Parametrizables)

```sql
CREATE TABLE dd_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),

  severity_weights JSONB NOT NULL DEFAULT '{"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.15, "informational": 0.0}',
  probability_weights JSONB NOT NULL DEFAULT '{"certain": 1.0, "alta": 0.9, "probable": 0.75, "media": 0.5, "baja": 0.2, "remote": 0.15}',
  timing_multipliers JSONB NOT NULL DEFAULT '{"blocking": 1.5, "pre_closing": 1.2, "post_closing": 1.0, "ongoing": 0.8}',
  area_weights JSONB NOT NULL DEFAULT '{"MERC": 1.0, "CONT": 1.2, "LAB": 0.8, "FISC": 1.0, "PI": 0.7, "LIT": 1.1, "GENERAL": 0.5}',
  recommendation_thresholds JSONB NOT NULL DEFAULT '{"go_below": 30, "no_go_above": 65}',
  deal_breaker_rules JSONB NOT NULL DEFAULT '{"severity": "critical", "probability_min": "alta", "timing": "blocking"}',
  tier_rules JSONB NOT NULL DEFAULT '{}',

  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### dd_document_facts (Hechos Estructurados)

```sql
CREATE TABLE dd_document_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id),
  project_id UUID NOT NULL REFERENCES dd_projects(id),

  -- Clasificacion
  document_type VARCHAR(50),
  document_subtype VARCHAR(50),
  area_codes TEXT[],
  jurisdiction VARCHAR(10),
  language VARCHAR(5),

  -- Partes
  parties JSONB,

  -- Fechas
  effective_date DATE,
  expiration_date DATE,
  signing_date DATE,

  -- Importes
  amounts JSONB,
  total_value NUMERIC,
  total_value_currency VARCHAR(3),

  -- Clausulas extraidas
  clauses JSONB,

  -- Metadata de extraccion
  extraction_method VARCHAR(20),
  extraction_confidence NUMERIC(3,2),
  extracted_at TIMESTAMPTZ DEFAULT now(),
  source_content_hash VARCHAR(64),

  CONSTRAINT chk_confidence CHECK (extraction_confidence BETWEEN 0 AND 1)
);

CREATE INDEX idx_df_project ON dd_document_facts(project_id);
CREATE INDEX idx_df_document ON dd_document_facts(document_id);
CREATE INDEX idx_df_type ON dd_document_facts(document_type);
CREATE INDEX idx_df_clauses ON dd_document_facts USING GIN(clauses);
```

### 3.2 Modificaciones a Tablas Existentes

```sql
-- Añadir FKs a dd_findings
ALTER TABLE dd_findings ADD COLUMN objective_id UUID REFERENCES dd_finding_objectives(id);
ALTER TABLE dd_findings ADD COLUMN rule_execution_id UUID REFERENCES dd_rule_executions(id);

CREATE INDEX idx_findings_objective ON dd_findings(objective_id) WHERE objective_id IS NOT NULL;
```

---

## 4. Flujo Iterativo por Documento

### 4.1 Niveles de Ejecución

```
NIVEL 1: WORKFLOW → FASE → SKILL (orquestación existente)
    │
    ▼
NIVEL 2: SKILL → FINDING OBJECTIVES
    Por cada skill de la fase:
      1. Cargar FOs asociados (dd_finding_objectives.skill_key)
      2. Filtrar por applies_when (deal_type, jurisdiction)
      3. Por cada FO aplicable → NIVEL 3
    │
    ▼
NIVEL 3: FO → DOCUMENTOS (iterativo + incremental)
    Para FO-XXX:
      1. Obtener docs relevantes (FO.data_required.document_type)
      2. Filtrar docs ya procesados (dd_fo_document_status.status = 'analyzed')
      3. Filtrar docs sin cambios (content_hash match)
      4. Por cada doc pendiente:
         a. Construir prompt estructurado (FO + doc chunks)
         b. Llamar Harvey
         c. Crear dd_rule_executions
         d. Si finding → crear dd_findings
         e. Actualizar dd_fo_document_status
      5. Verificar cobertura del FO
```

### 4.2 Flujo Incremental (Documento Nuevo)

```
Documento sube al VDR
       │
       ▼
[1. COMPUTE content_hash]
       │
       ▼
[2. CLASIFICAR documento] (document_type, area_codes)
       │
       ▼
[3. RESOLVER FOs aplicables al documento]
       │
       ▼
[4. CREAR registros pending en dd_fo_document_status]
       │
       ▼
[5. TRIGGER análisis async (worker/cron)]
```

### 4.3 Triggers de Re-análisis

```sql
-- Trigger: documento actualizado → re-analizar
CREATE OR REPLACE FUNCTION trigger_fo_reanalysis_on_doc_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
    UPDATE dd_fo_document_status
    SET status = 'pending',
        content_hash_at_analysis = NULL,
        analyzed_at = NULL
    WHERE document_id = NEW.id
      AND status = 'analyzed'
      AND content_hash_at_analysis != NEW.content_hash;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vdr_doc_content_change
AFTER UPDATE OF content_hash ON vdr_documents
FOR EACH ROW EXECUTE FUNCTION trigger_fo_reanalysis_on_doc_update();

-- Trigger: nuevo FO → crear pending para docs existentes
CREATE OR REPLACE FUNCTION trigger_fo_docs_on_new_objective()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dd_fo_document_status (project_id, objective_id, document_id, status)
  SELECT DISTINCT
    vd.project_id,
    NEW.id,
    vd.id,
    'pending'
  FROM vdr_documents vd
  WHERE vd.project_id IN (SELECT id FROM dd_projects WHERE status = 'active')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.data_required) dr
      WHERE vd.document_type = dr->>'document_type'
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_new_finding_objective
AFTER INSERT ON dd_finding_objectives
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION trigger_fo_docs_on_new_objective();
```

---

## 5. Worker de Análisis

### 5.1 Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  VERCEL CRON (cada 5 min) o API TRIGGER                         │
│  /api/cron/fo-analysis                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  fo-analysis-worker.ts                                          │
│                                                                 │
│  1. SELECT batch WHERE status='pending' LIMIT 10                │
│  2. Por cada item:                                              │
│     a. UPDATE status = 'analyzing'                              │
│     b. Verificar content_hash (skip si no cambió)               │
│     c. buildObjectivePrompt(fo, document_chunks)                │
│     d. Harvey Gateway completion                                │
│     e. Crear dd_rule_executions                                 │
│     f. Si finding → persistFindings() con objective_id          │
│     g. UPDATE status = 'analyzed'                               │
│  3. Emitir eventos de progreso                                  │
│  4. Respetar rate limits (5 rpm completion)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Eventos Emitidos

```typescript
type FOAnalysisEvent =
  | { type: 'fo_document_analyzed'; project_id: string; objective_id: string; document_id: string; finding_generated: boolean }
  | { type: 'fo_completed'; project_id: string; objective_id: string; coverage_pct: 100 }
  | { type: 'skill_completed'; project_id: string; skill_key: string; coverage_pct: 100 }
  | { type: 'phase_coverage_updated'; project_id: string; phase: string; coverage_pct: number };
```

---

## 6. Feature Flags

| Flag | Default | Efecto |
|------|---------|--------|
| `FINDING_OBJECTIVES` | false | Activa generación FO-driven |
| `FINDINGS_FIRST` | false | Lecturas desde dd_findings (ya existe) |

**Matriz de compatibilidad:**

| FINDINGS_FIRST | FINDING_OBJECTIVES | Comportamiento |
|:-:|:-:|---|
| OFF | OFF | v1.0 actual (legacy reads, Harvey libre) |
| ON | OFF | v1.5 actual (dd_findings reads, Harvey libre) |
| **ON** | **ON** | **v2.0 target** (dd_findings reads, FO-driven) |
| OFF | ON | Bloqueado — error en startup |

---

## 7. Archivos Nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/lib/findings/objective-resolver.ts` | Resuelve FOs por skill/documento |
| `src/lib/findings/rule-evaluator.ts` | Evalúa criterios, genera audit trail |
| `src/lib/findings/fo-analysis-worker.ts` | Worker iterativo |
| `src/lib/findings/coverage-tracker.ts` | Calcula % cobertura |
| `src/lib/vdr/fact-extractor.ts` | Extrae hechos de documentos |
| `src/lib/vdr/document-classifier.ts` | Clasifica documentos automáticamente |
| `src/app/api/cron/fo-analysis/route.ts` | Cron cada 5 min |
| `src/app/api/fo/analyze/route.ts` | Trigger manual |
| `src/app/api/fo/coverage/route.ts` | GET cobertura |
| `src/app/api/finding-objectives/route.ts` | CRUD FOs |

---

## 8. Fases de Implementación

### E.1: Finding Objectives + Scoring Config
- Migration: dd_finding_objectives + RLS
- Migration: dd_scoring_config
- Seed: 54 FOs (LEGAL_CATALOG_SEED.sql)
- Migration: objective_id FK en dd_findings
- APIs: /api/finding-objectives, /api/scoring/config

### E.2: Motor de Reglas + Audit Trail
- Migration: dd_rule_executions + RLS
- objective-resolver.ts
- rule-evaluator.ts
- Modificar engine.ts con path FO-driven
- Modificar prompt-builder.ts con buildObjectivePrompt()

### E.2.5: Flujo Iterativo + Incremental (NUEVO)
- Migration: dd_fo_document_status + triggers
- fo-analysis-worker.ts
- /api/cron/fo-analysis
- /api/fo/analyze, /api/fo/coverage

### E.3: Data Pipeline (Document Facts)
- Migration: dd_document_facts
- fact-extractor.ts
- document-classifier.ts
- Integrar con pipeline VDR

### E.4: Reporting + Coverage
- required_objectives en templates
- Coverage analysis en report-generator.ts
- Dashboard coverage en War Room

---

## 9. Catálogo de Finding Objectives (54 FOs)

| Área | FOs | Rango |
|------|-----|-------|
| MERC | 8 | FO-MERC-001 a FO-MERC-008 |
| CONT | 10 | FO-CONT-001 a FO-CONT-010 |
| FISC | 8 | FO-FISC-001 a FO-FISC-008 |
| LAB | 8 | FO-LAB-001 a FO-LAB-008 |
| PI | 6 | FO-PI-001 a FO-PI-006 |
| LIT | 8 | FO-LIT-001 a FO-LIT-008 |
| ADM | 6 | FO-ADM-001 a FO-ADM-006 |

**Seed:** `docs/architecture/LEGAL_CATALOG_SEED.sql`

---

## 10. Decisiones de Diseño

1. **FOs asociados a Skills** — Cada FO tiene `skill_key` FK, no directamente a fase
2. **Tracking por documento × FO** — `dd_fo_document_status` con UNIQUE constraint
3. **Cache L1 integrado** — Usa `content_hash` existente en vdr_documents
4. **Worker async** — Cron cada 5 min respetando rate limits Harvey
5. **Triggers automáticos** — Re-análisis en doc update, pending en nuevo FO
6. **Audit trail completo** — dd_rule_executions con input_hash, results, duration

---

*Documento aprobado el 24 febrero 2026.*
