# DD Legal PMO — Plan de Pruebas E2E Exhaustivo

## Contexto

El sistema tiene **27 paginas**, **64+ endpoints API**, **32 tablas** y **6 modulos de componentes**.
Framework: **Playwright** (existente, 2 spec files ya funcionan).

---

## Estructura de Test Suites

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts          # Login helpers + test users setup
│   ├── project.fixture.ts       # Create/seed project helper
│   └── data.fixture.ts          # Seed documents, Q&A, reports, etc.
├── helpers/
│   ├── page-helpers.ts          # gotoWithRetry, fillReactInput (refactored from existing)
│   └── api-helpers.ts           # API call wrappers with auth headers
├── 00-setup.spec.ts             # Global setup: seed test users + demo project
├── 01-auth.spec.ts              # Authentication & RBAC
├── 02-navigation.spec.ts        # Sidebar, routing, breadcrumbs
├── 03-projects.spec.ts          # Project CRUD lifecycle
├── 04-vdr.spec.ts               # Virtual Data Room
├── 05-qa.spec.ts                # Q&A Module
├── 06-reports.spec.ts           # Reporting Engine v2
├── 07-tools.spec.ts             # Herramientas (Societario, IP, Marcas)
├── 08-events.spec.ts            # Event-Driven IA + Notifications
├── 09-cockpit.spec.ts           # Deal Cockpit + Negotiation
├── 10-config.spec.ts            # Configuracion pages
├── 11-client-portal.spec.ts     # Portal Cliente externo
├── societario-api.spec.ts       # (existente — mantener)
├── societario-page.spec.ts      # (existente — mantener)
└── README-E2E-PLAN.md           # Este documento
```

---

## Suite 00: Setup Global (serial)

**Archivo**: `00-setup.spec.ts`

| Test | Descripcion | Criterio |
|------|-------------|----------|
| Seed test users | POST `/api/auth/setup-test-users` | 7 usuarios creados |
| Verify health | GET `/api/system/health` | status 200 |
| Seed demo project | Via API: crear proyecto FMC con areas, tareas, contingencias | project_id disponible |
| Assign roles | POST `/api/projects/[id]/roles` x7 | Cada usuario tiene su rol |

---

## Suite 01: Authentication & RBAC (serial)

**Archivo**: `01-auth.spec.ts`

| # | Test | Metodo | Criterio |
|---|------|--------|----------|
| 1.1 | Login con credenciales validas | POST `/api/auth/login` | token valido, user data |
| 1.2 | Login con credenciales invalidas | POST `/api/auth/login` | 401 Unauthorized |
| 1.3 | GET /api/auth/me con token | GET `/api/auth/me` | email + roles correcto |
| 1.4 | Pagina /login renderiza | Navegador `/login` | Form visible, 7 botones test users |
| 1.5 | Login via UI → redirect a Dashboard | Click test user → form submit | URL = `/` |
| 1.6 | RLS: usuario sin proyecto no ve datos | GET `/api/projects/[id]` sin rol | 403 o data vacia |
| 1.7 | RLS: abogado_area solo ve su area | GET tasks con area_code distinto | Filtrado correcto |
| 1.8 | RLS: cliente_externo solo ve client_visible | GET data | Solo registros visibles |
| 1.9 | Logout → sesion invalida | Click logout → GET /api/auth/me | 401 |
| 1.10 | Expiracion de acceso temporal | Rol con `expires_at` pasado | Acceso denegado |

---

## Suite 02: Navigation & Layout (parallel)

**Archivo**: `02-navigation.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 2.1 | Dashboard carga sin errores JS | Consola limpia (filtrar warnings Next.js) |
| 2.2 | Sidebar muestra solo secciones globales fuera de proyecto | No "Proyecto" section |
| 2.3 | Sidebar muestra seccion Proyecto dentro de `/projects/[id]` | 7 items visibles |
| 2.4 | Sidebar paths correctos (VDR, Q&A, Cockpit...) | Cada link navega correctamente |
| 2.5 | Sidebar collapse/expand funciona | Width cambia, labels ocultos |
| 2.6 | NotificationCenter bell visible en header | Icono campana visible |
| 2.7 | UserIndicator muestra email + rol | Texto correcto |
| 2.8 | Navegacion entre todas las 27 paginas | Cada una carga sin error 500 |

---

## Suite 03: Projects Lifecycle (serial)

**Archivo**: `03-projects.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 3.1 | Pagina `/projects` lista proyectos | Tabla visible, al menos 1 proyecto |
| 3.2 | Crear proyecto via `/projects/new` | Form: nombre, deal_type, review_depth → submit → redirect |
| 3.3 | Proyecto creado aparece en lista | Nombre visible en tabla |
| 3.4 | Detalle proyecto: tabs funcionan | Click cada tab → contenido carga |
| 3.5 | Overview: KPIs visibles | 4 cards con numeros |
| 3.6 | Overview: accesos rapidos grid | 6 cards con links correctos |
| 3.7 | Tab Equipo: roles asignados | Tabla con 7 roles |
| 3.8 | Tab Eventos: EventFeed carga | Contenedor visible |
| 3.9 | Tab IA Insights: SmartSuggestions carga | Cards de sugerencias |
| 3.10 | Badge review_depth visible | Light/Standard/Enhanced badge |

---

## Suite 04: Virtual Data Room (serial)

**Archivo**: `04-vdr.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 4.1 | VDR page carga con FolderTree | Arbol de carpetas visible |
| 4.2 | Crear carpeta | POST `/api/vdr/folders` → carpeta aparece en arbol |
| 4.3 | Crear subcarpeta | Carpeta anidada visible |
| 4.4 | Subir documento (drag-and-drop simulado) | UploadDropzone acepta file → documento en lista |
| 4.5 | Documento aparece con status correcto | Badge "uploaded" |
| 4.6 | Subir nueva version | POST `/api/vdr/documents/[id]/versions` → version_number incrementa |
| 4.7 | Historial versiones visible | Panel derecho muestra v1, v2 |
| 4.8 | Mover documento entre carpetas | PATCH → documento cambia de folder |
| 4.9 | Bulk select + archive | Seleccionar 2 docs → bulk archive |
| 4.10 | Busqueda cross-field | GET `/api/vdr/search?q=keyword` → resultados |
| 4.11 | ACL: set permission | POST `/api/vdr/acl` → permiso grabado |
| 4.12 | ACL: deny sin permiso | GET doc sin ACL → 403 |
| 4.13 | Gap Analysis page | `/projects/[id]/vdr/gap-analysis` → 4 KPIs + grid areas |
| 4.14 | Gap Analysis: cobertura coherente | % cobertura reflejado correctamente |
| 4.15 | Link compartible | POST `/api/vdr/links` → token generado |
| 4.16 | Audit trail | GET `/api/vdr/audit` → eventos ordenados |

**API Tests (sin UI)**:
| # | Test | Criterio |
|---|------|----------|
| 4.A1 | GET /api/vdr/documents pagination | X-Total-Count header, offset/limit |
| 4.A2 | GET /api/vdr/documents filters | file_type, is_confidential, date_from |
| 4.A3 | PATCH /api/vdr/folders rename | Nombre actualizado |
| 4.A4 | DELETE /api/vdr/folders cascade check | 400 si tiene contenido |
| 4.A5 | POST /api/vdr/bulk archive | Multiples docs archivados |

---

## Suite 05: Q&A Module (serial)

**Archivo**: `05-qa.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 5.1 | Q&A page carga | Lista hilos o estado vacio |
| 5.2 | Crear hilo Q&A | POST `/api/qa/threads` → thread_number asignado |
| 5.3 | Hilo aparece en lista | Subject visible en tabla |
| 5.4 | Enviar mensaje en hilo | POST `/api/qa/threads/[id]/messages` → mensaje visible |
| 5.5 | Responder como target | sender_role: target → status cambia a answered |
| 5.6 | Ciclo completo: draft→sent→answered→closed | Status transitions correctas |
| 5.7 | SLA tracking: breach detectado | Crear hilo con SLA 1h → verificar qa_slas |
| 5.8 | Q&A assignment routing | POST `/api/qa/assignments` → default_assignee configurado |
| 5.9 | Link cruzado a contingencia | POST `/api/qa/links` → entity_type: contingency |
| 5.10 | Link cruzado a document_version | POST `/api/qa/links` → entity_type: document_version |
| 5.11 | Filtros por area_code | GET threads con area_code → solo hilos de esa area |
| 5.12 | Filtros por status | GET threads?status=pending_response |
| 5.13 | Q&A desde gap analysis (source: gap_analysis) | Hilo con source correcto |

---

## Suite 06: Reporting Engine v2 (serial)

**Archivo**: `06-reports.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 6.1 | Lista informes | `/reports` → tabla visible |
| 6.2 | Crear informe nuevo | `/reports/new` → wizard → submit |
| 6.3 | Informe en cola genera correctamente | Status pending→generating→done |
| 6.4 | Detalle informe: grounding meter | Score circular visible |
| 6.5 | Detalle informe: evidence pack | CollapsiblePanel con fuentes |
| 6.6 | FreezeControl visible | Boton "Congelar" visible cuando status=done |
| 6.7 | Freeze report | Click congelar → confirmar → is_frozen=true |
| 6.8 | Frozen report: edicion bloqueada | Banner "congelado" visible |
| 6.9 | Unfreeze report | Click descongelar → is_frozen=false |
| 6.10 | ReportExportPanel | 4 botones formato (Markdown, JSON, HTML, CSV) |
| 6.11 | Export Markdown | POST `/api/reports/export` format=markdown → blob descargable |
| 6.12 | Export HTML | format=html → HTML con CSS inline |
| 6.13 | Version history | POST `/api/reports/[id]/versions` → nueva version |
| 6.14 | ReportVersionHistory timeline | Timeline visible con versiones |
| 6.15 | Compare versions | POST `/api/reports/compare` → diff campo a campo |
| 6.16 | report_category visible | Badge categoria en header |
| 6.17 | visibility badge | Badge visibilidad (internal/client/...) |

---

## Suite 07: Herramientas (parallel)

**Archivo**: `07-tools.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 7.1 | Hub herramientas carga | `/tools` → grid de tools |
| 7.2 | Societario page carga | `/tools/societario` → form visible |
| 7.3 | IP Radar page carga | `/tools/ip-radar` → form visible |
| 7.4 | Marcas page carga | `/tools/marcas` → form visible |
| 7.5 | Tool execution API | POST `/api/tools/execute` → execution logged |
| 7.6 | Executions list | GET `/api/tools/executions` → list con resultados |
| 7.7 | Link tool to project | POST `/api/tools/link-project` → vinculado |

> Los tests detallados de Societario API/Page ya existen en `societario-*.spec.ts`

---

## Suite 08: Events & Notifications (parallel)

**Archivo**: `08-events.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 8.1 | Event list API | GET `/api/events` → array de eventos |
| 8.2 | SSE stream conecta | GET `/api/events/stream` → SSE headers correctos |
| 8.3 | AI classify | POST `/api/ai/classify` con filename → categoria + confianza |
| 8.4 | AI suggest | POST `/api/ai/suggest` → array de sugerencias |
| 8.5 | Notifications list | GET `/api/notifications` → array reconstructed |
| 8.6 | Notification count | GET `/api/notifications/count` → conteo rapido |
| 8.7 | EventFeed component render | Tab Eventos en proyecto → feed visible |
| 8.8 | SmartSuggestions render | Tab IA Insights → cards visibles |
| 8.9 | NotificationCenter dropdown | Click bell → dropdown con notificaciones |
| 8.10 | Mark notification as read | PATCH → estado actualizado |

---

## Suite 09: Cockpit & Negotiation (serial)

**Archivo**: `09-cockpit.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 9.1 | Cockpit page carga | `/projects/[id]/cockpit` → paneles visibles |
| 9.2 | Cockpit API aggregation | GET `/api/projects/[id]/cockpit` → datos completos |
| 9.3 | KPIs correctos | Total tareas, contingencias, cobertura VDR |
| 9.4 | HITL page carga | `/projects/[id]/hitl` → decisiones pendientes |
| 9.5 | HITL decision flow | Aprobar/rechazar decision → status actualizado |
| 9.6 | Negotiation page carga | `/projects/[id]/negotiation` → board contingencias |
| 9.7 | Negotiation positions | Buy/sell positions editables |
| 9.8 | SPA clause mapping | Vinculacion contingencia ↔ clausula |
| 9.9 | Activity page carga | `/projects/[id]/activity` → timeline vertical |
| 9.10 | Activity timeline filter | Tabs por tipo de actividad |

---

## Suite 10: Configuracion (parallel)

**Archivo**: `10-config.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 10.1 | Estado del Sistema | `/configuracion` → health dashboard |
| 10.2 | Catalogo Skills | `/skills` → tabla skills |
| 10.3 | Gestion Herramientas | `/configuracion/herramientas` → CRUD |
| 10.4 | Gestion Skills | `/configuracion/skills` → lifecycle |
| 10.5 | Plantillas | `/configuracion/templates` → tabla templates |
| 10.6 | Dominios | `/configuracion/dominios` → CRUD domain_enums |
| 10.7 | Seguridad | `/configuracion/seguridad` → user management |
| 10.8 | Telemetria dashboard | Skills con metricas de ejecucion |

---

## Suite 11: Portal Cliente (serial)

**Archivo**: `11-client-portal.spec.ts`

| # | Test | Criterio |
|---|------|----------|
| 11.1 | Portal carga con login cliente | Login como cliente_externo |
| 11.2 | Solo ve datos client_visible | Tareas/docs sin flag no visibles |
| 11.3 | No puede editar | Botones de edicion ausentes |
| 11.4 | ClientDashboard renderiza | Dashboard con KPIs limitados |

---

## Metricas de Cobertura

| Categoria | Tests | Prioridad |
|-----------|-------|-----------|
| Auth/RBAC | 10 | P0 |
| Navigation | 8 | P0 |
| Projects | 10 | P0 |
| VDR | 21 | P0 |
| Q&A | 13 | P0 |
| Reports | 17 | P1 |
| Tools | 7 | P1 |
| Events/Notifications | 10 | P1 |
| Cockpit/Negotiation | 10 | P1 |
| Configuration | 8 | P2 |
| Client Portal | 4 | P2 |
| **TOTAL** | **118** | |

---

## Ejecucion

```bash
# Todos los tests
npm test

# Por suite individual
npx playwright test e2e/01-auth.spec.ts

# Solo API tests (rapido, sin browser)
npx playwright test --grep "@api"

# Solo UI tests
npx playwright test --grep "@ui"

# Con UI interactiva
npm run test:ui

# Generar reporte HTML
npx playwright test --reporter=html
```

---

## Fixtures Clave

### auth.fixture.ts
```typescript
// Extends Playwright test con autenticacion
export const test = base.extend<{
  authenticatedPage: Page;       // Pre-logged as pm@test
  cloPage: Page;                 // Pre-logged as clo@test
  clientePage: Page;             // Pre-logged as cliente@test
  apiContext: APIRequestContext; // With auth headers
}>();
```

### project.fixture.ts
```typescript
// Seeds un proyecto completo con:
// - 11 areas
// - ~50 tareas
// - ~10 contingencias
// - 7 roles asignados
// - VDR folders + documentos
// - Q&A threads
// - Reportes
export async function seedFullProject(request: APIRequestContext): Promise<string>;
```

---

## Prioridad de Implementacion

1. **Sprint 1**: `fixtures/` + `00-setup` + `01-auth` + `02-navigation` (foundation)
2. **Sprint 2**: `03-projects` + `04-vdr` (core workflows)
3. **Sprint 3**: `05-qa` + `06-reports` (information layer)
4. **Sprint 4**: `07-tools` + `08-events` + `09-cockpit` (advanced features)
5. **Sprint 5**: `10-config` + `11-client-portal` (governance & edge cases)

---

## Notas Tecnicas

- **Test users**: 7 cuentas predefinidas en Supabase Auth, seed via `/api/auth/setup-test-users`
- **Data isolation**: Cada suite crea sus propios datos; cleanup via `afterAll`
- **Parallel safety**: Suites que comparten estado (serial). Suites independientes (parallel)
- **CI**: GitHub Actions con Supabase CLI para DB temporal, Playwright containers
- **Screenshots**: `screenshot: 'only-on-failure'` en config para debugging
- **Trace**: `trace: 'on-first-retry'` ya configurado en playwright.config.ts
