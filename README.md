# DD Legal PMO

Plataforma web para gestionar proyectos de due diligence legal con soporte de IA (Harvey AI), pipeline de agentes de validacion, reporting automatizado, Data Room con gap analysis, y catalogo extensible de 63 skills legales.

**Production:** https://dd-legal-pmo.vercel.app

---

## Capacidades

| Modulo | Descripcion | Estado |
|--------|-------------|--------|
| Dashboard PMO | KPIs, proyectos recientes, areas de revision | Operativo |
| Proyectos DD | CRUD + 6 tabs: Resumen, Tareas, Contingencias, Q&A, Documentos, Entregables | Operativo |
| Reports UI | Hub de informes + wizard de generacion (31 templates) + visor con grounding | Operativo |
| Data Room | Upload, listado, gap list por area (22 docs esperados en 6 areas) | Operativo |
| Tool Societario | Pipeline 7 fases: request > resolve > BORME > snapshot > validate > report | Operativo |
| Tool IP Radar | Pipeline 5 fases: request > resolve > search > snapshot > report | Operativo |
| Skill-Driven Processes | Skills grid por area con accordion, invocar Harvey por skill especifico | Operativo |
| Skills Catalog | 63 skills en 11 areas, quality gates, domain enums, HITL badges | Operativo |
| Reporting Engine | 31 templates en 3 familias (transactional/pmo/compliance) | Operativo |
| Evidence Pack v1.1 | Fuentes indexadas [SRC-XXX] con grounding validation (0-100) | Operativo |
| Alertas Negociacion | Auto-deteccion de red flags criticos con scoring | Operativo |
| HITL | Aprobacion/correccion/rechazo de outputs IA, badges por area | Operativo |
| Portal Cliente | Vista read-only de proyecto con progreso por area | Operativo |
| Agent Pipeline n8n | Paranoico > Validador > Sanitizer (workflows creados) | Pendiente activar |

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilos | Garrigues Design System (CSS custom properties + Tailwind) |
| Base de datos | Supabase (PostgreSQL + RLS) — 19 tablas |
| IA Legal | Harvey AI via n8n Cloud webhooks |
| Orquestacion | n8n Cloud (9 workflows con agent pipeline) |
| Deploy | Vercel (auto-deploy desde main) |
| Tests E2E | Playwright |

---

## Arquitectura

```
Browser
  |
  v
Vercel (Next.js 14 App Router)
  |
  +-- Pages (17 rutas) ---- React UI + Garrigues Design System
  |
  +-- API Routes (27 endpoints) ---- Server-side logic
  |     |
  |     +-- Supabase (admin client, RLS bypass)
  |     |
  |     +-- n8n Cloud webhooks
  |           |
  |           +-- Harvey AI (eu.api.harvey.ai)
  |           |
  |           +-- Agent Pipeline (Paranoico > Validador > Sanitizer)
  |
  +-- Lib
        +-- supabase.ts / supabase-admin.ts (tipos + clients)
        +-- reporting/report-engine.ts (31 templates)
        +-- reporting/garrigues-schemas.ts (schemas FMC)
        +-- utils.ts (formatters, configs)
```

---

## Paginas (17)

| Ruta | Descripcion |
|------|-------------|
| `/` | Dashboard principal con KPIs y areas |
| `/projects` | Listado de proyectos DD |
| `/projects/new` | Alta de nuevo proyecto |
| `/projects/[id]` | Detalle: Resumen + Skills, Tareas, Contingencias, Q&A, Documentos, Entregables |
| `/projects/[id]/hitl` | Vista HITL para aprobacion de outputs |
| `/reports` | Hub de informes con filtros y busqueda |
| `/reports/new` | Wizard de generacion de informe (3 pasos) |
| `/reports/[id]` | Visor de informe con grounding score |
| `/tools` | Catalogo de herramientas DD |
| `/tools/societario` | Pipeline societario (7 fases) |
| `/tools/ip-radar` | Pipeline IP Radar (5 fases) |
| `/tools/marcas` | Herramienta de marcas |
| `/skills` | Catalogo de skills (lectura) |
| `/configuracion` | Estado del sistema |
| `/configuracion/herramientas` | Gestion de herramientas |
| `/configuracion/skills` | Gestion de skills |
| `/client/projects/[id]` | Portal de cliente (read-only) |

---

## API Routes (27)

### Societario (7)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/societario/request` | POST | Crea solicitud de DD societaria |
| `/api/societario/resolve` | POST | Resuelve empresa target en registros |
| `/api/societario/borme` | GET | Consulta BORME por empresa |
| `/api/societario/borme/ingest` | POST | Ingesta masiva de datos BORME |
| `/api/societario/snapshot` | POST | Genera snapshot del estado societario |
| `/api/societario/validate` | POST | Valida snapshot con grounding checks |
| `/api/societario/report` | POST | Genera reporte DD societario via Harvey |

### IP Radar (5)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/ip/requests` | POST | Crea solicitud de analisis IP |
| `/api/ip/resolve` | POST | Resuelve titular en OEPM/EUIPO |
| `/api/ip/search` | POST | Busqueda en registros de marcas/patentes |
| `/api/ip/snapshot` | POST | Genera snapshot de cartera IP |
| `/api/ip/report` | POST | Genera reporte IP via Harvey |

### Reporting (2)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/reports/generate` | POST | Genera reporte desde template (31 tipos) |
| `/api/reports/red-flags-digest` | POST | Consolida red flags cross-snapshot |

### Data Room (1)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/documents` | GET/POST | Listado + gap list / crear documento |

### Otros (12)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/alerts/negotiation` | POST | Evalua red flags con scoring |
| `/api/skills` | GET/POST | CRUD de skills catalog |
| `/api/system/health` | GET | Health check |
| `/api/system/skills` | GET | Lista skills del sistema |
| `/api/system/tools` | GET | Lista herramientas |
| `/api/tools/execute` | POST | Ejecuta herramienta via n8n |
| `/api/tools/executions` | GET | Lista ejecuciones |
| `/api/tools/link-project` | POST | Vincula ejecucion a proyecto |
| `/api/harvey` | POST | Invocacion directa Harvey AI |
| `/api/evidence` | POST | Gestiona Evidence Pack |
| `/api/hitl/decision` | POST | Decision HITL |
| `/api/client/projects/[id]` | GET | Portal cliente read-only |

---

## Base de datos (19 tablas)

| Tabla | Descripcion |
|-------|-------------|
| `dd_projects` | Proyectos DD principales |
| `dd_areas` | Catalogo de areas de revision |
| `dd_processes` | Procesos por area (incluye harvey_prompt) |
| `dd_tasks` | Ejecucion/seguimiento por proceso + salida IA |
| `dd_contingencies` | Contingencias/riesgos por proyecto |
| `dd_tools` | Catalogo de herramientas DD |
| `dd_tool_executions` | Log de ejecuciones de herramientas |
| `dd_skills_catalog` | 63 skills con prompts, schemas, quality gates |
| `dd_evidence_packs` | Paquetes de evidencia con fuentes indexadas |
| `dd_societario_requests` | Solicitudes de DD societaria |
| `dd_societario_snapshots` | Snapshots societarios |
| `dd_ip_requests` | Solicitudes de DD propiedad industrial |
| `dd_ip_snapshots` | Snapshots de cartera IP |
| `dd_reports` | Reportes generados (31 templates) |
| `dd_alerts` | Alertas de negociacion |
| `dd_agent_executions` | Observabilidad del pipeline de agentes |
| `dd_documents` | Documentos del Data Room |
| `dd_expected_documents` | Gap list por area (22 docs en 6 areas) |
| `dd_domain_enums` | Enumeraciones canonicas por dominio (15 enums) |

### Migraciones (9)

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
```

---

## Workflows n8n (9)

| Workflow | Webhook Path | Funcion |
|----------|-------------|---------|
| Harvey Adapter | `/dd-harvey-invoke` | Adaptador generico Harvey AI |
| Societario Report | `/dd-tool-societario-report` | Reporte DD societario |
| IP Report | `/dd-tool-ip-report` | Reporte DD propiedad industrial |
| Report Generator | `/dd-report-generate` | Generador generico (31 templates) |
| Skill Executor | `/dd-skill-executor` | Ejecucion de skills individuales |
| Generic Tool | `/dd-tool-generic` | Ejecucion de microtools |
| Agent Paranoico | `/dd-agent-paranoico` | Validacion de citas y URLs |
| Agent Validador | `/dd-agent-validador` | Validacion de schema/secciones |
| Agent Sanitizer | `/dd-agent-sanitizer` | Limpieza PII y formato |

---

## Componentes (11)

| Componente | Ubicacion | Funcion |
|-----------|-----------|---------|
| `sidebar` | layout/ | Navegacion principal con secciones |
| `candidate-resolver` | societario/ | UI resolucion de empresa target |
| `pipeline-tracker` | societario/ | Tracker visual de fases del pipeline |
| `snapshot-viewer` | societario/ | Visualizador de snapshot societario |
| `evidence-badge` | evidence/ | Badge con metrica de evidencia |
| `evidence-drawer` | evidence/ | Drawer lateral para explorar fuentes |
| `skill-card` | skills/ | Card de skill con metadata |
| `execution-status` | tools/ | Estado de ejecucion de herramienta |
| `link-project-modal` | tools/ | Modal para vincular ejecucion a proyecto |
| `status-indicator` | configuracion/ | Indicador de estado de servicio |
| `toggle-switch` | configuracion/ | Toggle para configuracion |

---

## Setup local

### Prerrequisitos
- Node.js 20+
- Proyecto Supabase con esquema DD
- n8n Cloud con credenciales Harvey (para flujo IA real)

### Variables de entorno

Crear `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
N8N_WEBHOOK_BASE_URL=https://mmenendeza.app.n8n.cloud/webhook
HARVEY_API_KEY=hv-...
```

### Scripts

```bash
npm install         # Instalar dependencias
npm run dev         # Desarrollo local (http://localhost:3000)
npm run build       # Build de produccion
npm run start       # Servir build de produccion
npm run lint        # Lint Next.js
npx playwright test # Tests E2E
```

### Arranque rapido
1. `npm install`
2. Configurar `.env.local`
3. `npm run dev`
4. Abrir `http://localhost:3000`

---

## Deploy (Vercel)

**Proyecto Vercel:** `dd-legal-pmo`
**URL produccion:** https://dd-legal-pmo.vercel.app
**Auto-deploy:** Push a `main` en GitHub (moimene/DDLegal)

### Env vars en Vercel

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview |
| `N8N_WEBHOOK_BASE_URL` | Production |

Nota: `.npmrc` contiene `legacy-peer-deps=true` para resolver peer deps.

---

## Tests E2E

```
e2e/
  societario-api.spec.ts    -- Tests de API del pipeline societario
  societario-page.spec.ts   -- Tests de UI del tool societario
```

Ejecutar: `npx playwright test`

---

## Documentacion

| Archivo | Descripcion |
|---------|-------------|
| `PRD.md` | Product Requirements Document v2.0 |
| `docs/PLAN_GENERACION_SKILLS.md` | Roadmap de 30 skills en 11 areas (Phases A-F) |
| `docs/BRIEFING_EQUIPO_LEGAL_FMC.md` | Briefing para equipo legal con fichas de skill |

---

## Proximos pasos

### P0 — Activacion pipeline
1. Configurar credenciales Harvey API en n8n Cloud.
2. Activar los 9 workflows en n8n.
3. Implementar autenticacion (Supabase Auth + RLS + roles).
4. Activar skills CONT + LAB con prompts ejecutables.

### P1 — Expansion
1. Skills operativos Phase C: Fiscal + Inmobiliario.
2. Skills operativos Phase D: Litigios + Regulatorio.
3. Tools UI dedicados para Contratos y Laboral.
4. Fichas modelo Garrigues (17 campos societaria).
5. Dashboard de riesgos agregado.

### P2 — Enterprise
1. Skills Phase E-F: Medioambiental + Datos + General.
2. Control de permisos por rol.
3. Integracion con Registro de la Propiedad.
4. Review Tables (Tabular Review Harvey nativo).
