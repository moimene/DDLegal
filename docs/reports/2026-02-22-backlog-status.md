# Informe de Backlog — DD Legal PMO
**Fecha:** 22 febrero 2026
**Proyecto Supabase:** NexusDD (`mxanelzxyaklvuypuafa`) — Plan Pro, Postgres 17.6, us-west-2

---

## 1. Resumen Ejecutivo

### Lo que esta hecho (Horizonte 1 — COMPLETADO)

| Dimension | Cifra |
|-----------|-------|
| Commits WFv1 | 12 |
| Migraciones aplicadas | 4 (workflow-specific) / 32 total |
| Tablas en DB | 64 |
| API endpoints | 97 |
| E2E test suites | 26 |
| Workflow templates seedeados | 16 (10 published, 6 planned) |
| Fases DD | 6 (expandidas de 5) |
| Categorias de template | 9 |
| Gateway circuit breaker | Implementado (30% threshold, 60s cooldown) |
| Skills en catalogo | 42 |

### Lo que queda por ejecutar

| Horizonte | Tasks | Esfuerzo est. | Prioridad |
|-----------|-------|---------------|-----------|
| H2 — Expansion Areas | 22 tasks | 40-60 dias | Alta |
| H3 — Scoring + Reporting | 8 tasks | 30 dias | Media |
| Security debt | 6 fixes | 3-5 dias | **Critica** |
| **Total** | **36 tasks** | **~90 dias** | — |

---

## 2. Backlog Horizonte 2 — Expansion Areas + Golden Path

### 2.1 Workstream G: Publicar 6 Workflows de Area (WF-07 a WF-12)

Cada workflow requiere: (1) crear skills, (2) actualizar template, (3) publicar, (4) test golden path.

| # | Task | WF | Area | Skills a crear | Est. | Prioridad |
|---|------|----|------|----------------|------|-----------|
| G.1 | Skills Inmobiliario | WF-07 | INM | `inm.titularidad_registral`, `inm.cargas_gravamenes`, `inm.urbanismo`, `inm.arrendamientos` | M | Alta |
| G.2 | Skills Litigios | WF-08 | LIT | `lit.procedimientos_activos`, `lit.reclamaciones_potenciales`, `lit.arbitrajes` | M | Alta |
| G.3 | Skills Regulatorio | WF-09 | REG | `reg.licencias_permisos`, `reg.cumplimiento_sectorial`, `reg.sanciones_historial` | M | Media |
| G.4 | Skills Medioambiental | WF-10 | ENV | `env.pasivos_ambientales`, `env.licencias_ambientales`, `env.suelos_contaminados` | M | Media |
| G.5 | Skills Proteccion Datos | WF-11 | DATA | `data.registro_actividades`, `data.base_legal_tratamiento`, `data.transferencias_internacionales`, `data.brechas_historico` | M | Media |
| G.6 | Skills Competencia | WF-12 | COMP | `comp.notificacion_obligatoria`, `comp.ayudas_estado`, `comp.acuerdos_verticales` | S | Baja |
| G.7 | Publicar templates WF-07 a WF-12 | All | All | Migration `is_published=true` | S | Alta (post-skills) |

**Total skills a crear: ~21 skills nuevos** (de 42 actuales a 63 objetivo)

### 2.2 Workstream H: Golden Path Validation — WF-04 Contratos

| # | Task | Archivo principal | Dependencia | Est. | Prioridad |
|---|------|-------------------|-------------|------|-----------|
| H.1 | AP-level Kanban task generation | `instantiate.ts` | — | M | Alta |
| H.2 | DoR enforcement en phase-engine | `phase-engine.ts` | H.1 | M | Alta |
| H.3 | Evidence linking via VDR semantic retrieval | `engine.ts` | — | M | Alta |
| H.4 | HITL auto-creation con contexto (AI output + evidence) | `phase-engine.ts` | H.3 | M | Alta |
| H.5 | Report section generation | `report-generator.ts` (nuevo) | H.4 | L | Alta |
| H.6 | E2E golden path test — Contratos | `24-golden-path-contratos.spec.ts` | H.1-H.5 | M | Alta |

### 2.3 Workstream I: Gateway Rate Limit por Familia

| # | Task | Archivo | Est. | Prioridad |
|---|------|---------|------|-----------|
| I.1 | Separar concurrency por familia | `gateway.ts` | S | Media |
| I.2 | Gateway factory con config por familia | `factory.ts` | S | Media |

### 2.4 Workstream J: Observability Automation

| # | Task | Archivo | Est. | Prioridad |
|---|------|---------|------|-----------|
| J.1 | Vercel Cron para audit sync (cada 15 min) | `api/cron/audit-sync/route.ts` | S | Media |
| J.2 | Metricas por fase de workflow | `api/observability/slo/route.ts` | M | Media |
| J.3 | Alertas SLO → War Room notifications | `api/observability/alerts/route.ts` | M | Media |

### 2.5 Workstream K: RLS Hardening

| # | Task | Archivo | Est. | Prioridad |
|---|------|---------|------|-----------|
| K.1 | CI lint rule — service_role_key no en client | CI config | S | Alta |
| K.2 | Matriz rol×endpoint E2E | `25-rbac-matrix.spec.ts` | L | Alta |

### 2.6 Workstream L: Retrieval Hibrido

| # | Task | Archivo | Est. | Prioridad |
|---|------|---------|------|-----------|
| L.1 | BM25 + pgvector hybrid search | `vdr/hybrid-search.ts` | M | Media |
| L.2 | Chunking adaptativo por tipo de documento | `vdr/chunking.ts` | M | Media |

---

## 3. Backlog Horizonte 3 — Scoring + Reporting Comite

| # | Task | WF relacionado | Est. | Prioridad |
|---|------|----------------|------|-----------|
| M.1 | Scoring consolidado cross-area (Deal Risk Score) | WF-13 | L | Media |
| M.2 | UI componente Deal Risk Score card | — | M | Media |
| N.1 | Reporting comite: template WF-16 → PDF | WF-16 | L | Media |
| N.2 | Red Flags Sheet export (Excel/PDF) | WF-14 | M | Media |
| N.3 | SPA Mapping dashboard | WF-15 | M | Media |
| O.1 | War Room timeline visual de negociacion | — | L | Baja |
| O.2 | Dashboard negotiation actions status | — | M | Baja |
| O.3 | Cierre de loop: decision → evidence → resolucion | — | M | Baja |

---

## 4. Deuda Tecnica de Seguridad (CRITICA)

Hallazgos del Supabase Security Advisor que requieren atencion inmediata:

### 4.1 ERROR: RLS deshabilitado en tablas publicas (5 tablas)

| Tabla | Riesgo | Fix |
|-------|--------|-----|
| `dd_hitl_decisions` | Decisiones HITL accesibles sin autorizacion | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy |
| `dd_areas` | Catalogo de areas (bajo riesgo, read-only) | Enable RLS + SELECT policy `USING(true)` |
| `dd_processes` | Catalogo de procesos (bajo riesgo, read-only) | Enable RLS + SELECT policy `USING(true)` |
| `dd_contingencies_ext` | **Datos sensibles** (columna `treatment`) | Enable RLS + policy project-scoped |
| `dd_spa_clause_library` | Biblioteca clausulas SPA | Enable RLS + SELECT policy |
| `dd_contingency_clause_map` | Mapeo contingencia-clausula | Enable RLS + policy project-scoped |

### 4.2 ERROR: SECURITY DEFINER view

| Vista | Riesgo | Fix |
|-------|--------|-----|
| `dd_documents_compat` | View con SECURITY DEFINER — bypasses RLS del usuario | Recrear como SECURITY INVOKER |

### 4.3 WARN: Funciones con search_path mutable (9 funciones)

| Funcion | Fix |
|---------|-----|
| `user_has_project_role` | `SET search_path = public` |
| `user_has_permission` | `SET search_path = public` |
| `match_vdr_chunks` | `SET search_path = public` |
| `current_user_org` | `SET search_path = public` |
| `forbid_audit_update_delete` | `SET search_path = public` |
| `update_kanban_state_timestamp` | `SET search_path = public` |
| `seed_kanban_config_for_project` | `SET search_path = public` |
| `update_updated_at_column` | `SET search_path = public` |
| `current_tenant_id` | `SET search_path = public` |

### 4.4 WARN: Policies `USING(true)` demasiado permisivas (~20 tablas)

Tablas con policies `ALL` con `USING(true)` y `WITH CHECK(true)`:
- `dd_projects`, `dd_reports`, `dd_requests`, `dd_skills_catalog`, `dd_report_templates`
- `dd_snapshots`, `dd_sources_log`, `dd_tool_executions`, `dd_tools`
- `dd_negotiation_alerts`, `governance_roles`
- `ip_*` (6 tablas: requests, titulares, marcas, disenos, snapshots, sources_log)
- `borme_announcements`, `personas`, `sociedad_candidates`, `sociedades`

**Recomendacion:** Sustituir policies `ALL USING(true)` por policies project-scoped o role-scoped. Las tablas de catalogo (dd_areas, dd_skills_catalog, dd_report_templates) pueden mantener SELECT `USING(true)` pero INSERT/UPDATE/DELETE deben ser restrictivos.

### 4.5 WARN: Leaked password protection deshabilitada

**Fix:** Habilitar en Dashboard > Auth > Password Security > "Check against HaveIBeenPwned".

### 4.6 WARN: Extension `vector` en schema public

**Recomendacion:** Mover a schema `extensions`:
```sql
ALTER EXTENSION vector SET SCHEMA extensions;
```
Nota: Requiere actualizar todas las queries que usan `vector(1536)` y `match_vdr_chunks`.

### 4.7 INFO: RLS enabled pero sin policies (5 tablas)

| Tabla | Riesgo | Fix |
|-------|--------|-----|
| `agent_executions` | Tabla legacy, sin acceso | Agregar policy o drop tabla |
| `dd_agent_executions` | Log de agentes | Policy read-only |
| `deletion_log` | Log de borrados | Policy admin-only |
| `document_sections` | Secciones de docs | Policy project-scoped |
| `tenants` | Tabla legacy multi-tenant | Policy o drop |

---

## 5. Resumen de Esfuerzos por Horizonte

### Horizonte 2 (60 dias estimados)

```
Semana 1-2:  Security debt (4.1-4.7) + Golden Path H.1-H.3
Semana 3-4:  Golden Path H.4-H.6 + Skills G.1-G.2 (INM, LIT)
Semana 5-6:  Skills G.3-G.4 (REG, ENV) + Gateway I.1-I.2
Semana 7-8:  Skills G.5-G.6 (DATA, COMP) + Observability J.1-J.3
Semana 8-9:  RLS K.1-K.2 + Retrieval L.1-L.2
Semana 9-10: Publish G.7 + E2E validation all workflows
```

### Horizonte 3 (30 dias estimados)

```
Semana 1-2:  Scoring M.1-M.2 + Reporting N.1
Semana 3-4:  Red Flags N.2 + SPA N.3 + War Room O.1-O.3
```

---

## 6. KPIs de Progreso

| Metrica | Actual | Target H2 | Target H3 |
|---------|--------|-----------|-----------|
| Templates published | 10/16 | 16/16 | 16/16 |
| Skills operativos | 42 | 63 | 63+ |
| Golden paths validados E2E | 0 | 3+ | 6+ |
| Tablas con RLS correcto | ~80% | 100% | 100% |
| Security advisors ERROR | 5 | 0 | 0 |
| Security advisors WARN | ~30 | <5 | 0 |
| Circuit breaker | Implemented | Implemented | Implemented |
| Metricas por fase | No | Si | Si |
| Cron audit sync | No | Si | Si |
| Scoring cross-area | No | No | Si |
| Informe PDF export | No | No | Si |
