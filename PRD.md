# PRD - DD Legal PMO v2.0
**Ultima actualizacion: 20 febrero 2026**

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
- Data room sin gap analysis automatizado.
- Skills legales sin quality gates ni enumeraciones de dominio cerradas.

## 2. Objetivo de producto

Proveer un PMO legal centralizado que:
- Gestiona proyectos DD end-to-end con soporte IA (Harvey AI).
- Ejecuta analisis especializados por area mediante herramientas dedicadas (Societario, IP Radar, Marcas).
- Genera reportes automatizados a partir de 31 templates configurables.
- Valida outputs IA con un pipeline de 3 agentes (grounding, schema, sanitization).
- Ofrece un catalogo extensible de 63 skills legales con prompt engineering especializado.
- Proporciona alertas automaticas de negociacion con scoring de riesgo.
- Gestiona Data Room virtual con gap list automatizada por area.
- Aplica quality gates juridicos con enumeraciones cerradas por dominio.

### Objetivos de negocio/legal
- Reducir tiempo de arranque de un proyecto DD de dias a horas.
- Estandarizar ejecucion por procesos y areas con skills reutilizables.
- Aumentar confiabilidad de outputs IA con validacion de citas y fuentes.
- Mejorar visibilidad de riesgos mediante consolidacion cross-area de red flags.
- Alinear con los 64 workflows del Excel FMC Due Diligence (Feb 2026).
- Cubrir las 11 areas juridicas con skills operativos progresivamente.

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
- "Cuando gestiono documentos, quiero ver el gap list de lo que falta por area y subir ficheros al Data Room."
- "Cuando ejecuto un skill, quiero saber si requiere revision humana (HITL) antes de publicarse."

## 4. Alcance funcional

### Implementado (operativo)

#### 4.1 Dashboard PMO
- KPIs: proyectos activos/en revision/completados y areas cubiertas.
- Proyectos recientes con acceso directo al detalle.
- Catalogo de areas de revision.

#### 4.2 Gestion de Proyectos DD
- Listado con buscador por nombre y sociedad target.
- Alta de nuevo proyecto con metadatos de operacion.
- Detalle de proyecto con 6 tabs: Resumen, Tareas, Contingencias, Q&A, Documentos, Entregables.
- Invocacion de Harvey AI por proceso y por skill especifico.
- Persistencia y visualizacion de contingencias (severidad, monto, recomendacion).
- Skills grid por area con accordion expandible en tab Resumen.
- HITL badges en skills que requieren revision humana obligatoria.

#### 4.3 Data Room (v1)
- Tab Documentos en detalle de proyecto con:
  - Stats de cobertura (documentos subidos vs esperados).
  - Upload de documentos con metadata (area, categoria, nombre).
  - Tabla de documentos con estado, tipo, tamano.
  - Gap list: documentos esperados por area que aun no se han subido.
- API: `GET/POST /api/documents` (listado + gap list + crear doc).
- Base de datos: `dd_documents` + `dd_expected_documents` (22 docs esperados en 6 areas).
- Areas cubiertas: MERC (6), CONT (4), LAB (4), FISC (3), INM (3), PI (2).

#### 4.4 Reports UI
Hub completo de reporteria:
- **Hub** (`/reports`): Listado de informes con filtros por familia/status, busqueda, grounding score bar.
- **Wizard** (`/reports/new`): Generacion en 3 pasos (seleccionar template > configurar > generar).
  - 31 templates agrupados por familia: Transactional (15), PMO (10), Compliance (6).
- **Visor** (`/reports/[id]`): Grounding score SVG meter, Harvey response, Evidence Pack, Grounding Issues.
  - Polling cada 5s cuando status es pending/generating.

#### 4.5 Tool Societario (7 fases)
Pipeline completo de due diligence societaria:
1. **Request**: Crear solicitud DD societaria con target y contexto.
2. **Resolve**: Resolver empresa target contra registros mercantiles.
3. **BORME Query**: Consultar y procesar publicaciones BORME.
4. **BORME Ingest**: Ingesta masiva de datos BORME historicos.
5. **Snapshot**: Generar snapshot del estado societario consolidado.
6. **Validate**: Validar snapshot con 5 grounding checks (score 0-100).
7. **Report**: Generar reporte DD via Harvey AI con evidence pack.

Componentes UI: CandidateResolver, PipelineTracker, SnapshotViewer.

#### 4.6 Tool IP Radar (5 fases)
Pipeline de due diligence de propiedad industrial:
1. **Request**: Crear solicitud de analisis IP con titular.
2. **Resolve**: Resolver titular en OEPM/EUIPO.
3. **Search**: Busqueda en registros de marcas y patentes.
4. **Snapshot**: Generar snapshot de cartera IP.
5. **Report**: Generar reporte IP via Harvey con fuentes oficiales.

#### 4.7 Reporting Engine (31 templates)
Motor de reporteria generico con 3 familias:

| Familia | Templates | Harvey AI | Descripcion |
|---------|-----------|-----------|-------------|
| Transactional | 15 | Si | Reportes que requieren analisis IA (DD societario, IP, contractual) |
| PMO | 10 | No | Reportes de agregacion de datos (progreso, estado, KPIs) |
| Compliance | 6 | No | Reportes de conformidad y checklists |

Cada template define: `required_sections[]`, `expected_output_schema`, `evidence_requirements`, `skills[]`.

#### 4.8 Evidence Pack v1.1
Sistema de gestion de fuentes con:
- Indexacion automatica: cada fuente recibe identificador `[SRC-001]...[SRC-NNN]`.
- Grounding validation con 5 checks: citation_exists, url_allowlist, section_coverage, source_coverage, score.
- Score de confiabilidad 0-100 para cada output.
- Allowlist de dominios oficiales: boe.es, borme.es, oepm.es, euipo.europa.eu, wipo.int, registradores.org.

#### 4.9 Skills Catalog (63 skills en dd_skills_catalog)
Catalogo extensible de skills legales cubriendo 11 areas:

| Fase | Areas | Skills | Estado |
|------|-------|--------|--------|
| Phase A | MERC, PI | 4 | Operativos |
| Phase B | CONT, LAB | 8 | Seeded (templates definidos) |
| FMC Alignment | 11 areas | 28 | Schemas Garrigues definidos |
| Phase C-F | FISC, INM, LIT, ADMIN, MA, DATOS, GENERAL | 23 | Planificados |

Cada skill tiene: `skill_key`, `area_code`, `prompt_template`, `expected_output_schema`, `evidence_requirements`, `agent_pipeline`, `hitl_required`, `priority`, `dependencies`.

**Quality gates (recomendacion informe legal):**
- `confidence_output_required`: booleano, requiere nivel de confianza en output.
- `evidence_minimum_count`: minimo de evidencias por output.
- `domain_enums`: enumeraciones cerradas por dominio legal.
- `hitl_required`: revision humana obligatoria para CONT, LAB, FISC, LIT.

#### 4.10 Domain Enumerations (dd_domain_enums)
15 enumeraciones canonicas por dominio legal:

| Dominio | Enumeraciones | Ejemplo |
|---------|---------------|---------|
| CONT | tipo_contrato, tipo_garantia, tipo_clausula_limitacion, efecto_coc | ["suministro","distribucion","servicios",...] |
| LAB | categoria_personal, tipo_incentivo | ["directivo","mando_intermedio",...] |
| FISC | tipo_impuesto, estado_ejercicio | ["IS","IVA","IRPF_retenciones",...] |
| INM | tipo_carga, tipo_arrendamiento | ["hipoteca","embargo",...] |
| PI | estado_marca | ["solicitada","registrada","renovada",...] |
| LIT | fase_procesal, tipo_organo | ["demanda","contestacion",...] |
| GENERAL | severidad_contingencia, probabilidad_contingencia | Con "informativo" y "not_verifiable" |

#### 4.11 Alertas de Negociacion
- Auto-deteccion de red flags criticos en snapshots y reportes.
- Scoring de impacto con categorizacion de severidad.
- API: `POST /api/alerts/negotiation`.

#### 4.12 Red Flags Digest
- Consolidacion cross-snapshot de red flags.
- API: `POST /api/reports/red-flags-digest`.

#### 4.13 HITL (Human-in-the-Loop)
- Aprobacion, correccion o rechazo de outputs IA.
- Vista dedicada en `/projects/[id]/hitl`.
- API: `POST /api/hitl/decision` con `task_id` + `decision` (approve|correct|reject).
- Badges HITL en skill cards para areas con revision obligatoria.

#### 4.14 Portal Cliente
- Vista read-only de proyecto con progreso por area.
- Ruta: `/client/projects/[id]`.
- API: `GET /api/client/projects/[id]`.

#### 4.15 Configuracion
- Panel de configuracion de herramientas y skills.
- Status indicators para servicios externos (Supabase, n8n, Harvey).
- Rutas: `/configuracion`, `/configuracion/herramientas`, `/configuracion/skills`.

### Parcial / En progreso

#### 4.16 Agent Pipeline n8n
Pipeline de 3 agentes de validacion post-Harvey:

| Agente | Funcion | Input | Output |
|--------|---------|-------|--------|
| Paranoico | Validar citas [SRC-XXX] y URLs | harvey_response + evidence_pack | { passed, score, issues[] } |
| Validador | Verificar schema y secciones | harvey_response + output_schema | { valid, missing_sections[], format_errors[] } |
| Sanitizer | Limpiar PII y formato | harvey_response | { sanitized_response, changes_made[] } |

**Estado**: Workflows creados en n8n Cloud (inactivos, pendiente configuracion de credenciales Harvey).

### Pendiente

- Autenticacion y autorizacion (Supabase Auth + RLS + roles).
- Skills operativos (prompts ejecutables) para areas distintas de MERC y PI.
- Tools UI dedicados para Contratos, Laboral, Fiscal, Inmobiliario, etc.
- Integracion con Registro de la Propiedad, CCAA, escrituras.
- Fichas modelo Garrigues (17 campos societaria, cuadro socios, fichas contratos).
- Review Tables y Tabular Review (herramientas Harvey nativas).

## 5. Arquitectura tecnica

### Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Garrigues Design System (CSS custom properties).
- **Backend**: Next.js API Routes (27 endpoints server-side).
- **Base de datos**: Supabase (PostgreSQL + RLS), admin client para bypass.
- **IA**: Harvey AI via n8n Cloud webhooks.
- **Orquestacion**: n8n Cloud — 9 workflows con agent pipeline.
- **Deploy**: Vercel (production + preview, auto-deploy desde main).
- **Tests**: Playwright (2 suites E2E).

### Modelo de datos (19 tablas)

| Tabla | Descripcion | Migracion |
|-------|-------------|-----------|
| `dd_projects` | Proyectos DD | baseline |
| `dd_areas` | Areas de revision | baseline |
| `dd_processes` | Procesos por area | baseline |
| `dd_tasks` | Ejecucion/seguimiento | baseline |
| `dd_contingencies` | Contingencias/riesgos | baseline |
| `dd_tools` | Catalogo herramientas | 202602200002 |
| `dd_tool_executions` | Log ejecuciones | 202602200002 |
| `dd_skills_catalog` | 63 skills con prompts + quality gates | 202602200002 |
| `dd_evidence_packs` | Evidence Packs | 202602200002 |
| `dd_societario_requests` | Solicitudes societario | 202602210001 |
| `dd_societario_snapshots` | Snapshots societarios | 202602210001 |
| `dd_ip_requests` | Solicitudes IP | 202602210001 |
| `dd_ip_snapshots` | Snapshots IP | 202602210001 |
| `dd_reports` | Reportes generados | 202602200002 |
| `dd_alerts` | Alertas negociacion | 202602200002 |
| `dd_agent_executions` | Observabilidad agentes | Cloud MCP |
| `dd_documents` | Documentos Data Room | 202602210004 |
| `dd_expected_documents` | Gap list por area (22 items) | 202602210004 |
| `dd_domain_enums` | Enumeraciones canonicas por dominio (15) | 202602210005 |

### Migraciones SQL (9)

```
supabase/migrations/
  20260103175640_remote_baseline.sql          -- Schema base DD
  202602200001_hitl_client_visibility.sql     -- HITL + portal cliente
  202602200002_tools_evidence_skills.sql      -- Tools, evidence, skills
  202602200003_seed_tools_skills.sql          -- Seed de tools y skills
  202602210001_societario_schema.sql          -- Schema societario + IP
  202602210002_seed_societario_config.sql     -- Seed config societario
  202602210003_seed_fmc_skills.sql            -- 28 skills FMC + schemas Garrigues
  202602210004_data_room.sql                  -- Data Room: dd_documents + dd_expected_documents
  202602210005_skill_quality_gates.sql        -- Quality gates + dd_domain_enums (15 enums)
```

### Flujo IA end-to-end

```
1. Usuario invoca herramienta o skill desde proyecto
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
12. Si skill.hitl_required = true, marca para revision humana
13. API Route retorna {success, report_id, grounding_score}
```

## 6. API Contracts (27 endpoints)

### Societario (7)
```
POST /api/societario/request   -> { success, request_id }
POST /api/societario/resolve   -> { success, candidates[] }
GET  /api/societario/borme     -> { success, announcements[] }
POST /api/societario/borme/ingest -> { success, count }
POST /api/societario/snapshot  -> { success, snapshot_id }
POST /api/societario/validate  -> { success, grounding_score, checks[] }
POST /api/societario/report    -> { success, report_id, grounding_score }
```

### IP Radar (5)
```
POST /api/ip/requests  -> { success, request_id }
POST /api/ip/resolve   -> { success, titular_data }
POST /api/ip/search    -> { success, results[] }
POST /api/ip/snapshot  -> { success, snapshot_id }
POST /api/ip/report    -> { success, report_id }
```

### Reporting (2)
```
POST /api/reports/generate        -> { success, report_id, grounding_score }
POST /api/reports/red-flags-digest -> { success, alerts[], risk_score }
```

### Data Room (1)
```
GET  /api/documents?project_id=X  -> { documents[], expected[], gaps[], stats }
POST /api/documents               -> { success, document }
```

### Alertas (1)
```
POST /api/alerts/negotiation -> { success, alerts[], risk_score }
```

### Skills (1)
```
GET/POST /api/skills -> CRUD de skills catalog
```

### System (3)
```
GET /api/system/health -> { supabase, n8n, overall }
GET /api/system/skills -> { skills[] }
GET /api/system/tools  -> { tools[] }
```

### Tools (3)
```
POST /api/tools/execute      -> { success, execution_id }
GET  /api/tools/executions   -> { executions[] }
POST /api/tools/link-project -> { success }
```

### Core (4)
```
POST /api/harvey              -> { success, result }
POST /api/evidence            -> { success, evidence_pack }
POST /api/hitl/decision       -> { success, task }
GET  /api/client/projects/[id] -> { project, areas, progress }
```

## 7. Variables de entorno

| Variable | Tipo | Descripcion |
|----------|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key Supabase (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Service role key (server-side, RLS bypass) |
| `N8N_WEBHOOK_BASE_URL` | Secret | Base URL de webhooks n8n Cloud |
| `HARVEY_API_KEY` | Secret | API key de Harvey AI |

## 8. Cobertura FMC (Feb 2026)

El Excel "Due Diligence FMC (Feb 2026)" define el scope completo de automatizacion:

| Dimension | FMC Requiere | PMO Cubre | % |
|-----------|-------------|-----------|---|
| Actuaciones (15) | 15 | 6 completas + 9 parciales | ~40% |
| Workflows (64) | 64 | 5 operativos + 8 parciales + 51 planificados | ~8% ejecutable |
| Areas (11) | 11 | 2 operativas (MERC, PI) + 9 con estructura | 18% live |
| Skills | ~30 necesarios | 4 activos + 8 seeded + 51 definidos | 13% activos |
| Report Templates | ~15 por area | 31 definidos (15 transactional) | 100% estructura |

**Areas con herramienta dedicada:** Societario (7 fases), IP Radar (5 fases).
**Areas con skills seeded:** Contratos (4), Laboral (4).
**Areas solo planificadas:** Fiscal, Inmobiliario, Litigios, Regulatorio, Medioambiental, Datos.

## 9. Requisitos no funcionales

### Seguridad
- Variables sensibles gestionadas por entorno (Vercel env vars para produccion).
- Supabase admin client solo en server-side (API routes).
- RLS habilitado en todas las tablas.
- Agent Sanitizer redacta PII automaticamente.
- HITL obligatorio para outputs de CONT, LAB, FISC, LIT.

### Confiabilidad
- Fallback cuando n8n/Harvey no disponibles (status: queued).
- Grounding validation con 5 checks independientes.
- Agent Pipeline con scoring de confiabilidad 0-100.
- Domain enumerations cerradas para evitar outputs abiertos.

### Trazabilidad
- Cada invocacion IA queda en dd_tasks/dd_reports/dd_agent_executions.
- Evidence Pack con fuentes indexadas [SRC-XXX].
- Observabilidad completa: workflow_id, latency, pipeline_results, grounding_score.

### Escalabilidad
- Skills catalog extensible (63 definidos, arquitectura para 100+).
- Templates catalog extensible (31 templates, 3 familias).
- Agent pipeline modular (3 agentes independientes como sub-workflows).
- Domain enumerations versionadas para evolucion controlada.

## 10. Metricas de exito

| Metrica | Objetivo |
|---------|----------|
| Grounding score medio | >= 80/100 |
| Cobertura de fuentes citadas | >= 95% |
| Tiempo snapshot -> report | < 60s (Harvey latency) |
| Skills activos | >= 30 (cobertura FMC) |
| Templates operativos | 31 (3 familias) |
| Agent pipeline pass rate | >= 90% |
| PII redaction rate | 100% |
| Data room gap coverage | >= 80% por proyecto |

## 11. Roadmap

### Completado
- MVP Dashboard + Proyectos + Harvey integration
- Tool Societario (7 fases) + Tool IP Radar (5 fases)
- Reporting Engine (31 templates) + Reports UI (hub + wizard + visor)
- Skills Catalog (63 skills definidos, 4 operativos, 8 seeded)
- Evidence Pack v1.1 con grounding validation
- Alertas de negociacion + Red Flags Digest
- HITL + Portal Cliente + HITL badges
- Agent Pipeline n8n (Paranoico + Validador + Sanitizer)
- Data Room v1 (upload, listado, gap list, 22 expected docs)
- Quality gates juridicos (domain enums, confidence, HITL obligatorio)
- Skill-driven processes (invocar skills por area desde proyecto)
- Deploy Vercel + env vars + Supabase migrations

### P0 — Activacion (proximo)
1. Configurar credenciales Harvey en n8n Cloud.
2. Activar 9 workflows n8n.
3. Implementar Supabase Auth + RLS + roles operativos.
4. Activar skills CONT + LAB con prompts ejecutables.
5. Tests E2E para Reports UI, Data Room, IP Radar.

### P1 — Expansion funcional
1. Skills operativos Phase C: Fiscal + Inmobiliario.
2. Skills operativos Phase D: Litigios + Regulatorio.
3. Tools UI dedicados para Contratos y Laboral.
4. Fichas modelo Garrigues (17 campos societaria, cuadro socios).
5. Dashboard de riesgos agregado (severidad x probabilidad x monto).
6. Exportes ejecutivos para comite de inversion.

### P2 — Enterprise
1. Skills Phase E-F: Medioambiental + Datos + General.
2. Control de permisos por rol (CLO, abogado, PM, cliente).
3. Integracion con Registro de la Propiedad y CCAA.
4. Q&A operativo con ciclo envio/respuesta y deadlines.
5. Review Tables (equivalente a Tabular Review de Harvey).
6. Observabilidad avanzada (latencia, error rate, dashboards).

## 12. Infraestructura

| Servicio | Instancia | Uso |
|----------|-----------|-----|
| Vercel | dd-legal-pmo | Frontend + API Routes |
| Supabase | ghmurrvvzochgtippxwu (legal_dd) | Base de datos + RLS |
| n8n Cloud | mmenendeza.app.n8n.cloud | Orquestacion IA + Agent Pipeline |
| Harvey AI | eu.api.harvey.ai | LLM legal especializado |
| GitHub | moimene/DDLegal | Repositorio codigo fuente |
