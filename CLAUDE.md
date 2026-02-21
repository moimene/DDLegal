# DD Legal PMO

Plataforma interna de Due Diligence legal: Next.js 14 + Supabase + Harvey AI + n8n. Gestiona proyectos DD end-to-end con 63 skills, 31 report templates, Evidence Pack, Kanban, VDR, War Room y Observabilidad.

## Stack

- **Frontend**: Next.js 14 (App Router), React 18, Zustand, TanStack Table, Lucide icons
- **Backend**: Next.js API routes (79 endpoints), Supabase (Postgres + RLS + pgvector)
- **AI**: Harvey AI gateway, OpenAI embeddings (text-embedding-3-small, 1536d)
- **Infra**: Vercel (produccion), Supabase hosted, n8n workflows
- **Tests**: Playwright E2E (21 suites, 150+ tests)

## Commands

- `npm run dev` — Dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run test` / `npx playwright test` — E2E tests (all 21 suites)
- `npm run test:api` — API specs societario
- `npm run test:page` — Page specs societario
- `npm run test:ui` — Playwright UI mode

## Project Structure

```
src/
  app/
    api/                    # 79 API routes across 26 groups
      ai/                   # classify, suggest
      alerts/               # SLA alerts
      auth/                 # login, me, roles
      gateway/              # Harvey AI proxy (whoami, health, completion)
      kanban/               # board, metrics, tasks CRUD + move
      observability/        # SLO dashboard, telemetry ingestion
      vdr/                  # documents, folders, bulk, search, audit
        ingest/             # S4: async vectorization pipeline
        search/semantic/    # S4: pgvector semantic search
      war-room/             # S6: dashboard, decisions, red-flags, export
      workflows/            # list, execute (Strangler workflow engine)
      # + 16 more: client, configuracion, documents, events, evidence,
      #   harvey, hitl, ip, negotiation, notifications, projects, qa,
      #   reports, skills, societario, system, tools
    (pages)/                # Next.js pages with App Router
  components/               # 13 component groups (dashboards, vdr, reports...)
  lib/
    auth/                   # require-permission middleware
    embeddings/             # OpenAI embedding client (batch, retry)
    harvey/                 # Harvey AI gateway + factory
    observability/          # Telemetry writer
    vdr/                    # Chunker, ingest pipeline, semantic search
    workflows/              # Strangler workflow engine + constants
    supabase.ts             # Types + client (service_role + anon)
    utils.ts                # Helpers, configs, constants
  middleware.ts             # Auth + feature flag middleware
supabase/
  migrations/               # 27 SQL migrations (RLS, pgvector, seeds)
e2e/                        # 21 Playwright test suites
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

## Critical Rules

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Only in `src/app/api/` routes.
- **NEVER** edit `.env.local` or `.env.production` files directly.
- All new DB tables **MUST** have RLS enabled + policies.
- HITL is **mandatory** for CONT, LAB, FISC, LIT area outputs.
- Path alias: `@/*` maps to `./src/*`.
- Design system: Garrigues tokens in `src/styles/tokens.css` — use `--g-*` CSS variables, never hardcode colors.
- Migration naming: `YYYYMMDDNNNN_snake_case.sql` (e.g., `202602210006_new_feature.sql`). Next available: `202602270001`.
- Next.js dynamic params use `{ params }: { params: Promise<{ id: string }> }` pattern.
- pgvector embeddings are 1536 dimensions (OpenAI text-embedding-3-small). HNSW index with cosine distance.
- Supabase RPC: `match_vdr_chunks` for semantic search. Never call pgvector directly from client.

## Environment Variables

Required in `.env.local` (never commit):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)
- `HARVEY_API_KEY` — Harvey AI API key
- `HARVEY_ENDPOINT` — Harvey API endpoint
- `HARVEY_HISTORY_ENDPOINT` — Harvey history endpoint
- `OPENAI_API_KEY` — OpenAI API key (for embeddings in S4)

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
