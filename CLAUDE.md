# DD Legal PMO

Plataforma interna de Due Diligence legal: Next.js 14 + Supabase + Harvey AI + n8n. Gestiona proyectos DD end-to-end con 63 skills, 31 report templates, Evidence Pack, Kanban, VDR y War Room.

## Commands

- `npm run dev` — Dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx playwright test` — E2E tests
- `npm run test:api` — API specs societario
- `npm run test:page` — Page specs societario

## Critical Rules

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Only in `src/app/api/` routes.
- **NEVER** edit `.env.local` or `.env.production` files directly.
- All new DB tables **MUST** have RLS enabled + policies.
- HITL is **mandatory** for CONT, LAB, FISC, LIT area outputs.
- Path alias: `@/*` maps to `./src/*`.
- Design system: Garrigues tokens in `src/styles/tokens.css` — use `--g-*` CSS variables, never hardcode colors.
- Migration naming: `YYYYMMDDNNNN_snake_case.sql` (e.g., `202602210006_new_feature.sql`).

## Architecture & Guidelines

- [Architecture & Patterns](.claude/docs/architecture.md)
- [Database & Migrations](.claude/docs/database.md)
- [API Conventions](.claude/docs/api-conventions.md)
- [Frontend & Components](.claude/docs/frontend.md)
- [AI Pipeline & Harvey](.claude/docs/ai-pipeline.md)
- [Testing](.claude/docs/testing.md)
- [Refactor Plan (Strangler Fig)](.claude/docs/refactor-plan.md)
