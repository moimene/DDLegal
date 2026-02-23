# Backlog ejecutable: modulo Comunicaciones-Notificaciones-Chat

- Version: `1.0.0`
- Fecha base: `2026-02-22`
- Estado: `Ready for delivery planning`
- Fuente: PRD blueprint + notas legales internas `(5)` y `(6)`

## 1. Decisiones de alcance (Scope Guardrails)

1. V1 no sustituye proveedores de mensajeria masiva.
2. V1 no incluye video/voz en tiempo real (RTC).
3. El modulo si integra canales externos via webhook outbound + inbound certificado.
4. La copia probatoria siempre vive en plataforma con hash/evento/sello (si aplica), aunque el transporte sea externo.
5. En este repositorio el scope es por `project_id` (no `contrato_id`).

## 2. Objetivo de release

Entregar un modulo unificado de comunicaciones formales + chat probatorio para `DD Legal PMO`, integrado con `VDR v2`, `Q&A`, `War Room` y `reporting`, con gobierno RBAC/RLS, observabilidad y criterios AC del PRD.

## 3. Roadmap por sprint (fechas concretas)

1. Sprint 0 (Foundation): `2026-02-23` a `2026-02-27`
2. Sprint 1 (Core formal): `2026-03-02` a `2026-03-06`
3. Sprint 2 (Chat probatorio): `2026-03-09` a `2026-03-13`
4. Sprint 3 (Integraciones + SLA): `2026-03-16` a `2026-03-20`
5. Sprint 4 (Vinculos + plantillas): `2026-03-23` a `2026-03-27`
6. Sprint 5 (Hardening + Go/No-Go): `2026-03-30` a `2026-04-03`

## 4. Backlog de epicas (E1-E9)

1. E1 Bandeja unificada y hilos.
2. E2 Comunicaciones formales con ciclo de vida y evidencia.
3. E3 Chat operativo con marcado probatorio.
4. E4 Integraciones outbound/inbound con idempotencia.
5. E5 Vinculos a VDR/QA/contingencias/reporting.
6. E6 Permisos, RLS y visibilidad por rol/area.
7. E7 SLA, entrega/lectura y escalado.
8. E8 Plantillas legales y catalogos gobernados.
9. E9 Observabilidad, auditoria y cumplimiento.

## 5. Sprint backlog ejecutable

## Sprint 0 - Foundation (`2026-02-23` a `2026-02-27`)

### Historias objetivo

1. `US-COM-001` Como admin quiero catalogos gobernados para tipos/canales/estados.
2. `US-COM-002` Como plataforma quiero modelo de datos base con RLS y auditoria.
3. `US-COM-003` Como seguridad quiero permisos backend consistentes con roles actuales.

### Tareas tecnicas

1. DB migrations (renumerar si aparece una migration nueva antes de ejecutar):
- `202602270013_comunicaciones_core.sql`
- `202602270014_comunicaciones_rls.sql`
- `202602270015_comunicaciones_catalogs.sql`
2. Crear tablas base:
- `dd_communications`
- `dd_communication_messages`
- `dd_communication_events`
- `dd_communication_seals`
3. Indices minimos:
- `(project_id, communication_date desc)`
- `(project_id, status)`
- `(project_id, is_external)`
- `(parent_communication_id)`
- `(project_id, created_at)` en mensajes
- parcial `is_relevant_probatory=true`
4. RBAC TS: extender `RolePermissions` en `src/lib/supabase-auth.ts` con permisos de comunicaciones/chat.
5. Autorizacion API: usar `requirePermission` en todas las rutas nuevas.
6. RLS: politicas por `project_id` y acceso por rol activo en `dd_project_user_roles`.

### AC de sprint

1. Tablas creadas con RLS habilitado y politicas activas.
2. Catalogos disponibles y versionados.
3. Ningun endpoint nuevo planeado sin permiso server-side definido.

### Tests

1. SQL smoke de tablas/politicas.
2. E2E base de autorizacion: `403`/`401` en rutas stub.

## Sprint 1 - Core formal (`2026-03-02` a `2026-03-06`)

### Historias objetivo

1. `US-COM-101` Crear comunicacion formal en BORRADOR.
2. `US-COM-102` Enviar comunicacion y registrar evento.
3. `US-COM-103` Marcar ENTREGADA/LEIDA y navegar hilo.

### Tareas tecnicas

1. API routes:
- `src/app/api/projects/[id]/communications/route.ts` (`GET`, `POST`)
- `src/app/api/projects/[id]/communications/external/route.ts` (`POST`)
- `src/app/api/communications/[id]/send/route.ts` (`POST`)
- `src/app/api/communications/[id]/reply/route.ts` (`POST`)
- `src/app/api/communications/[id]/delivered/route.ts` (`POST`)
- `src/app/api/communications/[id]/read/route.ts` (`POST`)
- `src/app/api/communications/[id]/thread/route.ts` (`GET`)
2. Servicio de hash SHA-256 (server-side) para contenido y adjuntos referenciados.
3. Emision de eventos via `emitEvent` para acciones criticas (`COMUNICACION_*`).
4. Estado de certificacion explicito (`pending/success/error`) para sellado.

### AC de sprint

1. Flujo `BORRADOR -> ENVIADA -> ENTREGADA/LEIDA` operativo y auditable.
2. `AC-001`, `AC-003`, `AC-006` del PRD cubiertos.
3. Intentos sin permisos retornan `403` consistente.

### Tests

1. Nuevo `e2e/27-communications-core.spec.ts`.
2. Ampliacion de `e2e/08-events.spec.ts` para nuevos tipos de evento.

## Sprint 2 - Chat probatorio (`2026-03-09` a `2026-03-13`)

### Historias objetivo

1. `US-CHAT-201` Enviar mensaje operativo con baja friccion.
2. `US-CHAT-202` Marcar/desmarcar relevancia probatoria con motivo.
3. `US-CHAT-203` Listar solo mensajes relevantes para evidencia.

### Tareas tecnicas

1. API routes:
- `src/app/api/projects/[id]/chat-messages/route.ts` (`GET`, `POST`)
- `src/app/api/chat-messages/[id]/route.ts` (`PATCH`)
- `src/app/api/projects/[id]/chat-messages/relevant/route.ts` (`GET`)
2. Persistir campos:
- `is_system`
- `is_relevant_probatory`
- `relevance_reason`
- `relevance_marked_at`
- `message_hash_sha256`
3. Registrar eventos `MENSAJE_ENVIADO` y `MENSAJE_MARCADO_RELEVANTE`.
4. UI inicial:
- `src/app/projects/[id]/communications/page.tsx` (tabs `Internas/Externas/Chat`)
- componentes en `src/components/communications/`

### AC de sprint

1. `AC-004` del PRD cubierto.
2. UX de chat operativa (`Enter` envia, `Shift+Enter` salto).
3. Mensajes relevantes accesibles por endpoint dedicado.

### Tests

1. Nuevo `e2e/28-communications-chat.spec.ts`.
2. RBAC de chat en `e2e/25-rbac-matrix.spec.ts` (extender).

## Sprint 3 - Integraciones + SLA (`2026-03-16` a `2026-03-20`)

### Historias objetivo

1. `US-INT-301` Notificar outbound a orquestador con reintentos.
2. `US-INT-302` Recibir inbound certificado con idempotencia.
3. `US-SLA-303` Gestionar SLA por tipo/canal y escalado.

### Tareas tecnicas

1. Outbound webhook:
- cola de reintentos (backoff)
- idempotency key
- registro por intento + DLQ
2. Inbound endpoint:
- `src/app/api/integrations/communications/inbound/route.ts`
- verificacion firma/origen
- deduplicacion por clave externa
3. SLA:
- tabla/reglas por tipo-canal
- job periodico de breach
- evento de escalado y alerta visual
4. Timeline/War Room: reflejar eventos de entrega/lectura/sla breach.

### AC de sprint

1. `AC-002` del PRD cubierto.
2. Integracion robusta con trazabilidad de intentos.
3. Breach SLA visible en bandeja y War Room.

### Tests

1. Nuevo `e2e/29-communications-integrations.spec.ts`.
2. Pruebas de idempotencia inbound/outbound y DLQ.

## Sprint 4 - Vinculos + plantillas (`2026-03-23` a `2026-03-27`)

### Historias objetivo

1. `US-LINK-401` Vincular comunicacion a `vdr_document_versions`.
2. `US-LINK-402` Vincular comunicacion a `dd_expected_documents` y `dd_contingencies`.
3. `US-TPL-403` Usar plantillas legales versionadas.

### Tareas tecnicas

1. Tabla de links `dd_communication_links` con tipos de entidad permitidos.
2. Integracion UI con VDR preview y trazas en timeline.
3. Integracion con reporting congelable (`dd_reports.is_frozen`).
4. Catalogo de plantillas y variables de fusion con versionado.

### AC de sprint

1. Navegacion evidencia exacta desde comunicacion/chat.
2. Asociaciones visibles en War Room y reporting.
3. Plantillas operativas con version trazable.

### Tests

1. Nuevo `e2e/30-communications-links-reporting.spec.ts`.
2. Extender `e2e/26-h3-scoring-reporting.spec.ts` para referencias congeladas.

## Sprint 5 - Hardening + Go/No-Go (`2026-03-30` a `2026-04-03`)

### Historias objetivo

1. `US-OBS-501` Observabilidad completa por endpoint e integracion.
2. `US-AUD-502` Cadena auditable end-to-end por comunicacion.
3. `US-REL-503` Cerrar checklist de salida a produccion.

### Tareas tecnicas

1. Metricas:
- p95 listado comunicaciones
- p95 envio chat
- errores 4xx/5xx por endpoint
- fallos webhook/sellado
2. Logs estructurados con correlacion: `request_id`, `user_id`, `project_id`.
3. Alertas operativas y runbook de incidentes.
4. Carga y resiliencia (picos, reintentos, degradacion controlada).
5. UAT legal + acta de Go/No-Go.

### AC de sprint

1. SLO disponibilidad mensual `99.9%` instrumentado.
2. p95: comunicaciones `< 400 ms`; chat `< 250 ms`.
3. Suite E2E de modulo en verde + regresion critica existente.

### Tests

1. `npx playwright test e2e/27-communications-core.spec.ts e2e/28-communications-chat.spec.ts e2e/29-communications-integrations.spec.ts e2e/30-communications-links-reporting.spec.ts`
2. Regression focal en `e2e/05-qa.spec.ts`, `e2e/08-events.spec.ts`, `e2e/25-rbac-matrix.spec.ts`, `e2e/26-h3-scoring-reporting.spec.ts`.

## 6. Definition of Done (global)

1. Todos los AC del PRD trazados a tests.
2. RLS activo en tablas nuevas + politicas validadas.
3. Acciones criticas con evento auditable y hash/sello segun politica.
4. Endpoints sin permiso retornan `403` consistente.
5. Checklist de despliegue gobernado completado (`staging` antes de `prod`).

## 7. Riesgos y mitigaciones operativas

1. Riesgo: mezclar chat informal con evidencia formal.
Mitigacion: marcado probatorio con motivo + vistas separadas.
2. Riesgo: fallo de sellado/proveedor externo.
Mitigacion: estado explicito + reintentos + DLQ + alerta.
3. Riesgo: desalineacion permisos UI/API.
Mitigacion: backend como unica fuente de verdad + tests RBAC.
4. Riesgo: duplicados por integraciones.
Mitigacion: idempotency key obligatoria inbound/outbound.

## 8. Orden recomendado de implementacion tecnica

1. Migrations + RLS + permisos.
2. API core formal.
3. API chat probatorio.
4. UI unificada.
5. Integraciones externas y SLA.
6. Vinculos cross-modulo y plantillas.
7. Observabilidad, hardening y go-live.
