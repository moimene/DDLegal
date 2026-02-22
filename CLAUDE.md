# DD Legal PMO

Plataforma interna de Due Diligence legal: Next.js 14 + Supabase + Harvey AI + n8n. Gestiona proyectos DD end-to-end con 63 skills, 31 report templates, Evidence Pack, Kanban, VDR, War Room y Observabilidad. 94+ endpoints, 25 suites.

## Stack

- **Frontend**: Next.js 14 (App Router), React 18, Zustand, TanStack Table, Lucide icons, Montserrat (Garrigues)
- **Backend**: Next.js API routes (94+ endpoints), Supabase (Postgres + RLS + pgvector)
- **AI**: Harvey AI gateway, OpenAI embeddings (text-embedding-3-small, 1536d)
- **Infra**: Vercel (produccion), Supabase hosted, n8n workflows
- **Tests**: Playwright E2E (25 suites, 180+ tests)

## Commands

- `npm run dev` — Dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run test` / `npx playwright test` — E2E tests (all 25 suites)
- `npm run test:api` — API specs societario
- `npm run test:page` — Page specs societario
- `npm run test:ui` — Playwright UI mode

## Project Structure

```
src/
  app/
    api/                    # 94+ API routes across 30+ groups
      ai/                   # classify, suggest
      alerts/               # SLA alerts
      auth/                 # login, me, roles, setup-test-users
      contingencies/        # PATCH severity, GET single
      evidence/             # link-chunks, pack builder (Evidence Pack v2)
      gateway/              # Harvey AI proxy (whoami, health, completion)
      kanban/               # board, metrics, tasks CRUD + move + alerts
      observability/        # SLO dashboard, telemetry ingestion
      vdr/                  # documents, folders, bulk, search, audit
        ingest/             # S4: async vectorization pipeline
        search/semantic/    # S4: pgvector semantic search
        rag/query/          # S0: Vault RAG query endpoint
        vault/sync/         # S4→S0: VDR to Harvey Vault sync
      war-room/             # S6: dashboard, decisions, red-flags, export
      workflows/            # list, execute (Strangler workflow engine)
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
    harvey/                 # Harvey AI gateway + factory
    observability/          # Telemetry writer
    vdr/                    # Chunker, ingest pipeline, semantic search
    war-room/               # Notifications, severity bridge
    reporting/              # Report engine, evidence pack builder
    workflows/              # Strangler workflow engine + constants
    supabase.ts             # Types + client (service_role + anon)
    supabase-auth.ts        # ProjectRole type, ROLE_PERMISSIONS matrix
    utils.ts                # Helpers, configs, constants
  styles/
    tokens.css              # Garrigues design tokens (--g-* CSS variables)
  middleware.ts             # Auth + feature flag middleware
supabase/
  migrations/               # 31 SQL migrations (RLS, pgvector, seeds, kanban, observability)
e2e/                        # 25 Playwright test suites
```

## Strangler Slices (v3.0) — All deployed

| Slice | Nombre | Estado |
|-------|--------|--------|
| S0 | Harvey Gateway | ✅ Produccion |
| S1 | Auth + RLS + Middleware | ✅ Produccion |
| S2 | Kanban Tasks | ✅ Produccion |
| S3 | Workflow Engine | ✅ Produccion |
| S4 | VDR Vectorizacion (pgvector + embeddings) | ✅ Produccion |
| S5 | Observabilidad (SLOs + telemetria) | ✅ Produccion |
| S6 | War Room (decisiones + red flags) | ✅ Produccion |

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

**GoTrue gotcha**: `email_change` column in `auth.users` MUST be `''` (empty string), not NULL. GoTrue's Go code scans it as `string` type which cannot handle NULL.

## Sprint Progress (Feb 2026)

| Day | Scope | Commit | Lines |
|-----|-------|--------|-------|
| Day 1 | Skills, workflows 4+6, audit ingest, SLO, kanban, war room | `16394b9` | +2,319 |
| Day 2 | Vault RAG, p95 SLO, Arranque DD backlog, kanban alerts, DoR UX | `770c724` | +704 |
| Day 3 | Severity notifications, Evidence Pack v2, VDR→Vault sync | `f19ec01` | +843 |
| Day 4 | 28 E2E tests covering all sprint features | `b69c81a` | +588 |
| Day 5 | Hardening + Documentation (tsc fixes, CLAUDE.md, PRD.md) | `a4b9b06` | +72 |

## Critical Rules

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Only in `src/app/api/` routes.
- **NEVER** edit `.env.local` or `.env.production` files directly.
- All new DB tables **MUST** have RLS enabled + policies.
- HITL is **mandatory** for CONT, LAB, FISC, LIT area outputs.
- Path alias: `@/*` maps to `./src/*`.
- Design system: Garrigues tokens in `src/styles/tokens.css` — use `--g-*` CSS variables, never hardcode colors. Brand: `--g-brand-3308: #004438`. Font: Montserrat.
- Migration naming: `YYYYMMDDNNNN_snake_case.sql` (e.g., `202602270001_seed_demo_users.sql`). Next available: `202602270002`.
- Next.js dynamic params use `{ params }: { params: Promise<{ id: string }> }` pattern.
- pgvector embeddings are 1536 dimensions (OpenAI text-embedding-3-small). HNSW index with cosine distance.
- Supabase RPC: `match_vdr_chunks` for semantic search. Never call pgvector directly from client.
- Auth login via `POST /api/auth/login` → returns `{ session: { access_token } }`. Token stored in `localStorage` as `dd_session_token`. All API calls use `Authorization: Bearer <token>`.

## Environment Variables

Required in `.env.local` (never commit):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)
- `HARVEY_API_KEY` — Harvey AI API key
- `HARVEY_ENDPOINT` — Harvey API endpoint
- `HARVEY_HISTORY_ENDPOINT` — Harvey history endpoint
- `HARVEY_FEATURE_FLAG` — `gateway` | `n8n` | `shadow` (controls Harvey routing)
- `OPENAI_API_KEY` — OpenAI API key (for embeddings in S4)
- `HARVEY_ENDPOINT_V1` — Harvey completion endpoint (EU region)
- `HARVEY_ENDPOINT_HISTORY` — Harvey history/audit endpoint
- `HARVEY_TOKEN` — Harvey bearer token (server only)

## Deployment

- **Production**: `dd-legal-pmo.vercel.app` (auto-deploy from `main`)
- **Preview**: auto-deploy from PR branches
- **Supabase**: project `mxanelzxyaklvuypuafa`
- **Repo**: `github.com/moimene/DDLegal` (private)

## Architecture & Guidelines

- [Architecture & Patterns](.claude/docs/architecture.md)
- [Database & Migrations](.claude/docs/database.md)
- [API Conventions](.claude/docs/api-conventions.md)
- [Frontend & Components](.claude/docs/frontend.md)
- [AI Pipeline & Harvey](.claude/docs/ai-pipeline.md)
- [Testing](.claude/docs/testing.md)
- [Refactor Plan (Strangler Fig)](.claude/docs/refactor-plan.md)
