# PRD Blueprint: Gestor de Comunicaciones + Chat

- Version: `1.0.0`
- Estado: `Blueprint reusable`
- Fuente base: implementacion actual de Chrono-Flare (modulos `GestorComunicaciones` + `ChatPanel` + APIs backend)

## 1) Vision de producto

Disponer de un modulo unico de comunicaciones del expediente que combine:

- `Comunicaciones formales` (estructuradas, trazables, con evidencia).
- `Chat operativo` (conversacion agil con posibilidad de elevar mensajes a evidencia).
- `Integracion con canales externos` (entrada/salida controlada).

Objetivo: reducir riesgo de disputa por falta de trazabilidad y acelerar la coordinacion entre partes.

## 2) Objetivos y no-objetivos

## Objetivos

1. Registrar comunicaciones internas y externas con integridad verificable (`hash SHA-256`).
2. Emitir evidencia temporal (`sello QTSP`) en puntos juridicamente sensibles.
3. Permitir chat de expediente con marcado de mensajes probatoriamente relevantes.
4. Exponer API y modelo de datos estables para clonar en otros productos.
5. Asegurar control de acceso por rol/mandato y politicas de gobierno.

## No-objetivos (v1)

1. Sustituir proveedores de mensajeria masiva (solo integracion).
2. Moderacion semantica avanzada por IA.
3. Video/voz en tiempo real.

## 3) Actores

- `ADMIN`
- `COMPRADOR`
- `VENDEDOR`
- `NOTARIO`
- `TERCERO` (segun mandato)
- `OBSERVADOR` (solo lectura)
- `SISTEMA` (automatismos, inbound, webhooks)

## 4) Alcance funcional

1. Bandeja de comunicaciones con filtros por tipo/canal/estado/origen.
2. Alta de comunicaciones internas estructuradas.
3. Importacion de comunicaciones externas (email, burofax, carta, WhatsApp, etc.).
4. Respuesta en hilo y transicion de estado (`BORRADOR`, `ENVIADA`, `ENTREGADA`, `LEIDA`, `RESPONDIDA`).
5. Chat del expediente (mensajes y marcado de relevancia probatoria).
6. Registro de eventos certificados en timeline.
7. Conectores salientes (notificaciones) e inbound certificable.

## 5) Casos de uso clave

1. Como asesor, quiero enviar una reclamacion formal sellada para activar plazo de respuesta.
2. Como usuario, quiero importar un burofax recibido para dejar constancia verificable.
3. Como parte, quiero mantener conversaciones en chat y marcar mensajes como evidencia.
4. Como notario, quiero consultar el historial de comunicaciones relevantes antes de una convocatoria.
5. Como auditor interno, quiero reconstruir el hilo completo con sus hashes y sellos.

## 6) Requisitos funcionales

## Comunicaciones formales

- `FR-COM-001`: crear comunicacion interna con campos minimos (`tipo`, `remitenteRol`, `contenido`).
- `FR-COM-002`: soportar tipos: `RECLAMACION`, `SOLICITUD_DOCUMENTACION`, `NOTIFICACION_GENERAL`, `CONVOCATORIA_NOTARIA`, `ALEGACION`, `RESPUESTA`, `COMUNICACION_EXTERNA_IMPORTADA`.
- `FR-COM-003`: soportar canales: `PLATAFORMA`, `EMAIL`, `BUROFAX`, `CARTA_CERTIFICADA`, `CARTA_SIMPLE`, `WHATSAPP`, `TELEFONO`, `OTRO`.
- `FR-COM-004`: calcular y persistir hash de contenido en alta.
- `FR-COM-005`: sellar QTSP en comunicaciones enviadas o externas importadas (segun politica).
- `FR-COM-006`: exponer flujo de envio diferido (`BORRADOR -> ENVIADA`).
- `FR-COM-007`: permitir respuesta enlazada a `comunicacion_padre_id`.
- `FR-COM-008`: permitir marcar como `ENTREGADA` y `LEIDA` con fecha.
- `FR-COM-009`: incluir adjuntos referenciando IDs de archivos.

## Chat

- `FR-CHAT-001`: listar mensajes por expediente ordenados cronologicamente.
- `FR-CHAT-002`: enviar mensaje de usuario y registrar evento de auditoria.
- `FR-CHAT-003`: soportar mensajes de sistema (`es_sistema=true`).
- `FR-CHAT-004`: marcar/desmarcar `es_relevante_probatoriamente`.
- `FR-CHAT-005`: listar solo relevantes para preparacion probatoria.
- `FR-CHAT-006`: mantener UX de baja friccion (enter envia, shift+enter salto de linea).

## Integraciones

- `FR-INT-001`: webhook saliente a orquestador (ej. n8n) para notificaciones.
- `FR-INT-002`: endpoint inbound para email/webhook externo con certificacion de recepcion.
- `FR-INT-003`: trazar resultado de intentos de notificacion.

## 7) Requisitos no funcionales

- `NFR-001` Seguridad: todo acceso con usuario autenticado + resolucion de rol/mandato.
- `NFR-002` Gobierno de datos: multi-tenant por expediente/organizacion con RLS.
- `NFR-003` Evidencia: hash + sello + evento para operaciones definidas como criticas.
- `NFR-004` Disponibilidad: SLO API `99.9%` mensual.
- `NFR-005` Rendimiento: p95 listado comunicaciones < `400 ms`; p95 envio chat < `250 ms`.
- `NFR-006` Observabilidad: logs estructurados, trazas por `requestId`, metricas por endpoint.
- `NFR-007` Retencion: politica configurable (ej. 6-10 anos segun normativa aplicable).

## 8) Modelo de datos canonico

## Tabla `comunicaciones`

Campos obligatorios de blueprint:

- `id`, `contrato_id`, `tipo_comunicacion`, `canal`, `estado`, `es_externa`
- `remitente_rol` o `remitente_externo`
- `contenido` o `resumen_externo`
- `fecha_comunicacion`, `fecha_registro`
- `hash_contenido`, `sello_qtsp_id` (si aplica)
- `adjuntos_archivo_ids`, `metadatos`, `comunicacion_padre_id`

Indices minimos:

- `(contrato_id, fecha_comunicacion desc)`
- `(contrato_id, estado)`
- `(contrato_id, es_externa)`
- `(comunicacion_padre_id)`

## Tabla `mensajes`

Campos obligatorios de blueprint:

- `id`, `contrato_id`, `mensaje`, `remitente_nombre`, `created_at`
- `es_sistema`, `es_relevante_probatoriamente`, `motivo_relevancia`, `fecha_marcado_relevante`

Indices minimos:

- `(contrato_id, created_at)`
- `(contrato_id, es_relevante_probatoriamente)` parcial

## Tabla `eventos`

- Registro de `COMUNICACION_ENVIADA`, `COMUNICACION_LEIDA`, `COMUNICACION_EXTERNA_IMPORTADA`, `MENSAJE_ENVIADO`, `MENSAJE_MARCADO_RELEVANTE`.
- Encadenado de hash recomendado (`prev_hash_sha256`) para cadena de custodia.

## 9) API blueprint (contratos minimos)

- `GET /api/contratos/:contratoId/comunicaciones`
- `POST /api/contratos/:contratoId/comunicaciones`
- `POST /api/contratos/:contratoId/comunicaciones/externas`
- `POST /api/comunicaciones/:id/enviar`
- `POST /api/comunicaciones/:id/responder`
- `POST /api/comunicaciones/:id/entregada`
- `POST /api/comunicaciones/:id/leida`
- `GET /api/comunicaciones/:id/hilo`
- `GET /api/contratos/:contratoId/mensajes`
- `POST /api/contratos/:contratoId/mensajes`
- `PATCH /api/mensajes/:id`
- `GET /api/contratos/:contratoId/mensajes/relevantes`

## 10) Matriz de permisos (baseline)

1. `ADMIN`: acceso total.
2. `COMPRADOR/VENDEDOR`: ver, enviar comunicaciones, usar chat, marcar relevantes.
3. `NOTARIO`: ver y enviar comunicaciones, sin borrar historico.
4. `TERCERO`: permisos efectivos por mandato (`puede_enviar_comunicaciones`, etc.).
5. `OBSERVADOR`: solo lectura, sin envio ni marcado.

## 11) UX minima esperada

1. Vista unificada con tabs `Internas / Externas / Chat`.
2. Filtros por tipo, canal, estado y fecha.
3. Formularios guiados para comunicaciones formales.
4. Detalle con hash y estado de sellado.
5. Lista de mensajes relevantes para evidencia.

## 12) KPIs de producto

- `% comunicaciones selladas sobre total enviadas`.
- `Tiempo medio envio -> lectura` por tipo de comunicacion.
- `Mensajes chat relevantes / total mensajes`.
- `Errores de webhook por canal`.
- `Tiempo de importacion externa` p95.

## 13) Criterios de aceptacion

- `AC-001`: una comunicacion enviada guarda hash y evento asociados.
- `AC-002`: al importar externa, queda sello QTSP o estado de error auditable.
- `AC-003`: el hilo de respuesta es navegable desde una comunicacion raiz.
- `AC-004`: mensaje marcado como relevante aparece en endpoint de relevantes.
- `AC-005`: usuarios sin permiso reciben `403` consistente.
- `AC-006`: toda accion critica deja rastro en `eventos`.

## 14) Plan de entrega recomendado

1. `Fase 1`: modelo de datos + API base + permisos.
2. `Fase 2`: UX completa comunicaciones + chat.
3. `Fase 3`: conectores n8n/inbound + observabilidad.
4. `Fase 4`: hardening legal/auditoria + pruebas de carga.

## 15) Riesgos y mitigaciones

1. Riesgo: mezcla de chat informal y evidencia formal.
   Mitigacion: reglas de marcado probatorio y vistas separadas.
2. Riesgo: sellado fallido por proveedor externo.
   Mitigacion: cola de reintentos + estado de certificacion explicito.
3. Riesgo: desalineacion de permisos entre UI y API.
   Mitigacion: autorizacion server-side como unica fuente de verdad.

## 16) Checklist de clonacion para otro proyecto

1. Definir catalogo de tipos/canales propios del dominio.
2. Ajustar textos legales y disclaimers de certificacion.
3. Parametrizar roles/mandatos.
4. Implementar RLS y pruebas de aislamiento.
5. Configurar proveedor de sellado y fallback operativo.
