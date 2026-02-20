# PRD - DD Legal PMO

## 1. Contexto y problema

Los equipos de due diligence legal necesitan coordinar proyectos con multiples areas, procesos y hallazgos en plazos cortos y con trazabilidad suficiente para decision de inversion.

Problemas que resuelve DD Legal PMO:
- Seguimiento fragmentado en documentos y hojas dispersas.
- Baja estandarizacion en el analisis por area.
- Dificultad para convertir hallazgos en contingencias priorizadas.
- Integracion incompleta entre trabajo humano y copiloto IA legal.
- Falta de validacion automatica de outputs IA (alucinaciones, citas falsas).
- Ausencia de pipeline de reporting estandarizado y trazable.
- Gestion manual de propiedad industrial sin integracion con registros oficiales.

## 2. Objetivo de producto

Proveer un PMO legal centralizado que:
- Gestiona proyectos DD end-to-end con soporte IA (Harvey AI).
- Ejecuta analisis especializados por area mediante herramientas dedicadas (Societario, IP Radar, Marcas).
- Genera reportes automatizados a partir de 31 templates configurables.
- Valida outputs IA con un pipeline de 3 agentes (grounding, schema, sanitization).
- Ofrece un catalogo extensible de 12+ skills legales con prompt engineering especializado.
- Proporciona alertas automaticas de negociacion con scoring de riesgo.

### Objetivos de negocio/legal
- Reducir tiempo de arranque de un proyecto DD de dias a horas.
- Estandarizar ejecucion por procesos y areas con skills reutilizables.
- Aumentar confiabilidad de outputs IA con validacion de citas y fuentes.
- Mejorar visibilidad de riesgos mediante consolidacion cross-area de red flags.
- Dejar base operativa para expansion a 30+ skills en 11 areas juridicas.

## 3. Usuarios objetivo y JTBD

### Usuarios principales
- **Lider legal transaccional / CLO**: Supervision de cartera DD y decision estrategica.
- **Abogado de ejecucion DD por area**: Analisis especializado con soporte IA.
- **PM de transaccion**: Coordinacion de avance, deadlines y entregables.
- **Stakeholder de negocio/inversion**: Consumo de resumen de riesgos y red flags.
- **Cliente externo**: Seguimiento read-only de progreso via portal dedicado.

### JTBD
- "Cuando inicio una DD, quiero crear el proyecto y ejecutar analisis societario e IP en una sola plataforma."
- "Cuando analizo una sociedad target, quiero que el sistema consulte registros oficiales (BORME, OEPM, EUIPO) y me genere un snapshot verificable."
- "Cuando necesito un reporte, quiero seleccionar un template y que el sistema genere el draft con evidencia citada y validada."
- "Cuando reviso outputs IA, quiero saber que las citas son reales, las URLs son de fuentes oficiales, y no hay datos inventados."
- "Cuando preparo negociacion, quiero alertas automaticas de red flags criticos con scoring de impacto."

## 4. Alcance funcional

### Implementado (operativo)

#### 4.1 Dashboard PMO
- KPIs: proyectos activos/en revision/completados y areas cubiertas.
- Proyectos recientes con acceso directo al detalle.
- Catalogo de areas de revision.

#### 4.2 Gestion de Proyectos DD
- Listado con buscador por nombre y sociedad target.
- Alta de nuevo proyecto con metadatos de operacion.
- Detalle de proyecto con tabs: Resumen, Tareas, Contingencias.
- Invocacion de Harvey AI por proceso.
- Persistencia y visualizacion de contingencias (severidad, monto, recomendacion).

#### 4.3 Tool Societario (7 fases)
Pipeline completo de due diligence societaria:
1. **Request**: Crear solicitud DD societaria con target y contexto.
2. **Resolve**: Resolver empresa target contra registros mercantiles.
3. **BORME Query**: Consultar y procesar publicaciones BORME.
4. **BORME Ingest**: Ingesta masiva de datos BORME historicos.
5. **Snapshot**: Generar snapshot del estado societario consolidado.
6. **Validate**: Validar snapshot con 5 grounding checks (score 0-100).
7. **Report**: Generar reporte DD via Harvey AI con evidence pack.

Componentes UI: CandidateResolver, PipelineTracker, SnapshotViewer.

#### 4.4 Tool IP Radar (5 fases)
Pipeline de due diligence de propiedad industrial:
1. **Request**: Crear solicitud de analisis IP con titular.
2. **Resolve**: Resolver titular en OEPM/EUIPO.
3. **Search**: Busqueda en registros de marcas y patentes.
4. **Snapshot**: Generar snapshot de cartera IP.
5. **Report**: Generar reporte IP via Harvey con fuentes oficiales.

#### 4.5 Reporting Engine (31 templates)
Motor de reporteria generico con 3 familias:

| Familia | Templates | Harvey AI | Descripcion |
|---------|-----------|-----------|-------------|
| Transactional | ~15 | Si | Reportes que requieren analisis IA (DD societario, IP, contractual) |
| PMO | ~10 | No | Reportes de agregacion de datos (progreso, estado, KPIs) |
| Compliance | ~6 | No | Reportes de conformidad y checklists |

Cada template define: `required_sections[]`, `expected_output_schema`, `evidence_requirements`, `skills[]`.

#### 4.6 Evidence Pack v1.1
Sistema de gestion de fuentes con:
- Indexacion automatica: cada fuente recibe identificador `[SRC-001]...[SRC-NNN]`.
- Grounding validation con 5 checks: citation_exists, url_allowlist, section_coverage, source_coverage, score.
- Score de confiabilidad 0-100 para cada output.
- Allowlist de dominios oficiales: boe.es, borme.es, oepm.es, euipo.europa.eu, wipo.int, registradores.org.

#### 4.7 Skills Catalog (12 activos)
Catalogo extensible de skills legales:

**Phase A (4 operativos):**
- `societario.consulta_rm` — Consulta Registro Mercantil
- `societario.analisis_organos` — Analisis de organos sociales
- `marcas.consulta_oepm` — Consulta OEPM
- `marcas.analisis_riesgo_pi` — Analisis de riesgo PI

**Phase B (8 seeded):**
- `contratos.revision_clausulas` — Revision de clausulas contractuales
- `contratos.analisis_garantias` — Analisis de garantias
- `contratos.change_of_control` — Clausulas de cambio de control
- `contratos.vencimientos` — Analisis de vencimientos
- `laboral.plantilla_estructura` — Estructura de plantilla
- `laboral.convenios_colectivos` — Analisis de convenios colectivos
- `laboral.litigios_pendientes` — Litigios laborales pendientes
- `laboral.planes_retribucion` — Planes de retribucion

Cada skill tiene: `skill_key`, `area_code`, `prompt_template`, `expected_output_schema`, `evidence_requirements`.

#### 4.8 Alertas de Negociacion
- Auto-deteccion de red flags criticos en snapshots y reportes.
- Scoring de impacto con categorizacion de severidad.
- API: `POST /api/alerts/negotiation`.

#### 4.9 Red Flags Digest
- Consolidacion cross-snapshot de red flags.
- API: `POST /api/reports/red-flags-digest`.

#### 4.10 HITL (Human-in-the-Loop)
- Aprobacion, correccion o rechazo de outputs IA.
- Vista dedicada en `/projects/[id]/hitl`.
- API: `POST /api/hitl/decision` con `task_id` + `decision` (approve|correct|reject).

#### 4.11 Portal Cliente
- Vista read-only de proyecto con progreso por area.
- Ruta: `/client/projects/[id]`.
- API: `GET /api/client/projects/[id]`.

#### 4.12 Configuracion
- Panel de configuracion de herramientas y skills.
- Status indicators para servicios externos (Supabase, n8n, Harvey).
- Rutas: `/configuracion`, `/configuracion/herramientas`, `/configuracion/skills`.

### Parcial / En progreso

#### 4.13 Agent Pipeline n8n
Pipeline de 3 agentes de validacion post-Harvey:

| Agente | Funcion | Input | Output |
|--------|---------|-------|--------|
| Paranoico | Validar citas [SRC-XXX] y URLs | harvey_response + evidence_pack | { passed, score, issues[] } |
| Validador | Verificar schema y secciones | harvey_response + output_schema | { valid, missing_sections[], format_errors[] } |
| Sanitizer | Limpiar PII y formato | harvey_response | { sanitized_response, changes_made[] } |

**Estado**: Workflows creados en n8n Cloud (inactivos, pendiente configuracion de credenciales Harvey).

### Pendiente

- Gestion funcional completa de tabs Tareas, Documentos y Q&A.
- Autenticacion y autorizacion (Supabase Auth + RLS + roles).
- Skills Phase C-F (18 skills adicionales en Fiscal, Inmobiliario, Medioambiental, Compliance, Penal, Procesal).

## 5. Arquitectura tecnica

### Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4.
- **Backend**: Next.js API Routes (26 endpoints server-side).
- **Base de datos**: Supabase (PostgreSQL + RLS), admin client para bypass.
- **IA**: Harvey AI via n8n Cloud webhooks.
- **Orquestacion**: n8n Cloud — 9 workflows con agent pipeline.
- **Deploy**: Vercel (production + preview).
- **Tests**: Playwright (2 suites E2E).

### Flujo IA end-to-end

```
1. Usuario invoca herramienta (Societario/IP/Generico)
2. API Route construye Evidence Pack v1.1 (fuentes indexadas [SRC-XXX])
3. API Route carga skill(s) relevantes de dd_skills_catalog
4. API Route crea registro en dd_reports (status: pending)
5. API Route envia POST a n8n webhook con:
   - evidence_pack
   - skill prompts
   - output_schema esperado
   - metadata (report_id, request_id)
6. n8n prepara system_prompt + user_prompt
7. n8n llama Harvey API (eu.api.harvey.ai/api/v1/completion)
8. n8n ejecuta Agent Pipeline:
   a. Paranoico: valida citas y URLs
   b. Validador: verifica schema y secciones
   c. Sanitizer: limpia PII y formato
9. n8n responde al webhook con resultado procesado
10. API Route actualiza dd_reports (harvey_response, status: done)
11. API Route ejecuta grounding validation (5 checks, score 0-100)
12. API Route retorna {success, report_id, grounding_score}
```

### Webhooks n8n (9)

| Path | Workflow | Funcion |
|------|----------|---------|
| `/dd-harvey-invoke` | Harvey Adapter | Adaptador generico Harvey AI |
| `/dd-tool-societario-report` | Societario Report | Reporte DD societario |
| `/dd-tool-ip-report` | IP Report | Reporte DD propiedad industrial |
| `/dd-report-generate` | Report Generator | Generador generico (31 templates) |
| `/dd-skill-executor` | Skill Executor | Ejecucion de skills individuales |
| `/dd-tool-generic` | Generic Tool | Ejecucion de microtools |
| `/dd-agent-paranoico` | Agent Paranoico | Validacion de citas y URLs |
| `/dd-agent-validador` | Agent Validador | Validacion de schema/secciones |
| `/dd-agent-sanitizer` | Agent Sanitizer | Limpieza PII y formato |

### Modelo de datos (16 tablas)

| Tabla | Descripcion | Migracion |
|-------|-------------|-----------|
| `dd_projects` | Proyectos DD | baseline |
| `dd_areas` | Areas de revision | baseline |
| `dd_processes` | Procesos por area | baseline |
| `dd_tasks` | Ejecucion/seguimiento | baseline |
| `dd_contingencies` | Contingencias/riesgos | baseline |
| `dd_tools` | Catalogo herramientas | 202602200002 |
| `dd_tool_executions` | Log ejecuciones | 202602200002 |
| `dd_skills_catalog` | Skills con prompts | 202602200002 |
| `dd_evidence_packs` | Evidence Packs | 202602200002 |
| `dd_societario_requests` | Solicitudes societario | 202602210001 |
| `dd_societario_snapshots` | Snapshots societarios | 202602210001 |
| `dd_ip_requests` | Solicitudes IP | 202602210001 |
| `dd_ip_snapshots` | Snapshots IP | 202602210001 |
| `dd_reports` | Reportes generados | 202602200002 |
| `dd_alerts` | Alertas negociacion | 202602200002 |
| `dd_agent_executions` | Observabilidad agentes | Cloud MCP |

## 6. API Contracts

### 6.1 Harvey Invocation
```
POST /api/harvey
Body: { project_id, process_id, prompt, target_company?, sector? }
Response: { success: boolean, result: object }
```

### 6.2 Societario Pipeline
```
POST /api/societario/request   → { success, request_id }
POST /api/societario/resolve   → { success, candidates[] }
POST /api/societario/snapshot  → { success, snapshot_id }
POST /api/societario/validate  → { success, grounding_score, checks[] }
POST /api/societario/report    → { success, report_id, grounding_score }
```

### 6.3 IP Radar Pipeline
```
POST /api/ip/requests  → { success, request_id }
POST /api/ip/resolve   → { success, titular_data }
POST /api/ip/search    → { success, results[] }
POST /api/ip/snapshot  → { success, snapshot_id }
POST /api/ip/report    → { success, report_id }
```

### 6.4 Reporting
```
POST /api/reports/generate
Body: { template_type, request_id, snapshot_id?, project_id? }
Response: { success, report_id, grounding_score }
```

### 6.5 HITL
```
POST /api/hitl/decision
Body: { task_id, decision: "approve"|"correct"|"reject", corrections? }
Response: { success, task }
```

### 6.6 Alerts
```
POST /api/alerts/negotiation
Body: { snapshot_id, threshold? }
Response: { success, alerts[], risk_score }
```

## 7. Variables de entorno

| Variable | Tipo | Descripcion |
|----------|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key Supabase (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Service role key (server-side, RLS bypass) |
| `N8N_WEBHOOK_BASE_URL` | Secret | Base URL de webhooks n8n Cloud |
| `HARVEY_API_KEY` | Secret | API key de Harvey AI |

## 8. Requisitos no funcionales

### 8.1 Seguridad
- Variables sensibles gestionadas por entorno (Vercel env vars para produccion).
- Supabase admin client solo en server-side (API routes).
- RLS habilitado en tablas de agentes.
- Agent Sanitizer redacta PII automaticamente.

### 8.2 Confiabilidad
- Fallback cuando n8n/Harvey no disponibles (status: queued).
- Grounding validation con 5 checks independientes.
- Agent Pipeline con scoring de confiabilidad 0-100.

### 8.3 Trazabilidad
- Cada invocacion IA queda en dd_tasks/dd_reports/dd_agent_executions.
- Evidence Pack con fuentes indexadas [SRC-XXX].
- Observabilidad completa: workflow_id, latency, pipeline_results, grounding_score.

### 8.4 Escalabilidad
- Skills catalog extensible (12 → 30 skills planeados).
- Templates catalog extensible (31 templates, 3 familias).
- Agent pipeline modular (3 agentes independientes como sub-workflows).

### 8.5 Mantenibilidad
- Interfaces TypeScript para todas las entidades.
- Migraciones SQL versionadas (6 archivos).
- Workflows n8n definidos como JSON en repositorio.
- Tests E2E con Playwright.

## 9. Metricas de exito

| Metrica | Objetivo |
|---------|----------|
| Grounding score medio | >= 80/100 |
| Cobertura de fuentes citadas | >= 95% |
| Tiempo snapshot → report | < 60s (Harvey latency) |
| Skills activos | >= 30 (Phases A-F) |
| Templates operativos | 31 (3 familias) |
| Agent pipeline pass rate | >= 90% |
| PII redaction rate | 100% (emails + phones) |

## 10. Riesgos y mitigaciones

| Riesgo | Severidad | Mitigacion |
|--------|-----------|------------|
| Harvey API no disponible | Alta | Fallback a queued + retry |
| Alucinaciones IA | Alta | Agent Paranoico + grounding validation |
| PII en outputs | Alta | Agent Sanitizer automatico |
| Schema mismatch | Media | Agent Validador + output_schema checks |
| n8n workflows inactivos | Media | Health check `/api/system/health` |
| Sin autenticacion | Alta | Pendiente: Supabase Auth + RLS |
| Drift de esquema | Media | Migraciones SQL versionadas |

## 11. Roadmap

### Completado
- MVP Dashboard + Proyectos + Harvey integration
- Tool Societario (7 fases)
- Tool IP Radar (5 fases)
- Reporting Engine (31 templates)
- Skills Catalog Phase A + B (12 skills)
- Evidence Pack v1.1 con grounding validation
- Alertas de negociacion + Red Flags Digest
- HITL + Portal Cliente
- Agent Pipeline n8n (Paranoico + Validador + Sanitizer)
- Deploy Vercel + env vars
- Observabilidad: dd_agent_executions

### P0 — Activacion (proximo)
1. Configurar credenciales Harvey en n8n Cloud.
2. Activar 9 workflows n8n.
3. Implementar Supabase Auth + RLS + roles operativos.
4. Implementar tabs Tareas, Documentos y Q&A.
5. Tests E2E para IP Radar y Reporting.

### P1 — Expansion funcional
1. Skills Phase C: Fiscal + Inmobiliario (6 skills).
2. Skills Phase D: Medioambiental + Compliance + Penal (8 skills).
3. Pipeline de entregables con versionado y aprobacion.
4. Dashboard de riesgos agregado (severidad x probabilidad x monto).
5. Exportes ejecutivos para comite de inversion.

### P2 — Enterprise
1. Skills Phase E-F: Procesal + Competencia + Subvenciones (6 skills).
2. Control de permisos por rol (CLO, abogado, PM, cliente).
3. Gestor documental completo con versionado.
4. Q&A operativo con ciclo envio/respuesta y deadlines.
5. Observabilidad avanzada (latencia, error rate, dashboards).

## 12. Infraestructura de deploy

| Servicio | Instancia | Uso |
|----------|-----------|-----|
| Vercel | dd-legal-pmo | Frontend + API Routes |
| Supabase | mxanelzxyaklvuypuafa (NexusDD) | Base de datos + RLS |
| n8n Cloud | mmenendeza.app.n8n.cloud | Orquestacion IA + Agent Pipeline |
| Harvey AI | eu.api.harvey.ai | LLM legal especializado |
| GitHub | moimene/DDLegal | Repositorio codigo fuente |

## 13. Archivos de referencia

### API Routes (26)
```
src/app/api/
  alerts/negotiation/route.ts
  client/projects/[id]/route.ts
  evidence/route.ts
  harvey/route.ts
  hitl/decision/route.ts
  ip/{requests,resolve,search,snapshot,report}/route.ts
  reports/{generate,red-flags-digest}/route.ts
  skills/route.ts
  societario/{borme,borme/ingest,report,request,resolve,snapshot,validate}/route.ts
  system/{health,skills,tools}/route.ts
  tools/{execute,executions,link-project}/route.ts
```

### n8n Workflows (9)
```
n8n/
  dd_harvey_adapter.workflow.json
  dd_societario_report.workflow.json
  dd_tool_ip_report.workflow.json
  dd_report_generate.workflow.json
  dd_skill_executor.workflow.json
  dd_tool_generic.workflow.json
  dd_agent_paranoico.workflow.json
  dd_agent_validador.workflow.json
  dd_agent_sanitizer.workflow.json
```

### Migraciones (6)
```
supabase/migrations/
  20260103175640_remote_baseline.sql
  202602200001_hitl_client_visibility.sql
  202602200002_tools_evidence_skills.sql
  202602200003_seed_tools_skills.sql
  202602210001_societario_schema.sql
  202602210002_seed_societario_config.sql
```
