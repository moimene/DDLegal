# Backlog Jira - Adopcion Rapida y UX Maxima (DD Legal PMO)

## 1. Objetivo del backlog
Traducir la estrategia de usabilidad a epics e historias implementables, priorizadas para:
- adopcion rapida por abogados,
- trabajo human-in-the-loop (HITL) sin friccion,
- visibilidad PMO y portal cliente accionable.

Fecha base del backlog: 20-Feb-2026.

## 2. Convenciones Jira
- Proyecto sugerido: `DDUX`.
- Prioridad: `P0` (critico), `P1` (alto), `P2` (medio).
- Estimacion: Story points `1, 2, 3, 5, 8`.
- Estado: `Backlog -> Ready -> In Progress -> Review -> Done`.
- Definicion de listo (DoR):
1. User story con criterio de aceptacion.
2. Dependencias identificadas.
3. Evento de tracking definido.
- Definicion de terminado (DoD):
1. Criterios de aceptacion cumplidos.
2. Telemetria emitida y validada.
3. QA funcional + QA legal (si aplica) completados.
4. Documentacion de uso actualizada.

## 3. Epics y resultados esperados

## EPIC DDUX-EP01 - Activacion sin friccion para abogados (P0)
Resultado: un abogado nuevo obtiene valor en menos de 20 minutos.

### Historias
1. `DDUX-101` - Wizard de alta de proyecto en 3 pasos (5 pts)
- Como abogado, quiero crear proyecto con flujo guiado para evitar errores de setup.
- Aceptacion:
1. 3 pasos: datos minimos, modo Data Room, plan inicial por area.
2. Validaciones en linea y guardado parcial.
3. Redireccion a detalle con checklist inicial generado.
- Evento: `project_wizard_completed`.

2. `DDUX-102` - Plantillas por tipo de deal (3 pts)
- Como abogado, quiero iniciar con plantilla para no configurar desde cero.
- Aceptacion:
1. Plantillas para `acquisition`, `merger`, `jv`, `carve-out`.
2. Se precargan procesos y deadlines sugeridos.
- Evento: `deal_template_applied`.

3. `DDUX-103` - Home "Mi Jornada Legal" por rol (8 pts)
- Como abogado, quiero ver mi proxima accion para comenzar el dia sin navegar 5 pantallas.
- Aceptacion:
1. Seccion "Siguiente mejor accion".
2. Seccion "Bloqueos urgentes".
3. Seccion "Pendiente de revision HITL".
- Evento: `my_day_opened`.

4. `DDUX-104` - Onboarding guiado in-app (3 pts)
- Como usuario nuevo, quiero un tour de 10-15 minutos para aprender el flujo.
- Aceptacion:
1. Tour contextual en dashboard, detalle y revision IA.
2. Puede pausarse y retomarse.
- Evento: `onboarding_completed`.

5. `DDUX-105` - Modo asistido primeras 2 semanas (2 pts)
- Como abogado, quiero tips contextuales solo al inicio para reducir curva.
- Aceptacion:
1. Tips activos para cuentas nuevas durante 14 dias.
2. Opcion para desactivar manualmente.
- Evento: `assist_tip_dismissed`.

## EPIC DDUX-EP02 - Workbench de proceso y HITL (P0)
Resultado: revisar IA y decidir en 1 pantalla con evidencia visible.

### Historias
1. `DDUX-201` - Workbench por proceso en detalle (8 pts)
- Como abogado de area, quiero checklist + findings + contingencias en vista unica.
- Aceptacion:
1. Panel de documentos esperados.
2. Panel de findings sugeridos.
3. Panel de contingencias abiertas.
- Evento: `process_workbench_opened`.

2. `DDUX-202` - Bandeja unica HITL (8 pts)
- Como revisor, quiero cola priorizada por riesgo y deadline para decidir rapido.
- Aceptacion:
1. Orden por severidad, vencimiento y confianza.
2. Filtros por area, proyecto y estado.
- Evento: `hitl_queue_opened`.

3. `DDUX-203` - Acciones rapidas de revision (5 pts)
- Como revisor, quiero aprobar/corregir/rechazar en un clic.
- Aceptacion:
1. Acciones: aprobar, corregir, rechazar, pedir evidencia.
2. Motivo obligatorio en rechazo.
- Evento: `hitl_decision_submitted`.

4. `DDUX-204` - Gating por impacto legal (5 pts)
- Como lider legal, quiero reglas de aprobacion segun impacto.
- Aceptacion:
1. Bajo impacto: autopromocion con muestreo.
2. Medio impacto: revision obligatoria.
3. Alto impacto: doble validacion.
- Evento: `risk_gate_applied`.

5. `DDUX-205` - Etiqueta de confianza y supuestos (3 pts)
- Como abogado, quiero saber cuando un output es incompleto.
- Aceptacion:
1. Badge de confianza en cada output.
2. Marcado automatico "supuesto" si falta evidencia minima.
- Evento: `assumption_flag_created`.

## EPIC DDUX-EP03 - Documentos y evidencia trazable (P0)
Resultado: cada hallazgo tiene prueba verificable y localizable.

### Historias
1. `DDUX-301` - Tab Documentos funcional MVP (8 pts)
- Como equipo DD, quiero gestionar documentos por estado operacional.
- Aceptacion:
1. Estados: recibido, OCR, indexado, listo.
2. Filtro por area, tipo y estado.
- Evento: `document_tab_opened`.

2. `DDUX-302` - Modo Data Room por proyecto (5 pts)
- Como PMO legal, quiero elegir politica documental permitida por VDR.
- Aceptacion:
1. Selector: espejo, indice, hibrido.
2. Registro de motivo y restriccion del vendedor.
- Evento: `dataroom_mode_set`.

3. `DDUX-303` - Evidencia vinculada a finding (8 pts)
- Como abogado, quiero ver documento, pagina y snippet desde cada finding.
- Aceptacion:
1. Link directo a evidencia.
2. Referencia de pagina/rango visible.
3. Hash/provenance almacenado.
- Evento: `evidence_link_opened`.

4. `DDUX-304` - Deteccion de falta de evidencia (3 pts)
- Como revisor, quiero alerta cuando un finding no tenga respaldo minimo.
- Aceptacion:
1. Estado "evidencia insuficiente".
2. Bloqueo de promocion a confirmado.
- Evento: `insufficient_evidence_block`.

5. `DDUX-305` - Busqueda semantica documental (5 pts)
- Como abogado, quiero encontrar soporte por contenido, no solo nombre archivo.
- Aceptacion:
1. Busqueda por texto OCR/indexado.
2. Resultados con preview de snippet.
- Evento: `semantic_search_used`.

## EPIC DDUX-EP04 - PMO operativo y predictibilidad (P0)
Resultado: agenda viva con bloqueos, SLAs y ruta critica.

### Historias
1. `DDUX-401` - Timeline de hitos por proyecto (8 pts)
- Como PM de transaccion, quiero ver hitos y dependencias.
- Aceptacion:
1. Hitos con fechas y owner.
2. Dependencias visibles entre hitos.
- Evento: `timeline_viewed`.

2. `DDUX-402` - Semaforo on-track / at-risk (3 pts)
- Como lider, quiero anticipar desviaciones.
- Aceptacion:
1. Estado por area y global.
2. Regla explicita para cambio de estado.
- Evento: `risk_status_changed`.

3. `DDUX-403` - Registro de bloqueos accionables (5 pts)
- Como equipo, quiero bloquear con motivo y accion esperada.
- Aceptacion:
1. Bloqueo con owner, causa y fecha compromiso.
2. SLA de resolucion y alertas.
- Evento: `blocker_created`.

4. `DDUX-404` - Digest diario interno (5 pts)
- Como PMO, quiero resumen diario automatico para coordinar equipo.
- Aceptacion:
1. Incluye hitos, bloqueos, tareas vencidas y riesgos.
2. Enlace directo al proyecto.
- Evento: `daily_digest_sent_internal`.

5. `DDUX-405` - Dashboard de capacidad por area (5 pts)
- Como PMO, quiero ver carga vs capacidad para reasignar.
- Aceptacion:
1. Conteo tareas por estado y abogado.
2. Alertas de sobrecarga.
- Evento: `capacity_dashboard_opened`.

## EPIC DDUX-EP05 - Portal cliente con control granular (P0)
Resultado: cliente informado y colaborando sin comprometer confidencialidad.

### Historias
1. `DDUX-501` - Portal cliente minimo por proyecto (8 pts)
- Como cliente, quiero ver progreso y proximos hitos.
- Aceptacion:
1. Progreso por area.
2. Proximas fechas clave.
3. Estado general del proyecto.
- Evento: `client_portal_opened`.

2. `DDUX-502` - Red flags confirmadas para cliente (5 pts)
- Como cliente, quiero entender riesgos ya validados.
- Aceptacion:
1. Lista solo de flags "confirmadas".
2. Explicacion corta y accion recomendada.
- Evento: `client_red_flag_viewed`.

3. `DDUX-503` - Bloqueos con accion esperada del cliente (5 pts)
- Como cliente, quiero saber que debo enviar o aprobar.
- Aceptacion:
1. Cada bloqueo tiene "accion esperada".
2. Deadline visible y recordatorio.
- Evento: `client_action_requested`.

4. `DDUX-504` - Permisos por item (8 pts)
- Como despacho, quiero controlar visibilidad por entidad.
- Aceptacion:
1. Flags `internal_only`, `client_visible`.
2. Auditoria de cambios de visibilidad.
- Evento: `visibility_rule_changed`.

5. `DDUX-505` - Digest cliente semanal (3 pts)
- Como cliente, quiero resumen periodico para no depender de correos manuales.
- Aceptacion:
1. Envio semanal con enlaces validos al portal.
2. Respeta permisos por item.
- Evento: `weekly_digest_sent_client`.

## EPIC DDUX-EP06 - IA proactiva por skills (P1)
Resultado: pasar de IA reactiva a ejecucion por eventos con gobernanza.

### Historias
1. `DDUX-601` - Trigger por evento documental (8 pts)
- Como sistema, quiero lanzar skill al detectar documento relevante.
- Aceptacion:
1. Evento "documento indexado" dispara skill configurada.
2. Registro de corrida con estado.
- Evento: `agent_run_started`.

2. `DDUX-602` - Catalogo de skills tipadas (8 pts)
- Como admin legaltech, quiero versionar skills por area y PMO.
- Aceptacion:
1. Metadatos: dominio, prompt, tools, output schema.
2. Version y estado activo/inactivo.
- Evento: `skill_catalog_updated`.

3. `DDUX-603` - Validador de payload IA (5 pts)
- Como equipo legal, quiero bloquear outputs rotos antes de llegar a usuario.
- Aceptacion:
1. Validacion de schema.
2. Marcado automatico de error y reintento.
- Evento: `agent_payload_validation_failed`.

4. `DDUX-604` - Observabilidad de corridas IA (5 pts)
- Como PMO tecnico, quiero medir latencia, error y fallback.
- Aceptacion:
1. Dashboard de corridas por skill.
2. Indicadores de latencia y tasa de exito.
- Evento: `agent_observability_viewed`.

5. `DDUX-605` - Feedback loop HITL -> mejora de skill (5 pts)
- Como equipo de producto IA, quiero usar revisiones humanas para afinar prompts.
- Aceptacion:
1. Feedback estructurado por decision HITL.
2. Reporte de mejora por skill/version.
- Evento: `skill_feedback_submitted`.

## 4. Orden sugerido de implementacion
1. Sprint 1-2: `DDUX-EP01`, `DDUX-EP02` (minimo), `DDUX-EP03` (minimo).
2. Sprint 3-4: `DDUX-EP04`, `DDUX-EP05`.
3. Sprint 5+: `DDUX-EP06` + endurecimiento.

## 5. KPI de control del backlog
1. Tiempo medio de cierre por historia P0.
2. Porcentaje de historias con telemetria activa al cerrar.
3. Ratio de defectos en historias de UX/HITL (7 dias post-release).
4. Activacion semanal de abogados por version liberada.

