# DD Legal PMO

## Que es DD Legal PMO
DD Legal PMO es una plataforma web para gestionar proyectos de due diligence legal con soporte de IA en flujos de analisis por area.

Estado actual del MVP:
- Implementado: dashboard, listado de proyectos, alta de proyecto, detalle de proyecto, invocacion de Harvey AI por proceso, lectura de contingencias.
- Parcial: gestion de tareas como vista dedicada.
- Pendiente: gestion funcional completa de Documentos y Q&A (tabs existentes con placeholder).

## Stack tecnico y arquitectura resumida
- Frontend: Next.js 14 (App Router), React 18, TypeScript.
- Estilos/UI: Tailwind CSS v4 + tokens de diseno.
- Datos: Supabase (cliente JS desde frontend y route handler).
- Integracion IA: API interna `POST /api/harvey` + webhook n8n `dd-harvey-invoke` + endpoint Harvey.

Arquitectura funcional:
1. UI consulta y persiste datos en tablas de DD en Supabase.
2. En detalle de proyecto, usuario invoca Harvey por proceso.
3. `POST /api/harvey` enriquece prompt, crea/actualiza tarea y llama n8n.
4. Resultado IA se guarda en `dd_tasks.ai_output` y se ajusta estado de tarea.

## Setup local
### Prerrequisitos
- Node.js 20+ recomendado.
- Proyecto Supabase con esquema DD creado.
- n8n operativo si se quiere ejecutar flujo IA real.

### Variables de entorno requeridas
Definir en `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_BASE_URL`
- `HARVEY_API_KEY`

Nota: `HARVEY_API_KEY` esta declarada en entorno del proyecto, pero el flujo actual de `POST /api/harvey` enruta la llamada mediante n8n.

### Scripts disponibles
Del `package.json`:
- `npm run dev`: desarrollo local.
- `npm run build`: build de produccion.
- `npm run start`: servir build de produccion.
- `npm run lint`: lint de Next.js.

### Arranque rapido
1. Instalar dependencias: `npm install`
2. Configurar `.env.local` con las variables requeridas.
3. Ejecutar: `npm run dev`
4. Abrir: `http://localhost:3000`

## Modelo funcional actual
### Dashboard
- KPIs: proyectos activos/en revision/completados y numero de areas.
- Lista de proyectos recientes.
- Grilla de areas de revision.

### Proyectos
- Listado con buscador por nombre y sociedad target.
- Alta de nuevo proyecto con metadatos de operacion.
- Navegacion al detalle por proyecto.

### Detalle de proyecto
- Header de estado y progreso.
- Tabs: Resumen, Tareas, Contingencias, Documentos, Q&A.
- Resumen: procesos por area + boton para invocar Harvey AI.
- Contingencias: listado de riesgos identificados con severidad y monto.
- Tareas/Documentos/Q&A: placeholders visibles, sin flujo completo implementado.

## Flujo IA extremo a extremo
1. Usuario pulsa "Harvey AI" en un proceso dentro de Resumen.
2. UI hace `POST /api/harvey` con:
   - `project_id`
   - `process_id`
   - `prompt`
   - `target_company`
   - `sector`
3. API:
   - valida campos minimos (`project_id`, `process_id`, `prompt`),
   - enriquece prompt (placeholders de target/sector),
   - crea o actualiza tarea en `dd_tasks`,
   - llama webhook n8n `${N8N_WEBHOOK_BASE_URL}/dd-harvey-invoke`.
4. n8n adapta request y consulta Harvey.
5. API guarda resultado en `dd_tasks.ai_output` y actualiza estado.
6. UI refresca tareas del proyecto.

Comportamiento fallback:
- Si n8n no esta disponible o no hay URL configurada, la respuesta se marca como `queued` y queda trazabilidad de prompt para ejecucion posterior.

## Modelo de datos usado
Tablas consumidas por frontend/API actual:
- `dd_projects`: entidad principal de proyecto DD.
- `dd_areas`: catalogo de areas de revision.
- `dd_processes`: procesos por area, incluye `harvey_prompt`.
- `dd_tasks`: ejecucion/seguimiento por proceso, estado y salida IA.
- `dd_contingencies`: contingencias/riesgos detectados por proyecto.

Tipos ya definidos en codigo (alcance de esquema DD):
- `DDProject`
- `DDArea`
- `DDProcess`
- `DDTask`
- `DDContingency`
- `DDQA`
- `DDDeliverable`

## Contratos vigentes (API e interfaces)
### API interna
- Endpoint: `POST /api/harvey`
- Request minima: `project_id`, `process_id`, `prompt`
- Response base:
  - `success: boolean`
  - `result: object` (salida IA o estado en cola)
- Endpoint: `POST /api/hitl/decision`
- Request minima: `task_id`, `decision` (`approve|correct|reject`)
- Response base:
  - `success: boolean`
  - `task: object`
- Endpoint: `GET /api/client/projects/:id`
- Response base:
  - `success: boolean`
  - `project`, `progress_by_area`, `confirmed_flags`, `blockers`, `next_milestones`

### Variables de entorno contractuales
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_BASE_URL`
- `HARVEY_API_KEY`

## Estado de madurez del MVP
Implementado:
- Estructura navegable de PMO DD.
- CRUD inicial de proyecto (alta y lectura).
- Orquestacion basica de invocacion IA por proceso.
- Visualizacion de contingencias existentes.

Pendiente prioritario:
- Gestion real de tareas (acciones, asignaciones, cierre).
- Flujo operativo de documentos.
- Flujo operativo de Q&A legal.
- Mecanismos de autenticacion/autorizacion y hardening.

## Riesgos y dependencias inmediatas
- Dependencia critica de esquema Supabase preexistente (sin migraciones SQL en repo).
- Dependencia de n8n para ejecucion IA real.
- Manejo de errores y contratos IA sin validacion estricta de schema.
- Sin capa de autenticacion/roles en frontend (riesgo de acceso no controlado).
- Sin bateria de tests automatizados en repo.

## Proximos pasos sugeridos del MVP
1. Definir y versionar migraciones SQL del esquema DD.
2. Implementar flujo funcional de tabs Tareas, Documentos y Q&A.
3. Introducir autenticacion y politicas de acceso (RLS + roles operativos).
4. Estandarizar contrato de salida IA y parser/validacion robusta.
5. Agregar tests minimos de API y smoke tests de flujos criticos.

## Base de verdad en codigo
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/app/api/harvey/route.ts`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/supabase.ts`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/n8n/dd_harvey_adapter.workflow.json`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/.env.local` (solo nombres de variables)
