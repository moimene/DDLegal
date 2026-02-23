# Design: Consolidacion de Trabajo — Sesion 23 Feb 2026

**Fecha:** 2026-02-23
**Objetivo:** Consolidar trabajo de sesiones anteriores (22-23 Feb), estabilizar build/frontend, revisar pipeline skill-workflow-prompt-Harvey, y actualizar PRD.md + CLAUDE.md.

## Fase 1: Fix Build + Estabilizar Frontend

### 1.1 Fix TS error
- Archivo: `e2e/helpers/api-helpers.ts:87`
- Error: `'inMemory' is possibly 'undefined'`
- Fix: guard de undefined

### 1.2 Verificar build limpio
- `npx tsc --noEmit` -> 0 errors
- `npm run build` -> success

### 1.3 Verificar UI con datos de test
- 3 proyectos en Supabase produccion
- UI `/projects` debe listarlos
- Flujo instanciar -> ejecutar -> ver informe funcional

## Fase 2: Revisar Pipeline Skill-Workflow-Prompt-Harvey

### 2.1 Pipeline completo documentado

```
UI (workflows/page.tsx)
  -> POST /api/workflows/instances/{id}/run (route.ts)
    -> runWorkflowInstance (instance-runner.ts)
      -> Load instance + template + version
      -> Calculate loop counters (loop_number, phase_loop_number)
      -> Build executionInput with workflow_iteration context
      -> Information gate check:
        - Missing required inputs -> code: information_required
        - Vault RAG grounding mode + no VDR docs -> code: information_required
      -> executeWorkflow (engine.ts)
        -> Feature flag check (WORKFLOW_TEMPLATES_V1)
        -> Template path: loadWorkflowTemplate -> extract skill keys -> query dd_skills_catalog
        -> Build prompt: buildHarveyWorkflowPrompt (prompt-builder.ts)
          - WORKFLOW CONTEXT section
          - ITERATION CONTEXT section (loop_number, phase, previous_loops)
          - ACTIVE SKILLS section (prompt_template, expected_output_schema, evidence_requirements)
          - INPUT PAYLOAD section
        -> Route decision (HARVEY_FEATURE_FLAG):
          - 'gateway' -> Harvey AI completion (circuit breaker + retry)
          - 'n8n' -> n8n webhook with buildN8nExecutionPayload
        -> Post-execution: DD backlog generation (arranque_dd only)
        -> Post-execution: Evidence auto-linking via VDR semantic search
      -> advancePhase (phase-engine.ts)
        - DoD checks from execution result
        - Phase advancement or gate failure
      -> Side effects (runPostPhaseSideEffects):
        - Archive workflow report version (dd_reports)
        - War Room notifications (emitWarRoomNotification)
        - Negotiation actions creation (high/critical findings)
      -> Append loop entry (appendWorkflowLoopEntry)
        - Loop tracking in instance metadata
        - Capped at 200 entries
```

### 2.2 Loop outcomes

| Outcome | Trigger | Loop recorded | Phase advances |
|---------|---------|--------------|----------------|
| `information_required` | Missing inputs or no VDR docs | Yes | No |
| `phase_gate_failed` | Execution OK but DoR/DoD not met | Yes | No |
| `execution_error` | Exception during execution | Yes | No |
| `completed` | Execution OK + phase advances | Yes | Yes |

### 2.3 Gaps identificados
- n8n local no operativo (feature flag en `gateway`)
- Skills para WF-07..12 no creados (planned, not published)
- HITL auto-creation no implementado aun (H.4 del backlog)
- AP-level Kanban task generation pendiente (H.1 del backlog)

## Fase 3: Actualizar PRD.md y CLAUDE.md

### 3.1 CLAUDE.md — Secciones a actualizar
- Project Structure: agregar prompt-builder.ts, schema-compat.ts
- Workflow Spec v1: actualizar estado (skills count, loop tracking)
- Pipeline reference: nuevo seccion con flujo completo
- Test data: documentar 3 proyectos en produccion

### 3.2 PRD.md — Secciones a actualizar
- Seccion 4.A: reflejar pipeline de ejecucion con loops
- Metricas actualizadas

## Criterios de Exito
- `tsc --noEmit` y `npm run build` en verde
- UI carga proyectos y el flujo instanciar->ejecutar funciona
- CLAUDE.md y PRD.md reflejan estado actual del pipeline
