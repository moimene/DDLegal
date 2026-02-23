# Workflow Spec v1 — Plan de Evolucion DD Legal PMO

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convertir el Workflow Engine actual (6 workflows hardcoded) en un framework escalable por plantillas versionadas, alineado a las 6 fases DD (obtencion > gestion > analisis > valoracion > informe > propuesta_transaccional), con integracion completa Kanban/War Room/Reports y sin cambios de codigo por cada nuevo flujo. **16 workflows definidos en catalogo YAML v1.**

**Architecture:** Expand/contract sobre S3. Nuevas tablas `dd_workflow_templates` + `dd_workflow_template_versions` + `dd_workflow_instances` conviven con `WORKFLOW_DEFINITIONS` en constants.ts. Feature flag `WORKFLOW_TEMPLATES_V1` vs legacy. Las 6 fases DD se mapean a estados Kanban. Cada template declara inputs, skills, artefactos y DoD por fase. Analysis Points (APs) son la unidad minima instanciable — cada AP genera una tarea Kanban con 5 salidas normalizadas.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS + pgvector), TypeScript, Playwright E2E, Harvey AI Gateway (circuit breaker + Retry-After), Zustand

---

## Estado de Ejecucion

### HORIZONTE 1: COMPLETADO (12 commits)

Todos los tasks del Horizonte 1 han sido implementados y verificados (`tsc --noEmit` clean, `next build` clean).

| Commit | Descripcion | Slot |
|--------|-------------|------|
| `89bf7f5` | DB: workflow templates, versions, instances, negotiation actions tables | A.1 |
| `0af15d9` | DB: seed 6 MVP workflows como templates versionadas (5 fases) | A.2 |
| `6f11f55` | DB: expand phase enum a 6 fases (informe + propuesta_transaccional) | A.3 |
| `ef91b5e` | DB: seed catalogo expandido 16 workflows YAML v1 (766 lineas) | A.4 |
| `3956ae3` | TS: tipos para templates, versions, instances, phases | B.1 |
| `b382984` | TS: template loader con cache en memoria (5-min TTL) | B.2 |
| `d46f2a5` | TS: workflow instantiation engine | B.3 |
| `abcc893` | TS: dual-run engine con feature flag | B.4 |
| `a87de16` | TS: phase advancement engine con ordering template-aware | B.5 |
| `5775cf5` | API: 5 routes (templates, instantiate, instances, phase, negotiation-actions) | C.1-C.5 |
| `2310c81` | Gateway: Retry-After parsing + circuit breaker pattern | D.1-D.2 |
| `7445614` | E2E: tests para catalogo, auth, gateway circuit breaker | F.1-F.5 |

### Migraciones aplicadas a Supabase (proyecto `mxanelzxyaklvuypuafa`)

| # | Migracion | Estado |
|---|-----------|--------|
| 1 | `202602270002_workflow_templates.sql` — 5 tablas + enum + RLS | APPLIED |
| 2 | `202602270003_seed_workflow_templates.sql` — 6 MVP seeds (v1) | APPLIED |
| 3 | `202602270004_expand_workflow_phases.sql` — enum +2 (informe, propuesta_transaccional) | APPLIED |
| 4 | `202602270005_expanded_workflow_catalog.sql` — 16 templates YAML v1 | APPLIED |

### Catalogo de Workflows v1 (16 templates)

| WF | Key | Nombre | Areas | Categoria | HITL | Version | Estado |
|----|-----|--------|-------|-----------|------|---------|--------|
| WF-01 | `arranque_dd` | Arranque DD + Backlog | GENERAL | transversal | No | v2 (6 fases) | Published |
| WF-02 | `data_room_gap` | VDR + Gap List | GENERAL | transversal | No | v2 (6 fases) | Published |
| WF-03 | `societario` | Societario | MERC | area | No | v2 (6 fases) | Published |
| WF-04 | `contratos_materiales` | Contratos Materiales | CONT | area | **Si** | v2 (6 fases) | Published |
| WF-05 | `ip_titularidad` | IP Titularidad/Licencias | PI | area | No | v2 (6 fases) | Published |
| WF-06 | `laboral_fiscal` | Laboral & Fiscal | LAB, FISC | area_multi | **Si** | v2 (6 fases) | Published |
| WF-07 | `inmobiliario` | Inmobiliario | INM | area | **Si** | v1 | Planned |
| WF-08 | `litigios` | Litigios | LIT | area | **Si** | v1 | Planned |
| WF-09 | `regulatorio` | Regulatorio | REG | area | No | v1 | Planned |
| WF-10 | `medioambiental` | Medioambiental | ENV | area | No | v1 | Planned |
| WF-11 | `proteccion_datos` | Proteccion de Datos | DATA | area | No | v1 | Planned |
| WF-12 | `competencia` | Competencia | COMP | area | No | v1 | Planned |
| WF-13 | `consolidacion_contingencias` | Consolidacion Contingencias | GENERAL | synthesis | No | v1 | Published |
| WF-14 | `red_flag_report` | Red Flag Report | GENERAL | deliverable | No | v1 | Published |
| WF-15 | `spa_mapping` | SPA Mapping | GENERAL | negotiation | No | v1 | Published |
| WF-16 | `informe_final` | Informe Final DD | GENERAL | deliverable | No | v1 | Published |

### 6 Fases DD (expandidas de 5 a 6)

```
obtencion → gestion → analisis → valoracion → informe → propuesta_transaccional
```

- **obtencion**: Recopilar informacion/docs del VDR
- **gestion**: Organizar, clasificar, gap analysis
- **analisis**: Revision legal + IA (skills + gateway)
- **valoracion**: Scoring/ranking de hallazgos + HITL
- **informe**: Generar seccion del informe por area
- **propuesta_transaccional**: Clausulas SPA, negotiation actions, War Room

> **Legacy compat:** La fase `tratamiento` se mantiene en el enum para backward compat. Los templates v2 usan las 6 fases nuevas.

### 9 Categorias de Templates

```
transversal | area | area_multi | synthesis | deliverable | negotiation
transactional | compliance | operational (legacy)
```

### Gaps cerrados del diagnostico original

| # | Gap original | Estado | Commit |
|---|-------------|--------|--------|
| 1 | S3 Workflow Engine hardcoded | **CERRADO** — 16 templates DB-backed versionados | `ef91b5e` |
| 2 | S3 Sin fases explicitas | **CERRADO** — 6 fases DD con DoR/DoD por fase | `6f11f55` |
| 3 | S6 War Room tratamiento incompleta | **CERRADO** — negotiation_actions API + propuesta_transaccional | `5775cf5` |
| 4 | S0 Gateway sin circuit breaker | **CERRADO** — circuit breaker + Retry-After parsing | `2310c81` |
| 5 | S5 Observability audit automation | Pendiente Horizonte 2 | — |
| 6 | S1 Auth tests rol×endpoint | Pendiente Horizonte 2 | — |
| 7 | S2 Kanban sin orquestacion por fase | **CERRADO** — task_groups + workflow_instance_id | `89bf7f5` |

---

## Analisis del Informe de Estado del Sistema

### Diagnostico confirmado

El informe deep-research identifica correctamente que el baseline P0 (Slices S0-S6) esta **materialmente completado**. La auditoria cruzada contra el repositorio confirma:

| Aspecto | Estado Informe | Estado Real (repo) | Delta |
|---------|---------------|-------------------|-------|
| S0 Gateway IA | exists | Gateway + factory + retry + telemetry + health + SLO p95 + **circuit breaker** + **Retry-After** | **Cerrado** |
| S1 Auth + RLS | exists | Middleware + requirePermission + RLS 8 tablas core + Kanban + Obs + **templates** | Alineado |
| S2 Kanban | exists | 10 estados + WIP + DoR/DoD + aging + alerts + board API + **workflow_instance_id** | **Cerrado** |
| S3 Workflows | exists | **16 templates DB-backed** + 6 fases + dual-run + instantiate + phase-engine | **Cerrado** |
| S4 VDR Vector | exists | pgvector + chunks + ingest + semantic search + Vault sync | Alineado |
| S5 Observability | partial | Telemetry DB + SLO API + sync endpoint + UI dashboard | Gap: audit automation |
| S6 War Room | exists | Dashboard + decisions + red-flags + export + **negotiation_actions** | **Cerrado** |

### Gaps residuales (post-Horizonte 1)

**Importantes (degradan operacion):**

1. **S5 Observability — Audit/History pipeline no automatizado**
   - El sync es manual (POST /api/observability/sync)
   - No hay job schedule automatico (Vercel Cron)
   - Usage History vs Query History no separados

2. **S1 Auth — Tests rol×endpoint incompletos**
   - Los E2E testean auth enforcement basico (401/403)
   - No hay matriz sistematica rol×endpoint para los 94+ endpoints

3. **S0 Gateway — Rate limit por familia de endpoint**
   - Hay un solo `maxConcurrency` global (5)
   - Deberia separarse: Completion (20 rpm), Vault (10 rpm), Audit (60 rpm)

4. **S3 Workflows — Skills catalog incompleto**
   - 6 planned workflows (WF-07 a WF-12) tienen templates pero les faltan skills
   - Skills para INM, LIT, REG, ENV, DATA, COMP no creados en `dd_skills_catalog`

5. **S3 Workflows — Analysis Points como tareas Kanban**
   - Cada AP del YAML v1 deberia generar una tarjeta Kanban individual
   - Actualmente se genera 1 tarjeta por fase; necesita granularidad AP-level

6. **S3 Workflows — Validacion end-to-end (golden path)**
   - Falta validar flujo completo: DoR blocks → IA propone → HITL decide → War Room publish → informe
   - Caso de prueba prioritario: WF-04 Contratos Materiales

---

## HORIZONTE 1: Workflow Spec v1 + Templates Versionadas — COMPLETADO

<details>
<summary>Click para ver detalle de tasks completados</summary>

### Workstream A: Schema y Migracion DB

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| A.1 | Migracion — Tablas de workflow templates (5 tablas + enum + RLS) | `89bf7f5` | DONE |
| A.2 | Seed — Migrar 6 workflows actuales a templates (v1, 5 fases) | `0af15d9` | DONE |
| A.3 | Expand phase enum 5→6 (informe + propuesta_transaccional) | `6f11f55` | DONE |
| A.4 | Seed — Catalogo expandido 16 workflows YAML v1 (v2 6 fases) | `ef91b5e` | DONE |

### Workstream B: TypeScript Types + Engine Refactor

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| B.1 | Tipos TypeScript (WorkflowPhase, TemplateCategory, etc.) | `3956ae3` | DONE |
| B.2 | Template Loader con cache 5-min TTL | `b382984` | DONE |
| B.3 | Workflow Instantiation Engine | `d46f2a5` | DONE |
| B.4 | Dual-run engine (legacy + templates via feature flag) | `abcc893` | DONE |
| B.5 | Phase Advancement Engine (template-aware ordering) | `a87de16` | DONE |

### Workstream C: API Routes

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| C.1 | GET /api/workflows/templates | `5775cf5` | DONE |
| C.2 | POST /api/workflows/instantiate | `5775cf5` | DONE |
| C.3 | GET /api/workflows/instances?project_id=X | `5775cf5` | DONE |
| C.4 | PATCH /api/workflows/instances/[id]/phase | `5775cf5` | DONE |
| C.5 | POST+GET /api/war-room/[project_id]/negotiation-actions | `5775cf5` | DONE |

### Workstream D: Gateway Hardening

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| D.1 | Retry-After header parsing (int seconds + HTTP-date) | `2310c81` | DONE |
| D.2 | Circuit breaker (closed→open→half_open, 30% threshold, 60s cooldown) | `2310c81` | DONE |
| D.3 | Rate limit por familia de endpoint | — | **Pendiente H2** |

### Workstream E: Observability Automation

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| E.1 | Cron job para audit log sync | — | **Pendiente H2** |
| E.2 | Metricas por fase de workflow | — | **Pendiente H2** |
| E.3 | Alertas por degradacion | — | **Pendiente H2** |

### Workstream F: E2E Tests

| Task | Descripcion | Commit | Estado |
|------|-------------|--------|--------|
| F.1-F.5 | E2E: catalogo, 6-phase, synthesis, auth, circuit breaker | `7445614` | DONE |

</details>

---

## HORIZONTE 2: Expansion Areas + Hardening + Golden Path (60 dias)

### Workstream G: Publicar 6 Workflows de Area (WF-07 a WF-12)

Para cada workflow planned, el ciclo es:
1. Crear skills en `dd_skills_catalog` (prompt templates + quality gates + evidence_requirements)
2. Actualizar template_version con skills linkados por `skill_slug`
3. Publicar template (`is_published = true`)
4. Test golden path (instanciar → fases → HITL si aplica → informe)

| WF | Area | Template Key | Skills Requeridos | HITL | Prioridad |
|----|------|-------------|-------------------|------|-----------|
| WF-07 | INM | `inmobiliario` | `inm.titularidad_registral`, `inm.cargas_gravamenes`, `inm.urbanismo`, `inm.arrendamientos` | Si | Alta |
| WF-08 | LIT | `litigios` | `lit.procedimientos_activos`, `lit.reclamaciones_potenciales`, `lit.arbitrajes` | Si | Alta |
| WF-09 | REG | `regulatorio` | `reg.licencias_permisos`, `reg.cumplimiento_sectorial`, `reg.sanciones_historial` | No | Media |
| WF-10 | ENV | `medioambiental` | `env.pasivos_ambientales`, `env.licencias_ambientales`, `env.suelos_contaminados` | No | Media |
| WF-11 | DATA | `proteccion_datos` | `data.registro_actividades`, `data.base_legal_tratamiento`, `data.transferencias_internacionales`, `data.brechas_historico` | No | Media |
| WF-12 | COMP | `competencia` | `comp.notificacion_obligatoria`, `comp.ayudas_estado`, `comp.acuerdos_verticales` | No | Baja |

#### Task G.1: Skills para Inmobiliario (WF-07)

**Files:**
- Create: `supabase/migrations/202603XX01_skills_inmobiliario.sql`

Crear 4 skills en `dd_skills_catalog`:
- `inm.titularidad_registral`: Verificacion de titularidad en Registro de la Propiedad
- `inm.cargas_gravamenes`: Deteccion de cargas, hipotecas, servidumbres
- `inm.urbanismo`: Cumplimiento urbanistico, licencias de actividad
- `inm.arrendamientos`: Analisis de contratos de arrendamiento vigentes

Cada skill incluye: `prompt_template`, `expected_output_schema` (5 salidas normalizadas: findings, red_flags, negotiation_actions, report_section, evidence_refs), `evidence_requirements`, `quality_gate`.

#### Task G.2: Skills para Litigios (WF-08)

Similar a G.1 pero con skills: `lit.procedimientos_activos`, `lit.reclamaciones_potenciales`, `lit.arbitrajes`.

#### Task G.3-G.6: Skills para REG, ENV, DATA, COMP

Ciclo identico para cada area restante.

#### Task G.7: Publicar templates WF-07 a WF-12

Migration que actualiza `is_published = true` y `published_at = NOW()` para cada template una vez sus skills esten creados.

---

### Workstream H: Golden Path Validation — WF-04 Contratos Materiales

Validar end-to-end el flujo completo con WF-04 como caso de referencia:

```
[DoR blocks sin docs] → [IA propone con citaciones] → [HITL decide] →
[War Room publish] → [Report section + annexes]
```

#### Task H.1: AP-level Kanban task generation

**Files:**
- Modify: `src/lib/workflows/instantiate.ts`

Actualmente se crea 1 Kanban task por fase. Evolucion: crear 1 Kanban task por Analysis Point (AP) dentro de cada fase. Cada AP tiene:
- `required_docs` (DoR)
- `skills` (que IA ejecutar)
- `findings` output
- `red_flags` output
- `negotiation_actions` output
- `report_section` output
- `evidence_refs` output

#### Task H.2: DoR enforcement en phase-engine

**Files:**
- Modify: `src/lib/workflows/phase-engine.ts`

Antes de avanzar fase, validar que TODOS los `required_docs` del AP estan presentes en VDR (via semantic search). Si faltan docs, bloquear con estado `info_solicitada`.

#### Task H.3: Evidence linking via VDR semantic retrieval

**Files:**
- Modify: `src/lib/workflows/engine.ts`

Cuando un skill se ejecuta via gateway, el `grounding_mode: vault_rag` debe:
1. Buscar chunks relevantes en `dd_vault_chunks` via pgvector
2. Vincular los chunk_ids como `evidence_refs` en el finding
3. Incluir snippets en la respuesta para auditabilidad

#### Task H.4: HITL auto-creation con contexto

**Files:**
- Modify: `src/lib/workflows/phase-engine.ts`

Cuando una fase tiene `hitl_required: true`:
1. Crear Kanban task en estado `hitl_revision`
2. Incluir AI output completo en `ai_output` JSONB
3. Incluir evidence_refs para que el revisor pueda verificar
4. Notificar al `reviewer_role` definido en `hitl_policy`

#### Task H.5: Report section generation

**Files:**
- Create: `src/lib/workflows/report-generator.ts`

Al completar fase `informe`:
1. Agregar secciones de todos los findings validados (post-HITL)
2. Formatear segun template de reporte del area
3. Incluir tabla de evidencia con referencias VDR
4. Vincular al `dd_reports` existente

#### Task H.6: E2E golden path test — Contratos

**Files:**
- Create: `e2e/24-golden-path-contratos.spec.ts`

Test completo: instantiate WF-04 → seed mock docs → advance phases → HITL approve → verify negotiation actions → verify report section.

---

### Workstream I: Gateway Rate Limit por Familia

#### Task I.1: Separar concurrency por familia de endpoint

**Files:**
- Modify: `src/lib/harvey/gateway.ts`

Separar `maxConcurrency` en 3 pools:
- `completion`: 5 concurrent (de 20 rpm, con headroom)
- `vault`: 3 concurrent (de 10 rpm)
- `audit`: 15 concurrent (de 60 rpm)

#### Task I.2: Gateway factory con config por familia

**Files:**
- Modify: `src/lib/harvey/factory.ts`

`getHarveyGateway(family: 'completion' | 'vault' | 'audit')` devuelve instancia configurada para la familia.

---

### Workstream J: Observability Automation

#### Task J.1: Vercel Cron para audit sync

**Files:**
- Create: `src/app/api/cron/audit-sync/route.ts`
- Create: `vercel.json` (cron config)

Cron cada 15 minutos que invoca `POST /api/observability/sync` con token de servicio.

#### Task J.2: Metricas por fase de workflow

**Files:**
- Modify: `src/app/api/observability/slo/route.ts`

Agregar metricas:
- Latencia p95 por fase de workflow
- HITL correction rate por area/skill
- Throughput de ingestion VDR
- Aging por fase (no solo por estado Kanban)

#### Task J.3: Alertas SLO → War Room

**Files:**
- Create: `src/app/api/observability/alerts/route.ts`

Evaluacion periodica que emite War Room notifications cuando:
- p95 > 30s
- 429% > 5%
- HITL correction rate > 20%
- Aging > 5 dias en cualquier fase

---

### Workstream K: RLS Hardening

#### Task K.1: CI lint rule — service_role_key

Regex en CI pipeline: `SUPABASE_SERVICE_ROLE_KEY` no puede aparecer en `src/app/` excepto `src/app/api/`.

#### Task K.2: Matriz rol×endpoint E2E

**Files:**
- Create: `e2e/25-rbac-matrix.spec.ts`

Test parametrizado: para cada endpoint nuevo, verificar que:
- anon devuelve 401
- rol incorrecto devuelve 403
- rol correcto devuelve 200/201

---

### Workstream L: Retrieval Hibrido

#### Task L.1: BM25 + pgvector hybrid search

**Files:**
- Create: `src/lib/vdr/hybrid-search.ts`

Combinar semantic search (pgvector cosine) con keyword search (tsvector BM25). Score final = `alpha * semantic_score + (1-alpha) * keyword_score` con alpha configurable por skill.

#### Task L.2: Chunking adaptativo por tipo de documento

**Files:**
- Modify: `src/lib/vdr/chunking.ts`

Estrategias de chunking por tipo:
- Contrato: por clausula (heading-based)
- Acta: por punto de orden del dia
- Balance: por partida contable
- Escritura: por otorgamiento/estipulacion

---

## HORIZONTE 3: Scoring Cross-Area + Reporting Comite (90 dias)

### Workstream M: Scoring Consolidado

Modelo de scoring cross-area que agrega hallazgos de todos los workflows de un proyecto en un "Deal Risk Score" unico:
- Desglosado por area, severidad y tipo de impacto
- Peso configurable por area (e.g., contingencias laborales pesan mas en deal labor-intensive)
- Utiliza WF-13 (Consolidacion Contingencias) como motor

### Workstream N: Reporting Comite de Inversion

Template de report consolidado (WF-16 Informe Final):
- Combina secciones de todas las areas
- Red flags sheet (WF-14)
- Negotiation tracker (WF-15 SPA Mapping)
- Decision log del War Room
- Export PDF con formato Garrigues

### Workstream O: War Room Completo

Vinculos estructurados:
```
hallazgo → clausula SPA → decision → accion → status
```
- Timeline visual de negociacion
- Dashboard de estado de todas las negotiation actions
- Cierre de loop: decision → evidence → accion → resolucion

---

## Criterios de Aceptacion (DoD Global)

- [x] ~~Cada template de workflow declara 5 fases~~ → **6 fases** con inputs, skills, artefactos y DoD
- [x] Instanciar un workflow crea grupos de tareas + tarjetas Kanban con DoR/DoD por fase
- [x] Ejecucion de workflow respeta route A/B de gateway segun grounding mode
- [x] HITL auto-creado para areas criticas (CONT/LAB/FISC/LIT)
- [x] Fase "propuesta_transaccional" produce negotiation_actions vinculados a War Room
- [x] RLS: no hay lectura/escritura cross-proyecto; service keys nunca en cliente
- [x] E2E: tests para catalogo de templates, auth, gateway circuit breaker
- [x] Feature flag: `WORKFLOW_TEMPLATES_V1=false` revierte a legacy sin perdida
- [x] Gateway con circuit breaker (30% threshold, 60s cooldown) y Retry-After parsing
- [x] 6 workflows existentes migrados a templates v2 con 6 fases
- [x] 4 workflows synthesis/deliverable/negotiation creados (WF-13 a WF-16)
- [x] 6 workflows planned seedeados como unpublished (WF-07 a WF-12)
- [ ] **H2:** Golden path validado E2E para WF-04 Contratos Materiales
- [ ] **H2:** 6 workflows de area publicados con skills completos
- [ ] **H2:** Metricas por fase visibles en SLO dashboard
- [ ] **H2:** AP-level Kanban task generation
- [ ] **H3:** Scoring consolidado cross-area
- [ ] **H3:** Informe Final export PDF

## Metricas Operativas Minimas

| Metrica | Target | Donde medir | Estado |
|---------|--------|-------------|--------|
| Latencia p95 completion (por workflow) | < 30s | /api/observability/slo | Medible |
| % 429 / retry ratio | < 5% | /api/gateway/health | Medible (circuit breaker) |
| Throughput ingestion VDR | > 50 docs/hora | /api/observability/slo | Pendiente |
| HITL correction rate (por skill/area) | < 20% | Kanban metrics | Pendiente H2 |
| Coverage de skills ejecutables | > 60% de 63 | /api/skills | Pendiente H2 |
| Workflows instanciados/semana | > 10 | /api/workflows/instances | Medible |
| Aging maximo en estado (dias) | < 5 | /api/kanban/alerts | Medible |
| Templates publicados | 16/16 | /api/workflows/templates | 10/16 (6 planned) |
| Circuit breaker state | closed | /api/gateway/health | Medible |

## Archivos Clave del Sistema

### Migraciones DB

| Archivo | Descripcion |
|---------|-------------|
| `supabase/migrations/202602270002_workflow_templates.sql` | 5 tablas + enum + RLS + indexes |
| `supabase/migrations/202602270003_seed_workflow_templates.sql` | 6 MVP seeds v1 (5 fases) |
| `supabase/migrations/202602270004_expand_workflow_phases.sql` | Enum +2 fases |
| `supabase/migrations/202602270005_expanded_workflow_catalog.sql` | 16 templates YAML v1 (766 lineas) |

### Engine (TypeScript)

| Archivo | Descripcion |
|---------|-------------|
| `src/lib/workflows/template-types.ts` | Tipos: 6 fases, 9 categorias, interfaces |
| `src/lib/workflows/template-loader.ts` | Loader con cache 5-min TTL |
| `src/lib/workflows/instantiate.ts` | Instantiation: template → instance → task groups → kanban |
| `src/lib/workflows/phase-engine.ts` | Phase advancement con template-aware ordering |
| `src/lib/workflows/engine.ts` | Dual-run: template path vs legacy path |
| `src/lib/workflows/constants.ts` | Legacy WORKFLOW_DEFINITIONS (6 hardcoded) |
| `src/lib/workflows/index.ts` | Barrel exports |

### API Routes

| Archivo | Metodo | Descripcion |
|---------|--------|-------------|
| `src/app/api/workflows/templates/route.ts` | GET | Lista templates publicados |
| `src/app/api/workflows/instantiate/route.ts` | POST | Crea workflow instance |
| `src/app/api/workflows/instances/route.ts` | GET | Lista instances por proyecto |
| `src/app/api/workflows/instances/[id]/phase/route.ts` | PATCH | Avanza fase |
| `src/app/api/war-room/[project_id]/negotiation-actions/route.ts` | POST+GET | Acciones de negociacion |
| `src/app/api/workflows/execute/route.ts` | POST | Ejecuta workflow (legacy compatible) |
| `src/app/api/workflows/list/route.ts` | GET | Lista workflows (legacy) |

### Gateway

| Archivo | Descripcion |
|---------|-------------|
| `src/lib/harvey/gateway.ts` | Gateway con circuit breaker + Retry-After |
| `src/lib/harvey/types.ts` | Tipos con GatewayHealth.circuit_breaker |
| `src/lib/harvey/factory.ts` | Singleton factory |

### Tests

| Archivo | Descripcion |
|---------|-------------|
| `e2e/23-workflow-templates-v1.spec.ts` | Catalogo, 6-phase, synthesis, auth, circuit breaker |
| `e2e/15-workflows.spec.ts` | Legacy workflows API |
| `e2e/12-gateway.spec.ts` | Gateway endpoints |
| `src/lib/harvey/__tests__/gateway.test.ts` | Unit tests gateway |

## Plan de Rollback

1. **Feature flag `WORKFLOW_TEMPLATES_V1`**: Si `false`, el engine usa `WORKFLOW_DEFINITIONS` de constants.ts (comportamiento actual identico). Verificado en dual-run engine (`abcc893`).
2. **Expand/contract en DB**: Las tablas nuevas (templates, versions, instances) no afectan a las existentes. Las columnas nuevas en `dd_kanban_tasks` son nullable.
3. **Shadow mode**: Se puede instanciar en background y comparar outputs sin publicar (via metadata flag `shadow_run: true`).
4. **Reversion de migracion**: Las tablas nuevas se pueden dropear sin afectar datos existentes; las columnas ALTER ADD se pueden DROP.
5. **Phase enum expansion**: Los valores nuevos (`informe`, `propuesta_transaccional`) en `dd_workflow_phase` no afectan queries existentes que usan los 5 valores originales.
