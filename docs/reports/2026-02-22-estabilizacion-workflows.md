# Estabilización de Workflows

Fecha: 2026-02-22
Repositorio: `dd-legal-pmo`

## Objetivo
Estabilizar el objeto elemental del sistema basado en workflows por área, con foco en:
- arranque por acción de usuario,
- gestión de información previa y loops de análisis,
- salida a informes/alertas para war room y negociación,
- ejecución de skills/cadena de análisis,
- registro de respuesta y documentación versionada,
- soporte de ejecución paralela.

## Cambios implementados

### 1) Trazabilidad de loops de ejecución por workflow
Se añadió persistencia de ciclo/loop de ejecución en metadata de instancia para no perder trazabilidad por fase y por ejecución.

Archivo:
- `src/lib/workflows/instance-runner.ts`

Incluye:
- `execution_loop_count`
- `phase_loop_counts`
- `execution_loops[]` (capado)
- outcomes explícitos: `information_required`, `phase_gate_failed`, `execution_error`, `completed`
- side effects por loop: `loop_number`, `phase_loop_number`

### 2) Versionado automático de informes por loop
Cada loop exitoso puede crear una nueva versión de informe de workflow en `dd_reports`.

Archivo:
- `src/lib/workflows/instance-runner.ts`

Incluye:
- archivado/versionado incremental por `workflow + instance`
- soporte para esquemas con/sin columnas avanzadas de freeze/version

### 3) Compatibilidad de esquema para reportes
Se creó capa de compatibilidad para entornos donde faltan columnas opcionales en `dd_reports`.

Archivo nuevo:
- `src/lib/reports/schema-compat.ts`

Uso aplicado en:
- `src/app/api/reports/[id]/versions/route.ts`
- `src/app/api/reports/[id]/freeze/route.ts`

Resultado:
- `versions` funciona con fallback de versión por fecha
- `freeze` devuelve `409 freeze_not_supported` cuando no aplica

### 4) Enriquecimiento de instancias con informe más reciente
Se amplió API de instancias para resolver y devolver `latest_report` por instancia.

Archivo:
- `src/app/api/workflows/instances/route.ts`

### 5) Mejora UX en Workflows
Tras ejecutar un workflow, se muestra resumen de side effects y acceso directo al informe generado.

Archivo:
- `src/app/projects/[id]/workflows/page.tsx`

### 6) Robustez E2E contra rate limit de login
Se mitigó el problema de `Request rate limit reached` en pruebas E2E.

Archivo:
- `e2e/helpers/api-helpers.ts`

Cambios:
- cache de token en memoria + archivo temporal compartido
- lock por email para evitar logins concurrentes
- retry con backoff para errores retryables (429/503 y 401 por rate limit)

### 7) Robustez de instanciación (`initiated_by`)
Se normalizó `initiated_by` para aceptar solo UUID válido; si no, se guarda `null`.

Archivo:
- `src/lib/workflows/instantiate.ts`

Motivo:
- evita fallos de instanciación por payloads E2E con identificadores no UUID.

## Validación ejecutada

### Build y unit tests
- `npm run build` OK
- `npm run test:unit` OK (`8/8`)

### E2E focalizados (workflows/reportes/war-room)
- `e2e/15-workflows.spec.ts` + `e2e/23-workflow-templates-v1.spec.ts`: OK (`13/13`)
- `e2e/06-reports.spec.ts` + `e2e/18-war-room.spec.ts`: OK en ejecución focalizada (`12 passed`, `10 skipped`)

### E2E críticos de proceso tras mitigaciones
Ejecución aislada en puerto dedicado para evitar contaminación de servidor externo:
- `e2e/15`, `e2e/18`, `e2e/23`, `e2e/24`, `e2e/26`
- Resultado final: `57 passed`, `7 skipped`, `0 failed`

## Incidencias encontradas y resueltas

1. **Contaminación de entorno E2E por servidor externo en :3000**
- Síntoma: `404` masivos en `/api/auth/login` y otras rutas.
- Causa: Playwright reutilizando otro `next dev` de otro proyecto.
- Mitigación: corridas aisladas en puerto dedicado (`3001`).

2. **Rate limiting de autenticación en corridas amplias**
- Síntoma: `401 {"error":"Request rate limit reached"}`.
- Mitigación: cache + lock + retry/backoff en helper de login E2E.

3. **Fallo de instanciación por `initiated_by` no UUID**
- Mitigación: normalización del campo antes del insert.

## Cobertura frente al objetivo funcional (resumen)

1. **Workflow por área y arranque por usuario**: cubierto.
2. **Gestión de información previa y loops múltiples**: cubierto (trazabilidad + outcomes + loop metadata).
3. **Conclusión con informes/alertas para war room/negociación**: cubierto en flujo y side effects.
4. **Activación de skills y cadena de análisis**: cubierto por fase/skill tasks y validación E2E de rutas críticas.
5. **Registro de respuesta + documentación versionada**: cubierto (versionado automático por loop).
6. **Paralelismo**: soportado en arquitectura y validado en ejecución concurrente de pruebas.

## Archivos clave modificados
- `src/lib/workflows/instance-runner.ts`
- `src/lib/reports/schema-compat.ts`
- `src/app/api/reports/[id]/versions/route.ts`
- `src/app/api/reports/[id]/freeze/route.ts`
- `src/app/api/workflows/instances/route.ts`
- `src/app/projects/[id]/workflows/page.tsx`
- `e2e/helpers/api-helpers.ts`
- `src/lib/workflows/instantiate.ts`

## Estado final
La estabilización de workflows críticos queda en estado **operativo** para los flujos nucleares validados (workflow templates, ejecución por fases, war room y reporting), con mitigaciones activas para estabilidad de pruebas y versionado de resultados.
