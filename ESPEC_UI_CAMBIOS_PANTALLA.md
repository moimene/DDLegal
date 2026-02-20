# Especificacion UI - Cambios exactos por pantalla (DD Legal PMO)

## 1. Objetivo
Definir cambios concretos de interfaz para adopcion rapida de abogados y operacion human-in-the-loop, mapeados sobre rutas existentes y nuevas.

Base de rutas actual:
- `/`
- `/projects`
- `/projects/new`
- `/projects/[id]`
- `POST /api/harvey` (backend de soporte a UX)

## 2. Patrones globales obligatorios
1. Header persistente de contexto:
- Proyecto actual.
- Estado global.
- Proximo hito.
- Ultima actualizacion.

2. Estados visuales estandar:
- `loading`, `empty`, `error`, `queued`, `review_required`, `done`.

3. Evidencia visible:
- Todo finding/contingencia con icono de evidencia.
- Click abre panel lateral con documento, pagina y snippet.

4. Acciones primarias en zona fija:
- Botones criticos siempre visibles al scroll en desktop.

5. Accesibilidad minima:
- Focus visible.
- Navegacion teclado.
- Target tactil >= 44x44.
- Contraste AA.

## 3. Cambios por pantalla

## 3.1 `/` Dashboard -> "Mi Jornada Legal"
### Objetivo UX
Dar claridad inmediata de que hacer ahora, no solo metricas historicas.

### Cambios exactos
1. Reemplazar bloque principal de KPIs por 3 paneles:
- `Siguiente mejor accion` (lista priorizada personal).
- `Bloqueos urgentes` (owner, deadline, accion esperada).
- `Pendiente de revision HITL` (outputs IA a validar).

2. Mantener KPIs actuales pero en segunda linea:
- Proyectos activos, en revision, completados, areas.

3. Agregar switch por rol:
- `Abogado`, `Lider`, `PMO`.
- Ajusta contenido del panel principal.

### Componentes nuevos sugeridos
- `TodayActionCard`
- `UrgentBlockersList`
- `HitlQueuePreview`
- `RoleViewSwitch`

### Eventos de tracking
- `my_day_opened`
- `next_action_clicked`
- `urgent_blocker_opened`
- `hitl_item_opened_from_dashboard`

## 3.2 `/projects` Listado de proyectos
### Objetivo UX
Encontrar rapido que proyecto esta en riesgo y entrar a actuar.

### Cambios exactos
1. Agregar columnas:
- `Proximo hito`
- `Bloqueos abiertos`
- `SLA` (on-track / at-risk)

2. Filtros rapidos:
- `At-risk`
- `Con bloqueos`
- `Pendiente cliente`

3. Barra de acciones batch:
- `Enviar digest`
- `Reasignar owner PMO`

### Componentes nuevos sugeridos
- `ProjectRiskBadge`
- `ProjectMilestoneCell`
- `ProjectQuickFilters`

### Eventos de tracking
- `projects_filter_applied`
- `project_risk_badge_clicked`
- `projects_batch_action_used`

## 3.3 `/projects/new` Alta de proyecto
### Objetivo UX
Reducir errores de setup y bajar tiempo a primer valor.

### Cambios exactos
1. Convertir formulario plano en wizard de 3 pasos:
- Paso 1: datos basicos deal.
- Paso 2: modo Data Room (`espejo`, `indice`, `hibrido`).
- Paso 3: plantilla de area + owners iniciales.

2. Guardado parcial automatico por paso.

3. Validacion contextual:
- Mensajes claros con ejemplo legal.

### Componentes nuevos sugeridos
- `ProjectSetupWizard`
- `DataRoomModeSelector`
- `DealTemplatePicker`

### Eventos de tracking
- `project_wizard_step_completed`
- `dataroom_mode_selected`
- `deal_template_selected`
- `project_wizard_completed`

## 3.4 `/projects/[id]` Cockpit operativo (cambio mayor)
### Objetivo UX
Convertir detalle en centro de control unico para PMO + ejecucion legal + HITL.

### Cambios exactos en header
1. Header con 4 bloques:
- estado proyecto,
- progreso por area,
- proximo hito,
- bloqueos abiertos.

2. Acciones primarias fijas:
- `Crear bloqueo`
- `Enviar digest`
- `Abrir portal cliente`

### Cambios exactos en tabs
1. `Resumen`:
- Mantener procesos por area.
- Reemplazar boton simple de Harvey por menu:
  - `Ejecutar analisis manual`
  - `Programar skill automatica`
- Mostrar ultima corrida y estado.

2. `Tareas` (activar funcional):
- Lista de tareas con kanban compacto:
  - `pending`, `in_progress`, `review`, `blocked`, `completed`.
- Filtros por owner, area, criticidad.
- Vista de dependencias.

3. `Contingencias` (refuerzo):
- Mostrar evidencia por item (doc/pagina/snippet).
- Accion rapida:
  - `Confirmar`
  - `Pedir mas evidencia`
  - `Escalar negociacion`

4. `Documentos` (activar funcional):
- Tabla con estados operativos:
  - recibido, OCR, indexado, listo.
- Busqueda por contenido y filtros por area/tipo.
- Indicador de modo Data Room activo.

5. `Q&A` (activar funcional):
- Lista de preguntas abiertas por area.
- Estado: draft, sent, answered, follow_up, closed.
- CTA para "Solicitar al cliente" o "Resolver interno".

### Panel lateral obligatorio (drawer)
Un solo componente transversal:
- `EvidenceDrawer`
- Se abre desde tareas, contingencias, findings y QA.

Contenido:
1. Documento fuente.
2. Pagina/rango.
3. Snippet.
4. Fecha y usuario de ultima revision.

### Eventos de tracking
- `project_cockpit_opened`
- `harvey_manual_run_clicked`
- `skill_schedule_clicked`
- `task_status_changed`
- `contingency_confirmed`
- `evidence_drawer_opened`

## 3.5 Nueva ruta `/projects/[id]/hitl` (recomendada)
### Objetivo UX
Sacar la revision humana de contexto disperso y acelerar decisiones.

### Cambios exactos
1. Cola unica priorizada por:
- severidad,
- deadline,
- confianza IA.

2. Tarjeta de revision con:
- output IA resumido,
- evidencia enlazada,
- acciones rapidas.

3. Atajos teclado:
- `A` aprobar,
- `C` corregir,
- `R` rechazar,
- `E` ver evidencia.

### Componentes nuevos sugeridos
- `HitlQueue`
- `HitlDecisionCard`
- `HitlKeyboardHints`

### Eventos de tracking
- `hitl_queue_opened`
- `hitl_decision_approved`
- `hitl_decision_corrected`
- `hitl_decision_rejected`

## 3.6 Nueva ruta `/client/projects/[id]` (portal cliente minimo)
### Objetivo UX
Dar transparencia accionable sin exponer informacion interna.

### Cambios exactos
1. Widgets principales:
- progreso por area,
- red flags confirmadas,
- bloqueos con accion esperada,
- proximas fechas clave.

2. Items con control de visibilidad:
- solo mostrar `client_visible=true`.

3. CTA claros:
- `Subir documento solicitado`
- `Responder Q&A`
- `Confirmar recepcion`

### Componentes nuevos sugeridos
- `ClientProgressBoard`
- `ClientRedFlagsList`
- `ClientActionRequests`

### Eventos de tracking
- `client_portal_opened`
- `client_action_completed`
- `client_red_flag_viewed`

## 4. Microcopy UX recomendado (ES)
Mensajes clave:
1. Estado en cola IA:
- "Analisis en cola. Puedes seguir trabajando; te avisaremos al completar."
2. Evidencia insuficiente:
- "Falta evidencia verificable. Revisa fuente antes de confirmar."
3. Bloqueo cliente:
- "Accion requerida del cliente para desbloquear este hito."
4. Error integracion:
- "No se pudo completar la ejecucion ahora. El sistema reintentara automaticamente."

## 5. Criterios de aceptacion UX por pantalla
1. Dashboard:
- usuario identifica siguiente accion en <= 10 segundos.

2. Alta proyecto:
- completion rate >= 85% del wizard sin soporte externo.

3. Cockpit proyecto:
- cambio de estado de tarea en <= 2 clics.
- evidencia accesible desde contingencia en <= 1 clic.

4. HITL:
- decision de revision promedio <= 60 segundos/item en piloto.

5. Portal cliente:
- cliente identifica accion pendiente sin asistencia humana.

## 6. Dependencias de backend necesarias para UX
1. Endpoint para cola HITL y decisiones.
2. Campos de evidencia (documento, pagina, snippet, hash).
3. Campo de visibilidad por item (`internal_only`, `client_visible`).
4. Endpoint de digest interno/cliente.
5. Estado de corrida IA y reintentos visibles en UI.

## 7. Mapeo a archivos actuales (implementacion incremental)
1. Extender `/src/app/page.tsx` para "Mi Jornada Legal".
2. Extender `/src/app/projects/page.tsx` con riesgo y filtros operativos.
3. Convertir `/src/app/projects/new/page.tsx` a wizard.
4. Reestructurar `/src/app/projects/[id]/page.tsx` como cockpit.
5. Mantener `/src/app/api/harvey/route.ts` y sumar endpoints para HITL/portal.

