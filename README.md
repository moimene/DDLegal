# DD Legal PMO

## Que es DD Legal PMO

DD Legal PMO es una plataforma web para gestionar proyectos de due diligence legal con soporte de IA (Harvey AI) en flujos de analisis por area, reporteria automatizada, y pipeline de agentes de validacion.

**Production URL:** https://dd-legal-pmo.vercel.app

### Capacidades principales

| Modulo | Descripcion | Estado |
|--------|-------------|--------|
| Dashboard PMO | KPIs, proyectos recientes, areas de revision | Operativo |
| Proyectos DD | CRUD, detalle, tareas, contingencias | Operativo |
| Tool Societario | Pipeline 7 fases: request > resolve > snapshot > report | Operativo |
| Tool IP Radar | Pipeline 5 fases: request > resolve > search > snapshot > report | Operativo |
| Tool Marcas | Interfaz especializada marcas | Operativo |
| Reporting Engine | 31 templates en 3 familias (transactional/pmo/compliance) | Operativo |
| Skills Catalog | 12 skills activos (Phase A + B), gestion desde UI | Operativo |
| Alertas Negociacion | Auto-deteccion de red flags criticos con scoring | Operativo |
| Red Flags Digest | Consolidacion cross-snapshot | Operativo |
| Evidence Pack v1.1 | Fuentes indexadas [SRC-XXX] con grounding validation | Operativo |
| Agent Pipeline n8n | Paranoico > Validador > Sanitizer | Workflows creados |
| Portal Cliente | Vista read-only de proyecto con progreso por area | Operativo |
| HITL (Human-in-the-Loop) | Aprobacion/correccion/rechazo de outputs IA | Operativo |

---

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilos | Tailwind CSS v4 + tokens de diseno |
| Base de datos | Supabase (PostgreSQL + RLS) |
| IA Legal | Harvey AI via n8n webhooks |
| Orquestacion | n8n Cloud (9 workflows) |
| Deploy | Vercel (produccion + preview) |
| Tests E2E | Playwright |

---

## Arquitectura

```
Browser
  |
  v
Vercel (Next.js App Router)
  |
  +-- Pages (14 rutas) ---- React UI con Tailwind
  |
  +-- API Routes (26 endpoints) ---- Server-side logic
  |     |
  |     +-- Supabase (admin client, RLS bypass)
  |     |
  |     +-- n8n Cloud webhooks
  |           |
  |           +-- Harvey AI (eu.api.harvey.ai/api/v1/completion)
  |           |
  |           +-- Agent Pipeline (Paranoico > Validador > Sanitizer)
  |
  +-- Lib
        +-- supabase.ts / supabase-admin.ts
        +-- reporting/report-engine.ts (31 templates)
        +-- reporting/templates.ts
        +-- utils.ts
```

---

## Inventario de API Routes (26)

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
| `/api/ip/resolve` | POST | Resuelve titular en registros OEPM/EUIPO |
| `/api/ip/search` | POST | Busqueda en registros de marcas/patentes |
| `/api/ip/snapshot` | POST | Genera snapshot de cartera IP |
| `/api/ip/report` | POST | Genera reporte IP via Harvey |

### Reporting (2)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/reports/generate` | POST | Genera reporte desde cualquier template (31 tipos) |
| `/api/reports/red-flags-digest` | POST | Consolida red flags cross-snapshot |

### Alertas (1)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/alerts/negotiation` | POST | Evalua red flags con scoring automatico |

### Skills (1)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/skills` | GET/POST | CRUD de skills catalog |

### System (3)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/system/health` | GET | Health check (Supabase + n8n connectivity) |
| `/api/system/skills` | GET | Lista skills del sistema |
| `/api/system/tools` | GET | Lista herramientas disponibles |

### Tools (3)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/tools/execute` | POST | Ejecuta herramienta generica via n8n |
| `/api/tools/executions` | GET | Lista ejecuciones de herramientas |
| `/api/tools/link-project` | POST | Vincula ejecucion a proyecto DD |

### Core (4)
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/harvey` | POST | Invocacion directa Harvey AI via n8n |
| `/api/evidence` | POST | Gestiona Evidence Pack (fuentes indexadas) |
| `/api/hitl/decision` | POST | Decision HITL: approve/correct/reject |
| `/api/client/projects/[id]` | GET | Portal cliente read-only |

---

## Paginas (14)

| Ruta | Descripcion |
|------|-------------|
| `/` | Dashboard principal con KPIs y areas |
| `/projects` | Listado de proyectos DD |
| `/projects/new` | Alta de nuevo proyecto |
| `/projects/[id]` | Detalle de proyecto (tabs: resumen, tareas, contingencias) |
| `/projects/[id]/hitl` | Vista HITL para aprobacion de outputs |
| `/tools` | Catalogo de herramientas DD |
| `/tools/societario` | Pipeline societario (7 fases) |
| `/tools/ip-radar` | Pipeline IP Radar (5 fases) |
| `/tools/marcas` | Herramienta de marcas |
| `/skills` | Catalogo y gestion de skills |
| `/configuracion` | Panel de configuracion general |
| `/configuracion/herramientas` | Config de herramientas |
| `/configuracion/skills` | Config de skills |
| `/client/projects/[id]` | Portal de cliente (read-only) |

---

## Componentes (11)

| Componente | Ubicacion | Funcion |
|-----------|-----------|---------|
| `sidebar` | layout/ | Navegacion principal |
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

## Workflows n8n (9)

Instancia n8n Cloud: `mmenendeza.app.n8n.cloud`

| Workflow | Webhook Path | Nodos | Funcion |
|----------|-------------|-------|---------|
| Harvey Adapter | `/dd-harvey-invoke` | 4 | Adaptador generico Harvey AI |
| Societario Report | `/dd-tool-societario-report` | 5 | Reporte DD societario |
| IP Report | `/dd-tool-ip-report` | 5 | Reporte DD propiedad industrial |
| Report Generator | `/dd-report-generate` | 7 | Generador generico (31 templates) |
| Skill Executor | `/dd-skill-executor` | 6 | Ejecucion de skills individuales |
| Generic Tool | `/dd-tool-generic` | 5 | Ejecucion de microtools |
| Agent Paranoico | `/dd-agent-paranoico` | 3 | Validacion de citas y URLs |
| Agent Validador | `/dd-agent-validador` | 3 | Validacion de schema/secciones |
| Agent Sanitizer | `/dd-agent-sanitizer` | 3 | Limpieza PII y formato |

### Agent Pipeline

El pipeline de agentes se ejecuta despues de cada respuesta de Harvey:

```
Harvey Response
     |
     v
Agent Paranoico ---- Valida: citas [SRC-XXX] existen en evidence pack,
     |                URLs en allowlist (boe.es, oepm.es, euipo.europa.eu...),
     |                cobertura de fuentes >= 95%
     v                Output: { passed, score: 0-100, issues[] }
Agent Validador --- Valida: secciones requeridas presentes,
     |               response no vacia, longitud minima,
     |               schema keys encontrados
     v               Output: { valid, missing_sections[], format_errors[] }
Agent Sanitizer --- Limpia: emails redactados [EMAIL_REDACTED],
     |               telefonos redactados [PHONE_REDACTED],
     |               fechas normalizadas a ISO,
     v               markdown roto cerrado, truncamiento a 50k chars
Final Response      Output: { sanitized_response, changes_made[], stats }
```

---

## Modelo de datos

### Tablas Supabase

| Tabla | Descripcion |
|-------|-------------|
| `dd_projects` | Proyectos DD principales |
| `dd_areas` | Catalogo de areas de revision |
| `dd_processes` | Procesos por area (incluye harvey_prompt) |
| `dd_tasks` | Ejecucion/seguimiento por proceso + salida IA |
| `dd_contingencies` | Contingencias/riesgos por proyecto |
| `dd_tools` | Catalogo de herramientas DD |
| `dd_tool_executions` | Log de ejecuciones de herramientas |
| `dd_skills_catalog` | 12 skills con prompt_template y output_schema |
| `dd_evidence_packs` | Paquetes de evidencia con fuentes indexadas |
| `dd_societario_requests` | Solicitudes de DD societaria |
| `dd_societario_snapshots` | Snapshots societarios |
| `dd_ip_requests` | Solicitudes de DD propiedad industrial |
| `dd_ip_snapshots` | Snapshots de cartera IP |
| `dd_reports` | Reportes generados (31 templates) |
| `dd_alerts` | Alertas de negociacion |
| `dd_agent_executions` | Observabilidad del pipeline de agentes |

### Migraciones SQL (6)

```
supabase/migrations/
  20260103175640_remote_baseline.sql          -- Schema base DD
  202602200001_hitl_client_visibility.sql     -- HITL + portal cliente
  202602200002_tools_evidence_skills.sql      -- Tools, evidence, skills
  202602200003_seed_tools_skills.sql          -- Seed de tools y skills
  202602210001_societario_schema.sql          -- Schema societario + IP
  202602210002_seed_societario_config.sql     -- Seed config societario
```

Tabla `dd_agent_executions` fue creada via Supabase MCP (migracion cloud).

---

## Skills Catalog (12 activos)

### Phase A — Operativos (4)

| Skill Key | Area | Descripcion |
|-----------|------|-------------|
| `societario.consulta_rm` | Societario | Consulta Registro Mercantil |
| `societario.analisis_organos` | Societario | Analisis de organos sociales |
| `marcas.consulta_oepm` | Marcas/PI | Consulta OEPM |
| `marcas.analisis_riesgo_pi` | Marcas/PI | Analisis de riesgo PI |

### Phase B — Seeded (8)

| Skill Key | Area | Descripcion |
|-----------|------|-------------|
| `contratos.revision_clausulas` | Contratos | Revision de clausulas contractuales |
| `contratos.analisis_garantias` | Contratos | Analisis de garantias |
| `contratos.change_of_control` | Contratos | Clausulas de cambio de control |
| `contratos.vencimientos` | Contratos | Analisis de vencimientos |
| `laboral.plantilla_estructura` | Laboral | Estructura de plantilla |
| `laboral.convenios_colectivos` | Laboral | Analisis de convenios colectivos |
| `laboral.litigios_pendientes` | Laboral | Litigios laborales pendientes |
| `laboral.planes_retribucion` | Laboral | Planes de retribucion |

---

## Setup local

### Prerrequisitos
- Node.js 20+
- Proyecto Supabase con esquema DD
- n8n Cloud con credenciales Harvey configuradas (para flujo IA real)

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

### Env vars configuradas en Vercel

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview |
| `N8N_WEBHOOK_BASE_URL` | Production |

### Deploy manual
```bash
npx vercel pull --yes
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

Nota: `.npmrc` contiene `legacy-peer-deps=true` para resolver conflicto de peer dependencies entre `eslint@^9` y `eslint-config-next@14`.

---

## Tests E2E

```
e2e/
  societario-api.spec.ts    -- Tests de API del pipeline societario
  societario-page.spec.ts   -- Tests de UI del tool societario
```

Ejecutar: `npx playwright test`

---

## Documentacion adicional

| Archivo | Descripcion |
|---------|-------------|
| `PRD.md` | Product Requirements Document completo |
| `docs/PLAN_GENERACION_SKILLS.md` | Roadmap de 30 skills en 11 areas (Phases A-F) |

---

## Proximos pasos

### P0 — Activacion pipeline
1. Configurar credenciales Harvey API en n8n Cloud.
2. Activar los 9 workflows en n8n.
3. Implementar autenticacion y autorizacion (Supabase Auth + RLS).
4. Implementar tabs Tareas, Documentos y Q&A operativos.

### P1 — Expansion
1. Skills Phase C: Fiscal, Inmobiliario (6 skills adicionales).
2. Skills Phase D: Medioambiental, Compliance, Penal (8 skills).
3. Pipeline de entregables con versionado.
4. Dashboard de riesgos agregado.
5. Exportes ejecutivos para comite.
