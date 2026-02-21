# PRD - DD Legal PMO v3.0
**Ultima actualizacion: 21 febrero 2026**

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
Hub (`/reports`) + Wizard 3 pasos (`/reports/new`) + Visor con grounding (`/reports/[id]`). Freeze control, version history, compare, export. 31 templates en 5 familias.

#### Tool Societario (7 fases)
Request > Resolve > BORME Query > BORME Ingest > Snapshot > Validate > Report. UI: CandidateResolver, PipelineTracker, SnapshotViewer.

#### Tool IP Radar (5 fases)
Request > Resolve > Search > Snapshot > Report.

#### Reporting Engine (31 templates, 5 familias)

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
3 agentes (Paranoico, Validador, Sanitizer). Workflows creados en n8n Cloud. **Estado: inactivos, pendiente credenciales Harvey.**

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

#### 4.B.4 Workflows MVP (Slice S3)

6 workflows que cubren deal breakers tipicos y control de proyecto:

| # | Workflow | Area | Objetivo | Salida |
|---|---------|------|----------|--------|
| 1 | Arranque DD + backlog | Transversal | Crear tablero, grupos y tareas base | Checklist + RACI + cronograma + Q&A |
| 2 | Data Room + gap list | Transversal | Control de documentacion | Gap list viva + solicitudes + trazabilidad |
| 3 | Societario | MERC | Snapshot + discrepancias + red flags | Hallazgos + CP/acciones + evidencias |
| 4 | Contratos materiales | CONT | Clausulas criticas y change of control | Tabla contratos + red flags + mitigacion |
| 5 | IP titularidad | PI | Riesgo titularidad/uso/encumbrances | Snapshot IP + red flags + acciones |
| 6 | Laboral & Fiscal | LAB/FISC | Pasivos contingentes y riesgos | Risk register rankeado + mitigacion |

Cada workflow produce:
1. Hallazgos estructurados con ranking.
2. Red flags destacados (deal critical).
3. Recomendacion de mitigacion/negociacion.
4. Seccion del informe-conclusion de area.
5. Evidence pack con trazabilidad.

Workflows 3 y 5 ya existen. Se crean workflows 1, 2, 4 y 6.

Skills a activar para workflows nuevos:
- CONT: `cont_extractor_clausulas`, `cont_change_of_control`, `cont_scoring_riesgo`, `cont_tabla_contratos`.
- LAB: `lab_categoria_personal`, `lab_contingencia_laboral`, `lab_incentivos`, `lab_convenio_colectivo`.
- FISC: activar skills FMC seeded.

**DoD:**
1. Cada workflow produce seccion de informe-conclusion de area.
2. Hallazgos con ranking (severidad/probabilidad/impacto) y red flags.
3. HITL obligatorio donde aplique (CONT, LAB, FISC).
4. Trazabilidad a evidencia (evidence_refs).
5. Rollback posible a workflow n8n equivalente via feature flag.

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

### 4.C Pendiente (P1/P2)

- Skills operativos Phase C-F: Fiscal, Inmobiliario, Litigios, Regulatorio, Medioambiental, Datos.
- Tools UI dedicados para Contratos, Laboral, Fiscal, Inmobiliario.
- Integracion con Registro de la Propiedad, CCAA, escrituras.
- Fichas modelo Garrigues completas (17 campos societaria, cuadro socios, fichas contratos).
- Review Tables y Tabular Review (herramientas Harvey nativas).
- Scoring cross-area avanzado.
- Reporting para comite de inversion.

## 5. Arquitectura tecnica

### Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Garrigues Design System.
- **State**: Zustand 5.0 (client), UserContext (auth/roles).
- **Backend**: Next.js API Routes (55+ endpoints server-side).
- **Base de datos**: Supabase (PostgreSQL + RLS + pgvector).
- **IA**: Harvey AI via Harvey Gateway (con fallback a n8n).
- **Orquestacion**: n8n Cloud (9 workflows, migracion progresiva a gateway).
- **Deploy**: Vercel (production + preview, auto-deploy desde main).
- **Tests**: Playwright E2E (12+ suites).

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

#### Tablas existentes (19+)

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
| QA tables | qa_threads, qa_messages, qa_assignments, qa_sla, qa_links |
| Negotiation | dd_contingency_ext, dd_spa_clauses, dd_contingency_clause_map |
| Events/Audit | dd_event_log, dd_audit_log |

#### Tablas nuevas (v3.0)

| Tabla | Slice | Descripcion |
|-------|-------|-------------|
| `dd_project_roles` | S1 | Roles por proyecto (user_id, project_id, role) |
| `dd_kanban_columns` | S2 | Config de columnas Kanban por proyecto (order, wip_limit, dor, dod) |
| `dd_kanban_tasks` | S2 | Modelo extendido de tarjeta Kanban (ver 4.B.3) |
| `dd_task_groups` | S2 | Agrupaciones de tareas por area/workflow |
| `dd_gateway_logs` | S0 | Log de llamadas Gateway (route, latency, status, rate_limit_remaining) |
| `dd_gateway_metrics` | S0 | Metricas agregadas (p95, error_rate, 429_ratio) |
| `vdr_chunks` | S4 | Chunks con embeddings vector(1536) + metadata |
| `vdr_ingestion_jobs` | S4 | Jobs de ingestion asincrona |
| `dd_war_room_decisions` | S6 | Registro de decisiones con evidence refs |
| `dd_slo_snapshots` | S5 | Snapshots periodicos de metricas SLO |

### Migraciones existentes (10)

```
supabase/migrations/
  20260103175640_remote_baseline.sql
  202602200001_hitl_client_visibility.sql
  202602200002_tools_evidence_skills.sql
  202602200003_seed_tools_skills.sql
  202602210001_societario_schema.sql
  202602210002_seed_societario_config.sql
  202602210003_seed_fmc_skills.sql
  202602210004_data_room.sql
  202602210005_skill_quality_gates.sql
  202602210006_activate_pending_skills.sql
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
12. Hallazgos se insertan en tarjeta con ranking
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

#### War Room (4)
```
GET  /api/war-room/[project_id]           -> { red_flags[], blockers[], progress{}, decisions[] }
POST /api/war-room/[project_id]/decisions -> { success, decision }
GET  /api/war-room/[project_id]/red-flags -> { flags[]{severity, probability, impact, evidence, action} }
POST /api/war-room/[project_id]/export    -> { file_url, format }
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

Cada hallazgo en `findings[]` de la tarjeta Kanban y en reportes sigue este schema.

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

### P0 — Marco operativo (Slices S0-S3 en paralelo)
1. **S0**: Harvey Gateway v1 con backoff, feature flag, metricas.
2. **S1**: Supabase Auth + RLS + roles por proyecto + middleware.
3. **S2**: Kanban operativo con 10 estados, WIP, aging, DoR/DoD.
4. **S3**: 4 workflows nuevos (arranque, gap list, contractual, laboral/fiscal) + activar skills CONT + LAB + FISC.
5. **S5**: Observabilidad basica (panel SLO, metricas Gateway).
6. Activar 9 workflows n8n con credenciales Harvey.
7. Tests E2E para Kanban, Gateway, Auth, workflows nuevos.

### P1 — Expansion (Slices S4-S5)
1. **S4**: VDR v2 + pgvector + chunking legal + busqueda semantica.
2. **S5**: Observabilidad completa (audit logs, history, alertas, dashboards SLO).
3. Evidence Pack v2 automatizado con trazabilidad a chunk/pagina.
4. Sync selectivo a Harvey Vault.
5. Skills operativos Phase C: Fiscal + Inmobiliario.
6. Skills operativos Phase D: Litigios + Regulatorio.

### P2 — Enterprise (Slice S6 + extensiones)
1. **S6**: War Room completo (red flags sheet, decisions log, notificaciones, export).
2. Scoring cross-area avanzado.
3. Reporting para comite de inversion.
4. Tools UI dedicados para Contratos y Laboral.
5. Skills Phase E-F: Medioambiental + Datos + General.
6. Fichas modelo Garrigues (17 campos societaria, cuadro socios).
7. Integracion con Registro de la Propiedad y CCAA.
8. Review Tables (Tabular Review Harvey nativo).

## 11. Metricas de exito

### Metricas de producto (v2.0 + actualizadas)

| Metrica | Objetivo |
|---------|----------|
| Grounding score medio | >= 80/100 |
| Cobertura de fuentes citadas | >= 95% |
| Tiempo snapshot -> report | < 60s |
| Skills activos | >= 30 (cobertura FMC) |
| Templates operativos | 31 (5 familias) |
| Agent pipeline pass rate | >= 90% |
| PII redaction rate | 100% |
| Data room gap coverage | >= 80% por proyecto |
| Workflows MVP activos | 6/6 |
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

## 14. Infraestructura

| Servicio | Instancia | Uso |
|----------|-----------|-----|
| Vercel | dd-legal-pmo | Frontend + API Routes (55+ endpoints) |
| Supabase | mxanelzxyaklvuypuafa | Base de datos + RLS + pgvector + Auth |
| n8n Cloud | mmenendeza.app.n8n.cloud | Orquestacion IA + Agent Pipeline (migracion progresiva) |
| Harvey AI | eu.api.harvey.ai | LLM legal especializado (via Gateway) |
| GitHub | moimene/DDLegal | Repositorio codigo fuente |

## 15. Variables de entorno

| Variable | Tipo | Scope | Descripcion |
|----------|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client + Server | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client + Server | Anon key (client-side, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server ONLY | Service role key (RLS bypass, API routes) |
| `N8N_WEBHOOK_BASE_URL` | Secret | Server ONLY | Base URL de webhooks n8n Cloud |
| `HARVEY_API_KEY` | Secret | Server ONLY | API key de Harvey AI (bearer token) |
| `HARVEY_GATEWAY_FALLBACK` | Config | Server ONLY | `true` para usar n8n como fallback (feature flag) |
