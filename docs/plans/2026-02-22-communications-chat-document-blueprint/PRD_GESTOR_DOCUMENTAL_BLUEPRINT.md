# PRD Blueprint: Gestor Documental

- Version: `1.0.0`
- Estado: `Blueprint reusable`
- Fuente base: implementacion actual de Chrono-Flare (modulos `GestorDocumental`, `UploadModal`, `documentManager` + `upload`)

## 1) Vision de producto

Construir un gestor documental de expediente que garantice:

- control de requisitos documentales,
- trazabilidad de integridad por archivo,
- versionado verificable,
- y governance de acceso por rol/mandato.

Objetivo: que cualquier evidencia documental pueda auditarse de extremo a extremo.

## 2) Objetivos y no-objetivos

## Objetivos

1. Gestionar inventario documental por grupos, estados y responsables.
2. Permitir subida, validacion, rechazo y reemplazo con historial.
3. Asociar hash y sello temporal en operaciones criticas.
4. Exponer APIs y reglas replicables en proyectos distintos.
5. Integrar storage privado con URLs firmadas y trazabilidad de acceso.

## No-objetivos (v1)

1. OCR inteligente o extraccion automatica avanzada.
2. Firma electronica embebida dentro del propio gestor documental.
3. Sistema DAM multimedia generalista.

## 3) Actores

- `ADMIN`
- `COMPRADOR`
- `VENDEDOR`
- `NOTARIO`
- `TERCERO` (segun mandato)
- `OBSERVADOR`
- `SISTEMA`

## 4) Alcance funcional

1. Inventario documental inicial y requisitos ad-hoc.
2. Subida de archivos (PDF, imagenes, DOC/DOCX).
3. Validacion/rechazo por roles autorizados.
4. Versionado de documentos con marcaje de vigente.
5. Descarga y preview mediante URL firmada.
6. Registro de eventos de subida, validacion, rechazo, acceso y eliminacion.

## 5) Flujos clave

1. `Inventario -> Subida -> Validacion`.
2. `Inventario -> Subida -> Rechazo -> Nueva version`.
3. `Documento existente -> Reemplazo -> Revalidacion`.
4. `Documento -> Descarga/Preview -> Evento de acceso`.

## 6) Estados y transiciones

Estados de item inventario:

- `PENDIENTE`
- `SUBIDO`
- `VALIDADO`
- `RECHAZADO`

Transiciones baseline:

1. `PENDIENTE -> SUBIDO` (subida).
2. `SUBIDO -> VALIDADO` (revision positiva).
3. `SUBIDO -> RECHAZADO` (revision negativa con motivo).
4. `RECHAZADO -> SUBIDO` (re-subida o reemplazo).

## 7) Requisitos funcionales

## Inventario

- `FR-DOC-001`: listar documentos por contrato con resumen de estados.
- `FR-DOC-002`: filtrar por grupo, tipo, estado y responsable.
- `FR-DOC-003`: crear item ad-hoc con `grupo`, `responsable`, `es_critico`.

## Subida y archivo

- `FR-DOC-004`: permitir subida con validacion de tipo y tamano.
- `FR-DOC-005`: persistir metadatos (`nombre_original`, `mime`, `tamano`, `tipo_documento`).
- `FR-DOC-006`: calcular `hash_sha256` en alta.
- `FR-DOC-007`: registrar relacion archivo <-> inventario.

## Validacion y rechazo

- `FR-DOC-008`: validar documento con rol autorizador y timestamp.
- `FR-DOC-009`: rechazar documento con motivo obligatorio.
- `FR-DOC-010`: registrar evento de auditoria en ambos casos.

## Versionado

- `FR-DOC-011`: reemplazar archivo manteniendo historial (`version`, `version_original_id`, `reemplazado_por`).
- `FR-DOC-012`: marcar version anterior `es_vigente=false`.
- `FR-DOC-013`: forzar revalidacion tras reemplazo.

## Acceso y seguridad

- `FR-DOC-014`: descarga y preview solo via URL firmada temporal.
- `FR-DOC-015`: registrar evento `DOCUMENTO_ACCEDIDO`.
- `FR-DOC-016`: eliminar archivo bajo permisos y registrar evento.

## 8) Requisitos no funcionales

- `NFR-001` Seguridad: bucket privado + signed URLs + autorizacion server-side.
- `NFR-002` Gobierno: aislamiento por expediente/tenant con RLS.
- `NFR-003` Rendimiento: p95 listado documentos < `500 ms`.
- `NFR-004` Subida: soporte hasta `50 MB` en backend (ajustable por entorno).
- `NFR-005` Integridad: hash obligatorio en cada version.
- `NFR-006` Observabilidad: logs de acceso y errores de storage.
- `NFR-007` Recuperacion: estrategia de backup/restore definida para DB + Storage.

## 9) Modelo de datos canonico

## Tabla `inventario_expediente`

Campos minimos:

- `id`, `contrato_id`, `tipo`, `titulo`, `grupo`, `responsable_rol`
- `estado`, `obligatorio`, `es_critico`, `archivo_id`
- `fecha_subida`, `subido_por_rol`, `validado_por_rol`, `fecha_validacion`, `motivo_rechazo`

Indices minimos:

- `(contrato_id, grupo)`
- `(contrato_id, estado)`
- `(contrato_id, responsable_rol)`

## Tabla `archivos`

Campos minimos:

- `id`, `contrato_id`, `nombre_original`, `nombre_almacenado`
- `tipo_mime`, `tamano_bytes/tamano`, `ruta_storage`
- `tipo_documento`, `categoria`, `titulo`
- `hash_sha256`, `version`, `version_original_id`, `es_vigente`, `reemplazado_por`
- `sello_qtsp_id`, `subido_por_rol`, `created_at`

Indices minimos:

- `(contrato_id, created_at desc)`
- `(version_original_id, version)`
- `(es_vigente)`
- `(hash_sha256)`

## Tabla `sellos_tiempo` y `eventos`

- `sellos_tiempo`: evidencia temporal RFC3161.
- `eventos`: auditoria legal y operativa de cambios documentales.

## 10) API blueprint (contratos minimos)

- `GET /api/contratos/:contratoId/documentos`
- `GET /api/contratos/:contratoId/documentos/filtrar`
- `GET /api/archivos/:id`
- `GET /api/archivos/:id/versiones`
- `GET /api/archivos/:id/descargar`
- `GET /api/archivos/:id/preview`
- `POST /api/upload`
- `DELETE /api/upload/:id`
- `POST /api/inventario/:id/validar`
- `POST /api/inventario/:id/rechazar`
- `POST /api/archivos/:id/reemplazar`
- `POST /api/contratos/:contratoId/inventario/adhoc`

## 11) Matriz de permisos baseline

1. `ADMIN`: todo.
2. `NOTARIO`: validar/rechazar y acceso documental.
3. `COMPRADOR/VENDEDOR`: subida y consulta; sin validar/rechazar (por defecto).
4. `TERCERO`: permisos efectivos por mandato (`puede_subir_documentos`, `puede_validar_documentos`).
5. `OBSERVADOR`: solo consulta.

## 12) UX minima esperada

1. Resumen visual de estado documental del expediente.
2. Filtros por grupo/estado y tabs por categoria.
3. Acciones directas: subir, preview, descargar, validar, rechazar, detalle.
4. Modal de detalle con hash, version y trazabilidad.
5. Formulario de requisito ad-hoc para casos excepcionales.

## 13) KPIs de producto y operacion

- `% items obligatorios en estado VALIDADO`.
- `Tiempo medio PENDIENTE -> VALIDADO`.
- `Tasa de rechazo por tipo documental`.
- `Numero medio de versiones por documento critico`.
- `Errores de preview/descarga por 1000 operaciones`.

## 14) Criterios de aceptacion

- `AC-DOC-001`: toda subida crea archivo con hash y evento asociado.
- `AC-DOC-002`: validar/rechazar exige permisos y actualiza estado correctamente.
- `AC-DOC-003`: reemplazo genera nueva version y desactiva la previa.
- `AC-DOC-004`: preview y descarga no exponen rutas directas permanentes.
- `AC-DOC-005`: item ad-hoc aparece en listados y respeta flujo de estados.
- `AC-DOC-006`: acciones sin permiso retornan `403`.

## 15) Plan de entrega recomendado

1. `Fase 1`: esquema de datos + storage + API de subida/listado.
2. `Fase 2`: validacion/rechazo + eventos + UI base.
3. `Fase 3`: versionado + access logs + optimizacion UX.
4. `Fase 4`: hardening (RLS, controles legales, observabilidad avanzada).

## 16) Riesgos y mitigaciones

1. Riesgo: incoherencia entre item inventario y archivo.
   Mitigacion: transacciones/logica idempotente en actualizacion de estado.
2. Riesgo: bypass de permisos por cliente.
   Mitigacion: enforcement estricto en backend + pruebas de autorizacion.
3. Riesgo: crecimiento de storage sin control.
   Mitigacion: politicas de lifecycle, cuotas y retencion por tipo documental.

## 17) Checklist de clonacion para otro proyecto

1. Definir taxonomia documental del dominio destino.
2. Configurar limites de archivo por regulacion interna.
3. Implementar reglas de validacion por rol/mandato.
4. Activar RLS y politicas del bucket.
5. Alinear retencion, borrado y custodia con compliance corporativo.
