# Design: S4 (VDR v2 + Vectorización) + S6 (War Room)
**Date**: 2026-02-21
**Status**: Approved
**Branch**: feat/prd-v3-strangler-slices

## Context
PRD v3.0 defines two remaining P1 slices: S4 (VDR vectorization + semantic search) and S6 (War Room for negotiation). pgvector 0.8.0 is already installed. VDR v1.5 tables exist. Negotiation module exists with contingencies, SPA clauses, and alerts.

## S4: VDR v2 + Vectorización

### Architecture
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Index**: HNSW via pgvector (cosine distance)
- **Chunking**: Section-aware, ~500 tokens, 50 token overlap
- **Pipeline**: Async ingestion jobs (document → text → chunks → embeddings → index)

### New Tables
```sql
vdr_chunks (
  id UUID PK,
  document_id FK → vdr_documents,
  version_id FK → vdr_document_versions,
  content TEXT,
  embedding vector(1536),
  chunk_index INT,
  page_number INT,
  section_title TEXT,
  category TEXT,
  token_count INT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
-- HNSW index on embedding column (cosine)

vdr_ingestion_jobs (
  id UUID PK,
  document_id FK → vdr_documents,
  version_id FK → vdr_document_versions,
  status 'pending'|'processing'|'completed'|'failed',
  chunks_created INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

### New API Routes
- `POST /api/vdr/ingest` — Start ingestion job for a document version
- `GET /api/vdr/ingest/[id]` — Check job status
- `POST /api/vdr/search/semantic` — Semantic search with threshold + limit

### New Library Files
- `src/lib/embeddings/openai.ts` — OpenAI embedding client with batching + retry
- `src/lib/embeddings/index.ts` — Barrel export
- `src/lib/vdr/chunker.ts` — Section-aware text chunking
- `src/lib/vdr/ingest.ts` — Ingestion pipeline orchestrator
- `src/lib/vdr/semantic-search.ts` — pgvector similarity search helper

### RLS
- `vdr_chunks`: SELECT via project membership (join through vdr_documents)
- `vdr_ingestion_jobs`: SELECT/INSERT via project membership

## S6: War Room

### Architecture
- Aggregation layer over existing tables (dd_contingencies, dd_kanban_tasks, dd_negotiation_alerts)
- New decision log table for audit trail
- Role-based visibility (cliente_externo sees only client_visible items)

### New Tables
```sql
dd_war_room_decisions (
  id UUID PK,
  project_id FK → dd_projects,
  contingency_id FK → dd_contingencies (nullable),
  alert_id FK → dd_negotiation_alerts (nullable),
  decision_type 'accept_risk'|'mitigate'|'transfer'|'reject'|'defer'|'escalate',
  title TEXT,
  rationale TEXT,
  evidence_refs JSONB DEFAULT '[]',
  decided_by UUID FK → auth.users,
  decided_at TIMESTAMPTZ DEFAULT now(),
  client_visible BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

dd_war_room_notifications (
  id UUID PK,
  project_id FK → dd_projects,
  notification_type 'severity_change'|'new_blocker'|'request_overdue'|'decision_required'|'red_flag_new',
  title TEXT,
  description TEXT,
  severity 'critical'|'high'|'medium'|'low',
  source_type TEXT,
  source_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_by UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### New API Routes
- `GET /api/war-room/[project_id]` — Aggregated dashboard (red flags, blockers, progress, decisions)
- `POST /api/war-room/[project_id]/decisions` — Record decision with evidence
- `GET /api/war-room/[project_id]/red-flags` — Detailed red flags with scoring + evidence
- `POST /api/war-room/[project_id]/export` — Export to JSON/Excel

### New Page
- `/projects/[id]/war-room/page.tsx` — Executive view

### RLS
- `dd_war_room_decisions`: SELECT/INSERT via project role, client sees only client_visible=true
- `dd_war_room_notifications`: SELECT via project role, INSERT service_role only

## Implementation Slots (Parallel)

| Slot | Work | Files | Dependencies |
|------|------|-------|-------------|
| A | S4 Migration + Types | 1 SQL, types in supabase.ts | pgvector installed ✓ |
| B | S4 Embedding service + Chunker | 4 TS files | None |
| C | S4 API routes (ingest + search) | 3 route files | Slot A types |
| D | S6 Migration + Types + APIs | 1 SQL, 4 route files, types | Existing tables |
| E | S6 War Room page + Export | 1 page, 1 util | Slot D APIs |

## E2E Tests
- `e2e/17-vdr-vectorization.spec.ts` — Ingest, search, job status
- `e2e/18-war-room.spec.ts` — Dashboard, decisions, red flags, export
