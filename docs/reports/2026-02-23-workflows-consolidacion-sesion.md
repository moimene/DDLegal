# Informe de Sesión: Consolidación de Workflows

Fecha: 2026-02-23  
Repositorio: `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo`

## 1) Objetivo de la sesión

Consolidar la lógica operativa del objeto elemental del sistema (workflow por área), verificando:

1. activación por usuario,  
2. gestión de información requerida y loops de análisis,  
3. generación de informes/alertas para war room y negociación,  
4. activación de skills y encadenamiento de análisis,  
5. registro de resultados y versionado documental,  
6. ejecución paralela de workflows.

## 2) Revisión ejecutada (diagnóstico)

### 2.1 Verificación de activación de workflow por usuario

- UI ejecuta `POST /api/workflows/instances/{id}/run` desde:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/app/projects/[id]/workflows/page.tsx`
- API de run delega a `runWorkflowInstance(...)`:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/app/api/workflows/instances/[id]/run/route.ts`
- Runner invoca engine:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/instance-runner.ts`

### 2.2 Verificación relación Skill ↔ Workflow

- `PhaseDefinition` ya modela `skills: string[]`:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/template-types.ts`
- Instanciación genera tareas AP-level por skill con `skill_key`:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/instantiate.ts`
- El engine carga skills activas desde `dd_skills_catalog`:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/engine.ts`

### 2.3 Verificación n8n

- La ruta n8n existe en código, condicionada por feature flag:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/engine.ts`
- Config observada: `HARVEY_FEATURE_FLAG=gateway` y `N8N_WEBHOOK_BASE_URL=http://localhost:5678/webhook` en:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/.env.local`
- Resultado de conectividad local a n8n durante la sesión: no alcanzable (`curl` con error de conexión).

## 3) Cambios implementados en esta sesión

### 3.1 Enriquecimiento por iteración (skills + contexto de loop)

Se creó un builder de prompt/payload para incluir explícitamente en cada iteración:

- skills activas y su metadata (`expected_output_schema`, `evidence_requirements`),
- `workflow_instance_id`, `workflow_phase`,
- `loop_number`, `phase_loop_number`,
- últimos loops (`previous_loops`) para continuidad analítica.

Archivo nuevo:
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/prompt-builder.ts`

### 3.2 Integración en engine (template y legacy)

Se reemplazó el prompt agregado plano por prompt estructurado por iteración y skills.
Además, para ruta n8n se envía payload enriquecido con skills + contexto de iteración.

Archivo modificado:
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/engine.ts`

### 3.3 Inyección de contexto de loop desde runner

Antes de ejecutar workflow, `runWorkflowInstance` ahora calcula y adjunta:

- `loop_number` siguiente,
- `phase_loop_number` siguiente,
- historial corto de loops previos.

Archivo modificado:
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/instance-runner.ts`

### 3.4 Tests unitarios nuevos

Se añadieron pruebas para validar:

- extracción de contexto de iteración,
- construcción de prompt Harvey enriquecido,
- construcción de payload n8n enriquecido.

Archivo nuevo:
- `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/src/lib/workflows/__tests__/prompt-builder.test.ts`

## 4) Pruebas ejecutadas y resultado

### 4.1 Unit tests

Comando:
- `npm run test:unit`

Resultado:
- OK, `2` test files, `11` tests passing (incluyendo los nuevos de prompt-builder).

### 4.2 Smoke test API end-to-end (manual)

Entorno levantado en `http://localhost:3100`.

Secuencia ejecutada:
1. `POST /api/auth/login` (pm test user)  
2. `POST /api/workflows/instantiate` (`wf_04_cont_material_contracts`)  
3. `POST /api/workflows/instances/{id}/run`

Resultado:
- Flujo completo API smoke: OK (`200` en instanciación y ejecución).
- Se observó avance de fase (de `obtencion` a `gestion`) y respuesta consistente.

### 4.3 Checks no concluyentes por entorno

- `npm run build` no quedó en verde por error TypeScript preexistente en:
  `/Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo/e2e/helpers/api-helpers.ts`
- Intento de Playwright smoke quedó bloqueado por timeout del webServer en ese contexto.
- Se observaron warnings de Next sobre parcheo de lockfile SWC (no introducidos en esta sesión).

## 5) Estado contra requisitos críticos

| Requisito crítico | Estado | Evidencia |
|---|---|---|
| WF por área se activa por usuario | Implementado y validado | UI + API run + smoke API |
| Gestión de información y loops múltiples | Implementado y reforzado | `information_required` + `workflow_iteration` enriquecido |
| Conclusión en informes/alertas/war room-negociación | Implementado en runner | side effects, report archive, war room/negotiation hooks |
| Activación de skills por iteración | Reforzado en esta sesión | prompt/payload enriquecidos por skills |
| Registro y versionado de resultados | Implementado | loop entries + archive de reportes versionados |
| Ejecución paralela de workflows | Implementado | endpoint batch con `Promise.allSettled` |

## 6) Riesgos y pendientes abiertos

1. n8n local no operativo durante la sesión (`localhost:5678` sin conexión).  
2. feature flag global en `gateway`, por lo que runtime actual no enruta a n8n.  
3. build global no totalmente verde por error TypeScript preexistente en helper E2E.  

## 7) Conclusión ejecutiva

La consolidación deja estable la lógica core de workflows con foco en procesos:

- relación `workflow-phase-skill` operativa,  
- ejecución enriquecida por iteración para Harvey,  
- payload preparado para cadena de agentes cuando se habilite n8n,  
- validación unitaria y smoke API satisfactoria.

La brecha restante para “invoca n8n en operación” es principalmente de **configuración/servicio** (feature flag + disponibilidad del webhook), no de ausencia de lógica en código.
