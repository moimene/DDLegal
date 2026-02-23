# Incremental RAG + Report Rendering + Two-Level Cache — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add incremental document ingestion with content hashing, multi-query RAG with skill orchestration, HTML report rendering by typology with PDF on-demand, and a two-level cache (document + report).

**Architecture:** Documents arrive in batches. Each batch triggers parsing, embedding, and skill execution only for new/changed docs (level-1 cache via content_hash). Results accumulate in `dd_analysis_results`. Reports are generated from accumulated results and cached by evidence_hash (level-2 cache). HTML is rendered per report_type (8 dedicated templates + generic fallback). PDF is generated on-demand via Next.js API.

**Tech Stack:** Supabase (PostgreSQL + pgvector), n8n workflows, Harvey AI, Next.js API routes, Puppeteer (PDF), TypeScript.

**Design doc:** `docs/plans/2026-02-23-incremental-rag-render-cache-design.md`

---

## Task 1: Database Migration — Add cache columns to vdr_documents

**Files:**
- Create: `dd-legal-pmo/supabase/migrations/202602280001_vdr_cache_columns.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Migration: Add cache columns to vdr_documents
-- Adds content_hash, embedding_status, embedding_hash, last_embedded_at
-- for level-1 document cache (skip re-parsing unchanged docs).
-- Date: 2026-02-28
-- ============================================================

begin;

-- Add content_hash for deduplication
alter table public.vdr_documents
  add column if not exists content_hash text;

-- Add embedding lifecycle columns
alter table public.vdr_documents
  add column if not exists embedding_status text default 'pending'
    check (embedding_status in ('pending', 'processing', 'done', 'stale'));

alter table public.vdr_documents
  add column if not exists embedding_hash text;

alter table public.vdr_documents
  add column if not exists last_embedded_at timestamptz;

-- Index for cache lookups
create index if not exists idx_vdr_docs_content_hash
  on public.vdr_documents(project_id, content_hash);

create index if not exists idx_vdr_docs_embedding_status
  on public.vdr_documents(project_id, embedding_status);

commit;
```

**Step 2: Apply migration via Supabase MCP**

```
Use mcp__53aea412-0041-417c-9b2b-0098684c252a__apply_migration
  project_id: (from .env.local NEXT_PUBLIC_SUPABASE_URL)
  name: vdr_cache_columns
  query: (the SQL above)
```

**Step 3: Run security advisors**

```
Use mcp__53aea412-0041-417c-9b2b-0098684c252a__get_advisors
  project_id: (same)
  type: "security"
```

**Step 4: Commit**

```bash
git add dd-legal-pmo/supabase/migrations/202602280001_vdr_cache_columns.sql
git commit -m "feat(db): add content_hash and embedding_status to vdr_documents"
```

---

## Task 2: Database Migration — Create dd_analysis_results

**Files:**
- Create: `dd-legal-pmo/supabase/migrations/202602280002_create_analysis_results.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Migration: Create dd_analysis_results
-- Accumulative table for skill analysis outputs per project.
-- Supports incremental upsert as new documents arrive.
-- Date: 2026-02-28
-- ============================================================

begin;

create table if not exists public.dd_analysis_results (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null,
  area             text not null,
  report_type      text not null,
  finding_key      text not null,
  structured_data  jsonb not null default '{}',
  evidence_refs    text[] default '{}',
  confidence_score numeric(3,2) default 0.00,
  version          integer not null default 1,
  source_skill     text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique(project_id, area, finding_key)
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.dd_analysis_results
    add constraint dd_analysis_results_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- RLS
alter table public.dd_analysis_results enable row level security;

create policy "dd_analysis_results_service_bypass"
  on public.dd_analysis_results for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_analysis_results_select_assigned"
  on public.dd_analysis_results for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_analysis_results.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- Indexes
create index if not exists idx_analysis_results_project_area
  on public.dd_analysis_results(project_id, area, report_type);

create index if not exists idx_analysis_results_updated
  on public.dd_analysis_results(project_id, updated_at desc);

commit;
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Run security advisors**

**Step 4: Commit**

```bash
git add dd-legal-pmo/supabase/migrations/202602280002_create_analysis_results.sql
git commit -m "feat(db): create dd_analysis_results accumulative table"
```

---

## Task 3: Database Migration — Create dd_report_cache + dd_report_versions

**Files:**
- Create: `dd-legal-pmo/supabase/migrations/202602280003_create_report_cache_versions.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Migration: Create dd_report_cache and dd_report_versions
-- Level-2 cache for generated reports (skip re-generation).
-- Versioned history for audit trail.
-- Date: 2026-02-28
-- ============================================================

begin;

-- dd_report_cache — active cache keyed by evidence_hash
create table if not exists public.dd_report_cache (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null,
  report_type    text not null,
  evidence_hash  text not null,
  html_content   text,
  md_content     text,
  json_output    jsonb,
  is_valid       boolean default true,
  created_at     timestamptz default now(),
  valid_until    timestamptz not null,

  unique(project_id, report_type, evidence_hash)
);

do $$
begin
  alter table public.dd_report_cache
    add constraint dd_report_cache_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.dd_report_cache enable row level security;

create policy "dd_report_cache_service_bypass"
  on public.dd_report_cache for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_report_cache_select_assigned"
  on public.dd_report_cache for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_report_cache.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

create index if not exists idx_report_cache_lookup
  on public.dd_report_cache(project_id, report_type, is_valid);

-- dd_report_versions — immutable history
create table if not exists public.dd_report_versions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null,
  report_type    text not null,
  version        integer not null default 1,
  json_output    jsonb not null,
  html_content   text,
  md_content     text,
  evidence_hash  text not null,
  generated_by   text default 'system',
  created_at     timestamptz default now(),

  unique(project_id, report_type, version)
);

do $$
begin
  alter table public.dd_report_versions
    add constraint dd_report_versions_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.dd_report_versions enable row level security;

create policy "dd_report_versions_service_bypass"
  on public.dd_report_versions for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "dd_report_versions_select_assigned"
  on public.dd_report_versions for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = dd_report_versions.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

create index if not exists idx_report_versions_project
  on public.dd_report_versions(project_id, report_type, version desc);

commit;
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Run security advisors**

**Step 4: Commit**

```bash
git add dd-legal-pmo/supabase/migrations/202602280003_create_report_cache_versions.sql
git commit -m "feat(db): create dd_report_cache and dd_report_versions tables"
```

---

## Task 4: Content Hash Utility + Ingest Enhancement

**Files:**
- Create: `dd-legal-pmo/src/lib/vdr/content-hash.ts`
- Modify: `dd-legal-pmo/src/lib/vdr/ingest.ts`

**Step 1: Create content-hash.ts**

```typescript
// dd-legal-pmo/src/lib/vdr/content-hash.ts
import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of text content for cache deduplication.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compute evidence hash from an array of document content hashes.
 * Sorts hashes alphabetically before hashing to ensure deterministic output.
 */
export function computeEvidenceHash(contentHashes: string[]): string {
  const sorted = [...contentHashes].sort();
  return createHash('sha256').update(sorted.join('|'), 'utf-8').digest('hex');
}
```

**Step 2: Modify ingest.ts to add content_hash check**

In `dd-legal-pmo/src/lib/vdr/ingest.ts`, add the content hash check at the start of `processIngestion`:

After line `const { data: doc } = ...` (line ~24), add:

```typescript
import { computeContentHash } from './content-hash';

// ... inside processIngestion, after fetching doc:

// Compute content hash for cache deduplication
const textContent = doc.description || doc.name;
// (existing code continues building textContent with version notes)
const contentHash = computeContentHash(textContent);

// Check if document content is unchanged (level-1 cache)
const { data: existingDoc } = await supabaseAdmin
  .from('vdr_documents')
  .select('content_hash, embedding_status')
  .eq('id', documentId)
  .single();

if (existingDoc?.content_hash === contentHash && existingDoc?.embedding_status === 'done') {
  // Content unchanged, skip re-processing
  await supabaseAdmin.from('vdr_ingestion_jobs').update({
    status: 'completed',
    chunks_created: 0,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
  return;
}

// Mark as processing
await supabaseAdmin.from('vdr_documents').update({
  embedding_status: 'processing',
}).eq('id', documentId);

// ... (existing parse + embed logic) ...

// After successful embedding, update cache columns
await supabaseAdmin.from('vdr_documents').update({
  content_hash: contentHash,
  embedding_status: 'done',
  last_embedded_at: new Date().toISOString(),
}).eq('id', documentId);
```

**Step 3: Commit**

```bash
git add dd-legal-pmo/src/lib/vdr/content-hash.ts dd-legal-pmo/src/lib/vdr/ingest.ts
git commit -m "feat(vdr): add content hash deduplication to document ingestion"
```

---

## Task 5: Multi-Query Retrieval Service

**Files:**
- Create: `dd-legal-pmo/src/lib/vdr/multi-query-retrieval.ts`

**Step 1: Create the multi-query retrieval module**

```typescript
// dd-legal-pmo/src/lib/vdr/multi-query-retrieval.ts
import { semanticSearch, type SemanticSearchResult } from './semantic-search';
import { REPORT_TEMPLATES } from '@/lib/reporting/templates';

/**
 * Section-to-query mapping.
 * Maps report section names to semantic search queries in Spanish.
 */
const SECTION_QUERY_MAP: Record<string, string> = {
  // Societario
  datos_generales: 'datos generales sociedad denominacion CIF domicilio capital social constitucion',
  administradores: 'organo administracion administradores nombramientos apoderados retribucion',
  // IP
  titular: 'titular derechos propiedad industrial intelectual marcas patentes',
  matriz_marcas: 'marcas registradas clases Niza estado jurisdiccion renovacion',
  diagnostico: 'diagnostico vencimientos gaps cobertura incoherencias titularidad',
  // Common
  conclusiones: 'conclusiones red flags riesgos contingencias recomendaciones hallazgos',
  recomendaciones: 'recomendaciones acciones prioritarias siguiente paso remediation',
  resumen: 'resumen ejecutivo principales hallazgos resultados clave',
  hallazgos: 'hallazgos findings descubrimientos problemas detectados issues',
  // Laboral
  plantilla: 'plantilla empleados trabajadores convenio colectivo',
  alta_direccion: 'alta direccion directivos ejecutivos pactos retribucion',
  contingencias: 'contingencias riesgos laborales litigios reclamaciones',
  // Fiscal
  situacion_fiscal: 'situacion fiscal impuestos tributos declaraciones inspecciones',
  // Contratos
  clausulas_clave: 'clausulas clave contratos obligaciones restricciones covenants',
  consentimientos: 'consentimientos autorizaciones permisos aprobaciones',
  cambio_control: 'cambio control change of control vesting aceleracion',
  impacto: 'impacto economico financiero operativo consecuencias',
  // PMO
  progreso_areas: 'progreso avance por area estado completion porcentaje',
  tareas_pendientes: 'tareas pendientes por completar backlog bloqueadas',
  bloqueos: 'bloqueos impedimentos problemas sin resolver dependencias',
  carga_trabajo: 'carga trabajo workload asignaciones capacidad equipo',
  sla_cumplimiento: 'SLA cumplimiento plazos vencimientos alertas',
  // Compliance
  accesos: 'accesos usuarios permisos login sesiones',
  anomalias: 'anomalias irregularidades comportamiento inusual',
  scores: 'scores puntuaciones grounding validacion calidad',
  issues: 'issues errores problemas incidencias',
  tendencias: 'tendencias evolucion historico comparativa',
  // Negotiation
  contingencias_overview: 'contingencias resumen overview todas las areas',
  posiciones_buy_sell: 'posiciones comprador vendedor negociacion buyer seller',
  tratamientos: 'tratamientos propuestos indemnizacion ajuste precio warranty',
  clausulas_spa: 'clausulas SPA acuerdo compraventa share purchase agreement',
  pendientes: 'pendientes abiertos sin resolver outstanding items',
  // Consolidated
  overview_deal: 'overview deal resumen transaccion operacion',
  metricas_clave: 'metricas clave KPI indicadores principales cifras',
  contingencias_criticas: 'contingencias criticas alto riesgo material red flags',
  estado_negociacion: 'estado negociacion posiciones acuerdos pendientes',
  proximos_pasos: 'proximos pasos next steps acciones siguientes timeline',
  // Fallback for unmapped sections
  _default: 'informacion relevante evidencia datos clave',
};

/**
 * Execute multi-query semantic retrieval for a report type.
 * Runs one query per required_section, de-duplicates, and ranks results.
 */
export async function multiQueryRetrieval(opts: {
  projectId: string;
  reportType: string;
  areaCode?: string;
  topKPerQuery?: number;
}): Promise<{
  results: SemanticSearchResult[];
  queriesExecuted: number;
  sectionsQueried: string[];
}> {
  const { projectId, reportType, areaCode, topKPerQuery = 10 } = opts;

  const template = REPORT_TEMPLATES[reportType];
  if (!template) {
    throw new Error(`Unknown report_type: ${reportType}`);
  }

  const sections = template.required_sections;
  const allResults: SemanticSearchResult[] = [];
  const seenChunkIds = new Set<string>();

  for (const section of sections) {
    const query = SECTION_QUERY_MAP[section] || SECTION_QUERY_MAP._default;

    const sectionResults = await semanticSearch(projectId, query, {
      threshold: 0.6,
      limit: topKPerQuery,
      areaCode: areaCode || undefined,
    });

    for (const result of sectionResults) {
      if (!seenChunkIds.has(result.chunk_id)) {
        seenChunkIds.add(result.chunk_id);
        allResults.push(result);
      }
    }
  }

  // Sort by similarity descending
  allResults.sort((a, b) => b.similarity - a.similarity);

  return {
    results: allResults,
    queriesExecuted: sections.length,
    sectionsQueried: sections,
  };
}
```

**Step 2: Commit**

```bash
git add dd-legal-pmo/src/lib/vdr/multi-query-retrieval.ts
git commit -m "feat(vdr): add multi-query semantic retrieval per report sections"
```

---

## Task 6: Analysis Results Service (TypeScript)

**Files:**
- Create: `dd-legal-pmo/src/lib/reporting/analysis-results.ts`

**Step 1: Create the analysis results service**

```typescript
// dd-legal-pmo/src/lib/reporting/analysis-results.ts
import { supabaseAdmin } from '@/lib/supabase-admin';
import { computeEvidenceHash } from '@/lib/vdr/content-hash';

export interface AnalysisResult {
  id: string;
  project_id: string;
  area: string;
  report_type: string;
  finding_key: string;
  structured_data: Record<string, unknown>;
  evidence_refs: string[];
  confidence_score: number;
  version: number;
  source_skill: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert an analysis result. Increments version on conflict.
 */
export async function upsertAnalysisResult(opts: {
  projectId: string;
  area: string;
  reportType: string;
  findingKey: string;
  structuredData: Record<string, unknown>;
  evidenceRefs: string[];
  confidenceScore?: number;
  sourceSkill?: string;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('dd_analysis_results')
    .select('id, version')
    .eq('project_id', opts.projectId)
    .eq('area', opts.area)
    .eq('finding_key', opts.findingKey)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('dd_analysis_results')
      .update({
        structured_data: opts.structuredData,
        evidence_refs: opts.evidenceRefs,
        confidence_score: opts.confidenceScore ?? 0,
        source_skill: opts.sourceSkill || null,
        version: existing.version + 1,
        report_type: opts.reportType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('dd_analysis_results')
      .insert({
        project_id: opts.projectId,
        area: opts.area,
        report_type: opts.reportType,
        finding_key: opts.findingKey,
        structured_data: opts.structuredData,
        evidence_refs: opts.evidenceRefs,
        confidence_score: opts.confidenceScore ?? 0,
        source_skill: opts.sourceSkill || null,
      });
  }
}

/**
 * Load all accumulated analysis results for a project + report_type.
 */
export async function loadAnalysisResults(
  projectId: string,
  reportType: string,
): Promise<AnalysisResult[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .eq('report_type', reportType)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load analysis results: ${error.message}`);
  return (data || []) as AnalysisResult[];
}

/**
 * Compute the evidence hash for a project (all indexed docs).
 */
export async function getProjectEvidenceHash(projectId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('vdr_documents')
    .select('content_hash')
    .eq('project_id', projectId)
    .eq('embedding_status', 'done')
    .not('content_hash', 'is', null)
    .order('content_hash');

  if (error) throw new Error(`Failed to compute evidence hash: ${error.message}`);

  const hashes = (data || []).map(d => d.content_hash).filter(Boolean) as string[];
  return computeEvidenceHash(hashes);
}

/**
 * Invalidate all report caches for a project.
 */
export async function invalidateProjectReportCache(projectId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('dd_report_cache')
    .update({ is_valid: false })
    .eq('project_id', projectId)
    .eq('is_valid', true)
    .select('id');

  if (error) throw new Error(`Failed to invalidate cache: ${error.message}`);
  return (data || []).length;
}

/**
 * Check if a valid cache entry exists for a report.
 */
export async function checkReportCache(
  projectId: string,
  reportType: string,
  evidenceHash: string,
): Promise<{ hit: boolean; htmlContent?: string; mdContent?: string; jsonOutput?: Record<string, unknown> }> {
  const { data } = await supabaseAdmin
    .from('dd_report_cache')
    .select('html_content, md_content, json_output, valid_until')
    .eq('project_id', projectId)
    .eq('report_type', reportType)
    .eq('evidence_hash', evidenceHash)
    .eq('is_valid', true)
    .gt('valid_until', new Date().toISOString())
    .maybeSingle();

  if (data) {
    return {
      hit: true,
      htmlContent: data.html_content || undefined,
      mdContent: data.md_content || undefined,
      jsonOutput: data.json_output as Record<string, unknown> | undefined,
    };
  }

  return { hit: false };
}

/**
 * Store a report in cache and version history.
 */
export async function storeReport(opts: {
  projectId: string;
  reportType: string;
  evidenceHash: string;
  jsonOutput: Record<string, unknown>;
  htmlContent: string;
  mdContent?: string;
  cadencia: 'on_demand' | 'daily' | 'weekly' | 'monthly';
  generatedBy?: string;
}): Promise<string> {
  const ttlMap: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    on_demand: 30 * 24 * 60 * 60 * 1000,
  };

  const validUntil = new Date(Date.now() + (ttlMap[opts.cadencia] || ttlMap.on_demand));

  // Upsert cache
  await supabaseAdmin
    .from('dd_report_cache')
    .upsert({
      project_id: opts.projectId,
      report_type: opts.reportType,
      evidence_hash: opts.evidenceHash,
      html_content: opts.htmlContent,
      md_content: opts.mdContent || null,
      json_output: opts.jsonOutput,
      is_valid: true,
      valid_until: validUntil.toISOString(),
    }, { onConflict: 'project_id,report_type,evidence_hash' });

  // Get next version number
  const { data: lastVersion } = await supabaseAdmin
    .from('dd_report_versions')
    .select('version')
    .eq('project_id', opts.projectId)
    .eq('report_type', opts.reportType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersion?.version || 0) + 1;

  // Insert version
  const { data: versionRow, error } = await supabaseAdmin
    .from('dd_report_versions')
    .insert({
      project_id: opts.projectId,
      report_type: opts.reportType,
      version: nextVersion,
      json_output: opts.jsonOutput,
      html_content: opts.htmlContent,
      md_content: opts.mdContent || null,
      evidence_hash: opts.evidenceHash,
      generated_by: opts.generatedBy || 'system',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to store report version: ${error.message}`);
  return versionRow.id;
}
```

**Step 2: Commit**

```bash
git add dd-legal-pmo/src/lib/reporting/analysis-results.ts
git commit -m "feat(reporting): add analysis results service with cache + versioning"
```

---

## Task 7: n8n Workflow — dd_ingest_pipeline

**Files:**
- Create: `dd-legal-pmo/n8n/dd_ingest_pipeline.workflow.json`

**Step 1: Design the workflow JSON**

Create the workflow with these nodes:
1. `Webhook - Ingest Pipeline` — POST `/dd-ingest-pipeline`, responseMode: responseNode
2. `Split Batch Documents` — Code node: split input docs array into individual items
3. `Loop Over Documents` — SplitInBatches node
4. `Compute Content Hash` — Code node: SHA-256 of document text content
5. `Check Content Hash` — HTTP Request to Supabase REST API (select content_hash from vdr_documents)
6. `Is Changed?` — IF node: compare hashes
7. `Skip Unchanged` — (true branch loops back)
8. `Parse & Embed` — HTTP Request to existing ingest endpoint or direct Supabase calls
9. `Multi-Query Retrieval` — Code node: build queries from SECTION_QUERY_MAP, call match_vdr_chunks RPC
10. `Execute Skills` — HTTP Request to `dd-skill-executor` webhook (for each relevant skill)
11. `Validate Pipeline` — HTTP Request chain: `dd-agent-validador` -> `dd-agent-paranoico` -> `dd-agent-sanitizer`
12. `Upsert Analysis Results` — Supabase insert/update
13. `Invalidate Report Cache` — Supabase update (SET is_valid = false)
14. `Return Summary` — Respond to Webhook

**Step 2: Create the workflow via n8n MCP**

```
Use mcp__n8n__n8n_create_workflow with the full node/connection structure
```

**Step 3: Validate the workflow**

```
Use mcp__n8n__n8n_validate_workflow with the workflow ID
```

**Step 4: Auto-fix if needed**

```
Use mcp__n8n__n8n_autofix_workflow with the workflow ID
```

**Step 5: Save JSON backup and commit**

```bash
git add dd-legal-pmo/n8n/dd_ingest_pipeline.workflow.json
git commit -m "feat(n8n): create dd_ingest_pipeline workflow with content hash cache"
```

---

## Task 8: n8n Workflow — dd_report_orchestrator

**Files:**
- Create: `dd-legal-pmo/n8n/dd_report_orchestrator.workflow.json`

**Step 1: Design the workflow**

Nodes:
1. `Webhook - Orchestrator` — POST `/dd-report-orchestrator`, accepts `{ project_id, report_type?, force_refresh? }`
2. `Load Report Map` — Code node: resolve which report_types to generate from REPORT_TEMPLATES
3. `Loop Over Report Types` — SplitInBatches
4. `Compute Evidence Hash` — HTTP Request to Supabase: select content_hashes, compute hash
5. `Check Cache` — HTTP Request to Supabase: check dd_report_cache
6. `Cache Hit?` — IF node
7. `Load Analysis Results` — HTTP Request to Supabase: select from dd_analysis_results
8. `Has Missing Data?` — IF node: check if all required_sections have results
9. `Execute Skills On-Demand` — HTTP Request to `dd-skill-executor`
10. `Consolidate JSON` — Code node: merge analysis_results into structured output
11. `Call Report Render` — HTTP Request to `dd-report-render` webhook (sub-workflow)
12. `Store Cache + Version` — HTTP Request to Supabase: upsert cache, insert version
13. `Return Summary` — Respond to Webhook

**Step 2-5:** Same as Task 7 (create, validate, autofix, save + commit)

```bash
git add dd-legal-pmo/n8n/dd_report_orchestrator.workflow.json
git commit -m "feat(n8n): create dd_report_orchestrator with evidence cache"
```

---

## Task 9: n8n Workflow — dd_report_render + HTML Templates

**Files:**
- Create: `dd-legal-pmo/n8n/dd_report_render.workflow.json`

**Step 1: Design the workflow**

Nodes:
1. `Webhook - Render` — POST `/dd-report-render`, accepts `{ report_type, json_output, project_metadata }`
2. `Select Template` — Switch node: route by report_type to dedicated template nodes or generic fallback
3. `Map Fields — Societario` — Code node: map JSON to societario HTML template variables
4. `Render HTML — Societario` — HTML node: societario_standard template (17 Garrigues fields)
5. `Map Fields — IP Report` — Code node: map JSON for IP template
6. `Render HTML — IP Report` — HTML node: trademark matrix template
7. `Map Fields — Red Flags` — Code node
8. `Render HTML — Red Flags` — HTML node: severity badges
9. `Map Fields — Generic` — Code node: dynamic section generation
10. `Render HTML — Generic` — HTML node: generic fallback
11. (Repeat for: pmo_estado, executive_digest, ficha_contingencia, negotiation_summary, deal_summary_executive)
12. `Merge Outputs` — Merge node: combine all branches
13. `Generate Markdown` — Code node: convert structured JSON to markdown format
14. `Return Rendered` — Respond to Webhook: `{ html_content, md_content }`

**Step 2: Build the 8 dedicated HTML templates**

Each template follows the visual style of the benchmark (clean, professional, CSS embedded):
- Consistent header with project name, report date, deal ID
- Section-based layout with `section-title` + `card` pattern
- Evidence references as inline links `[SRC-XXX]`
- Color-coded severity badges for red flags
- Footer with disclaimer and metadata
- Print-optimized CSS for PDF rendering

**Step 3: Create, validate, autofix, save + commit**

```bash
git add dd-legal-pmo/n8n/dd_report_render.workflow.json
git commit -m "feat(n8n): create dd_report_render with 8 HTML templates + generic fallback"
```

---

## Task 10: Next.js API Routes — PDF + Markdown Download

**Files:**
- Create: `dd-legal-pmo/src/app/api/reports/pdf/route.ts`
- Create: `dd-legal-pmo/src/app/api/reports/md/route.ts`

**Step 1: Create PDF route**

```typescript
// dd-legal-pmo/src/app/api/reports/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const reportVersionId = request.nextUrl.searchParams.get('report_version_id');
  if (!reportVersionId) {
    return NextResponse.json({ error: 'report_version_id is required' }, { status: 400 });
  }

  // Load HTML content from report version
  const { data: version, error } = await supabaseAdmin
    .from('dd_report_versions')
    .select('html_content, report_type, project_id, version')
    .eq('id', reportVersionId)
    .single();

  if (error || !version?.html_content) {
    return NextResponse.json({ error: 'Report version not found or has no HTML' }, { status: 404 });
  }

  // Dynamic import puppeteer to keep it server-side only
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setContent(version.html_content, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      scale: 0.95,
    });

    const filename = `${version.report_type}-v${version.version}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
```

**Step 2: Create markdown route**

```typescript
// dd-legal-pmo/src/app/api/reports/md/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const reportVersionId = request.nextUrl.searchParams.get('report_version_id');
  if (!reportVersionId) {
    return NextResponse.json({ error: 'report_version_id is required' }, { status: 400 });
  }

  const { data: version, error } = await supabaseAdmin
    .from('dd_report_versions')
    .select('md_content, report_type, version')
    .eq('id', reportVersionId)
    .single();

  if (error || !version?.md_content) {
    return NextResponse.json({ error: 'Report version not found or has no markdown' }, { status: 404 });
  }

  const filename = `${version.report_type}-v${version.version}.md`;

  return new NextResponse(version.md_content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

**Step 3: Commit**

```bash
git add dd-legal-pmo/src/app/api/reports/pdf/route.ts dd-legal-pmo/src/app/api/reports/md/route.ts
git commit -m "feat(api): add PDF and markdown download endpoints for reports"
```

---

## Task 11: Update n8n Workflow Skill + Template Metadata

**Files:**
- Modify: `dd-legal-pmo/.claude/skills/n8n-workflow/SKILL.md`
- Modify: `dd-legal-pmo/src/lib/reporting/templates.ts`

**Step 1: Update n8n-workflow skill to include new workflows**

Add to the "Existing Workflows" section:
```
- `dd_ingest_pipeline` - Incremental document ingestion with content hash cache
- `dd_report_orchestrator` - Report generation with evidence hash cache
- `dd_report_render` - HTML template engine by report type
```

**Step 2: Add template rendering metadata to templates.ts**

Add to `ReportTemplate` interface:

```typescript
/** Whether this report_type has a dedicated HTML template in dd_report_render */
has_dedicated_template?: boolean;
```

Add `has_dedicated_template: true` to these 8 templates:
- `societario_standard`
- `ip_report`
- `red_flags_digest`
- `pmo_estado`
- `executive_digest`
- `negotiation_summary`
- `deal_summary_executive`

And create a new entry for `ficha_contingencia` if not present as a standalone report_type.

**Step 3: Commit**

```bash
git add dd-legal-pmo/.claude/skills/n8n-workflow/SKILL.md dd-legal-pmo/src/lib/reporting/templates.ts
git commit -m "docs: update n8n skill and add template rendering metadata"
```

---

## Task 12: Integration Test — Full Pipeline Smoke Test

**Step 1: Test the ingest pipeline**

```
Use mcp__n8n__n8n_test_workflow with:
  workflowId: (dd_ingest_pipeline ID)
  data: {
    "project_id": "test-project-id",
    "documents": [
      { "document_id": "doc-1", "content": "Sample contract content..." }
    ]
  }
```

Verify: Response contains ingestion summary with documents processed count.

**Step 2: Test the orchestrator**

```
Use mcp__n8n__n8n_test_workflow with:
  workflowId: (dd_report_orchestrator ID)
  data: {
    "project_id": "test-project-id",
    "report_type": "societario_standard",
    "force_refresh": true
  }
```

Verify: Response contains report generation result with HTML content.

**Step 3: Test cache hit**

Re-run the same orchestrator request without `force_refresh`.
Verify: Response indicates cache hit (faster, no Harvey call).

**Step 4: Test PDF endpoint**

```bash
curl -s "http://localhost:3000/api/reports/pdf?report_version_id=XXX" -o test.pdf
file test.pdf  # Should say "PDF document"
```

**Step 5: Commit final integration notes**

```bash
git commit --allow-empty -m "chore: complete incremental RAG + render + cache pipeline integration"
```

---

## Summary of Deliverables

| # | Deliverable | Type |
|---|---|---|
| 1 | `202602280001_vdr_cache_columns.sql` | Migration |
| 2 | `202602280002_create_analysis_results.sql` | Migration |
| 3 | `202602280003_create_report_cache_versions.sql` | Migration |
| 4 | `src/lib/vdr/content-hash.ts` | New file |
| 5 | `src/lib/vdr/ingest.ts` (modified) | Enhancement |
| 6 | `src/lib/vdr/multi-query-retrieval.ts` | New file |
| 7 | `src/lib/reporting/analysis-results.ts` | New file |
| 8 | `n8n/dd_ingest_pipeline.workflow.json` | New workflow |
| 9 | `n8n/dd_report_orchestrator.workflow.json` | New workflow |
| 10 | `n8n/dd_report_render.workflow.json` + 8 HTML templates | New workflow |
| 11 | `src/app/api/reports/pdf/route.ts` | New API route |
| 12 | `src/app/api/reports/md/route.ts` | New API route |
| 13 | Updated SKILL.md + templates.ts metadata | Docs |
