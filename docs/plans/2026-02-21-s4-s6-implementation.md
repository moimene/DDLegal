# S4 (VDR v2 Vectorization) + S6 (War Room) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add semantic search to VDR via pgvector + OpenAI embeddings, and build War Room aggregation layer with decision log.

**Architecture:** S4 adds vdr_chunks + vdr_ingestion_jobs tables, an OpenAI embedding service, section-aware chunker, and 3 API routes. S6 adds dd_war_room_decisions + dd_war_room_notifications tables, 4 API routes that aggregate existing negotiation/kanban/alert data, and E2E tests. Both use supabaseAdmin pattern from `src/lib/supabase-admin.ts` with NextRequest/NextResponse API routes.

**Tech Stack:** Next.js 14 API Routes, Supabase (pgvector 0.8.0 installed), OpenAI text-embedding-3-small (1536d), TypeScript

---

## Task 1: S4 Migration — vdr_chunks + vdr_ingestion_jobs

**Files:**
- Create: `supabase/migrations/202602210001_vdr_vectorization.sql`

**Step 1: Write the migration**

```sql
-- S4: VDR Vectorization — chunks + ingestion jobs
-- Requires: pgvector extension (already installed as vector 0.8.0)

-- ── vdr_ingestion_jobs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS vdr_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES vdr_document_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  chunks_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_jobs_document ON vdr_ingestion_jobs(document_id);
CREATE INDEX idx_ingestion_jobs_status ON vdr_ingestion_jobs(status);

-- ── vdr_chunks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vdr_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES vdr_document_versions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL DEFAULT 0,
  page_number INTEGER,
  section_title TEXT,
  category TEXT,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_document ON vdr_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON vdr_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE vdr_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vdr_chunks ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_ingestion_jobs" ON vdr_ingestion_jobs
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_chunks" ON vdr_chunks
  FOR ALL USING (auth.role() = 'service_role');

-- Users can SELECT via project membership
CREATE POLICY "select_ingestion_jobs" ON vdr_ingestion_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vdr_documents d
      JOIN dd_project_user_roles pur ON pur.project_id = d.project_id
      WHERE d.id = vdr_ingestion_jobs.document_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND (pur.expires_at IS NULL OR pur.expires_at > now())
    )
  );

CREATE POLICY "select_chunks" ON vdr_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vdr_documents d
      JOIN dd_project_user_roles pur ON pur.project_id = d.project_id
      WHERE d.id = vdr_chunks.document_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND (pur.expires_at IS NULL OR pur.expires_at > now())
    )
  );
```

**Step 2: Apply migration to Supabase**

Use Supabase MCP: `apply_migration(project_id="mxanelzxyaklvuypuafa", name="vdr_vectorization", query=<sql>)`

**Step 3: Verify tables exist**

Use Supabase MCP: `list_tables(project_id="mxanelzxyaklvuypuafa")` — confirm `vdr_chunks` and `vdr_ingestion_jobs` appear.

---

## Task 2: S4 TypeScript Types

**Files:**
- Modify: `src/lib/supabase.ts` (append new interfaces at end)

**Step 1: Add VDR vectorization types**

Append to `src/lib/supabase.ts`:

```typescript
// ── VDR Vectorization (S4) ──────────────────────────────

export interface VDRChunk {
  id: string;
  document_id: string;
  version_id: string | null;
  content: string;
  embedding?: number[];
  chunk_index: number;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VDRIngestionJob {
  id: string;
  document_id: string;
  version_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_created: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SemanticSearchResult {
  chunk_id: string;
  content: string;
  similarity: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
}
```

---

## Task 3: S4 Embedding Service

**Files:**
- Create: `src/lib/embeddings/openai.ts`
- Create: `src/lib/embeddings/index.ts`

**Step 1: Write OpenAI embedding client**

`src/lib/embeddings/openai.ts`:

```typescript
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';
const MAX_BATCH = 100;
const MAX_RETRIES = 3;

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    const embeddings = await fetchWithRetry(batch, apiKey);
    results.push(...embeddings);
  }

  return results;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

async function fetchWithRetry(texts: string[], apiKey: string): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: MODEL, input: texts }),
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
      }

      const body: EmbeddingResponse = await res.json();
      return body.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('Embedding generation failed');
}
```

**Step 2: Write barrel export**

`src/lib/embeddings/index.ts`:

```typescript
export { generateEmbedding, generateEmbeddings } from './openai';
```

---

## Task 4: S4 Chunker + Ingestion Pipeline

**Files:**
- Create: `src/lib/vdr/chunker.ts`
- Create: `src/lib/vdr/ingest.ts`
- Create: `src/lib/vdr/semantic-search.ts`

**Step 1: Write section-aware chunker**

`src/lib/vdr/chunker.ts`:

```typescript
export interface Chunk {
  content: string;
  chunk_index: number;
  page_number: number | null;
  section_title: string | null;
  token_count: number;
}

const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;

// Rough token estimate: 1 token ≈ 4 chars for Spanish/English legal text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string, options?: {
  targetTokens?: number;
  overlapTokens?: number;
}): Chunk[] {
  const target = options?.targetTokens ?? TARGET_TOKENS;
  const overlap = options?.overlapTokens ?? OVERLAP_TOKENS;
  const targetChars = target * 4;
  const overlapChars = overlap * 4;

  if (!text || text.trim().length === 0) return [];

  // Split by sections (headers: lines starting with # or ALL CAPS or numbered)
  const sectionRegex = /^(?:#{1,4}\s+.+|[A-ZÁÉÍÓÚÑ\s]{10,}|(?:\d+\.)+\s+.+)$/gm;
  const sections: Array<{ title: string | null; content: string; pageHint: number | null }> = [];

  let lastIndex = 0;
  let currentTitle: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push({
        title: currentTitle,
        content: text.slice(lastIndex, match.index).trim(),
        pageHint: null,
      });
    }
    currentTitle = match[0].replace(/^#+\s*/, '').trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    sections.push({
      title: currentTitle,
      content: text.slice(lastIndex).trim(),
      pageHint: null,
    });
  }

  if (sections.length === 0) {
    sections.push({ title: null, content: text.trim(), pageHint: null });
  }

  // Chunk each section
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionText = section.content;
    if (!sectionText) continue;

    // Split into paragraphs first
    const paragraphs = sectionText.split(/\n\n+/).filter(p => p.trim());

    let buffer = '';

    for (const para of paragraphs) {
      if (buffer.length + para.length > targetChars && buffer.length > 0) {
        chunks.push({
          content: buffer.trim(),
          chunk_index: chunkIndex++,
          page_number: section.pageHint,
          section_title: section.title,
          token_count: estimateTokens(buffer),
        });

        // Keep overlap
        const words = buffer.split(/\s+/);
        const overlapWords = Math.ceil(overlapChars / 5); // ~5 chars per word
        buffer = words.slice(-overlapWords).join(' ') + '\n\n' + para;
      } else {
        buffer = buffer ? buffer + '\n\n' + para : para;
      }
    }

    if (buffer.trim()) {
      chunks.push({
        content: buffer.trim(),
        chunk_index: chunkIndex++,
        page_number: section.pageHint,
        section_title: section.title,
        token_count: estimateTokens(buffer),
      });
    }
  }

  return chunks;
}
```

**Step 2: Write ingestion pipeline**

`src/lib/vdr/ingest.ts`:

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbeddings } from '@/lib/embeddings';
import { chunkText, Chunk } from './chunker';

export async function startIngestion(documentId: string, versionId?: string): Promise<string> {
  // Create job record
  const { data: job, error } = await supabaseAdmin
    .from('vdr_ingestion_jobs')
    .insert({
      document_id: documentId,
      version_id: versionId || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !job) throw new Error(`Failed to create ingestion job: ${error?.message}`);

  // Run async (don't await — fire and forget)
  processIngestion(job.id, documentId, versionId).catch(err => {
    console.error(`[ingest] Job ${job.id} failed:`, err);
  });

  return job.id;
}

async function processIngestion(jobId: string, documentId: string, versionId?: string) {
  try {
    // Mark processing
    await supabaseAdmin
      .from('vdr_ingestion_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Get document text content
    // For now, we get content from the latest version's change_notes + document description
    // In production, this would OCR/parse the actual file from storage
    const { data: doc } = await supabaseAdmin
      .from('vdr_documents')
      .select('id, name, description, category, area_code, project_id')
      .eq('id', documentId)
      .single();

    if (!doc) throw new Error('Document not found');

    // Get version text if available
    let textContent = doc.description || doc.name;
    if (versionId) {
      const { data: version } = await supabaseAdmin
        .from('vdr_document_versions')
        .select('change_notes')
        .eq('id', versionId)
        .single();
      if (version?.change_notes) {
        textContent = version.change_notes + '\n\n' + textContent;
      }
    }

    // Delete existing chunks for this document
    await supabaseAdmin
      .from('vdr_chunks')
      .delete()
      .eq('document_id', documentId);

    // Chunk the text
    const chunks: Chunk[] = chunkText(textContent);
    if (chunks.length === 0) {
      await supabaseAdmin
        .from('vdr_ingestion_jobs')
        .update({
          status: 'completed',
          chunks_created: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return;
    }

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    // Insert chunks with embeddings
    const rows = chunks.map((chunk, i) => ({
      document_id: documentId,
      version_id: versionId || null,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      category: doc.category,
      token_count: chunk.token_count,
      metadata: { source_document_name: doc.name, area_code: doc.area_code },
    }));

    const { error: insertError } = await supabaseAdmin
      .from('vdr_chunks')
      .insert(rows);

    if (insertError) throw new Error(`Chunk insert failed: ${insertError.message}`);

    // Mark completed
    await supabaseAdmin
      .from('vdr_ingestion_jobs')
      .update({
        status: 'completed',
        chunks_created: chunks.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

  } catch (err) {
    await supabaseAdmin
      .from('vdr_ingestion_jobs')
      .update({
        status: 'failed',
        error_message: (err as Error).message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
```

**Step 3: Write semantic search helper**

`src/lib/vdr/semantic-search.ts`:

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbedding } from '@/lib/embeddings';
import type { SemanticSearchResult } from '@/lib/supabase';

export async function semanticSearch(
  projectId: string,
  query: string,
  options?: { threshold?: number; limit?: number; areaCode?: string }
): Promise<SemanticSearchResult[]> {
  const threshold = options?.threshold ?? 0.7;
  const limit = options?.limit ?? 10;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Use pgvector cosine similarity via RPC or raw SQL
  const { data, error } = await supabaseAdmin.rpc('match_vdr_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: limit,
    filter_project_id: projectId,
    filter_area_code: options?.areaCode || null,
  });

  if (error) throw new Error(`Semantic search failed: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => ({
    chunk_id: row.id as string,
    content: row.content as string,
    similarity: row.similarity as number,
    document_id: row.document_id as string,
    document_name: row.document_name as string,
    page_number: row.page_number as number | null,
    section_title: row.section_title as string | null,
    category: row.category as string | null,
  }));
}
```

---

## Task 5: S4 Semantic Search RPC Function

**Files:**
- Append to migration or apply separately

**Step 1: Create match_vdr_chunks RPC**

Add to migration `202602210001_vdr_vectorization.sql` (or apply as separate migration):

```sql
-- Semantic search RPC function
CREATE OR REPLACE FUNCTION match_vdr_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_project_id uuid DEFAULT NULL,
  filter_area_code text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  document_id uuid,
  document_name text,
  page_number int,
  section_title text,
  category text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.document_id,
    d.name AS document_name,
    c.page_number,
    c.section_title,
    c.category
  FROM vdr_chunks c
  JOIN vdr_documents d ON d.id = c.document_id
  WHERE
    (filter_project_id IS NULL OR d.project_id = filter_project_id)
    AND (filter_area_code IS NULL OR c.category = filter_area_code)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Task 6: S4 API Routes

**Files:**
- Create: `src/app/api/vdr/ingest/route.ts`
- Create: `src/app/api/vdr/ingest/[id]/route.ts`
- Create: `src/app/api/vdr/search/semantic/route.ts`

**Step 1: POST /api/vdr/ingest**

`src/app/api/vdr/ingest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { startIngestion } from '@/lib/vdr/ingest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { document_id, version_id } = body;

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id required' },
        { status: 400 }
      );
    }

    const jobId = await startIngestion(document_id, version_id);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      message: 'Ingestion started',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 2: GET /api/vdr/ingest/[id]**

`src/app/api/vdr/ingest/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from('vdr_ingestion_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, job });
}
```

**Step 3: POST /api/vdr/search/semantic**

`src/app/api/vdr/search/semantic/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/vdr/semantic-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, query, threshold, limit, area_code } = body;

    if (!project_id || !query) {
      return NextResponse.json(
        { success: false, error: 'project_id and query required' },
        { status: 400 }
      );
    }

    const results = await semanticSearch(project_id, query, {
      threshold: threshold ?? 0.7,
      limit: limit ?? 10,
      areaCode: area_code,
    });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

---

## Task 7: S6 Migration — War Room Tables

**Files:**
- Create: `supabase/migrations/202602210002_war_room.sql`

**Step 1: Write the migration**

```sql
-- S6: War Room — decisions + notifications

CREATE TABLE IF NOT EXISTS dd_war_room_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  contingency_id UUID REFERENCES dd_contingencies(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES dd_negotiation_alerts(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL
    CHECK (decision_type IN ('accept_risk','mitigate','transfer','reject','defer','escalate')),
  title TEXT NOT NULL,
  rationale TEXT,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ DEFAULT now(),
  client_visible BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wr_decisions_project ON dd_war_room_decisions(project_id);
CREATE INDEX idx_wr_decisions_type ON dd_war_room_decisions(decision_type);

CREATE TABLE IF NOT EXISTS dd_war_room_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'severity_change','new_blocker','request_overdue',
      'decision_required','red_flag_new'
    )),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical','high','medium','low')),
  source_type TEXT,
  source_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_by UUID REFERENCES auth.users(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wr_notif_project ON dd_war_room_notifications(project_id);
CREATE INDEX idx_wr_notif_unread ON dd_war_room_notifications(project_id, is_read) WHERE NOT is_read;

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE dd_war_room_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_war_room_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_wr_decisions" ON dd_war_room_decisions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_wr_notif" ON dd_war_room_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Users SELECT via project membership
CREATE POLICY "select_wr_decisions" ON dd_war_room_decisions
  FOR SELECT USING (
    public.user_has_project_role(project_id)
  );

CREATE POLICY "insert_wr_decisions" ON dd_war_room_decisions
  FOR INSERT WITH CHECK (
    public.user_has_permission(project_id, 'manage_contingencies')
  );

CREATE POLICY "select_wr_notif" ON dd_war_room_notifications
  FOR SELECT USING (
    public.user_has_project_role(project_id)
  );

CREATE POLICY "update_wr_notif" ON dd_war_room_notifications
  FOR UPDATE USING (
    public.user_has_project_role(project_id)
  );
```

**Step 2: Apply migration**

Use Supabase MCP: `apply_migration(project_id="mxanelzxyaklvuypuafa", name="war_room", query=<sql>)`

---

## Task 8: S6 TypeScript Types

**Files:**
- Modify: `src/lib/supabase.ts` (append)

**Step 1: Add War Room types**

```typescript
// ── War Room (S6) ───────────────────────────────────────

export type WarRoomDecisionType = 'accept_risk' | 'mitigate' | 'transfer' | 'reject' | 'defer' | 'escalate';

export interface DDWarRoomDecision {
  id: string;
  project_id: string;
  contingency_id: string | null;
  alert_id: string | null;
  decision_type: WarRoomDecisionType;
  title: string;
  rationale: string | null;
  evidence_refs: unknown[];
  decided_by: string | null;
  decided_at: string;
  client_visible: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type WarRoomNotificationType = 'severity_change' | 'new_blocker' | 'request_overdue' | 'decision_required' | 'red_flag_new';

export interface DDWarRoomNotification {
  id: string;
  project_id: string;
  notification_type: WarRoomNotificationType;
  title: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source_type: string | null;
  source_id: string | null;
  is_read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
}

export interface WarRoomDashboard {
  project_id: string;
  red_flags: Array<{
    id: string;
    title: string;
    severity: string;
    area_code: string;
    status: string;
    evidence: string[];
    recommendation: string;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    area_code: string;
    state: string;
    entered_state_at: string;
    assigned_to: string | null;
  }>;
  progress: Array<{
    area_code: string;
    total_tasks: number;
    completed_tasks: number;
    blocked_tasks: number;
    pct_complete: number;
  }>;
  decisions: DDWarRoomDecision[];
  notifications: DDWarRoomNotification[];
}
```

---

## Task 9: S6 War Room API Routes

**Files:**
- Create: `src/app/api/war-room/[project_id]/route.ts`
- Create: `src/app/api/war-room/[project_id]/decisions/route.ts`
- Create: `src/app/api/war-room/[project_id]/red-flags/route.ts`
- Create: `src/app/api/war-room/[project_id]/export/route.ts`

**Step 1: GET /api/war-room/[project_id] — Dashboard**

`src/app/api/war-room/[project_id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  try {
    // Parallel queries
    const [alertsRes, blockersRes, tasksRes, decisionsRes, notifsRes] = await Promise.all([
      // Red flags (negotiation alerts)
      supabaseAdmin
        .from('dd_negotiation_alerts')
        .select('*')
        .eq('project_id', project_id)
        .in('severity', ['critical', 'high'])
        .order('created_at', { ascending: false })
        .limit(20),
      // Blockers (kanban tasks in bloqueado state)
      supabaseAdmin
        .from('dd_kanban_tasks')
        .select('id, title, area_code, state, entered_state_at, assigned_to')
        .eq('project_id', project_id)
        .eq('state', 'bloqueado')
        .order('entered_state_at', { ascending: true }),
      // All kanban tasks for progress calculation
      supabaseAdmin
        .from('dd_kanban_tasks')
        .select('area_code, state')
        .eq('project_id', project_id),
      // Recent decisions
      supabaseAdmin
        .from('dd_war_room_decisions')
        .select('*')
        .eq('project_id', project_id)
        .order('decided_at', { ascending: false })
        .limit(20),
      // Unread notifications
      supabaseAdmin
        .from('dd_war_room_notifications')
        .select('*')
        .eq('project_id', project_id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Calculate progress per area
    const tasksByArea: Record<string, { total: number; completed: number; blocked: number }> = {};
    for (const task of tasksRes.data || []) {
      if (!tasksByArea[task.area_code]) {
        tasksByArea[task.area_code] = { total: 0, completed: 0, blocked: 0 };
      }
      tasksByArea[task.area_code].total++;
      if (['conclusion', 'integrado_en_informe'].includes(task.state)) {
        tasksByArea[task.area_code].completed++;
      }
      if (task.state === 'bloqueado') {
        tasksByArea[task.area_code].blocked++;
      }
    }

    const progress = Object.entries(tasksByArea).map(([area_code, stats]) => ({
      area_code,
      total_tasks: stats.total,
      completed_tasks: stats.completed,
      blocked_tasks: stats.blocked,
      pct_complete: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));

    return NextResponse.json({
      success: true,
      project_id,
      red_flags: (alertsRes.data || []).map(a => ({
        id: a.id,
        title: a.titulo,
        severity: a.severity,
        area_code: a.area_code,
        status: a.status,
        evidence: a.evidencia || [],
        recommendation: a.recomendacion,
      })),
      blockers: blockersRes.data || [],
      progress,
      decisions: decisionsRes.data || [],
      notifications: notifsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 2: POST /api/war-room/[project_id]/decisions**

`src/app/api/war-room/[project_id]/decisions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;
  const userId = req.headers.get('x-user-id');

  try {
    const body = await req.json();
    const { decision_type, title, rationale, contingency_id, alert_id, evidence_refs, client_visible } = body;

    if (!decision_type || !title) {
      return NextResponse.json(
        { success: false, error: 'decision_type and title required' },
        { status: 400 }
      );
    }

    const validTypes = ['accept_risk', 'mitigate', 'transfer', 'reject', 'defer', 'escalate'];
    if (!validTypes.includes(decision_type)) {
      return NextResponse.json(
        { success: false, error: `decision_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('dd_war_room_decisions')
      .insert({
        project_id,
        decision_type,
        title,
        rationale: rationale || null,
        contingency_id: contingency_id || null,
        alert_id: alert_id || null,
        evidence_refs: evidence_refs || [],
        decided_by: userId || null,
        client_visible: client_visible ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, decision: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  const { data, error } = await supabaseAdmin
    .from('dd_war_room_decisions')
    .select('*')
    .eq('project_id', project_id)
    .order('decided_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, decisions: data || [] });
}
```

**Step 3: GET /api/war-room/[project_id]/red-flags**

`src/app/api/war-room/[project_id]/red-flags/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;
  const severity = req.nextUrl.searchParams.get('severity');

  try {
    // Get negotiation alerts as red flags
    let alertQuery = supabaseAdmin
      .from('dd_negotiation_alerts')
      .select('*')
      .eq('project_id', project_id)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false });

    if (severity) {
      alertQuery = alertQuery.eq('severity', severity);
    }

    // Get critical contingencies as additional red flags
    let contQuery = supabaseAdmin
      .from('dd_contingencies')
      .select('*, dd_contingencies_ext(*)')
      .eq('project_id', project_id)
      .in('severity', ['critical', 'high'])
      .order('severity', { ascending: true });

    const [alertsRes, contingenciesRes] = await Promise.all([
      alertQuery,
      contQuery,
    ]);

    const redFlags = [
      ...(alertsRes.data || []).map(a => ({
        id: a.id,
        source: 'alert' as const,
        title: a.titulo,
        severity: a.severity,
        area_code: a.area_code,
        status: a.status,
        impact: a.impacto_negociacion,
        evidence: a.evidencia || [],
        recommendation: a.recomendacion,
        created_at: a.created_at,
        actions: [] as string[],
      })),
      ...(contingenciesRes.data || []).map(c => ({
        id: c.id,
        source: 'contingency' as const,
        title: c.title,
        severity: c.severity,
        area_code: null as string | null,
        status: c.status,
        impact: c.description,
        evidence: [] as string[],
        recommendation: c.recommendation,
        created_at: c.created_at,
        actions: c.dd_contingencies_ext
          ? [c.dd_contingencies_ext.treatment, c.dd_contingencies_ext.negotiation_status].filter(Boolean)
          : [],
      })),
    ];

    // Sort by severity priority
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    redFlags.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    return NextResponse.json({
      success: true,
      red_flags: redFlags,
      count: redFlags.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 4: POST /api/war-room/[project_id]/export**

`src/app/api/war-room/[project_id]/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const format = body.format || 'json';

    // Gather all war room data
    const [alertsRes, contingenciesRes, decisionsRes] = await Promise.all([
      supabaseAdmin
        .from('dd_negotiation_alerts')
        .select('*')
        .eq('project_id', project_id)
        .order('severity'),
      supabaseAdmin
        .from('dd_contingencies')
        .select('*, dd_contingencies_ext(*)')
        .eq('project_id', project_id)
        .in('severity', ['critical', 'high']),
      supabaseAdmin
        .from('dd_war_room_decisions')
        .select('*')
        .eq('project_id', project_id)
        .order('decided_at', { ascending: false }),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      project_id,
      red_flags: alertsRes.data || [],
      contingencies: contingenciesRes.data || [],
      decisions: decisionsRes.data || [],
    };

    if (format === 'csv') {
      // Simple CSV for red flags
      const rows = (alertsRes.data || []).map(a =>
        [a.severity, a.area_code, a.titulo, a.impacto_negociacion, a.recomendacion, a.status].join('\t')
      );
      const csv = 'Severity\tArea\tTitle\tImpact\tRecommendation\tStatus\n' + rows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/tab-separated-values',
          'Content-Disposition': `attachment; filename="war-room-${project_id}.tsv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      export: exportData,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

---

## Task 10: S6 War Room Constants

**Files:**
- Modify: `src/lib/utils.ts` (append)

**Step 1: Add War Room config constants**

```typescript
// ── War Room (S6) ──────────────────────────────────────

export const DECISION_TYPE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  accept_risk: { label: 'Aceptar riesgo', color: '#6B7280', description: 'Riesgo aceptado sin acción adicional' },
  mitigate: { label: 'Mitigar', color: '#10B981', description: 'Acción de mitigación implementada' },
  transfer: { label: 'Transferir', color: '#3B82F6', description: 'Riesgo transferido (seguro, escrow, etc.)' },
  reject: { label: 'Rechazar', color: '#EF4444', description: 'Deal breaker — no se acepta' },
  defer: { label: 'Diferir', color: '#F59E0B', description: 'Decisión aplazada pendiente más información' },
  escalate: { label: 'Escalar', color: '#8B5CF6', description: 'Escalado a comité / CLO / socio' },
};

export const NOTIFICATION_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  severity_change: { label: 'Cambio de severidad', icon: '⚠️' },
  new_blocker: { label: 'Nuevo bloqueante', icon: '🚫' },
  request_overdue: { label: 'Solicitud vencida', icon: '⏰' },
  decision_required: { label: 'Decisión requerida', icon: '⚖️' },
  red_flag_new: { label: 'Nuevo red flag', icon: '🚩' },
};
```

---

## Task 11: E2E Tests

**Files:**
- Create: `e2e/17-vdr-vectorization.spec.ts`
- Create: `e2e/18-war-room.spec.ts`

**Step 1: VDR vectorization tests**

`e2e/17-vdr-vectorization.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('VDR Vectorization API @vdr-vector', () => {
  test('POST /api/vdr/ingest requires document_id', async ({ request }) => {
    const res = await request.post('/api/vdr/ingest', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('document_id');
  });

  test('POST /api/vdr/search/semantic requires project_id and query', async ({ request }) => {
    const res = await request.post('/api/vdr/search/semantic', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/vdr/search/semantic returns results array', async ({ request }) => {
    const res = await request.post('/api/vdr/search/semantic', {
      data: {
        project_id: '00000000-0000-0000-0000-000000000000',
        query: 'contrato de compraventa',
      },
    });
    // May return 200 with empty results or 500 if no OPENAI_API_KEY
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test('GET /api/vdr/ingest/nonexistent returns 404', async ({ request }) => {
    const res = await request.get('/api/vdr/ingest/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });
});
```

**Step 2: War Room tests**

`e2e/18-war-room.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const FAKE_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

test.describe('War Room API @war-room', () => {
  test('GET /api/war-room/[project_id] returns dashboard structure', async ({ request }) => {
    const res = await request.get(`/api/war-room/${FAKE_PROJECT_ID}`);
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
      expect(body).toHaveProperty('blockers');
      expect(body).toHaveProperty('progress');
      expect(body).toHaveProperty('decisions');
      expect(body).toHaveProperty('notifications');
      expect(Array.isArray(body.red_flags)).toBe(true);
    }
  });

  test('POST /api/war-room/[project_id]/decisions requires fields', async ({ request }) => {
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/decisions`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/war-room/[project_id]/decisions validates decision_type', async ({ request }) => {
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/decisions`, {
      data: { decision_type: 'invalid', title: 'Test' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/war-room/[project_id]/red-flags returns array', async ({ request }) => {
    const res = await request.get(`/api/war-room/${FAKE_PROJECT_ID}/red-flags`);
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.red_flags)).toBe(true);
    }
  });

  test('POST /api/war-room/[project_id]/export returns json by default', async ({ request }) => {
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/export`, {
      data: { format: 'json' },
    });
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(body.export).toHaveProperty('red_flags');
      expect(body.export).toHaveProperty('decisions');
    }
  });
});
```

---

## Task 12: Install openai dependency + Build + Commit

**Step 1: Install openai (not needed — we use raw fetch)**

No npm install needed. The embedding service uses raw `fetch()` to OpenAI API.

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit all changes**

```bash
git add supabase/migrations/202602210001_vdr_vectorization.sql \
  supabase/migrations/202602210002_war_room.sql \
  src/lib/embeddings/ \
  src/lib/vdr/chunker.ts src/lib/vdr/ingest.ts src/lib/vdr/semantic-search.ts \
  src/app/api/vdr/ingest/ src/app/api/vdr/search/semantic/ \
  src/app/api/war-room/ \
  src/lib/supabase.ts src/lib/utils.ts \
  e2e/17-vdr-vectorization.spec.ts e2e/18-war-room.spec.ts \
  docs/plans/

git commit -m "feat(v3.0): S4 VDR vectorization + S6 War Room"
```

**Step 4: Push and update PR**

```bash
git push origin feat/prd-v3-strangler-slices
```
