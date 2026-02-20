# PRD - DD Legal PMO (MVP Operativo)

## 1. Contexto y problema
Los equipos de due diligence legal necesitan coordinar proyectos con multiples areas, procesos y hallazgos en plazos cortos y con trazabilidad suficiente para decision de inversion.

Situacion actual que se busca resolver:
- Seguimiento fragmentado en documentos y hojas dispersas.
- Baja estandarizacion en el analisis por area.
- Dificultad para convertir hallazgos en contingencias priorizadas.
- Integracion incompleta entre trabajo humano y copiloto IA legal.

## 2. Objetivo de producto y objetivos de negocio/legal
Objetivo de producto:
- Proveer un PMO legal centralizado para gestionar proyectos DD end-to-end y acelerar analisis asistido por IA con control de estado y trazabilidad.

Objetivos de negocio/legal del MVP:
- Reducir tiempo de arranque de un proyecto DD.
- Estandarizar ejecucion por procesos y areas.
- Aumentar visibilidad de riesgos/contingencias para comite de decision.
- Dejar base operativa para formalizar Q&A y entregables posteriores.

## 3. Usuarios objetivo y JTBD
Usuarios principales:
- Lider legal transaccional / CLO.
- Abogado de ejecucion DD por area.
- PM de transaccion (coordinacion de avance y deadlines).
- Stakeholder de negocio/inversion que consume resumen de riesgos.

JTBD:
- "Cuando inicio una DD, quiero crear rapidamente el proyecto y su contexto para empezar ejecucion sin friccion."
- "Cuando coordino multiples areas, quiero visualizar avance y estados para detectar bloqueos pronto."
- "Cuando un proceso requiere analisis, quiero invocar IA sobre prompt especializado para acelerar primera lectura."
- "Cuando preparo decision, quiero ver contingencias priorizadas por severidad e impacto economico."

## 4. Alcance MVP
### In-scope
- Dashboard general de actividad DD.
- Listado y busqueda de proyectos.
- Alta de proyecto DD.
- Detalle de proyecto con progreso.
- Invocacion de Harvey AI por proceso.
- Persistencia y visualizacion de contingencias existentes.
- Contrato base de integracion con n8n/Harvey.

### Out-of-scope
- Edicion avanzada de contingencias con workflow de aprobacion.
- Gestor documental completo.
- Q&A operativo completo con ciclo envio/respuesta.
- Control de permisos por rol listo para produccion enterprise.
- Reporteria ejecutiva automatizada y versionado de entregables final.

## 5. Requisitos funcionales por modulo
### 5.1 Dashboard
- Mostrar KPIs: activos, en revision, completados, areas cubiertas.
- Mostrar proyectos recientes con acceso directo al detalle.
- Mostrar catalogo de areas de revision.

### 5.2 Proyectos (listado y alta)
- Listar proyectos ordenados por fecha de creacion.
- Filtrar por nombre o sociedad target.
- Permitir crear proyecto con campos clave: nombre, target, sector, tipo de operacion, cliente, deadline, alcance.
- Redirigir al detalle al crear proyecto exitosamente.

### 5.3 Detalle de proyecto
- Mostrar metadata principal y estado del proyecto.
- Mostrar progreso agregado de tareas.
- Mostrar tabs funcionales:
  - Resumen: procesos por area e invocacion IA.
  - Contingencias: listado de riesgos y recomendacion.
- Mostrar tabs no implementadas aun (Tareas, Documentos, Q&A) con estado placeholder.

### 5.4 Contingencias
- Listar contingencias por proyecto.
- Mostrar titulo, descripcion, severidad, estimacion economica y recomendacion.
- Permitir lectura rapida orientada a toma de decision.

### 5.5 Integracion IA (Harvey via n8n)
- Permitir invocacion por proceso desde detalle de proyecto.
- Validar request minima.
- Crear o actualizar tarea vinculada a proyecto/proceso.
- Almacenar salida IA en `dd_tasks.ai_output`.
- Ajustar estado de tarea segun resultado (queued vs completado/revision).
- Mantener fallback cuando n8n no responda.

## 6. Requisitos de integracion IA (contrato esperado)
### 6.1 API interna
- Endpoint: `POST /api/harvey`
- Input minimo obligatorio:
  - `project_id`
  - `process_id`
  - `prompt`
- Input opcional de contexto:
  - `target_company`
  - `sector`

### 6.2 Enriquecimiento de prompt
La API debe reemplazar placeholders de prompt para incorporar contexto de target y sector antes de invocar n8n/Harvey.

### 6.3 Salida esperada
Response API:
- `success: true|false`
- `result: object`

Desde n8n/Harvey (contrato esperado del workflow):
- `status: ok | error` (y estado equivalente de cola cuando aplique fallback)
- `output.summary`
- `output.findings[]`
- `output.contingencies[]`
- `output.documents_identified[]`
- `output.next_steps[]`
- `output.disclaimer`

## 7. Requisitos no funcionales minimos
### 7.1 Seguridad basica
- Variables sensibles gestionadas por entorno.
- No exponer secretos en cliente.
- Definir como siguiente fase autenticacion y control de acceso por rol.

### 7.2 Confiabilidad operativa
- Manejo de fallback si n8n o Harvey no estan disponibles.
- Persistencia de estado de tarea aunque falle integracion externa.

### 7.3 Trazabilidad
- Cada invocacion IA debe quedar asociada a proyecto y proceso.
- La salida IA debe quedar persistida para revision posterior.

### 7.4 Mantenibilidad
- Mantener contratos de datos tipados (interfaces TS).
- Separacion clara entre UI, cliente de datos y route handler de integracion.

## 8. Criterios de aceptacion por flujo
### Flujo A - Crear proyecto
- Dado un usuario en "Nuevo Proyecto", cuando completa campos obligatorios y envia, entonces se crea registro en `dd_projects` y navega al detalle.

### Flujo B - Ver cartera de proyectos
- Dado un usuario en "Proyectos", cuando busca por nombre o target, entonces la tabla muestra solo coincidencias.

### Flujo C - Invocar IA por proceso
- Dado un proyecto con procesos, cuando se pulsa "Harvey AI", entonces se envia `POST /api/harvey`, se actualiza/crea tarea y se refresca listado de tareas.

### Flujo D - Fallback de integracion
- Dado que n8n no esta disponible, cuando se invoca IA, entonces la API responde sin romper UX y deja estado en cola para trazabilidad.

### Flujo E - Revisar contingencias
- Dado un proyecto con contingencias, cuando se abre la tab correspondiente, entonces se visualizan severidad, monto y recomendacion.

## 9. Metricas iniciales de exito
- Tiempo medio desde creacion de proyecto hasta primera invocacion IA.
- Porcentaje de procesos con tarea creada por IA sobre total de procesos ejecutados.
- Numero de contingencias registradas por proyecto DD.
- Tiempo de ciclo para pasar de estado `in_progress` a `review` en tareas IA.
- Ratio de invocaciones IA exitosas vs fallback en cola.

## 10. Dependencias y riesgos
Dependencias:
- Esquema DD de Supabase disponible y consistente.
- n8n desplegado y webhook `dd-harvey-invoke` operativo.
- Endpoint Harvey operativo y credenciales validas en entorno n8n.

Riesgos:
- No hay migraciones SQL versionadas en repo (riesgo de drift de esquema).
- Tabs clave aun en placeholder reducen cobertura funcional del PMO.
- Ausencia de auth/RLS documentada como gap de seguridad para produccion.
- Contrato de salida IA sin validacion estricta puede producir payloads heterogeneos.
- Sin suite de tests automatizados que cubra regresiones de flujo.

## 11. Backlog priorizado siguiente fase
### P0 (imprescindible para operacion robusta)
1. Versionar migraciones SQL y seed base para `dd_areas` y `dd_processes`.
2. Implementar flujo operativo real de tabs Tareas, Documentos y Q&A.
3. Definir e implementar autenticacion + autorizacion (RLS y roles).
4. Estandarizar parser/validacion de respuesta IA en `POST /api/harvey`.
5. Agregar tests minimos de flujos criticos (API + smoke UI).

### P1 (escalado funcional y calidad de decision)
1. Pipeline de entregables con versionado y aprobacion.
2. Dashboard de riesgos agregado por severidad/probabilidad/monto.
3. Exportes ejecutivos para comite (resumen DD y red flags).
4. Observabilidad de integracion IA (latencia, error rate, retries).
5. Trazabilidad avanzada de decisiones legales y mitigantes por contingencia.

## 12. Cambios en APIs/interfaces/tipos publicos
Este PRD no propone cambios de runtime ni cambios de tipos existentes.

Se documenta como contrato vigente:
- `POST /api/harvey` con request minima `project_id`, `process_id`, `prompt`; response `success` + `result`.
- Entidades definidas en codigo:
  - `DDProject`
  - `DDProcess`
  - `DDTask`
  - `DDContingency`
  - `DDQA`
  - `DDDeliverable`
- Variables de entorno requeridas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `N8N_WEBHOOK_BASE_URL`
  - `HARVEY_API_KEY`

## 13. Base de verdad en codigo
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/app/api/harvey/route.ts`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/supabase.ts`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/n8n/dd_harvey_adapter.workflow.json`
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/.env.local` (solo nombres de variables)

