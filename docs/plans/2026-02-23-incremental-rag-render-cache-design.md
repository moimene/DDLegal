# Design: Incremental RAG + Report Rendering + Two-Level Cache

**Date:** 2026-02-23
**Status:** Approved
**Scope:** 3 improvements inspired by Due Diligence Automation v2.0.1 benchmark

---

## 1. Context and Motivation

The DD Legal PMO platform currently has 9 n8n workflows that process documents and generate analysis via Harvey AI. Three gaps were identified after benchmarking against an external Due Diligence Automation workflow:

1. **Single-query analysis** — Each skill executes one Harvey call with limited context. No multi-dimensional retrieval against the VDR.
2. **Raw text output** — Reports return JSON/raw text. No HTML rendering, no PDF generation, no visual templates per report type.
3. **No caching** — Every request re-processes all documents and re-generates all reports, even when nothing changed.

### Incremental Model

Documents arrive in batches over the lifecycle of a deal. A first upload of contracts triggers analysis; 3 days later another batch arrives, and so on. The report output map is fixed per deal, but analysis results accumulate incrementally. Reports are regenerated from the accumulated analysis, not from scratch.

Custom/special reports produce markdown for external formatting to `.doc`/`.pptx`.

---

## 2. Architecture Overview

```
DOCUMENT UPLOAD (VDR batch)
    |
    v
dd_ingest_pipeline (NEW) --- Level 1 cache: content_hash
    |-- 1. Split docs, compute content_hash per doc
    |-- 2. Skip docs with matching hash (no changes)
    |-- 3. Parse + embed new/changed docs -> pgvector
    |-- 4. Multi-query retrieval per required_section
    |-- 5. Execute relevant skills (dd_skill_executor x N)
    |-- 6. Validate (validador + paranoico + sanitizer)
    |-- 7. UPSERT dd_analysis_results (accumulative)
    |-- 8. Invalidate report cache for project
    v
dd_report_orchestrator (NEW) --- Level 2 cache: evidence_hash
    |-- Trigger: manual (UI) or automatic (post-ingestion)
    |-- 1. Load project report map from REPORT_TEMPLATES
    |-- 2. For each report_type:
    |      |-- Compute evidence_hash
    |      |-- Cache HIT? -> skip
    |      |-- Cache MISS:
    |      |     |-- Load accumulated dd_analysis_results
    |      |     |-- Missing data? -> Execute skills on-demand
    |      |     |-- Consolidate structured JSON
    |      |     |-- Call dd_report_render
    |      |     |-- Store in dd_report_cache + dd_report_versions
    v
dd_report_render (NEW) --- Pure template engine
    |-- Select HTML template by report_type (or fallback)
    |-- Map JSON -> template fields
    |-- Render HTML
    |-- Optionally generate markdown
    v
Next.js API (on-demand)
    |-- /api/reports/pdf  -> Puppeteer -> PDF download
    |-- /api/reports/md   -> markdown download
```

### Dual Skill Execution Model

Skills execute in TWO contexts:

| Context | Trigger | When |
|---|---|---|
| **Automatic (ingestion)** | Document upload to VDR | Each new batch of docs |
| **On-demand (manual)** | User clicks "run analysis" or orchestrator detects missing data | Any time |

Both paths converge on `dd_analysis_results` as the single source of truth.

---

## 3. Workflows

### 3.1 dd_ingest_pipeline (NEW)

**Trigger:** Webhook POST from VDR on document upload
**Path:** `/dd/ingest/batch`

**Node flow:**

```
Webhook POST (batch upload)
  -> Split Documents (1 item per doc)
  -> For Each Document:
      -> Compute content_hash (SHA-256 of binary)
      -> Check dd_vdr_documents.content_hash
          |-- MATCH -> skip -> loop next
          |-- MISS:
              -> Parse document (existing OCR/text pipeline)
              -> Generate embeddings (OpenAI)
              -> Upsert embeddings in pgvector
              -> Update dd_vdr_documents:
                   content_hash = new_hash
                   embedding_status = 'done'
                   last_embedded_at = now()
              -> Determine area_code from doc metadata
              -> Multi-query retrieval:
                   For each required_section of relevant report_types:
                     query pgvector with section-specific query
              -> Execute relevant skills:
                   skill_executor x N (parallel where possible)
              -> Validate pipeline:
                   agent_validador -> agent_paranoico -> agent_sanitizer
              -> UPSERT dd_analysis_results:
                   ON CONFLICT (project_id, area, finding_key)
                   DO UPDATE SET structured_data, evidence_refs, version+1
  -> Post-loop: Invalidate report cache
      UPDATE dd_report_cache SET is_valid = false
      WHERE project_id = X
  -> Respond with ingestion summary
```

### 3.2 dd_report_orchestrator (NEW)

**Trigger:** Webhook POST (manual) or internal call post-ingestion
**Path:** `/dd/report/orchestrate`

**Input:**
```json
{
  "project_id": "uuid",
  "report_type": "string | null",
  "force_refresh": false
}
```

- `report_type = null` -> regenerate all report_types in deal map
- `force_refresh = true` -> ignore cache

**Node flow:**

```
Receive Request
  -> Load project config (deal report map)
  -> For Each report_type:
      -> Compute evidence_hash:
           SHA-256(sorted content_hashes of relevant docs)
      -> Check dd_report_cache:
           WHERE project_id, report_type, evidence_hash, is_valid = true
          |-- HIT (and not force_refresh) -> skip
          |-- MISS:
              -> Load dd_analysis_results for (project, report_type)
              -> Missing required data?
                   -> Execute skills on-demand (skill_executor)
                   -> UPSERT new analysis_results
              -> Consolidate structured JSON output
              -> Call dd_report_render (sub-workflow)
              -> Store:
                   INSERT dd_report_versions (versioned, never deleted)
                   UPSERT dd_report_cache (latest valid)
  -> Respond with list of generated/updated reports
```

### 3.3 dd_report_render (NEW)

**Trigger:** Called as sub-workflow by orchestrator
**Path:** `/dd/report/render`

**Input:**
```json
{
  "report_type": "string",
  "json_output": {},
  "project_metadata": {}
}
```

**Node flow:**

```
Receive JSON + report_type
  -> Select template:
      |-- report_type in DEDICATED_TEMPLATES -> specific template
      |-- else -> generic template by family
  -> Map JSON fields -> template variables
  -> Render HTML (n8n-nodes-base.html node)
  -> IF report needs markdown -> generate .md
  -> Return { html_content, md_content? }
```

### 3.4 Existing Workflows (unchanged)

| Workflow | Status |
|---|---|
| `dd_skill_executor` | No change. Called by ingest_pipeline and orchestrator |
| `dd_harvey_adapter` | No change. Called by skill_executor |
| `dd_agent_validador` | No change. Called by ingest_pipeline |
| `dd_agent_paranoico` | No change. Called by ingest_pipeline |
| `dd_agent_sanitizer` | No change. Called by ingest_pipeline |
| `dd_report_generate` | Gradual deprecation. Redirect to orchestrator |

---

## 4. HTML Templates

### 4.1 Dedicated Templates (8)

| report_type | Reason for dedicated template |
|---|---|
| `societario_standard` | 17 Garrigues fields with specific narrative format |
| `ip_report` | Complex Nice classification trademark matrix table |
| `red_flags_digest` | Visual layout with severity badges + traffic lights |
| `pmo_estado` | Dashboard-style with area progress bars |
| `executive_digest` | Clean executive format for investment committee |
| `ficha_contingencia` | Red flag card with quantification + probability |
| `negotiation_summary` | Buy/sell positions with treatment columns |
| `deal_summary_executive` | Cross-area consolidated for investors |

### 4.2 Generic Fallback Template

For the remaining ~27 report_types:
- Dynamic sections generated from `required_sections`
- Evidence reference table
- Metadata footer with disclaimer
- Consistent visual identity (same CSS framework as dedicated templates)

### 4.3 Template Location

Templates are embedded in the n8n workflow nodes (HTML node content). The source of truth for template HTML lives in the n8n workflow JSON files backed up to `dd-legal-pmo/n8n/`.

---

## 5. Database Schema Changes

### 5.1 Modify: dd_vdr_documents

```sql
ALTER TABLE dd_vdr_documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'done', 'stale')),
  ADD COLUMN IF NOT EXISTS embedding_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vdr_docs_content_hash
  ON dd_vdr_documents(project_id, content_hash);

CREATE INDEX IF NOT EXISTS idx_vdr_docs_embedding_status
  ON dd_vdr_documents(project_id, embedding_status);
```

### 5.2 Create: dd_analysis_results

```sql
CREATE TABLE dd_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  report_type TEXT NOT NULL,
  finding_key TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}',
  evidence_refs TEXT[] DEFAULT '{}',
  confidence_score NUMERIC(3,2) DEFAULT 0.00,
  version INTEGER NOT NULL DEFAULT 1,
  source_skill TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, area, finding_key)
);

ALTER TABLE dd_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_analysis_results_select_authenticated"
  ON dd_analysis_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "dd_analysis_results_all_service"
  ON dd_analysis_results FOR ALL TO service_role USING (true);

CREATE INDEX idx_analysis_results_project_area
  ON dd_analysis_results(project_id, area, report_type);

CREATE INDEX idx_analysis_results_updated
  ON dd_analysis_results(project_id, updated_at DESC);
```

### 5.3 Create: dd_report_cache

```sql
CREATE TABLE dd_report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  html_content TEXT,
  md_content TEXT,
  json_output JSONB,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,

  UNIQUE(project_id, report_type, evidence_hash)
);

ALTER TABLE dd_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_report_cache_select_authenticated"
  ON dd_report_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "dd_report_cache_all_service"
  ON dd_report_cache FOR ALL TO service_role USING (true);

CREATE INDEX idx_report_cache_lookup
  ON dd_report_cache(project_id, report_type, is_valid);
```

### 5.4 Create: dd_report_versions

```sql
CREATE TABLE dd_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  json_output JSONB NOT NULL,
  html_content TEXT,
  md_content TEXT,
  evidence_hash TEXT NOT NULL,
  generated_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, report_type, version)
);

ALTER TABLE dd_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_report_versions_select_authenticated"
  ON dd_report_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "dd_report_versions_all_service"
  ON dd_report_versions FOR ALL TO service_role USING (true);

CREATE INDEX idx_report_versions_project
  ON dd_report_versions(project_id, report_type, version DESC);
```

---

## 6. Cache Invalidation Strategy

### 6.1 TTL by Report Cadence

| Template cadencia | TTL |
|---|---|
| `daily` | 24 hours |
| `weekly` | 7 days |
| `monthly` | 30 days |
| `on_demand` | 30 days |

### 6.2 Invalidation Events

| Event | Action |
|---|---|
| New doc uploaded to project VDR | `UPDATE dd_report_cache SET is_valid = false WHERE project_id = X` |
| Existing doc updated (new content_hash) | Same + `embedding_status = 'stale'` in dd_vdr_documents |
| TTL expired (`valid_until < now()`) | Lazy check in orchestrator |
| `force_refresh = true` in request | Ignore cache completely |
| User requests manual re-generation | Same as force_refresh |

### 6.3 Evidence Hash Calculation

```javascript
const relevantDocs = await supabase
  .from('dd_vdr_documents')
  .select('content_hash')
  .eq('project_id', projectId)
  .eq('embedding_status', 'done')
  .order('content_hash');

const evidenceHash = sha256(
  relevantDocs.map(d => d.content_hash).join('|')
);
```

---

## 7. Next.js API Routes

### 7.1 PDF Generation (on-demand)

**Route:** `GET /api/reports/pdf?report_version_id=xxx`

```typescript
// src/app/api/reports/pdf/route.ts
// 1. Read dd_report_versions.html_content by id
// 2. Launch Puppeteer headless
// 3. setContent(html)
// 4. page.pdf({ format: 'A4', printBackground: true, margin: 40px })
// 5. Return Response with Content-Type: application/pdf
```

### 7.2 Markdown Download

**Route:** `GET /api/reports/md?report_version_id=xxx`

```typescript
// src/app/api/reports/md/route.ts
// 1. Read dd_report_versions.md_content by id
// 2. Return Response with Content-Type: text/markdown
//    Content-Disposition: attachment; filename="report.md"
```

---

## 8. Multi-Query Retrieval Strategy

For each document ingested, the ingest pipeline performs N semantic queries against pgvector, one per `required_section` of the relevant report_type.

### Example: societario_standard

Required sections: `['datos_generales', 'administradores', 'conclusiones']`

Queries executed:
1. "datos generales sociedad denominacion CIF domicilio capital social constitucion"
2. "organo administracion administradores nombramientos apoderados retribucion"
3. "conclusiones red flags riesgos contingencias recomendaciones hallazgos"

Results are aggregated into the evidence pack passed to the skill_executor.

### Query Generation

The orchestrator generates queries by:
1. Reading `required_sections` from REPORT_TEMPLATES
2. Expanding each section name using a mapping of section -> semantic query terms
3. Executing each query against pgvector with `top_k = 10`
4. De-duplicating and ranking results by relevance score

---

## 9. Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Multi-query approach | Both: VDR retrieval + multi-skill orchestration | Maximum context coverage for analysis |
| HTML template granularity | 8 dedicated + generic fallback | Balance between quality and maintenance |
| Cache architecture | Two levels: document + report | Avoids both re-parsing and re-generation |
| PDF generation | Hybrid: HTML in n8n, PDF on-demand in Next.js | Avoids generating PDFs nobody downloads |
| Rendering engine | n8n HTML node | Keeps report pipeline in n8n ecosystem |
| Cache location | Supabase tables | Consistent with existing stack |
| Skill execution timing | Ingestion (auto) + on-demand (manual) | Both paths needed for complete coverage |
| Analysis storage | Accumulative upsert in dd_analysis_results | Supports incremental document batches |
| Custom reports | Markdown output for external .doc/.pptx formatting | Pragmatic for current phase |

---

## 10. Files Affected

### New n8n Workflows
- `dd-legal-pmo/n8n/dd_ingest_pipeline.workflow.json`
- `dd-legal-pmo/n8n/dd_report_orchestrator.workflow.json`
- `dd-legal-pmo/n8n/dd_report_render.workflow.json`

### New Supabase Migrations
- `dd-legal-pmo/supabase/migrations/YYYYMMDD0001_add_vdr_cache_columns.sql`
- `dd-legal-pmo/supabase/migrations/YYYYMMDD0002_create_analysis_results.sql`
- `dd-legal-pmo/supabase/migrations/YYYYMMDD0003_create_report_cache.sql`
- `dd-legal-pmo/supabase/migrations/YYYYMMDD0004_create_report_versions.sql`

### New Next.js API Routes
- `dd-legal-pmo/src/app/api/reports/pdf/route.ts`
- `dd-legal-pmo/src/app/api/reports/md/route.ts`

### Modified Files
- `dd-legal-pmo/src/lib/reporting/templates.ts` (add template metadata for HTML selection)
- `dd-legal-pmo/n8n/dd_report_generate.workflow.json` (redirect to orchestrator)

### No Changes
- `dd_skill_executor`, `dd_harvey_adapter`, `dd_agent_validador`, `dd_agent_paranoico`, `dd_agent_sanitizer`
