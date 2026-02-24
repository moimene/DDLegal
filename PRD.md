# PRD - DD Legal PMO v3.0
**Ultima actualizacion: 24 febrero 2026 — Desplegado en produccion: `dd-legal-pmo.vercel.app`**

## 1. Contexto y problema

En una transaccion, la due diligence no es una tarea legal aislada: es un **mecanismo de decision y negociacion**. Los hallazgos soportan ajustes de precio, conditions precedent (CPs), garantias/indemnidades y medidas de mitigacion antes y despues del closing.

Los equipos de DD legal necesitan coordinar proyectos con multiples areas, procesos y hallazgos en plazos cortos y con trazabilidad suficiente para decision de inversion. El output relevante de una DD es: **hallazgos rankeados + red flags negociables/no negociables + evidencias trazables + informe-conclusion**.

### Problemas que resuelve DD Legal PMO

**Operativos (resueltos en v2.0):**
- Seguimiento fragmentado en documentos y hojas dispersas.
- Baja estandarizacion en el analisis por area.
- Dificultad para convertir hallazgos en contingencias priorizadas.
- Integracion incompleta entre trabajo humano y copiloto IA legal.
- Falta de validacion automatica de outputs IA (alucinaciones, citas falsas).
- Ausencia de pipeline de reporting estandarizado y trazable.
- Gestion manual de propiedad industrial sin integracion con registros oficiales.
- Data room sin gap analysis automatizado.
- Skills legales sin quality gates ni enumeraciones de dominio cerradas.

**Estructurales (nuevos en v3.0):**
- Ausencia de Kanban real como single source of truth del backlog DD.
- Sin workflow engine operable por area con politicas explicitas (DoR/DoD).
- IA no gobernada: sin gateway, sin rate limit control, sin telemetria.
- Auth y RLS pendientes: sin autorizacion end-to-end efectiva.
- Solo 2 de 6 workflows MVP operativos (societario, IP).
- VDR sin vectorizacion ni busqueda semantica para RAG interno.
- Sin war room para negociacion con evidencia.
- Sin observabilidad operativa (SLOs, p95, 429 ratio).

## 2. Objetivo de producto

Convertir DD Legal PMO en un **sistema operativo interno de due diligence** orientado a proyecto transaccional, que entregue cuatro capacidades no negociables:

1. **Control del proyecto DD**: Kanban + backlog + workflow engine por area, con politicas explicitas (DoR/DoD) y limites WIP.
2. **IA gobernada y auditable**: separacion formal "IA propone" vs "HITL decide", trazabilidad de evidencias/citas, telemetria minima.
3. **Informe-conclusion + red flags**: secciones por area + red flag report consolidado y negociable, con ranking por severidad/probabilidad/impacto y vinculacion a evidencia.
4. **War room para negociacion**: vista ejecutiva + hoja de red flags + registro de decisiones + notificaciones.

### Objetivos de negocio/legal
- Reducir tiempo de arranque de un proyecto DD de dias a horas.
- Estandarizar ejecucion por procesos y areas con skills reutilizables.
- Aumentar confiabilidad de outputs IA con validacion de citas y fuentes.
- Mejorar visibilidad de riesgos mediante consolidacion cross-area de red flags.
- Alinear con los 64 workflows del Excel FMC Due Diligence (Feb 2026).
- Cubrir las 11 areas juridicas con skills operativos progresivamente.
- Habilitar 6 workflows MVP activos con hallazgos rankeados y secciones de informe.
- Industrializar la IA (Harvey) mas alla de las 2 pipelines actuales via gateway unificado.

## 3. Usuarios objetivo y JTBD

### Usuarios principales
- **Lider legal transaccional / CLO**: Supervision de cartera DD y decision estrategica. Vista war room.
- **Abogado de ejecucion DD por area**: Analisis especializado con soporte IA. Tablero Kanban por area.
- **PM de transaccion**: Coordinacion de avance, deadlines y entregables. Vista WIP/aging/blockers.
- **Stakeholder de negocio/inversion**: Consumo de resumen de riesgos y red flags. Red flags sheet.
- **Cliente externo**: Seguimiento read-only de progreso via portal dedicado. Sin query history ni prompts.

### JTBD
- "Cuando inicio una DD, quiero crear el proyecto y que se genere automaticamente el backlog de tareas por area con checklist, roles y cronograma."
- "Cuando gestiono mi area, quiero un tablero Kanban con WIP controlado que separe claramente lo que esta en analisis, lo que propone la IA, y lo que espera mi revision."
- "Cuando analizo una sociedad target, quiero que el sistema consulte registros oficiales (BORME, OEPM, EUIPO) y me genere un snapshot verificable."
- "Cuando necesito un reporte, quiero seleccionar un template y que el sistema genere el draft con evidencia citada y validada."
- "Cuando reviso outputs IA, quiero saber que las citas son reales, las URLs son de fuentes oficiales, y no hay datos inventados."
- "Cuando preparo negociacion, quiero un war room con red flags rankeados, hoja de decisiones, y evidencia vinculada."
- "Cuando gestiono documentos, quiero buscar semanticamente en el VDR y ver el gap list de lo que falta por area."
- "Cuando ejecuto un skill, quiero saber si requiere revision humana (HITL) antes de publicarse."
- "Cuando superviso la operacion, quiero metricas de SLO (latencia IA, ratio de errores, ratio de correcciones HITL)."

## 4. Alcance funcional

### 4.A Implementado (operativo)

#### Dashboard PMO
KPIs (proyectos activos/en revision/completados, areas cubiertas), proyectos recientes, catalogo de areas. Dashboards por rol: Lawyer, Leader, PMO, Client.

#### Gestion de Proyectos DD
CRUD + 6 tabs (Resumen, Tareas, Contingencias, Q&A, Documentos, Entregables). Invocacion Harvey por proceso y skill. Contingencias con severidad/monto/recomendacion. Skills grid por area. HITL badges. Activity feed. Cockpit. Negotiation view.

#### Data Room v1
Upload + listado + gap list por area (22 docs esperados en 6 areas). Stats de cobertura. API: `GET/POST /api/documents`.

#### VDR v1.5
Folder tree, document preview, upload dropzone, bulk upload, ACL per folder, audit log, shared links, search, gap analysis, document versioning. API: 10 endpoints bajo `/api/vdr/`.

#### Reports UI
Hub (`/reports`) + Wizard 3 pasos (`/reports/new`) + Visor con grounding (`/reports/[id]`). Freeze control, version history, compare, export. 35 templates en 5 familias.

#### Tool Societario (7 fases)
Request > Resolve > BORME Query > BORME Ingest > Snapshot > Validate > Report. UI: CandidateResolver, PipelineTracker, SnapshotViewer.

#### Tool IP Radar (5 fases)
Request > Resolve > Search > Snapshot > Report.

#### Reporting Engine (35 templates, 5 familias)

| Familia | Templates | Harvey AI |
|---------|-----------|-----------|
| Transactional | 15 | Si |
| PMO | 8 | No |
| Compliance | 7 | No |
| Negotiation | 4 | Si |
| Consolidated | 1 | Si |

Cada template define: `required_sections[]`, `expected_output_schema`, `evidence_requirements`, `skills[]`, `export_formats[]`, `audience[]`.

#### Evidence Pack v1.1
Indexacion automatica `[SRC-001]...[SRC-NNN]`. Grounding validation: 5 checks (citation_exists, url_allowlist, section_coverage, source_coverage, score 0-100). Allowlist: boe.es, borme.es, oepm.es, euipo.europa.eu, wipo.int, registradores.org.

#### Skills Catalog (63 skills)
11 areas, quality gates (confidence, evidence minimum, domain enums, HITL). 4 operativos (MERC, PI), 8 seeded (CONT, LAB), 28 FMC schemas, 23 planificados.

#### Domain Enumerations (15)
Enumeraciones canonicas por dominio legal: CONT (4), LAB (2), FISC (2), INM (2), PI (1), LIT (2), GENERAL (2).

#### Alertas + Red Flags Digest + HITL + Portal Cliente + Configuracion
Alertas de negociacion con scoring. Red flags digest cross-area. HITL approve/correct/reject. Portal cliente read-only. Config panel con status indicators.

#### Q&A Module
Threads con mensajes, assignments, SLA tracking, links a documentos. API: 6 endpoints bajo `/api/qa/`.

#### Negotiation Module
Contingencias extendidas, clausulas SPA, mapeo contingencia-clausula. API: 2 endpoints bajo `/api/negotiation/`.

#### Events & Notifications
Event bus con 12 tipos de evento + Supabase Realtime. NotificationCenter, ActivityTimeline, PresenceIndicator, SmartSuggestions.

#### Agent Pipeline n8n (parcial)
3 agentes (Paranoico, Validador, Sanitizer) + 3 workflows de report pipeline (Ingest, Orchestrator, Render). 12 workflows totales en n8n Cloud. **Estado: agentes inactivos (pendiente credenciales Harvey), render activo.**

### 4.B Nuevo en v3.0

#### 4.B.1 Auth + Roles + RLS (Slice S1)

Autenticacion y autorizacion end-to-end:
- Supabase Auth (email/password, SSO futuro).
- Tabla `dd_project_roles`: asigna roles por proyecto.
- 7 roles: `clo`, `pm_transaccion`, `abogado_area`, `deal_sponsor`, `target_liaison`, `stakeholder_negocio`, `cliente_externo`.
- 13 permisos por rol (ya definidos en `ROLE_PERMISSIONS`).
- Politicas RLS en TODAS las tablas — anon no accede a nada.
- `SUPABASE_SERVICE_ROLE_KEY` solo en API routes (server-side).
- Login page funcional (`/login`).
- Middleware de autorizacion en API routes.

**DoD:**
1. Login y roles por proyecto operativos.
2. RLS efectivo (anon no accede).
3. service_role nunca en cliente.
4. Tests de acceso por rol.
5. Auditoria de cambios de rol.

**Estado actual:** ✅ Implementado (middleware, requirePermission, RLS policies en todas las tablas core + kanban + observability). E2E tests de auth enforcement.

#### 4.B.2 Harvey Gateway v1 (Slice S0)

Gateway unico para todas las llamadas a Harvey AI:
- Ruta A: Completion directa (`POST /api/v2/completion`, multipart/form-data, prompt <= 20.000 chars).
- Ruta B: Completion con Vault RAG (`knowledge_sources=[{"type":"vault","folder_id":...}]`).
- Restriccion: `file` y `knowledge_sources` son excluyentes.
- Exponential backoff en 429.
- Control de concurrencia por familia de endpoints.
- Inyeccion de `client_matter_id` para atribucion.
- Logging estructurado (sin exponer tokens ni prompts).
- Feature flag para fallback a n8n.
- Metricas: p95 latencia, % 429, retry ratio.

Rate limits por minuto/org:

| Familia | RPM |
|---------|-----|
| Completion | 20 |
| Vault | 10 |
| Audit | 60 |
| History | 60 |
| Client matters | 150 |

API nueva:
```
POST /api/gateway/completion  -> { success, result, route, latency_ms }
POST /api/gateway/vault       -> { success, result, citations[] }
GET  /api/gateway/health      -> { status, rate_limits, p95, error_rate }
```

**DoD:**
1. Soporta `/whoami` y `/completion` v2.
2. Respeta 429 con backoff (no propaga al cliente).
3. Logging estructurado sin exponer tokens.
4. Feature flag para fallback a n8n.
5. p95 latencia y %429 visibles en `/gateway/health`.

**Estado actual:** ✅ Implementado (gateway lib con retry/concurrency/telemetry, singleton factory, feature flags, completion/health/whoami routes, SLO p95 metrics, Vault RAG query endpoint). E2E tests.

#### 4.B.3 Kanban + Motor de Tareas (Slice S2)

Kanban real como centro de mando del proyecto DD:

**Estados de tarjeta:**
1. Backlog
2. Info solicitada
3. Info recibida
4. Lista para analisis (DoR cumplida)
5. En analisis (WIP controlado)
6. IA propuesta (output + evidencias)
7. HITL revision (approve/correct/reject)
8. Conclusion de tarea (hallazgos cerrados + mitigacion)
9. Integrado en informe
10. Bloqueado (con causa, owner, ETA)

**Modelo de tarjeta:**

| Campo | Tipo | Uso |
|-------|------|-----|
| project_id | UUID | Vinculacion a transaccion |
| area_code | Enum | Area DD |
| task_group | Texto/ID | Agrupacion |
| parent_task_id | UUID/null | Subtareas |
| title | Texto | Accion concreta |
| description | Texto | Alcance y criterio |
| status | Enum | Estados Kanban (10) |
| service_class | Enum | standard / expedite / blocker |
| assignee | UUID | Responsable |
| reviewer | UUID | Revisor |
| due_date | Fecha | SLA |
| required_docs | Lista | Docs requeridos + estado |
| evidence_refs | Lista | IDs a VDR/Vault + chunk/page |
| skills_activated | Lista | Skills que ejecuta |
| ai_proposal | JSONB | Output IA versionado |
| hitl_decision | Enum+texto | approve/correct/reject + rationale |
| findings | JSONB[] | Hallazgos con scoring |
| red_flags | JSONB[] | Subset deal critical |
| negotiation_actions | JSONB[] | CP/indemnity/price adj/etc |
| audit_trail | JSONB[] | Quien, que, cuando |

**Limites WIP y politicas:**
- WIP por columna (configurable por proyecto).
- Politicas visibles (DoR/DoD por estado).
- Metrica de aging (dias en estado) para escalado.

**Vistas por rol:**
- Lead/socio: top red flags + blockers + timeline + decisiones.
- Responsable area: tablero del area con WIP/aging.
- Equipo: mi trabajo + en revision + bloqueadas.
- Cliente: progreso por area + requests + outputs aprobados.

API nueva:
```
GET    /api/kanban/board?project_id=X     -> { columns[], tasks[], wip_limits }
PATCH  /api/kanban/tasks/[id]/move        -> { success, task }
POST   /api/kanban/tasks                  -> { success, task }
PATCH  /api/kanban/tasks/[id]             -> { success, task }
GET    /api/kanban/metrics?project_id=X   -> { aging, throughput, wip_violations }
```

Paginas nuevas:
- `/projects/[id]/kanban` — Vista Kanban interactiva.
- Integrar metricas en `/projects/[id]/cockpit`.

**DoD:**
1. Estados y WIP operativos con limites configurables.
2. DoR/DoD por columna visible y enforced.
3. Aging visible con alertas a >3 dias.
4. Separacion IA propuesta vs HITL revision en tarjeta.
5. Export basico (CSV/JSON).

**Estado actual:** ✅ Implementado (10-state enum, WIP limits, DoR/DoD criteria, aging metrics, task CRUD + move, board endpoint, Kanban UI page, aging alerts endpoint). E2E tests.

#### 4.B.4 Workflows MVP (Slice S3) → Workflow Spec v1

**Evolucion:** De 6 workflows hardcoded en constants.ts a **16 workflow templates DB-backed versionados** con 6 fases DD explicitas.

##### 6 Fases DD (expandidas de 5)

```
obtencion → gestion → analisis → valoracion → informe → propuesta_transaccional
```

Cada fase declara: inputs, skills, artefactos, DoR/DoD, kanban_start/end_state, hitl_required, gateway_config.

##### 16 Workflow Templates

| # | Key | Area | Categoria | HITL | Estado |
|---|-----|------|-----------|------|--------|
| WF-01 | `arranque_dd` | GENERAL | transversal | No | Published v2 |
| WF-02 | `data_room_gap` | GENERAL | transversal | No | Published v2 |
| WF-03 | `societario` | MERC | area | No | Published v2 |
| WF-04 | `contratos_materiales` | CONT | area | **Si** | Published v2 |
| WF-05 | `ip_titularidad` | PI | area | No | Published v2 |
| WF-06 | `laboral_fiscal` | LAB, FISC | area_multi | **Si** | Published v2 |
| WF-07 | `inmobiliario` | INM | area | **Si** | Planned |
| WF-08 | `litigios` | LIT | area | **Si** | Planned |
| WF-09 | `regulatorio` | REG | area | No | Planned |
| WF-10 | `medioambiental` | ENV | area | No | Planned |
| WF-11 | `proteccion_datos` | DATA | area | No | Planned |
| WF-12 | `competencia` | COMP | area | No | Planned |
| WF-13 | `consolidacion_contingencias` | GENERAL | synthesis | No | Published v1 |
| WF-14 | `red_flag_report` | GENERAL | deliverable | No | Published v1 |
| WF-15 | `spa_mapping` | GENERAL | negotiation | No | Published v1 |
| WF-16 | `informe_final` | GENERAL | deliverable | No | Published v1 |

##### Arquitectura del engine

- **Template loader** (`template-loader.ts`): Lee templates de DB con cache 5-min TTL
- **Instantiation engine** (`instantiate.ts`): Template → instance → task_groups → kanban tasks
- **Phase engine** (`phase-engine.ts`): Avance de fases con DoD validation, template-aware ordering
- **Dual-run** (`engine.ts`): Feature flag `WORKFLOW_TEMPLATES_V1` → template path vs legacy path
- **Circuit breaker** en gateway: 30% threshold, 60s cooldown, Retry-After header parsing
- **Prompt builder** (`prompt-builder.ts`): Construye prompt/payload enriquecido por iteracion con skills activas, contexto de loop (loop_number, phase_loop_number, previous_loops)
- **Instance runner enrichment** (`instance-runner.ts`): Calcula y adjunta contexto de iteracion antes de cada ejecucion

##### DB Schema (4 migraciones)

| Tabla | Proposito |
|-------|-----------|
| `dd_workflow_templates` | Templates maestros (template_key, area_codes, category) |
| `dd_workflow_template_versions` | Versiones inmutables (phases JSONB, hitl_policy, schemas) |
| `dd_workflow_instances` | Ejecucion por proyecto (status, current_phase, phase_status) |
| `dd_workflow_task_groups` | Grupo de tareas por fase de instancia |
| `dd_negotiation_actions` | Acciones de negociacion (fase propuesta_transaccional) |

##### API (7 endpoints)

```
GET    /api/workflows/templates               -> { templates[] }
POST   /api/workflows/instantiate             -> { instance, tasks_created }
GET    /api/workflows/instances?project_id=X  -> { instances[] }
PATCH  /api/workflows/instances/[id]/phase    -> { instance, next_phase, hitl_required }
POST   /api/war-room/[project_id]/negotiation-actions -> { action }
GET    /api/workflows/list                    -> { workflows[] } (legacy)
POST   /api/workflows/execute                 -> { result, findings } (legacy)
```

Cada workflow produce:
1. Hallazgos estructurados con ranking (severidad/probabilidad/impacto).
2. Red flags destacados (deal critical).
3. Recomendacion de mitigacion/negociacion.
4. Seccion del informe-conclusion de area.
5. Evidence pack con trazabilidad.

**DoD:**
1. ~~Cada template de workflow declara 5 fases~~ → **6 fases** con inputs, skills, artefactos y DoD.
2. Instanciar un workflow crea grupos de tareas + tarjetas Kanban con DoR/DoD por fase.
3. Ejecucion respeta route A/B de gateway segun grounding mode.
4. HITL obligatorio donde aplique (CONT, LAB, FISC, LIT).
5. Feature flag `WORKFLOW_TEMPLATES_V1=false` revierte a legacy sin perdida.
6. 16 templates seedeados (10 published, 6 planned).

**Estado actual:** ✅ Implementado (16 template DB-backed versionados, 6 fases DD, dual-run engine, instantiation + phase advancement, 7 API endpoints, circuit breaker + Retry-After, negotiation actions, prompt-builder con enriquecimiento por iteracion/skills). E2E tests + unit tests (prompt-builder).

#### 4.B.5 VDR v2 + Vectorizacion (Slice S4)

Evolucion del VDR a sistema de record con busqueda semantica:

**Componentes nuevos:**
- Extension `pgvector` habilitada en Supabase.
- Tabla `vdr_chunks`: chunks con embeddings + metadata (pagina, seccion, categoria, version).
- Pipeline de ingestion: texto/OCR/normalizacion > chunking section-aware > embedding > indexacion.
- Indices ANN (HNSW para speed/recall).
- Busqueda semantica con umbral configurable.
- Evidence Pack v2: `[SRC-xxx]` trazable a documento/version/pagina/chunk.

**Sync selectivo a Harvey Vault:**
- Solo cuando se necesite citacion nativa de Harvey o evidence packs cerrados.
- Vault upload: hasta 50 ficheros/request, 100 MB/fichero.
- `duplicate_mode=skip|replace` para idempotencia.

Tablas nuevas:
```
vdr_chunks (id, document_id, version_id, content, embedding vector(1536),
            page_number, section_title, category, metadata, created_at)
vdr_ingestion_jobs (id, document_id, status, started_at, completed_at,
                    chunks_created, error_message)
```

API nueva:
```
POST /api/vdr/search/semantic  -> { results[]{chunk_id, content, similarity, document, page} }
POST /api/vdr/ingest           -> { success, job_id }
GET  /api/vdr/ingest/[id]      -> { job, status, chunks_created }
```

**DoD:**
1. Ingestion y chunking reproducible.
2. Busqueda semantica con umbral configurable.
3. Indexacion asincrona (no bloquea UI).
4. Evidencia refiere version/pagina/chunk.
5. Control de sensibilidad y permisos via RLS.

**Estado actual:** ✅ Implementado (pgvector, vdr_chunks, ingestion pipeline, semantic search, HNSW index, Evidence Pack v2 with finding→chunk linking, VDR→Harvey Vault sync). E2E tests.

#### 4.B.6 Observabilidad (Slice S5)

Metricas y telemetria para operacion fiable:

**SLOs minimos:**

| Metrica | Target |
|---------|--------|
| Latencia p95 completion (por workflow) | < 30s |
| % 429 / retry ratio | < 5% |
| Throughput ingestion VDR (docs/hora) | > 50 |
| Ratio HITL corrections (por skill/area) | < 20% |
| Errores n8n (mientras exista convivencia) | < 2% |

**Componentes:**
- Ingesta incremental de Harvey Audit Logs (paginacion `from` + `take`, max 1000).
- Separacion Usage History (para BI, sin inputs/outputs) vs Query History (solo forensics, con retencion estricta).
- Panel SLO en `/configuracion/observabilidad`.
- Alertas por fallo de sync o degradacion.

API nueva:
```
GET /api/observability/slos     -> { metrics[], alerts[] }
GET /api/observability/harvey   -> { p95, error_rate, retry_ratio, throughput }
GET /api/observability/pipeline -> { pass_rate, correction_rate, latency_by_skill }
```

**DoD:**
1. Audit logs ingest incremental operativo.
2. Usage/Query history separados con politica de retencion.
3. Alertas por fallo de sync activas.
4. Panel SLO visible y actualizado.
5. Minimizacion de datos sensibles enforced.

**Estado actual:** ✅ Implementado (gateway telemetry table, batched telemetry writer, SLO dashboard API with p50/p95/p99, telemetry list endpoint, health route with SLO thresholds). E2E tests.

#### 4.B.7 War Room (Slice S6)

Centro de negociacion con evidencia:

**Capacidades:**
- Vista ejecutiva: progreso por area, blockers, aging, top red flags.
- Hoja de red flags: cada red flag con evidencia, scoring, owner, accion propuesta (CP/indemnity/ajuste).
- Registro de decisiones: quien decide, cuando, por que, evidencia que lo soporta.
- Notificaciones: cambios de severidad, blockers nuevos, requests vencidas.
- Permisos granulares: cliente "view" vs equipos internos.

Pagina nueva: `/projects/[id]/war-room`.

API nueva:
```
GET  /api/war-room/[project_id]           -> { red_flags[], blockers[], progress, decisions[] }
POST /api/war-room/[project_id]/decisions -> { success, decision }
GET  /api/war-room/[project_id]/red-flags -> { red_flags[] con scoring + evidence + actions }
POST /api/war-room/[project_id]/export    -> { file_url } (PDF/Excel)
```

**DoD:**
1. Vista top risks/blockers operativa.
2. Decisions log funcional con audit trail.
3. Notificaciones por cambio de severidad activas.
4. Permisos por rol enforced (cliente no ve query history).
5. Export de red flags sheet (Excel/PDF).

**Estado actual:** ✅ Implementado (dashboard, decisions, red-flags, export endpoints, severity change notifications via event bus bridge, contingency PATCH with change detection). E2E tests.

#### 4.B.8 Incremental RAG + Report Rendering + Two-Level Cache

Pipeline incremental de ingesta, análisis y renderizado de informes con cache de dos niveles y multi-query RAG.

**Componentes:**

1. **Level-1 Cache (Documento):** SHA-256 `content_hash` en `vdr_documents` — skip re-parsing si el contenido no cambió.
2. **Level-2 Cache (Informe):** `evidence_hash` (SHA-256 de content_hashes ordenados) en `dd_report_cache` — skip re-generación si la evidencia base no cambió.
3. **Multi-Query RAG:** SECTION_QUERY_MAP con 100+ entradas — una query pgvector por `required_section` del template. `multiQueryRetrieval()` en `src/lib/vdr/multi-query-retrieval.ts`.
4. **Analysis Results acumulativos:** Tabla `dd_analysis_results` con UPSERT (version increment on conflict).
5. **HTML Template Engine:** 7 templates dedicados (societario, IP, red_flags, PMO, executive, negotiation, deal_summary) + fallback genérico. Renderizado en n8n workflow `dd_report_render`.
6. **PDF on-demand:** API route `/api/reports/pdf` con Puppeteer (no pre-generado).
7. **Markdown export:** API route `/api/reports/md` para formatos externos (.doc/.pptx).
8. **TTL Cache:** Invalidación por cadencia de template: daily=24h, weekly=7d, monthly/on_demand=30d.

**n8n Workflows (3 nuevos):**

| Workflow | n8n ID | Webhook | Función |
|----------|--------|---------|---------|
| dd_ingest_pipeline | `HeenX8fGJV8PyuJX` | `/webhook/dd-ingest-pipeline` | Ingesta con content-hash dedup |
| dd_report_orchestrator | `9GZKI27F4bKQJMhC` | `/webhook/dd-report-orchestrator` | Orquestación con evidence cache |
| dd_report_render | `lhHRkEuOpPR4V9YV` | `/webhook/dd-report-render` | Renderizado HTML (7 templates + fallback) |

**DB (3 migrations: 202602280001–003):**

| Tabla | Propósito |
|-------|-----------|
| `dd_analysis_results` | Resultados de análisis acumulativos por sección |
| `dd_report_cache` | Cache L2 por evidence_hash + TTL |
| `dd_report_versions` | Versiones inmutables (HTML + MD + metadata) |

Columnas nuevas en `vdr_documents`: `content_hash`, `embedding_status`, `embedding_hash`, `last_embedded_at`.

**DoD:**
1. Ingesta skip unchanged (content_hash match).
2. Report generation skip cuando evidence_hash coincide y TTL no expirado.
3. Multi-query retrieval con 1 query por sección requerida del template.
4. PDF export funcional via Puppeteer.
5. Los 3 n8n workflows creados y validados estructuralmente.

**Estado actual:** ✅ Implementado. 3 workflows creados en n8n Cloud (inactivos — pendiente credenciales Supabase API en ingest/orchestrator). Render listo para activación. TypeScript sin errores. Tests pasando.

#### 4.B.9 Finding-Centric Architecture (Hallazgo)

El "hallazgo" (finding) se convierte en la **unidad mínima de gestión** del DD. Implementado via patrón Strangler Fig con feature flag `FINDINGS_FIRST`.

**Componentes:**

1. **dd_findings** — Tabla canónica (30+ columnas, 9 CHECK constraints, 10-state lifecycle).
2. **dd_finding_evidence** — Enlace N:M finding↔chunk VDR.
3. **dd_report_findings** — Enlace N:M finding↔report.
4. **findings-service.ts** — CRUD completo: `persistFindings()`, `transitionFindingStatus()`, `overrideFindingTier()`, `linkFindingToContingency()`.
5. **Dual-Write** — `engine.ts` y `instance-runner.ts` inyectan findings en las 4 rutas de ejecución de workflows.
6. **6 consumers migrados** — deal-risk scoring, red-flag report, war-room dashboard/red-flags, report-generator, final-report compiler. Todos con fallback legacy.
7. **21 findings backfilled** — 19 de contingencias, 2 de workflow metadata JSONB.

**Lifecycle (10 estados):** `identified → under_review → validated → contested → accepted → mitigated → reported → negotiated → resolved / dismissed`

**Relevance Tiers:** Tier 1 (Decisorio), Tier 2 (Gestión), Tier 3 (Registro). Auto-calculated, overridable.

**DB (8 migrations: 202602280004–011):** 3 tablas + finding_id FK en tablas existentes + RLS + 7 RPCs + CHECK constraints + backfill.

**API (3 endpoints):**
```
GET    /api/findings?project_id=...&tier=...&status=...&area_code=...&summary=true
GET    /api/findings/[id]
PATCH  /api/findings/[id]
```

**Feature flag:** `FINDINGS_FIRST` — cuando ON, lecturas usan `dd_findings`. Actualmente OFF (dual-write only).

**DoD:**
1. Tabla dd_findings con lifecycle enforced por RPC.
2. Dual-write en todas las rutas de ejecución de workflows.
3. 6 consumers con FINDINGS_FIRST switch y fallback.
4. Backfill completo (21 findings, bidirectional FK).
5. API CRUD con permisos granulares (4 permissions).

**Estado actual:** ✅ Fases A-E.2.5 completadas. FINDINGS_FIRST=on y FINDING_OBJECTIVES=on en producción. 54 Finding Objectives seeded (7 áreas). 36 E2E tests (`@fo` tag). Pendiente Fase E.3-E.4 (validar consumidores + cleanup legacy).

### 4.C Pendiente (Horizonte 2/3)

**Horizonte 2 — Expansion Areas + Golden Path (60 dias):**
- ~~Publicar 6 workflows planned (WF-07 a WF-12)~~ ✅ Published con migration `202602270007`.
- Golden path E2E: validar WF-04 Contratos Materiales (DoR→IA→HITL→War Room→Informe).
- AP-level Kanban: 1 tarea por Analysis Point (no 1 por fase).
- DoR enforcement via VDR semantic search.
- ~~Evidence linking automatico (findings→vdr_chunks)~~ ✅ Implementado via `dd_finding_evidence` (migration 202602280005).
- Gateway rate limit por familia (completion/vault/audit).
- ~~Observability: Vercel Cron para audit sync~~ ✅ Implementado (`vercel.json` cron cada 15 min).
- RLS hardening: ~~CI lint~~ ✅ `scripts/lint-service-role.sh` + ~~security migrations~~ ✅ `202602270006/011/012`. Pendiente: matriz rol×endpoint E2E.
- ~~Retrieval hibrido: BM25 + pgvector + chunking adaptativo~~ ✅ Implementado (`hybridSearch()` RRF k=60, `bm25_search_vdr_chunks` RPC, adaptive chunking).

**Horizonte 3 — Scoring + Reporting Comite (90 dias):**
- ~~Scoring consolidado cross-area (Deal Risk Score)~~ ✅ Implementado (`dd_deal_risk_scores`, scoring engine con severity×probability×timing×area weighting).
- ~~Reporting para comite de inversion~~ ✅ Parcial: final report compiler, red flag report generator, workflow report engine implementados. Pendiente: PDF Garrigues format.
- ~~War Room completo: timeline negociacion + dashboard negotiation actions~~ ✅ Implementado (timeline, negotiation-dashboard, decision-resolution, SPA mapping).
- Review Tables y Tabular Review (herramientas Harvey nativas).
- Fichas modelo Garrigues (17 campos societaria, cuadro socios).

## 5. Arquitectura tecnica

### Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Garrigues Design System.
- **State**: Zustand 5.0 (client), UserContext (auth/roles).
- **Backend**: Next.js API Routes (120 endpoints server-side).
- **Base de datos**: Supabase (PostgreSQL + RLS + pgvector).
- **IA**: Harvey AI via Harvey Gateway (con fallback a n8n).
- **Orquestacion**: n8n Cloud (12 workflows, migracion progresiva a gateway).
- **Deploy**: Vercel (production: `dd-legal-pmo.vercel.app`, auto-deploy desde main).
- **Auth**: 16 usuarios Supabase Auth (1 admin + 8 demo + 4 project-specific + 3 seed).
- **Tests**: Playwright E2E (30 suites, 293+ tests, 0 failures).

### Diagrama E2E

```
VDR interno (docs + versiones + permisos)
  -> Ingestion (texto/OCR/normalizacion)
  -> Chunking legal (section-aware + metadata)
  -> pgvector (embeddings + HNSW index)
  -> Retriever por skill (filtros: area/categoria/version)
  -> Evidence Pack v2 ([SRC-xxx] trazable)
  -> Harvey Gateway
     -> Ruta A: Completion directa -> Output IA
     -> Ruta B: Completion + Vault RAG -> Output IA + citaciones
  -> HITL (approve/correct/reject)
  -> Hallazgos (ranking + red flags)
  -> Report Engine (secciones + anexos)
```

### Modelo de datos

#### Tablas existentes (72+ total en public schema)

| Tabla | Descripcion |
|-------|-------------|
| `dd_projects` | Proyectos DD (status, deal_type, review_depth) |
| `dd_areas` | 11 areas de revision |
| `dd_processes` | Procesos por area con harvey_prompt |
| `dd_tasks` | Ejecucion/seguimiento (evolucionara a modelo Kanban) |
| `dd_contingencies` | Contingencias/riesgos |
| `dd_tools` | Catalogo herramientas |
| `dd_tool_executions` | Log ejecuciones |
| `dd_skills_catalog` | 63 skills con prompts + quality gates |
| `dd_evidence_packs` | Evidence Packs |
| `dd_societario_requests/snapshots` | Societario pipeline |
| `dd_ip_requests/snapshots` | IP pipeline |
| `dd_reports` | Reportes (31 templates, grounding, versions, freeze) |
| `dd_alerts` | Alertas negociacion |
| `dd_agent_executions` | Observabilidad agentes |
| `dd_documents` | Data Room docs |
| `dd_expected_documents` | Gap list (22 docs, 6 areas) |
| `dd_domain_enums` | 15 enumeraciones canonicas |
| VDR tables | vdr_folders, vdr_documents, vdr_document_versions, vdr_acl, vdr_links |
| QA tables | qa_threads, qa_messages, qa_assignments, qa_sla, qa_links, dd_qa_threads, dd_qa_messages |
| Negotiation | dd_contingency_ext, dd_spa_clauses, dd_contingency_clause_map |
| Events/Audit | dd_event_log, dd_audit_log |

#### Tablas nuevas (v3.0 + Workflow Spec v1)

| Tabla | Slice | Descripcion |
|-------|-------|-------------|
| `dd_project_roles` | S1 | Roles por proyecto (user_id, project_id, role) |
| `dd_kanban_config` | S2 | Config de columnas Kanban por proyecto (order, wip_limit, dor, dod) |
| `dd_kanban_tasks` | S2 | Modelo extendido de tarjeta Kanban (+ workflow_instance_id, workflow_phase) |
| `dd_gateway_telemetry` | S0 | Log de llamadas Gateway (route, latency, status, rate_limit_remaining) |
| `dd_slo_snapshots` | S5 | Snapshots periodicos de metricas SLO |
| `vdr_chunks` | S4 | Chunks con embeddings vector(1536) + metadata |
| `vdr_ingestion_jobs` | S4 | Jobs de ingestion asincrona |
| `dd_war_room_decisions` | S6 | Registro de decisiones con evidence refs |
| `dd_war_room_notifications` | S6 | Notificaciones de cambio de severidad |
| `dd_workflow_templates` | S3 | Templates maestros (22 rows, 16 unicos) |
| `dd_workflow_template_versions` | S3 | Versiones inmutables (phases JSONB, hitl_policy) |
| `dd_workflow_instances` | S3 | Ejecucion por proyecto (status, current_phase) |
| `dd_workflow_task_groups` | S3 | Grupo de tareas por fase de instancia |
| `dd_negotiation_actions` | S3/S6 | Acciones de negociacion (fase propuesta_transaccional) |
| `dd_analysis_results` | RAG | Resultados de análisis acumulativos por sección (UPSERT) |
| `dd_report_cache` | RAG | Cache L2 de informes por evidence_hash + TTL |
| `dd_report_versions` | RAG | Versiones inmutables de informes (HTML + MD) |
| `dd_findings` | Finding | Tabla canónica de hallazgos (30+ columnas, 9 CHECK constraints) |
| `dd_finding_evidence` | Finding | Enlace N:M finding↔chunk VDR |
| `dd_report_findings` | Finding | Enlace N:M finding↔report |

### Migraciones existentes (50)

```
supabase/migrations/
  20260103175640_remote_baseline.sql
  202602200001_hitl_client_visibility.sql
  ... (10 baseline migrations)
  202602260001_rls_core_tables.sql          # S1: RLS policies
  202602260002_kanban_tasks.sql             # S2: Kanban engine
  202602260003_observability.sql            # S5: Telemetry + SLO
  202602270001_seed_demo_users.sql          # Auth: 8 demo users
  202602270002_workflow_templates.sql       # S3: 5 tables + enum + RLS
  202602270003_seed_workflow_templates.sql  # S3: 6 MVP seeds (v1)
  202602270004_expand_workflow_phases.sql   # S3: enum +2 (informe, propuesta_transaccional)
  202602270005_expanded_workflow_catalog.sql # S3: 16 templates YAML v1
  202602270006_security_hardening.sql       # RLS on 6 tables, SECURITY INVOKER views
  202602270007_area_skills_publish_wf07_12.sql # Publish WF-07 to WF-12
  202602270008_hitl_workflow_columns.sql    # Expand dd_hitl_decisions for workflow-level HITL
  202602270009_bm25_search_rpc.sql          # BM25 full-text search function + GIN index
  202602270010_h3_scoring_columns.sql       # Deal Risk Score table (dd_deal_risk_scores)
  202602270011_security_search_path.sql     # Idempotent search_path fixes
  202602270012_rls_tighten_policies.sql     # Project-scoped RLS on 10 tables
  ... + 14 more (skills, seeds, vdr, war room)
  202602230001_seed_v3_schema.sql          # Seed v3: dd_qa_threads, dd_qa_messages, seed_uuid()
```

### Flujo IA end-to-end (v3.0)

```
1. Usuario invoca herramienta o skill desde proyecto/Kanban
2. API Route construye Evidence Pack v2 (fuentes indexadas [SRC-XXX] con chunk refs)
3. API Route carga skill(s) relevantes de dd_skills_catalog
4. API Route crea registro en dd_reports (status: pending)
5. API Route envia a Harvey Gateway:
   - Ruta A: completion directa (prompt <= 20k chars)
   - Ruta B: completion + Vault RAG (si hay knowledge_sources)
   - Gateway controla: rate limits, backoff 429, concurrencia, client_matter_id
   - Feature flag: si gateway falla, fallback a n8n webhook
6. Harvey responde
7. Gateway ejecuta Agent Pipeline:
   a. Paranoico: valida citas [SRC-XXX] y URLs contra allowlist
   b. Validador: verifica schema y secciones requeridas
   c. Sanitizer: limpia PII y normaliza formato
8. Gateway registra metricas (latencia, ruta, status)
9. API Route actualiza dd_reports (harvey_response, status: done)
10. API Route ejecuta grounding validation (5 checks, score 0-100)
11. Si skill.hitl_required = true, tarjeta Kanban pasa a "HITL revision"
12. Hallazgos se insertan en tarjeta con ranking + dual-write a dd_findings (si FINDINGS_FIRST habilitado)
13. API Route retorna {success, report_id, grounding_score}
```

## 6. API Contracts

### Existentes (55+ endpoints)
Se mantienen todos los endpoints documentados en v2.0 mas los endpoints VDR, QA, Negotiation, Events, Notifications, AI, Auth, y Configuracion ya implementados.

### Nuevos en v3.0

#### Gateway (3)
```
POST /api/gateway/completion  -> { success, result, route, latency_ms, rate_limit_remaining }
POST /api/gateway/vault       -> { success, result, citations[], latency_ms }
GET  /api/gateway/health      -> { status, rate_limits{}, p95, error_rate, fallback_active }
```

#### Kanban (5)
```
GET    /api/kanban/board?project_id=X     -> { columns[], tasks[], wip_limits{}, metrics }
POST   /api/kanban/tasks                  -> { success, task }
PATCH  /api/kanban/tasks/[id]             -> { success, task }
PATCH  /api/kanban/tasks/[id]/move        -> { success, task, wip_violation? }
GET    /api/kanban/metrics?project_id=X   -> { aging{}, throughput, wip_violations[], blockers[] }
```

#### VDR v2 (3)
```
POST /api/vdr/search/semantic  -> { results[]{chunk_id, content, similarity, document, page} }
POST /api/vdr/ingest           -> { success, job_id }
GET  /api/vdr/ingest/[id]      -> { job, status, chunks_created, error? }
```

#### Observabilidad (3)
```
GET /api/observability/slos     -> { metrics[], alerts[], last_updated }
GET /api/observability/harvey   -> { p95, error_rate, retry_ratio, throughput, by_route }
GET /api/observability/pipeline -> { pass_rate, correction_rate, latency_by_skill }
```

#### War Room (5)
```
GET  /api/war-room/[project_id]                       -> { red_flags[], blockers[], progress{}, decisions[] }
POST /api/war-room/[project_id]/decisions             -> { success, decision }
GET  /api/war-room/[project_id]/red-flags             -> { flags[]{severity, probability, impact, evidence, action} }
POST /api/war-room/[project_id]/export                -> { file_url, format }
POST /api/war-room/[project_id]/negotiation-actions   -> { success, action }
GET  /api/war-room/[project_id]/negotiation-actions   -> { actions[] }
```

#### Tasks (1)
```
PATCH  /api/tasks/[id]/status                 -> { success, task } (status validation: backlog/todo/in_progress/review/blocked/done/cancelled)
```

#### Findings (3)
```
GET    /api/findings?project_id=X&tier=1,2&status=...  -> { findings[], meta }
GET    /api/findings/[id]                               -> { finding, evidence[], reports[] }
PATCH  /api/findings/[id]                               -> { success, finding }
```

#### Report Export (2)
```
GET  /api/reports/pdf?report_version_id=X&project_id=Y  -> PDF binary
GET  /api/reports/md?report_version_id=X&project_id=Y   -> Markdown file
```

#### Workflows v1 (5 nuevos)
```
GET    /api/workflows/templates               -> { templates[] }
POST   /api/workflows/instantiate             -> { instance, tasks_created }
GET    /api/workflows/instances?project_id=X  -> { instances[] }
PATCH  /api/workflows/instances/[id]/phase    -> { instance, next_phase, hitl_required }
```

## 7. Ranking de hallazgos y red flags

Modelo normalizado para que la DD "condicione negociacion y cierre":

| Dimension | Valores | Uso |
|-----------|---------|-----|
| Severidad legal | critical / high / medium / low / informational | Clasificacion base |
| Probabilidad | alta / media / baja | Basada en evidencia y recurrencia |
| Impacto economico | importe estimado o banda + tipo | contingencia, pasivo, perdida de valor, coste operativo |
| Timing | blocking (signing/closing) / post-closing | Para priorizacion en negociacion |
| Mitigacion recomendada | CP / indemnidad / ajuste de precio / covenant / remediation plan | Accion concreta |
| Verificabilidad | verificado / parcialmente / no verificable | Si falta evidencia o hay conflicto |

Cada hallazgo vive en `dd_findings` (tabla canónica, 10-state lifecycle, 3-tier relevance) con enlace N:M a evidence chunks y reportes. Feature flag `FINDINGS_FIRST` controla lectura desde `dd_findings` vs legacy `findings[]` JSONB.

## 8. Strangler Slices y criterios de aceptacion

### Principio: Strangler Fig + convivencia controlada

Mantener n8n como fallback mientras se introduce gateway, Kanban y workflows nuevos por slices priorizados.

### Slices

| Slice | Objetivo | Dependencia | Esfuerzo | Parallelizable |
|-------|----------|-------------|----------|----------------|
| S0 | Harvey Gateway v1 | Harvey API | M | Si (independiente) |
| S1 | Auth + Roles + RLS | Supabase Auth | M | Si (independiente) |
| S2 | Kanban + Motor de Tareas | S1 | M | Parcial (necesita S1 para RLS) |
| S3 | 6 Workflows MVP | S0 + S2 | L | Parcial (4 nuevos + 2 existentes) |
| S4 | VDR v2 + Vectorizacion | pgvector | L | Si (independiente) |
| S5 | Observabilidad | Harvey logs | M | Si (independiente) |
| S6 | War Room | S2 + S3 | M | No (depende de datos) |

### Ejecucion paralela (P0)

```
Semana 1-3:  S0 (Gateway) + S1 (Auth) + S4 (VDR v2 inicio) — en paralelo
Semana 2-5:  S2 (Kanban) — arranca cuando S1 tiene RLS basico
Semana 3-8:  S3 (Workflows) — arranca cuando S0 + S2 tienen base
Semana 4-6:  S5 (Observabilidad) — en paralelo
Semana 6-10: S6 (War Room) — cuando S2 + S3 tienen datos
```

### Patrones de rollback

| Patron | Cuando | Como |
|--------|--------|------|
| Feature flag de ruteo | Migrar llamadas IA | Gateway decide: nuevo worker vs n8n webhook |
| Shadow mode | Validar calidad | Doble ejecucion: mantiene actual, compara nuevo en background |
| Rollback por degradacion | Incidente en produccion | Si p95 o error rate supera umbral, volver a n8n |
| Expand/contract | Cambios BD sin downtime | Anadir columnas/tablas, dual-write, migrar lectura, limpiar |
| Colas idempotentes | Reintentos ante 429/5xx | Job keys por (project, task, doc_version) |
| Error workflows n8n | Mientras n8n siga activo | Error Trigger + alerting |

## 9. Harvey API Constraints

### Limites de la API

| Constraint | Valor |
|-----------|-------|
| Endpoint completion | `POST /api/v2/completion` (multipart/form-data) |
| Limite prompt | 20.000 caracteres |
| `file` vs `knowledge_sources` | Mutuamente excluyentes |
| Vault upload | Max 50 ficheros/request, 100 MB/fichero |
| `duplicate_mode` | skip / replace (idempotencia) |
| Auth | Bearer token + HTTPS obligatorio |
| Region | EU (eu.api.harvey.ai) |
| Validacion token | `GET /api/whoami` |
| `include_citations` | Devuelve `response_with_citations` + `sources` con grounding |

### Rate Limits

| Familia | RPM (por org) |
|---------|---------------|
| Completion | 20 |
| Vault | 10 |
| Audit | 60 |
| History | 60 |
| Client matters | 150 |

### Implicaciones de diseno
- Colas/workers obligatorios: no ejecutar cargas masivas en request/response UI.
- Backoff exponencial en 429.
- Control de concurrencia por familia de endpoint.
- Vault RAG/completion requiere habilitacion comercial adicional.
- Query History contiene inputs/outputs (dato sensible) — solo forensics con retencion estricta.
- Usage History (sin inputs/outputs) para BI.

## 10. Roadmap

### Completado (v1.0 + v2.0)
- Dashboard PMO + Proyectos DD (CRUD + 6 tabs + cockpit + negotiation + activity)
- Tool Societario (7 fases) + Tool IP Radar (5 fases)
- Reporting Engine (31 templates, 5 familias) + Reports UI (hub + wizard + visor + freeze + compare + export)
- Skills Catalog (63 skills, 4 operativos, 8 seeded, 28 FMC, 23 planificados)
- Evidence Pack v1.1 con grounding validation (5 checks, score 0-100)
- Alertas de negociacion + Red Flags Digest
- HITL + Portal Cliente + HITL badges
- Agent Pipeline n8n (Paranoico + Validador + Sanitizer — creados, inactivos)
- Data Room v1 + VDR v1.5 (upload, folders, ACL, audit, versioning, links, search, gap list)
- Q&A Module (threads, messages, assignments, SLA, links)
- Negotiation Module (contingencias ext, clausulas SPA, mapeo)
- Events & Notifications (12 event types, realtime, smart suggestions)
- Quality gates juridicos (domain enums, confidence, HITL obligatorio)
- Garrigues Design System completo (tokens, 11 workstream colors, WCAG AA)
- Role-based dashboards (Lawyer, Leader, PMO, Client)
- Deploy Vercel + env vars + Supabase migrations (10)

### P0 — Marco operativo (Slices S0-S6) — ✅ Sprint Feb 2026 — DESPLEGADO
1. **S0**: Harvey Gateway v1 ✅ — backoff, feature flag, metricas, Vault RAG, SLO p95, **circuit breaker**, **Retry-After**.
2. **S1**: Supabase Auth + RLS ✅ — roles por proyecto, middleware, requirePermission (82 routes).
3. **S2**: Kanban operativo ✅ — 10 estados, WIP, aging, DoR/DoD, alerts, **workflow_instance_id**.
4. **S3**: **16 workflow templates** ✅ — 6 fases DD, dual-run engine, instantiation + phase advancement, negotiation actions.
5. **S5**: Observabilidad ✅ — panel SLO, metricas Gateway, telemetry batching.
6. **S4**: VDR v2 ✅ — pgvector, semantic search, Evidence Pack v2, Vault sync, **BM25 hybrid search**, **adaptive chunking**.
7. **S6**: War Room ✅ — dashboard, decisions, red-flags, severity notifications, export, **negotiation_actions API**, **SPA mapping**, **timeline**, **decision resolution**.
8. **H3 Scoring** ✅ — Deal Risk Score engine (severity×probability×timing×area weighting), per-project scoring API.
9. **Reporting** ✅ — Final report compiler, red flag report generator, workflow report engine.
10. Tests E2E: 30 suites, 293+ tests (0 failures) covering all slices.
11. DB: 72+ tablas, 50 migrations, Postgres 17.6 Pro.
12. **Deploy**: Vercel `dd-legal-pmo.vercel.app` ✅, 10 env vars, Supabase connected, n8n reachable, Cron audit-sync active.
13. **Synthetic Test Dataset v3**: 3 proyectos seed (Green/Amber/Red) con 342+ filas en 16 tablas, 16 usuarios auth, 47 project roles. CSVs fuente en `docs/output_v3/`. Consolidacion de workflows con prompt-builder enriquecido (sesion 2026-02-23, reporte en `docs/reports/`).
14. **Incremental RAG + Two-Level Cache** ✅ — Content-hash L1, evidence-hash L2, multi-query retrieval (100+ SECTION_QUERY_MAP entries), analysis results UPSERT, 3 n8n workflows (ingest/orchestrator/render), PDF/MD export.
15. **Finding-Centric Architecture** ✅ — dd_findings como unidad canónica, 10-state lifecycle, 3-tier relevance, dual-write, 6 consumers migrados, 21 findings backfilled, 54 Finding Objectives seeded, 36 E2E tests. Feature flags `FINDINGS_FIRST=on`, `FINDING_OBJECTIVES=on` en producción.

### P1 — Expansion Areas + Golden Path (Horizonte 2)
1. ~~Publicar 6 workflows planned (WF-07 a WF-12)~~ ✅ Done.
2. Golden path E2E: WF-04 Contratos (DoR→IA→HITL→War Room→Informe).
3. AP-level Kanban task generation (1 tarea por Analysis Point).
4. DoR enforcement via VDR semantic retrieval.
5. ~~Evidence linking automatico findings→chunks~~ ✅ Done (dd_finding_evidence table, migration 202602280005).
6. Gateway rate limit por familia (completion 5 / vault 3 / audit 15).
7. ~~Observability: Vercel Cron audit sync~~ ✅ Done. Pendiente: metricas por fase + alertas SLO→War Room.
8. ~~RLS hardening: CI lint service_role_key~~ ✅ Done (`scripts/lint-service-role.sh` + migrations 6/11/12). Pendiente: matriz rol×endpoint E2E.
9. ~~Retrieval hibrido BM25 + pgvector + chunking adaptativo~~ ✅ Done.
10. ~~**Fase E.1-E.2.5: FINDINGS_FIRST activation**~~ ✅ Done — `FINDINGS_FIRST=on`, `FINDING_OBJECTIVES=on` in Vercel, 54 FOs seeded, 36 E2E tests. Pendiente: Fase E.3-E.4 (validate consumers, deprecate legacy JSONB).
11. **n8n credentials setup** — Configure Supabase HTTP Header Auth credentials in n8n for ingest/orchestrator workflows.

### P2 — Scoring + Reporting Comite (Horizonte 3)
1. ~~Scoring consolidado cross-area (Deal Risk Score)~~ ✅ Done (H3 scoring engine + API).
2. ~~Reporting comite~~ ✅ Parcial (final report compiler, red flag report, workflow report). Pendiente: PDF Garrigues format.
3. ~~War Room completo: timeline + dashboard negotiation actions~~ ✅ Done.
4. Tools UI dedicados para Contratos, Laboral, Fiscal.
5. Fichas modelo Garrigues (17 campos societaria, cuadro socios).
6. Integracion Registro de la Propiedad y CCAA.
7. Review Tables (Tabular Review Harvey nativo).

## 11. Metricas de exito

### Metricas de producto (v2.0 + actualizadas)

| Metrica | Objetivo |
|---------|----------|
| Grounding score medio | >= 80/100 |
| Cobertura de fuentes citadas | >= 95% |
| Tiempo snapshot -> report | < 60s |
| Skills activos | >= 30 (cobertura FMC) |
| Templates operativos | 35 (5 familias, 7 con HTML dedicado) |
| Agent pipeline pass rate | >= 90% |
| PII redaction rate | 100% |
| Data room gap coverage | >= 80% por proyecto |
| Workflows MVP activos | **16/16 published** |
| Workflow templates total | 16/16 seedeados |
| Kanban adoption | 100% proyectos nuevos |

### SLOs operativos (nuevos)

| Metrica | Target |
|---------|--------|
| Latencia p95 completion | < 30s |
| % 429 / retry ratio | < 5% |
| Throughput ingestion VDR | > 50 docs/hora |
| Ratio HITL corrections | < 20% por skill |
| Errores n8n | < 2% (mientras exista convivencia) |
| Uptime Gateway | > 99.5% |

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|-----------|
| Quota/rate limits Harvey (Vault 10rpm, Completion 20rpm) | Cuellos de botella y timeouts | Colas + batching + control concurrencia; backoff 429; sync selectivo a Vault |
| Exposicion de texto sensible via Query History | Riesgo RGPD y reputacional | Usage para BI; Query solo forensics con permisos/retencion; cifrado y minimizacion |
| Dependencia operativa de n8n | Fallos de ejecucion y baja observabilidad | Strangler: gateway + workers; mientras, error workflows/alerting en n8n |
| Auth/roles pendientes | Acceso indebido a datos | Implementar Auth y RLS efectivas (S1); service_role nunca en cliente |
| Limitaciones funciones Vercel (timeout, payload) | Fallos en pipelines largos | Asincronia (jobs/workers); no payload grande en API routes |
| Cumplimiento RGPD/EDPB en uso IA | Sanciones/obligaciones | Privacy by design/default (art.25); seguridad (art.32); EIPD cuando aplique |
| Migracion Kanban rompe flujo existente | Resistencia y bugs | Expand/contract; dual-write temporal; feature flag |
| pgvector en Supabase (limites de plan) | Performance en busquedas | HNSW index; monitorizar; plan Supabase adecuado |

## 13. Requisitos no funcionales

### Seguridad
- Supabase Auth obligatorio para todas las rutas (excepto login y portal cliente).
- RLS en TODAS las tablas — anon no accede a nada.
- `SUPABASE_SERVICE_ROLE_KEY` solo en API routes server-side.
- Agent Sanitizer redacta PII automaticamente.
- HITL obligatorio para outputs de CONT, LAB, FISC, LIT.
- Query History solo con permisos forensics y retencion estricta.
- Privacy by design/default (RGPD art.25).

### Confiabilidad
- Harvey Gateway con backoff, colas, y fallback a n8n.
- Grounding validation con 5 checks independientes.
- Agent Pipeline con scoring 0-100.
- Domain enumerations cerradas.
- Colas idempotentes para retry.

### Trazabilidad
- Cada invocacion IA en dd_reports/dd_agent_executions/dd_gateway_logs.
- Evidence Pack con fuentes indexadas [SRC-XXX] + chunk refs.
- Audit trail completo en tarjetas Kanban.
- Decisions log en War Room.

### Escalabilidad
- Skills catalog extensible (63 -> 100+).
- Templates extensible (31 -> 50+).
- Agent pipeline modular.
- VDR con vectorizacion para volumenes grandes.
- Kanban con WIP limits para control de flujo.

## 14. Known Issues

~~Todos resueltos (23 feb 2026).~~

| Issue | Estado | Fix aplicado |
|-------|--------|-------------|
| ~~Vista General sin datos RLS~~ | ✅ Resuelto | Endpoint consolidado `/api/projects/[id]/overview` + migrar page.tsx de anon Supabase a `fetch()` con Bearer. `updateTaskStatus` migrado a `/api/tasks/[id]/status` PATCH. **0 usos de cliente anon en page.tsx.** |
| ~~401 en nav-badges, active-areas~~ | ✅ Resuelto | Auth headers Bearer anadidos a hooks `use-project-nav-badges.ts` y `use-project-areas.ts` |
| ~~HITL ruta incorrecta~~ | ✅ Ya correcto | Todas las referencias en codigo apuntan a `/projects/[id]/hitl` correctamente |

## 15. Infraestructura

| Servicio | Instancia | Uso |
|----------|-----------|-----|
| Vercel | dd-legal-pmo (`prj_c6BXNArsGxvSeM1k3bKqthgHQpYP`) | Frontend + API Routes (120 endpoints) ✅ LIVE |
| Supabase | mxanelzxyaklvuypuafa (NexusDD) | Base de datos + RLS + pgvector + Auth |
| n8n Cloud | mmenendeza.app.n8n.cloud | Orquestacion IA + Agent Pipeline + Report Pipeline (12 workflows, migracion progresiva) |
| Harvey AI | eu.api.harvey.ai | LLM legal especializado (via Gateway) |
| GitHub | moimene/DDLegal | Repositorio codigo fuente |

## 16. Variables de entorno

| Variable | Tipo | Scope | Descripcion |
|----------|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client + Server | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client + Server | Anon key (client-side, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server ONLY | Service role key (RLS bypass, API routes) |
| `N8N_WEBHOOK_BASE_URL` | Secret | Server ONLY | Base URL de webhooks n8n Cloud |
| `HARVEY_API_KEY` | Secret | Server ONLY | API key de Harvey AI (legacy, some routes) |
| `HARVEY_TOKEN` | Secret | Server ONLY | Harvey bearer token (gateway) |
| `HARVEY_ENDPOINT_V1` | Secret | Server ONLY | Harvey completion endpoint (EU region) |
| `HARVEY_ENDPOINT_HISTORY` | Secret | Server ONLY | Harvey history/audit endpoint |
| `HARVEY_FEATURE_FLAG` | Config | Server ONLY | `gateway` / `n8n` / `shadow` (controls routing) |
| `CRON_SECRET` | Secret | Server ONLY | Vercel Cron auth secret (protects `/api/cron/*`) |
| `OPENAI_API_KEY` | Secret | Server ONLY | OpenAI API key (VDR embeddings, text-embedding-3-small) |
| `HARVEY_GATEWAY_FALLBACK` | Config | Server ONLY | `true` para usar n8n como fallback (feature flag) |
| `FINDINGS_FIRST` | Config | Server ONLY | `true` / `false` — cuando true, lecturas usan dd_findings como fuente (default: false) |

### Estado Vercel Env Vars (Produccion)

| Variable | Configurada |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `N8N_WEBHOOK_BASE_URL` | ✅ |
| `HARVEY_ENDPOINT_V1` | ✅ |
| `HARVEY_ENDPOINT_HISTORY` | ✅ |
| `HARVEY_TOKEN` | ✅ |
| `HARVEY_FEATURE_FLAG` | ✅ (`gateway`) |
| `CRON_SECRET` | ✅ |
| `HARVEY_API_KEY` | ✅ |
| `OPENAI_API_KEY` | ❌ Pendiente |
