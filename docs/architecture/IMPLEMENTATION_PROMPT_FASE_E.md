# Prompt de Implementacion: Finding-Centric Architecture v2.0 — Fases E.1-E.4

## Contexto

Lee `CLAUDE.md` para entender el estado actual del sistema. Lee `docs/architecture/finding-centric-v2-architecture.md` para la arquitectura objetivo.

**IMPORTANTE**: Lee tambien:
- `docs/architecture/LEGAL_CATALOG_REQUIREMENT.md` — requerimiento estructurado del catalogo legal
- `docs/architecture/LEGAL_CATALOG_SEED.sql` — 54 INSERTs listos para ejecutar en dd_finding_objectives

El sistema DD Legal PMO tiene una Finding-Centric Architecture (Fases A-D completadas). Ahora vamos a implementar el motor de reglas declarativo con catalogo de Finding Objectives. El equipo legal ha entregado el catalogo completo v1.0 con 54 FOs ejecutables.

## Estado actual completado

- Fase A: Schema (dd_findings, dd_finding_evidence, dd_report_findings) — 8 migraciones
- Fase B: Dual-Write (findings-service.ts, engine.ts, instance-runner.ts)
- Fase C: Migrate Reads (6 consumers con FINDINGS_FIRST flag)
- Fase D: Backfill (21 findings from contingencies + workflow metadata)
- Feature flag: `FINDINGS_FIRST` (OFF en prod, pendiente activacion)

## Fases a implementar

### Fase E.1: Finding Objectives + Scoring Config (MVP)

1. **Migracion: `dd_finding_objectives`**
   - Ver schema en `docs/architecture/finding-centric-v2-architecture.md` seccion 3.5
   - RLS: mismas politicas que dd_findings (project-scoped via area_code)
   - Seed: **54 FOs completos** en `docs/architecture/LEGAL_CATALOG_SEED.sql`
   - Distribucion: MERC: 8, CONT: 10, FISC: 8, LAB: 8, PI: 6, LIT: 8, ADM: 6
   - Ver `docs/architecture/LEGAL_CATALOG_REQUIREMENT.md` para detalles de estructura JSONB

2. **Migracion: `dd_scoring_config`**
   - Ver schema en seccion 7.1 del doc de arquitectura
   - Seed: config "default" con pesos actuales hardcodeados en deal-risk-score
   - Migrar `src/app/api/scoring/deal-risk/route.ts` para leer pesos de BD

3. **Añadir `objective_id` a dd_findings**
   - FK nullable a dd_finding_objectives(id)
   - No rompe nada existente (nullable)

4. **API Routes:**
   - `GET /api/finding-objectives?area_code=...&deal_type=...` — lista FOs aplicables
   - `GET /api/finding-objectives/[id]` — detalle de un FO
   - `GET /api/scoring/config?deal_type=...&jurisdiction=...` — config de scoring

5. **Feature flag:** `FINDING_OBJECTIVES=true|false` (default false)

### Fase E.2: Motor de Reglas + Audit Trail

1. **Migracion: `dd_rule_executions`**
   - Ver schema en seccion 4.6 del doc de arquitectura
   - Audit trail completo de cada ejecucion de regla

2. **`src/lib/findings/objective-resolver.ts`**
   - `resolveApplicableObjectives(projectId, dealContext)` → FindingObjective[]
   - Evalua `applies_when` JSON rules contra contexto del deal
   - Retorna FOs ordenados por prioridad

3. **`src/lib/findings/rule-evaluator.ts`**
   - `evaluateObjective(fo, facts, dealContext)` → RuleEvaluationResult
   - Criterios booleanos: evaluacion directa
   - Criterios semanticos: genera prompt estructurado para Harvey
   - Severity modifiers: decision table evaluation
   - Registra dd_rule_executions con audit trail

4. **Modificar `engine.ts`**
   - Nuevo path cuando `FINDING_OBJECTIVES=true`:
     - Resolver FOs aplicables
     - Verificar datos disponibles
     - Ejecutar rule-evaluator por FO
     - Generar findings con objective_id + rule_execution_id

5. **Modificar `prompt-builder.ts`**
   - `buildObjectivePrompt(fo, facts)` genera prompt estructurado por FO
   - Incluye criterios de evaluacion, documentos, ejemplos, formato de respuesta

### Fase E.3: Data Pipeline (Document Facts)

1. **Migracion: `dd_document_facts`**
   - Ver schema en seccion 5.3 del doc de arquitectura
   - Hechos estructurados extraidos de documentos VDR

2. **`src/lib/vdr/fact-extractor.ts`**
   - `extractDocumentFacts(documentId)` → DocumentFact
   - Usa Harvey para extraer: partes, fechas, importes, clausulas
   - Almacena en dd_document_facts con confidence score

3. **`src/lib/vdr/document-classifier.ts`**
   - `classifyDocument(documentId)` → { type, subtype, area_codes, jurisdiction }
   - Auto-clasificacion por tipo de documento
   - Actualiza vdr_documents.document_metadata

4. **Integrar con pipeline VDR existente**
   - Post-chunking: trigger fact extraction
   - Content-hash aware: skip si ya extraido y no cambio

### Fase E.4: Reporting + Coverage

1. **Añadir `required_objectives` a report templates**
   - Modificar templates.ts para incluir FOs requeridos por seccion
   - `src/lib/reporting/templates.ts`

2. **Coverage analysis en report-generator.ts**
   - Para cada seccion: FOs requeridos vs. FOs evaluados vs. FOs con finding
   - Cobertura < 80% → warning en informe
   - Cobertura < 50% → seccion marcada "incompleta"

3. **Dashboard de cobertura en War Room**
   - `GET /api/war-room/[project_id]/coverage` → { by_area, by_priority, overall }

## Patron de trabajo

- Feature flag `FINDING_OBJECTIVES` (ortogonal a `FINDINGS_FIRST`)
- Cada fase: migracion → servicio → API → tests
- TSC 0 errors al final de cada fase
- Smoke tests SQL para validar migraciones
- Actualizar CLAUDE.md al completar cada fase
- Migration naming: `202602280012` en adelante
- Supabase project: `mxanelzxyaklvuypuafa`

## Orden de ejecucion

```
E.1 (Finding Objectives + Scoring Config) — independiente, sin prerequisitos
    ↓
E.2 (Motor de Reglas) — necesita E.1 (dd_finding_objectives)
    ↓
E.3 (Data Pipeline) — necesita E.2 (rule-evaluator consume facts)
    ↓
E.4 (Reporting + Coverage) — necesita E.1 + E.2
```

E.1 y E.4 son parcialmente paralelizables. E.2 y E.3 son secuenciales.

## Comando para empezar

```bash
# Leer la arquitectura completa
cat docs/architecture/finding-centric-v2-architecture.md

# Verificar estado actual
npx tsc --noEmit 2>&1 | tail -5

# Empezar con E.1
```
