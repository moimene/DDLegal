# DD Legal PMO

Plataforma interna de Due Diligence legal: Next.js 14 + Supabase + Harvey AI + n8n. Gestiona proyectos DD end-to-end con 17 workflow templates (6 fases DD + 1 CA, 17/17 published), 65 skills (57 base + 8 CA), 35 report templates, Evidence Pack, Kanban, VDR, War Room, Observabilidad, **Finding-Centric Architecture** (dd_findings como unidad canónica con AI summaries + ABM sin hardcodes), **Worker Architecture v1.0** (loop autónomo SENSE→NORMALIZE→EVALUATE→CONCLUDE) e **Incremental RAG + Report Rendering + Two-Level Cache**. 134 API routes, 30 E2E suites, 75 migrations. 69 Finding Objectives (54 base + 15 CA), 39 expected documents across 7 areas. 3 proyectos sinteticos (GREEN/AMBER/RED) con datos completos para demo. **Desplegado en produccion**: `dd-legal-pmo.vercel.app`.

## Stack

- **Frontend**: Next.js 14 (App Router), React 18, Zustand, TanStack Table, Lucide icons, Montserrat (Garrigues)
- **Backend**: Next.js API routes (134 endpoints), Supabase (Postgres + RLS + pgvector + BM25)
- **AI**: Harvey AI gateway, OpenAI embeddings (text-embedding-3-small, 1536d)
- **Infra**: Vercel (produccion: `dd-legal-pmo.vercel.app`), Supabase hosted, n8n workflows
- **Tests**: Playwright E2E (30 suites, 293+ tests), Vitest unit tests

## Commands

- `npm run dev` — Dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run test` / `npx playwright test` — E2E tests (all 30 suites)
- `npx playwright test --grep @fo` — Finding Objectives tests (36 tests)
- `npm run test:api` — API specs societario
- `npm run test:page` — Page specs societario
- `npm run test:ui` — Playwright UI mode

## Project Structure

```
src/
  app/
    api/                    # 134 API routes across 30+ groups
      ai/                   # classify, suggest
      alerts/               # SLA alerts
      auth/                 # login, me, roles, setup-test-users
      contingencies/        # PATCH severity, GET single
      evidence/             # link-chunks, pack builder (Evidence Pack v2)
      gateway/              # Harvey AI proxy (whoami, health, completion)
      kanban/               # board, metrics, tasks CRUD + move + alerts
      cron/                  # Vercel Cron: audit-sync (15-min), fo-analysis (5-min), worker-cycle (5-min)
      worker/               # DD Worker: start, status, pause, resume
      observability/        # SLO dashboard (workflow phases), telemetry ingestion, alerts
      vdr/                  # documents, folders, bulk, search, audit
        ingest/             # S4: async vectorization pipeline
        search/semantic/    # S4: pgvector semantic search
        rag/query/          # S0: Vault RAG query endpoint
        vault/sync/         # S4→S0: VDR to Harvey Vault sync
      reports/              # Report generation: final, red-flags, workflow, pdf, md, compare, export, generate
      findings/             # Finding ABM: list (+include_inactive), create manual, detail, PATCH, soft-delete, batch-summary
      scoring/              # H3: Deal Risk Score (POST/GET per project)
      war-room/             # S6: dashboard, decisions, red-flags, export, negotiation-actions, spa-mapping, timeline, negotiation-dashboard, decision-resolution
      tasks/                # [id]/status PATCH (authenticated task status update)
      workflows/            # templates, instantiate, instances, phase, list, execute
      # + 16 more: client, configuracion, documents, events, evidence,
      #   harvey, hitl, ip, negotiation, notifications, projects, qa,
      #   reports, skills, societario, system, tools
    login/                  # Login page with demo user selection + auto-fill
    projects/[id]/
      findings/             # Findings management page (table + detail + evidence)
      hitl/                 # HITL review queue
      kanban/               # Kanban board
      vdr/                  # Virtual Data Room
      workflows/            # Workflow instances
    (pages)/                # Next.js pages with App Router
  components/               # 13 component groups (dashboards, vdr, reports...)
  contexts/
    UserContext.tsx          # Auth state, login/logout, role management
  lib/
    auth/                   # require-permission middleware (18 permissions incl. findings)
    findings/               # Finding-Centric Architecture: dual-write service, queries, types
    embeddings/             # OpenAI embedding client (batch, retry)
    harvey/                 # Harvey AI gateway (circuit breaker + Retry-After + per-family rate limits) + factory
    observability/          # Telemetry writer
    vdr/                    # Chunker, ingest pipeline, semantic search, hybrid search (BM25+pgvector), adaptive chunking, content-hash, multi-query-retrieval
    war-room/               # Notifications, severity bridge
    scoring/                # Deal Risk Score engine (severity×probability×timing×area weighting)
    reporting/              # Report engine, evidence pack builder, red flag generator, final report compiler, analysis-results cache, templates (35), garrigues-schemas
    worker/                 # DD Worker: controller, phases (sense, normalize, evaluate, conclude), fact-extractor, document-classifier
    workflows/              # Template-based engine + instantiation + phase advancement
      template-types.ts     # 6 phases, 9 categories, template/instance types
      template-loader.ts    # DB-backed loader with 5-min cache
      instantiate.ts        # Template → instance → task groups → kanban
      phase-engine.ts       # Phase advancement with template-aware ordering
      engine.ts             # Dual-run: template path vs legacy path
      constants.ts          # Legacy WORKFLOW_DEFINITIONS (6 hardcoded)
    supabase.ts             # Types + client (service_role + anon)
    supabase-auth.ts        # ProjectRole type, ROLE_PERMISSIONS matrix
    utils.ts                # Helpers, configs, constants
  styles/
    tokens.css              # Garrigues design tokens (--g-* CSS variables)
  middleware.ts             # Auth + feature flag middleware
supabase/
  migrations/               # 75 SQL migrations (RLS, pgvector, seeds, kanban, workflows, observability, security hardening, BM25, H3 scoring, seed_v3_schema, RAG cache, findings)
e2e/                        # 29 Playwright test suites (257 passed, 0 failed)
vercel.json                 # Vercel config: cron job (audit-sync every 15 min)
scripts/
  lint-service-role.sh      # CI lint: detect service_role_key in client code
```

## Strangler Slices (v3.0) — All deployed

| Slice | Nombre | Estado |
|-------|--------|--------|
| S0 | Harvey Gateway (circuit breaker + Retry-After) | ✅ Produccion |
| S1 | Auth + RLS + Middleware | ✅ Produccion |
| S2 | Kanban Tasks (10 estados + WIP + aging) | ✅ Produccion |
| S3 | Workflow Engine (16 templates DB-backed, 6 fases DD) | ✅ Produccion |
| S4 | VDR Vectorizacion (pgvector + embeddings) | ✅ Produccion |
| S5 | Observabilidad (SLOs + telemetria) | ✅ Produccion |
| S6 | War Room (decisiones + red flags + negotiation actions) | ✅ Produccion |

## Workflow Spec v1 (16 templates)

6 fases DD: `obtencion → gestion → analisis → valoracion → informe → propuesta_transaccional`

| Estado | Workflows | Detalles |
|--------|-----------|----------|
| Published (16) | WF-01 a WF-06 (v2, 6 fases), WF-07 a WF-12 (v2, area skills), WF-13 a WF-16 (synthesis/deliverable) | All operational |

Feature flag: `WORKFLOW_TEMPLATES_V1` — cuando `false`, usa `WORKFLOW_DEFINITIONS` legacy. 9 categorias: transversal, area, area_multi, synthesis, deliverable, negotiation, transactional, compliance, operational.

## Demo Users

16 usuarios en Supabase Auth (8 demo + 8 extended seed v3). Login page (`/login`) permite seleccion directa con auto-fill. Credenciales en seed migration (NO en este fichero).

| Rol | UUID | Notas |
|-----|------|-------|
| Superusuario (admin) | `aaaa0001-0000-4000-8000-000000000000` | Admin principal |
| CLO / Director Legal | `aaaa0001-0001-4000-8000-000000000001` | |
| PM Transaccion | `aaaa0001-0002-4000-8000-000000000002` | |
| Abogado Mercantil | `aaaa0001-0003-4000-8000-000000000003` | |
| Deal Sponsor | `aaaa0001-0004-4000-8000-000000000004` | |
| Contacto Target | `aaaa0001-0005-4000-8000-000000000005` | |
| Stakeholder Negocio | `aaaa0001-0006-4000-8000-000000000006` | |
| Cliente Externo | `aaaa0001-0007-4000-8000-000000000007` | |
| Abogado Contractual | `aaaa0001-0008-...` | Seed v3 |
| Abogado Fiscal | `aaaa0001-0009-...` | Seed v3 |
| Abogado PI | `aaaa0001-000a-...` | Seed v3 |
| Abogado Laboral | `aaaa0001-000b-...` | Seed v3 |
| Abogado Litigios | `aaaa0001-000c-...` | Seed v3 |
| Abogado ADM | `aaaa0001-000d-...` | Seed v3 |
| Inactive (former) | `aaaa0001-000e-...` | Seed v3 |
| Expired user | `aaaa0001-000f-...` | Seed v3 |

Demo project: `a1b2c3d4-0001-4000-8000-000000000001` (FMC Due Diligence - Prototipo).
Credenciales y emails: ver `supabase/migrations/202602270001_seed_demo_users.sql` (local only, nunca en repo publico).

**GoTrue gotcha**: `email_change` column in `auth.users` MUST be `''` (empty string), not NULL. GoTrue's Go code scans it as `string` type which cannot handle NULL.

## Synthetic Test Dataset v3

3 fully-seeded projects with 342+ rows across 16 tables, loaded via SQL directly to Supabase production (project `mxanelzxyaklvuypuafa`). Deterministic UUIDs via `seed_uuid(key) = md5('dd_seed_v3::' || key)::uuid`.

| Project | Code | Score | Recommendation | Economic Exposure |
|---------|------|-------|----------------|-------------------|
| Proyecto Green (Synapse AI SL) | PJT_GREEN | 74 | conditional_go | 855K EUR |
| Proyecto Amber (DataForge SA) | PJT_AMBER | 68 | go | 755K EUR |
| Proyecto Red (Legacy Systems SL) | PJT_RED | 22 | no_go | 3.235M EUR |

### Seed data counts

| Table | Total | Seed v3 |
|-------|-------|---------|
| dd_projects | 4 | 3 |
| dd_workflow_instances | 19 | 16 |
| dd_kanban_tasks | 56 | 23 |
| dd_contingencies | 19 | 19 |
| dd_contingencies_ext | 19 | 19 |
| dd_contingency_clause_map | 32 | 32 |
| dd_deal_risk_scores | 32 | 3 |
| dd_hitl_decisions | 18 | 16 |
| dd_war_room_decisions | 31 | 16 |
| dd_war_room_notifications | 16 | 16 |
| dd_evidence | 18 | 18 |
| dd_reports | 22 | 16 |
| dd_project_user_roles | 47 | 39 |
| dd_qa_threads | 20 | 20 |
| dd_qa_messages | 63 | 63 |
| dd_spa_clause_library | 34 | 18 |

### CSV source files

All seed data originates from `docs/output_v3/*.csv` (17 files). Schema mapping and DDL migration applied via Supabase MCP tool.

### Area codes → UUIDs

| Code | UUID |
|------|------|
| MERC | `b4ee7c1b-8aa4-4897-84cf-07d9dfaabe78` |
| CONT | `494b59cc-00a6-4269-aa37-b7a8a3e803bb` |
| LAB | `d6dec417-57dd-4740-aca7-c5d4e22e3c84` |
| FISC | `dd68cc5e-2265-4c08-8639-8bebceb3c51d` |
| PI | `ef610832-083e-4512-8b7d-ad723f106ee6` |
| ADM | `2493fc84-226f-4efb-955e-f89c88989562` |
| LIT | `68bf73da-cfd7-4ab8-b990-b2e6132c2f43` |

### Expected Documents per Area

| Area | Count | Mandatory |
|------|-------|-----------|
| MERC | 13 | 8 |
| CONT | 5 | 4 |
| FISC | 4 | 3 |
| LAB | 5 | 4 |
| PI | 2 | 2 |
| LIT | 5 | 2 |
| ADM | 5 | 2 |
| **Total** | **39** | **25** |

## Workflow Consolidation (2026-02-23)

Consolidated workflow engine with enriched iteration context for Harvey AI:

- **prompt-builder.ts** (`src/lib/workflows/prompt-builder.ts`): Builds structured prompt/payload per iteration including active skills metadata, workflow context, loop history
- **engine.ts** (modified): Template and legacy paths now use enriched prompts with skills + iteration context. n8n path sends enriched payload
- **instance-runner.ts** (modified): Calculates `loop_number`, `phase_loop_number`, and previous loops history before each execution
- **Unit tests**: `src/lib/workflows/__tests__/prompt-builder.test.ts` (11 tests passing)

### Known Issues (all resolved 23 feb 2026)

1. ~~**Vista General empty data**~~: ✅ Resuelto. Creado endpoint consolidado `/api/projects/[id]/overview` con `supabaseAdmin`. Migrado `page.tsx` de 7 `supabase.from()` calls a `fetch()` con Bearer token. `updateTaskStatus` tambien migrado a `/api/tasks/[id]/status` PATCH. **0 usos de cliente anon `supabase` en page.tsx.**
2. ~~**401 en nav-badges/active-areas**~~: ✅ Resuelto. Auth headers Bearer anadidos a `use-project-nav-badges.ts` y `use-project-areas.ts`.
3. ~~**HITL ruta incorrecta**~~: ✅ Ya correcto. Todas las referencias apuntan a `/projects/[id]/hitl`.
4. **n8n not operational**: Feature flag set to `gateway`, n8n webhook (`localhost:5678`) not reachable. Code path exists but routing disabled. (No es un bug, es configuracion intencional.)

## Sprint Progress (Feb 2026)

| Day | Scope | Commit | Lines |
|-----|-------|--------|-------|
| Day 1 | Skills, workflows 4+6, audit ingest, SLO, kanban, war room | `16394b9` | +2,319 |
| Day 2 | Vault RAG, p95 SLO, Arranque DD backlog, kanban alerts, DoR UX | `770c724` | +704 |
| Day 3 | Severity notifications, Evidence Pack v2, VDR→Vault sync | `f19ec01` | +843 |
| Day 4 | 28 E2E tests covering all sprint features | `b69c81a` | +588 |
| Day 5 | Hardening + Documentation (tsc fixes, CLAUDE.md, PRD.md) | `a4b9b06` | +72 |
| Day 6 | E2E fixes: 52→257 passed, 0 failed | `8f66744` | +340 |
| Day 7 | S4-S6 features (scoring, reporting, VDR, war-room, cron) + deploy | `a94a836` | +1,200 |

### Workflow Spec v1 Evolution (12 commits)

| Commit | Scope |
|--------|-------|
| `89bf7f5` | DB: 5 tablas workflow (templates, versions, instances, task_groups, negotiation_actions) |
| `0af15d9` | DB: seed 6 MVP workflows como templates versionadas |
| `6f11f55` | DB: expand phase enum 5→6 (informe + propuesta_transaccional) |
| `ef91b5e` | DB: seed catalogo expandido 16 workflows YAML v1 |
| `3956ae3`..`a87de16` | TS: types + loader + instantiate + dual-run + phase engine |
| `5775cf5` | API: 5 routes (templates, instantiate, instances, phase, negotiation-actions) |
| `2310c81` | Gateway: Retry-After parsing + circuit breaker (30% threshold, 60s cooldown) |
| `7445614` | E2E: tests catalogo, auth, circuit breaker |

## Critical Rules

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Only in `src/app/api/` routes.
- **NEVER** edit `.env.local` or `.env.production` files directly.
- All new DB tables **MUST** have RLS enabled + policies.
- HITL is **mandatory** for CONT, LAB, FISC, LIT area outputs.
- Path alias: `@/*` maps to `./src/*`.
- Design system: Garrigues tokens in `src/styles/tokens.css` — use `--g-*` CSS variables, never hardcode colors. Brand: `--g-brand-3308: #004438`. Font: Montserrat.
- Migration naming: `YYYYMMDDNNNN_snake_case.sql` (e.g., `202602270001_seed_demo_users.sql`). Next available: `202602280036`.
- **dd_deal_risk_scores JSON formats**: `top_risks` and `deal_breakers` must be arrays of `ScoredFinding` objects (`{id, title, raw_score, weighted_score, is_deal_breaker, area_code}`), NOT plain strings. `area_scores` must be `{score, finding_count, critical_count}` objects, NOT plain numbers.
- **RLS + project access**: Users must have an active entry in `dd_project_user_roles` with appropriate role for their project. Admin user needs CLO role on each project. RLS function `user_has_permission(project_id, permission)` checks `auth.uid()` against `dd_project_user_roles`.
- Next.js dynamic params use `{ params }: { params: Promise<{ id: string }> }` pattern.
- pgvector embeddings are 1536 dimensions (OpenAI text-embedding-3-small). HNSW index with cosine distance.
- Supabase RPC: `match_vdr_chunks` for semantic search, `bm25_search_vdr_chunks` for full-text. Never call pgvector directly from client.
- Hybrid search: `hybridSearch()` merges BM25 + pgvector via RRF (k=60). Use for VDR queries needing both keyword and semantic relevance.
- Per-family gateway rate limits: completion=5, history=3, rag=2 concurrent (total 10, under Harvey 20 rpm cap).
- Auth login via `POST /api/auth/login` → returns `{ session: { access_token } }`. Token stored in `localStorage` as `dd_session_token`. All API calls use `Authorization: Bearer <token>`.

## Environment Variables

Required in `.env.local` (never commit):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)
- `HARVEY_ENDPOINT_V1` — Harvey completion endpoint (EU region)
- `HARVEY_ENDPOINT_HISTORY` — Harvey history/audit endpoint
- `HARVEY_TOKEN` — Harvey bearer token (server only)
- `HARVEY_FEATURE_FLAG` — `gateway` | `n8n` | `shadow` (controls Harvey routing)
- `WORKFLOW_TEMPLATES_V1` — `true` | `false` (enables template-based workflow engine)
- `OPENAI_API_KEY` — OpenAI API key (for embeddings in S4)
- `CRON_SECRET` — Vercel Cron auth secret (protects `/api/cron/*` routes)
- `HARVEY_API_KEY` — Harvey API key (legacy, used by some routes)
- `FINDINGS_FIRST` — `true` | `false` (when true, reads shift to dd_findings as source of truth; default: false)
- `FINDING_OBJECTIVES` — `true` | `false` (when true, uses FO-driven analysis; requires FINDINGS_FIRST=true)
- `DD_WORKER` — `true` | `false` (when true, enables autonomous Worker loop and post-ingestion classification)

## Deployment

- **Production**: `dd-legal-pmo.vercel.app` (auto-deploy from `main`) — ✅ LIVE
- **Preview**: auto-deploy from PR branches
- **Supabase**: project `mxanelzxyaklvuypuafa` (NexusDD)
- **Vercel project**: `prj_c6BXNArsGxvSeM1k3bKqthgHQpYP` / org `team_W5FPu7F9THwPNfGfTAyIwhYX`
- **Repo**: `github.com/moimene/DDLegal` (private)

### Vercel Env Vars (Production)

10 configured: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_WEBHOOK_BASE_URL`, `HARVEY_ENDPOINT_V1`, `HARVEY_ENDPOINT_HISTORY`, `HARVEY_TOKEN`, `HARVEY_FEATURE_FLAG`, `CRON_SECRET`, `HARVEY_API_KEY`.

**Pending**: `OPENAI_API_KEY` (needed for VDR embedding/vectorization).

### Deployment Notes

- **NEVER use `echo` to pipe env vars to `vercel env add`** — it adds trailing `\n`. Always use `printf '%s' "value" | npx vercel env add NAME production`.
- TypeScript build: `[...new Set()]` fails without `downlevelIteration` — use `Array.from(new Set())` instead.
- Vercel validates CRON_SECRET has no whitespace (used in HTTP headers).

## Finding-Centric Architecture (Fase A+B — Feb 2026)

El "hallazgo" (finding) es la unidad mínima de gestión del DD. Implementado via Strangler Fig:

### Tablas nuevas (8 migrations: 202602280004–202602280011)

| Tabla | Propósito |
|-------|-----------|
| `dd_findings` | Tabla canónica de hallazgos (30+ columnas, 9 CHECK constraints) |
| `dd_finding_evidence` | Enlace N:M finding↔chunk VDR |
| `dd_report_findings` | Enlace N:M finding↔report |

RLS habilitado en las 3 tablas. 7 funciones RPC: `validate_finding_transition`, `get_finding_with_evidence`, `get_project_findings_summary`, `compute_finding_score`, `compute_finding_tier`, `compute_project_coverage`, `get_findings_by_area`.

**Evolución de esquema Findings (2 migrations adicionales):**
- `202602280035_add_finding_summary.sql` — columna `summary` + índice parcial
- `202602280036_add_findings_soft_delete.sql` — `is_active`, `archived_at`, `archived_by`, `archive_reason` + índice `(project_id, is_active, updated_at DESC)`

### Finding Status Lifecycle (10 estados)

`identified → under_review → validated → contested → accepted → mitigated → reported → negotiated → resolved / dismissed`

State machine enforced via `validate_finding_transition()` RPC. Transitions are strict (no arbitrary jumps).

### Relevance Tier System

| Tier | Nombre | Criterio |
|------|--------|----------|
| 1 | Decisorio | Critical severity OR blocking timing OR high+alta probability |
| 2 | Gestión | High/medium with economic impact OR blocking timing |
| 3 | Registro | Todo lo demás |

Auto-calculated on insert (`tier_auto_calculated`), overridable via `relevance_tier` + `tier_override_by` + `tier_override_reason`.

### Dual-Write Layer (Fase B)

**Files:**
- `src/lib/findings/findings-service.ts` — Core service: `persistFindings()`, `transitionFindingStatus()`, `overrideFindingTier()`, `linkFindingToContingency()`, queries
- `src/lib/findings/index.ts` — Barrel export
- `src/lib/workflows/engine.ts` — `dualWriteFindings()` injected in all 4 execution paths (template n8n, template gateway, legacy n8n, legacy gateway)
- `src/lib/workflows/instance-runner.ts` — `resolveFindingIds()` maps finding_ref → dd_findings.id for negotiation actions

**API Routes:**
- `GET /api/findings?project_id=...&tier=1,2&status=...&area_code=...&summary=true&include_inactive=true|false` — List/summary
- `POST /api/findings` — Create manual finding (project-scoped)
- `GET /api/findings/[id]` — Detail via RPC
- `PATCH /api/findings/[id]` — Status transition, tier override, contingency link, field updates
- `DELETE /api/findings/[id]` — Soft-delete (archive) with traceability fields
- `POST /api/findings/batch-summary` — Generate AI summaries for findings without one (limit 10-50)

**Permissions (added to RolePermissions):**
- `can_view_findings` — clo, pm, abogado, deal_sponsor, stakeholder, cliente_externo
- `can_edit_findings` — clo, pm, abogado (scoped)
- `can_change_finding_tier` — clo, pm, abogado (3→2 own area)
- `can_resolve_findings` — clo, pm only

**Feature flag:** `FINDINGS_FIRST` — when enabled, reads shift to `dd_findings` as source of truth. Currently OFF (dual-write only).

**CHECK constraint values (dd_findings):**
- `source_type`: workflow_ai, manual, import, tool_societario, tool_ip, workflow_execution, manual_entry, ai_analysis, document_review, registry_scrape, backfill
- `timing`: blocking, post_closing, pre_closing, pre-close, post-close, ongoing, immediate (or NULL)
- `verifiability`: verified, partially, not_verifiable, documentable, verifiable, unverifiable (or NULL)
- `economic_impact_type`: contingency, liability, loss, operational_cost, direct, indirect, reputational (or NULL)
- `severity`: critical, high, medium, low, informational
- `probability`: certain, alta, probable, media, possible, baja, remote

**Events (5 new):** `finding_created`, `finding_archived`, `finding_status_changed`, `finding_tier_changed`, `finding_updated` — emitted via event bus, persisted in `dd_event_log`, broadcast via Supabase Realtime.

### Findings UI (Feb 2026)

Página dedicada para gestión de findings en `/projects/[id]/findings`.

**Archivo:** `src/app/projects/[id]/findings/page.tsx` (~800 líneas)

**Componentes:**

| Componente | Descripción |
|------------|-------------|
| Header + Summary Cards | 5 cards: critical, high, medium, low, total |
| Filter Panel | Severidad, Estado, Tier, Área, Búsqueda libre |
| Findings Table | Tabla ordenable con badges de severidad/estado/tier |
| Detail Panel (40%) | Panel lateral con toda la info del finding |
| Evidence Section | Chunks VDR vinculados con snippets y enlaces |
| Actions Section | Botones de transición de estado + override de tier |

**Flujo de navegación:**

```
Sidebar → Findings → Header + Filters → Tabla
                                          ↓ click
                                    Detail Panel
                                          ↓
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
              Ver Evidencia        Cambiar Estado         Cambiar Tier
                    ↓                     ↓                     ↓
               Link → VDR          State Machine          Justificación
```

**State Machine UI (transiciones válidas):**

| Estado Actual | Transiciones Disponibles |
|---------------|-------------------------|
| identified | under_review, dismissed |
| under_review | validated, contested, dismissed |
| validated | accepted, contested |
| contested | under_review, validated, dismissed |
| accepted | mitigated, reported |
| mitigated | reported, resolved |
| reported | negotiated, resolved |
| negotiated | resolved |
| resolved/dismissed | (terminal) |

**Evidence Display:**
- Muestra chunks VDR vinculados via `dd_finding_evidence`
- Cada item: título sección, tipo, página, similarity score, snippet
- Link directo al documento en VDR: `/projects/[id]/vdr?doc={document_id}`

**AI Summary (Harvey):**
- Columna `summary` en `dd_findings` (~200 chars, español)
- **Generación inline en workflow:** `buildFindingSummary()` en `rule-evaluator.ts` genera resumen como parte del flujo Harvey
- Incluye: severidad (traducida), área, título, criterios evaluados
- Pasado via `WorkflowFinding.summary` → `persistFindings()`
- Batch endpoint: `POST /api/findings/batch-summary` para findings existentes sin summary
- Fallback local si Harvey no disponible (para findings manuales/import)
- **Files:**
  - `src/lib/findings/rule-evaluator.ts` — `buildFindingSummary()` inline generation
  - `src/lib/findings/summary-generator.ts` — Harvey integration, batch processing (fallback)
  - `src/app/api/findings/batch-summary/route.ts` — Batch API (limit 10-50)
- **UI:** Mostrado en tabla (bajo título) y panel de detalle (header, itálica)
- **Migration:** `202602280035_add_finding_summary.sql` — columna + índice parcial

**Permisos requeridos:**
- `can_view_findings` — ver página y lista
- `can_edit_findings` — cambiar estado (excepto resolved/dismissed)
- `can_change_finding_tier` — override de tier con justificación
- `can_resolve_findings` — transición a resolved/dismissed

### Findings Admin Console (ABM, sin hardcodes)

- Nueva consola en `/configuracion/findings` con dos pestañas:
  - `Catálogo de Findings` (global): alta, edición, desactivación lógica de `dd_finding_objectives`
  - `Findings por Proyecto` (operativo): alta manual, edición y baja lógica en `dd_findings`
- Navegación integrada en sidebar: `Configuracion -> Findings ABM`
- `ProcessWorkbench` dejó de depender de findings mockeados en runtime; carga findings por `GET /api/findings`

### Fase C — Migrate Reads (COMPLETED)

All major read paths now support `FINDINGS_FIRST` feature flag. When OFF (default), legacy paths remain active. When ON, reads shift to `dd_findings`.

**Migrated consumers:**

| Consumer | File | Legacy Source | FINDINGS_FIRST Source |
|----------|------|-------------|----------------------|
| Deal Risk Scoring | `/api/scoring/deal-risk` POST | dd_contingencies + dd_negotiation_alerts + HITL filter | dd_findings (non-dismissed) |
| Red Flag Report | `/lib/reporting/red-flag-report-generator.ts` | dd_contingencies(critical/high) + dd_negotiation_alerts | dd_findings (is_red_flag OR severity in critical/high) |
| War Room Red Flags | `/api/war-room/[project_id]/red-flags` | dd_contingencies + dd_negotiation_alerts | dd_findings via getRedFlagFindings() |
| War Room Dashboard | `/api/war-room/[project_id]` | dd_negotiation_alerts | dd_findings (critical/high) |
| Workflow Report | `/lib/reporting/report-generator.ts` | metadata.phase_results_{phase}.findings (JSONB) | dd_findings by source_workflow_instance_id + source_phase |
| Final Report | `/lib/reporting/final-report-compiler.ts` | dd_contingencies(critical/high) count | dd_findings via getRedFlagsDigest() |

**New query helpers in findings-service.ts:**
- `getFindingsForScoring(projectId)` — ScoringInput[] shape
- `getRedFlagFindings(projectId)` — red flags with contingency link
- `getFindingsByWorkflowInstance(instanceId, phase?)` — replaces JSONB reads
- `getRedFlagsDigest(projectId)` — {total, deal_breakers, critical} counts

All responses include `source: 'dd_findings' | 'legacy'` for observability.

### Fase D — Backfill (COMPLETED)

Migration `202602280011_backfill_findings_from_contingencies.sql` applied. Idempotent (uses `NOT EXISTS` on external_ref).

| Source | Rows Backfilled | External Ref Pattern |
|--------|----------------|---------------------|
| dd_contingencies | 19 | `backfill:contingency:{contingency_id}` |
| Workflow metadata JSONB | 2 | `{instance_id}:{phase}:{slugified_title}` |
| **Total** | **21** | |

**Per-project distribution:**

| Project | Findings | Critical | Deal Breakers | Linked Contingencies |
|---------|----------|----------|---------------|---------------------|
| Proyecto Red | 7 | 3 | 4 | 7 |
| Proyecto Amber | 7 | 0 | 1 | 7 |
| Proyecto Green | 5 | 1 | 1 | 5 |
| FMC Prototipo | 2 | 1 | 0 | 0 |

Bidirectional FK: all 19 contingencies have `finding_id` set, all 19 findings have `contingency_id` set. Status mapping: `identified→identified`, `confirmed→validated`, `accepted→accepted`, `mitigated→mitigated`, `resolved→resolved`.

### Fase E.1-E.2.5: Finding Objectives + Iterative Analysis (COMPLETED)

**New tables (7 migrations: 202602280012-202602280018):**

| Tabla | Propósito |
|-------|-----------|
| `dd_finding_objectives` | Catálogo de 54 FOs por área legal |
| `dd_scoring_config` | Pesos parametrizables por deal_type/jurisdiction |
| `dd_rule_executions` | Audit trail completo de cada evaluación FO+documento |
| `dd_fo_document_status` | Tracking iterativo N docs × M FOs |

**New files:**

| Archivo | Propósito |
|---------|-----------|
| `src/lib/findings/objective-types.ts` | TypeScript types para FOs |
| `src/lib/findings/objective-resolver.ts` | Resolver de FOs aplicables por contexto |
| `src/lib/findings/rule-evaluator.ts` | Evaluador de criterios con audit trail |
| `src/lib/findings/fo-analysis-worker.ts` | Worker iterativo para procesar docs pendientes |
| `src/app/api/finding-objectives/route.ts` | CRUD catálogo FOs (GET/POST/PATCH/DELETE) |
| `src/app/api/scoring/config/route.ts` | GET config scoring |
| `src/app/api/cron/fo-analysis/route.ts` | Cron cada 5 min |
| `src/app/api/fo/coverage/route.ts` | GET coverage stats por proyecto |

**Triggers automáticos:**
- `trg_vdr_doc_content_change`: Re-análisis cuando cambia content_hash
- `trg_new_finding_objective`: Crear pending para docs existentes
- `trg_vdr_doc_new`: Crear pending para FOs activos

**Feature flag:** `FINDING_OBJECTIVES=true` (requires `FINDINGS_FIRST=true`)

**APIs:**
- `GET /api/finding-objectives?area_code=...&deal_type=...&jurisdiction=...&include_inactive=true|false`
- `POST /api/finding-objectives`
- `PATCH /api/finding-objectives`
- `DELETE /api/finding-objectives` (soft-delete `is_active=false`)
- `GET /api/scoring/config?deal_type=...&jurisdiction=...`
- `GET /api/fo/coverage?project_id=...`
- `GET /api/cron/fo-analysis` (protected by CRON_SECRET)

### Pendiente (Fase E.3-E.4)

- **Fase E.3 (Contract)**: Set `FINDINGS_FIRST=on` in Vercel env, validate all consumers read correctly
- **Fase E.4 (Cleanup)**: Deprecate legacy JSONB paths, remove dual-write

## Worker Architecture v1.0 (Fase F — Feb 2026)

Worker autónomo de DD que ejecuta un loop continuo de 4 fases: **SENSE → NORMALIZE → EVALUATE → CONCLUDE**. Transforma el sistema de request/response a un worker que procesa documentos, evalúa Finding Objectives, y genera conclusiones automáticamente.

### Migrations (4: 202602280019–202602280022)

| Migration | Descripción |
|-----------|-------------|
| `202602280019_create_dd_document_facts.sql` | Tabla de hechos estructurados extraídos de documentos |
| `202602280020_create_dd_worker_runs.sql` | State machine del worker + RPC helpers |
| `202602280021_add_fo_depends_on.sql` | Columna depends_on para dependencias entre FOs |
| `202602280022_create_dd_area_conclusions.sql` | Conclusiones por área con recommendations y patterns |

### New Tables

| Tabla | Propósito |
|-------|-----------|
| `dd_document_facts` | Hechos estructurados: parties, dates, amounts, clauses, obligations |
| `dd_worker_runs` | Estado del worker: status, current_phase, work_queue, coverage_snapshot |
| `dd_area_conclusions` | Conclusiones por área: narrative, risk_score, recommendations, patterns |

### Worker Files

| Archivo | Propósito |
|---------|-----------|
| `src/lib/worker/worker-controller.ts` | State machine + cycle orchestration |
| `src/lib/worker/sense-phase.ts` | Detecta documentos pendientes, calcula cobertura, construye work queue |
| `src/lib/worker/normalize-phase.ts` | Clasifica documentos + extrae hechos estructurados |
| `src/lib/worker/evaluate-phase.ts` | Evalúa FOs con dependencias y hechos estructurados |
| `src/lib/worker/conclude-phase.ts` | Genera conclusiones por área con narrativas AI |
| `src/lib/worker/fact-extractor.ts` | Extracción AI via Harvey con cache por content_hash |
| `src/lib/worker/document-classifier.ts` | Clasificación pattern-based + AI fallback |
| `src/lib/worker/dependency-resolver.ts` | Resolución topológica de dependencias FO |
| `src/lib/worker/index.ts` | Barrel export |

### API Routes

| Route | Método | Descripción |
|-------|--------|-------------|
| `/api/worker/start` | POST | Iniciar worker para proyecto |
| `/api/worker/status` | GET | Estado actual del worker |
| `/api/worker/pause` | POST | Pausar worker |
| `/api/worker/resume` | POST | Reanudar worker pausado |
| `/api/cron/worker-cycle` | GET | Cron cada 5 min (protected by CRON_SECRET) |

### Worker State Machine

```
IDLE → SENSING → NORMALIZING → EVALUATING → CONCLUDING → COMPLETED
  ↑                                              │
  └────────────── feedback loop ─────────────────┘
```

Estados: `idle`, `sensing`, `normalizing`, `evaluating`, `concluding`, `paused`, `error`, `completed`

### Execution Modes

| Modo | Descripción |
|------|-------------|
| `continuous` | Loop indefinido (cron-triggered, 5 min) |
| `targeted` | Un área o FO específico |
| `full_sweep` | Reevaluar todo el proyecto |
| `on_demand` | Trigger manual por usuario |

### Feature Flag

`DD_WORKER=true` — Habilita el Worker autónomo y post-ingestion classification hook en VDR.

### Document Facts Schema

```typescript
interface DocumentFacts {
  document_type: string;      // contrato_material, acta_junta, etc.
  area_codes: string[];       // ['CONT', 'LAB']
  jurisdiction: string;       // ES, UE, UK, US
  parties: Party[];           // [{name, role, is_target, is_counterparty}]
  key_dates: KeyDate[];       // [{type, date, description}]
  amounts: Amount[];          // [{type, amount, currency, annualized}]
  clauses: Clause[];          // [{clause_type, present, page, excerpt, confidence}]
  obligations: Obligation[];  // [{type, description, party, deadline}]
}
```

### Fase F.3: Enhanced Evaluation (COMPLETED)

**New files:**

| Archivo | Propósito |
|---------|-----------|
| `src/lib/worker/evaluate-phase.ts` | Orchestrates FO evaluation with dependency awareness |
| `src/lib/worker/dependency-resolver.ts` | Topological sort of FOs into evaluation waves |

**New columns:**
- `dd_finding_objectives.depends_on TEXT[]` — FO dependency keys

### Fase F.4: Conclusions Engine (COMPLETED)

**New tables:**

| Tabla | Propósito |
|-------|-----------|
| `dd_area_conclusions` | Area-level conclusions with risk scores, recommendations, patterns |

**New files:**

| Archivo | Propósito |
|---------|-----------|
| `src/lib/worker/conclude-phase.ts` | Generates area conclusions with AI-assisted narratives |

### Pendiente (Fase F.5)

- **Fase F.5 (Observability)**: Worker dashboard UI, coverage visualization, alerts

## Incremental RAG + Report Rendering + Two-Level Cache (Feb 2026)

Pipeline incremental de ingesta, análisis y renderizado de informes con cache de dos niveles.

### Migrations (3: 202602280001–202602280003)

| Migration | Cambio |
|-----------|--------|
| `202602280001_vdr_cache_columns.sql` | Añade `content_hash`, `embedding_status`, `embedding_hash`, `last_embedded_at` a `vdr_documents` |
| `202602280002_create_analysis_results.sql` | Crea tabla `dd_analysis_results` (UPSERT acumulativo) |
| `202602280003_create_report_cache_versions.sql` | Crea tablas `dd_report_cache` y `dd_report_versions` |

### Two-Level Cache

| Nivel | Tabla | Clave | Propósito |
|-------|-------|-------|-----------|
| L1 — Documento | `vdr_documents.content_hash` | SHA-256 del contenido | Skip re-parsing si el documento no cambió |
| L2 — Informe | `dd_report_cache.evidence_hash` | SHA-256 de content_hashes ordenados | Skip re-generación si la evidencia no cambió |

TTL por cadencia de template: daily=24h, weekly=7d, monthly/on_demand=30d.

### Multi-Query RAG

`src/lib/vdr/multi-query-retrieval.ts` — SECTION_QUERY_MAP con 100+ entradas mapeando cada `required_section` de los 35 templates a queries semánticas específicas. `multiQueryRetrieval()` ejecuta una query pgvector por sección requerida del report_type.

### Files

| Archivo | Propósito |
|---------|-----------|
| `src/lib/vdr/content-hash.ts` | `computeContentHash()` y `computeEvidenceHash()` (SHA-256) |
| `src/lib/vdr/multi-query-retrieval.ts` | SECTION_QUERY_MAP + `multiQueryRetrieval()` |
| `src/lib/reporting/analysis-results.ts` | UPSERT acumulativo, cache check, store, invalidate |
| `src/lib/reporting/report-engine.ts` | ReportTemplate interface, `has_dedicated_template` flag |
| `src/lib/reporting/templates.ts` | 35 templates en 5 familias (7 con template HTML dedicado) |
| `src/app/api/reports/pdf/route.ts` | PDF on-demand via Puppeteer (GET) |
| `src/app/api/reports/md/route.ts` | Markdown download (GET) |

### n8n Workflows (3)

| Workflow | n8n ID | Webhook | Estado |
|----------|--------|---------|--------|
| dd_ingest_pipeline | `HeenX8fGJV8PyuJX` | `/webhook/dd-ingest-pipeline` | Inactivo (pendiente credenciales Supabase) |
| dd_report_orchestrator | `9GZKI27F4bKQJMhC` | `/webhook/dd-report-orchestrator` | Inactivo (pendiente credenciales Supabase) |
| dd_report_render | `lhHRkEuOpPR4V9YV` | `/webhook/dd-report-render` | Inactivo (sin credenciales necesarias) |

Archivos JSON en `n8n/dd_ingest_pipeline.workflow.json`, `n8n/dd_report_orchestrator.workflow.json`, `n8n/dd_report_render.workflow.json`.

### Report Templates (35, 5 familias)

| Familia | Count | Con template HTML dedicado |
|---------|-------|----------------------------|
| Transactional | 15 | societario_standard |
| PMO | 8 | pmo_estado |
| Compliance | 7 | red_flags_digest, ip_report |
| Negotiation | 4 | negotiation_summary |
| Consolidated | 1 | deal_summary_executive, executive_digest |

## Architecture & Guidelines

- [Architecture & Patterns](.claude/docs/architecture.md)
- [Database & Migrations](.claude/docs/database.md)
- [API Conventions](.claude/docs/api-conventions.md)
- [Frontend & Components](.claude/docs/frontend.md)
- [AI Pipeline & Harvey](.claude/docs/ai-pipeline.md)
- [Testing](.claude/docs/testing.md)
- [Refactor Plan (Strangler Fig)](.claude/docs/refactor-plan.md)
- [Workflow Spec v1 Evolution Plan](docs/plans/2026-02-22-workflow-spec-v1-evolution.md)
- [Incremental RAG + Render + Cache Design](docs/plans/2026-02-23-incremental-rag-render-cache-design.md)
- [Incremental RAG + Render + Cache Plan](docs/plans/2026-02-23-incremental-rag-render-cache-plan.md)
