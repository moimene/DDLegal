# DD Legal PMO

Plataforma interna de Due Diligence legal: Next.js 14 + Supabase + Harvey AI + n8n. Gestiona proyectos DD end-to-end con 16 workflow templates (6 fases DD, 16/16 published), 57 skills, 31 report templates, Evidence Pack, Kanban, VDR, War Room y Observabilidad. 109 API routes, 29 E2E suites, 40 migrations. 3 proyectos sinteticos (GREEN/AMBER/RED) con datos completos para demo. **Desplegado en produccion**: `dd-legal-pmo.vercel.app`.

## Stack

- **Frontend**: Next.js 14 (App Router), React 18, Zustand, TanStack Table, Lucide icons, Montserrat (Garrigues)
- **Backend**: Next.js API routes (109 endpoints), Supabase (Postgres + RLS + pgvector + BM25)
- **AI**: Harvey AI gateway, OpenAI embeddings (text-embedding-3-small, 1536d)
- **Infra**: Vercel (produccion: `dd-legal-pmo.vercel.app`), Supabase hosted, n8n workflows
- **Tests**: Playwright E2E (29 suites, 257+ tests), Vitest unit tests

## Commands

- `npm run dev` — Dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run test` / `npx playwright test` — E2E tests (all 29 suites)
- `npm run test:api` — API specs societario
- `npm run test:page` — Page specs societario
- `npm run test:ui` — Playwright UI mode

## Project Structure

```
src/
  app/
    api/                    # 109 API routes across 30+ groups
      ai/                   # classify, suggest
      alerts/               # SLA alerts
      auth/                 # login, me, roles, setup-test-users
      contingencies/        # PATCH severity, GET single
      evidence/             # link-chunks, pack builder (Evidence Pack v2)
      gateway/              # Harvey AI proxy (whoami, health, completion)
      kanban/               # board, metrics, tasks CRUD + move + alerts
      cron/                  # Vercel Cron: audit-sync (15-min telemetry flush)
      observability/        # SLO dashboard (workflow phases), telemetry ingestion, alerts
      vdr/                  # documents, folders, bulk, search, audit
        ingest/             # S4: async vectorization pipeline
        search/semantic/    # S4: pgvector semantic search
        rag/query/          # S0: Vault RAG query endpoint
        vault/sync/         # S4→S0: VDR to Harvey Vault sync
      reports/              # Report generation: final, red-flags, workflow
      scoring/              # H3: Deal Risk Score (POST/GET per project)
      war-room/             # S6: dashboard, decisions, red-flags, export, negotiation-actions, spa-mapping, timeline, negotiation-dashboard, decision-resolution
      tasks/                # [id]/status PATCH (authenticated task status update)
      workflows/            # templates, instantiate, instances, phase, list, execute
      # + 16 more: client, configuracion, documents, events, evidence,
      #   harvey, hitl, ip, negotiation, notifications, projects, qa,
      #   reports, skills, societario, system, tools
    login/                  # Login page with demo user selection + auto-fill
    (pages)/                # Next.js pages with App Router
  components/               # 13 component groups (dashboards, vdr, reports...)
  contexts/
    UserContext.tsx          # Auth state, login/logout, role management
  lib/
    auth/                   # require-permission middleware
    embeddings/             # OpenAI embedding client (batch, retry)
    harvey/                 # Harvey AI gateway (circuit breaker + Retry-After + per-family rate limits) + factory
    observability/          # Telemetry writer
    vdr/                    # Chunker, ingest pipeline, semantic search, hybrid search (BM25+pgvector), adaptive chunking
    war-room/               # Notifications, severity bridge
    scoring/                # Deal Risk Score engine (severity×probability×timing×area weighting)
    reporting/              # Report engine, evidence pack builder, red flag generator, final report compiler
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
  migrations/               # 40 SQL migrations (RLS, pgvector, seeds, kanban, workflows, observability, security hardening, BM25, H3 scoring, seed_v3_schema)
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

8 usuarios demo en Supabase Auth. Login page (`/login`) permite seleccion directa con auto-fill de credenciales.

| Email | Password | Rol | UUID |
|-------|----------|-----|------|
| admin@ddlegal.com | admin123456 | Superusuario (admin) | `aaaa0001-0000-4000-8000-000000000000` |
| clo@test.ddlegal.com | test123456 | CLO / Director Legal | `aaaa0001-0001-4000-8000-000000000001` |
| pm@test.ddlegal.com | test123456 | PM Transaccion | `aaaa0001-0002-4000-8000-000000000002` |
| abogado.merc@test.ddlegal.com | test123456 | Abogado Mercantil | `aaaa0001-0003-4000-8000-000000000003` |
| sponsor@test.ddlegal.com | test123456 | Deal Sponsor | `aaaa0001-0004-4000-8000-000000000004` |
| target@test.ddlegal.com | test123456 | Contacto Target | `aaaa0001-0005-4000-8000-000000000005` |
| stakeholder@test.ddlegal.com | test123456 | Stakeholder Negocio | `aaaa0001-0006-4000-8000-000000000006` |
| cliente@test.ddlegal.com | test123456 | Cliente Externo | `aaaa0001-0007-4000-8000-000000000007` |

Demo project: `a1b2c3d4-0001-4000-8000-000000000001` (FMC Due Diligence - Prototipo).
Seed migration: `supabase/migrations/202602270001_seed_demo_users.sql`.

### Extended Test Users (seed v3)

8 additional users created for project role testing (total 16 in auth.users):

| Email | Rol | UUID |
|-------|-----|------|
| abogado.cont@test.ddlegal.com | Abogado Contractual | `aaaa0001-0008-...` |
| abogado.fisc@test.ddlegal.com | Abogado Fiscal | `aaaa0001-0009-...` |
| abogado.pi@test.ddlegal.com | Abogado PI | `aaaa0001-000a-...` |
| abogado.lab@test.ddlegal.com | Abogado Laboral | `aaaa0001-000b-...` |
| abogado.lit@test.ddlegal.com | Abogado Litigios | `aaaa0001-000c-...` |
| abogado.adm@test.ddlegal.com | Abogado ADM | `aaaa0001-000d-...` |
| former@test.ddlegal.com | Inactive user (former) | `aaaa0001-000e-...` |
| expired@test.ddlegal.com | Expired user | `aaaa0001-000f-...` |

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
- Migration naming: `YYYYMMDDNNNN_snake_case.sql` (e.g., `202602270001_seed_demo_users.sql`). Next available: `202602270014`.
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

## Architecture & Guidelines

- [Architecture & Patterns](.claude/docs/architecture.md)
- [Database & Migrations](.claude/docs/database.md)
- [API Conventions](.claude/docs/api-conventions.md)
- [Frontend & Components](.claude/docs/frontend.md)
- [AI Pipeline & Harvey](.claude/docs/ai-pipeline.md)
- [Testing](.claude/docs/testing.md)
- [Refactor Plan (Strangler Fig)](.claude/docs/refactor-plan.md)
- [Workflow Spec v1 Evolution Plan](docs/plans/2026-02-22-workflow-spec-v1-evolution.md)
