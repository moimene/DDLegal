# Horizonte 2: Robustez y Profundidad — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar el pipeline documental con PDF extraction, queue system, retry logic, area-specific extraction extensions, y dashboard de observabilidad del Worker.

**Architecture:** El plan extiende la infraestructura existente del Worker Architecture v1.0 con: (1) extracción de texto de PDFs pre-chunking, (2) sistema de colas BullMQ para procesamiento asíncrono, (3) retry con exponential backoff para embeddings, (4) extensiones de extracción para PI/LAB/FISC, (5) validación de completitud de facts vs FO requirements, (6) push notifications via Supabase Realtime, (7) dashboard UI del Worker.

**Tech Stack:** pdf-parse (Node), BullMQ + Redis, Supabase Realtime, Next.js API routes, React components

**Source Document:** `docs/architecture/DOCUMENT_STRATEGY_v1.md` (Horizonte 2: H2.1-H2.10)

---

## Task Overview (12 Tasks)

| # | Task | Gap | Priority |
|---|------|-----|----------|
| 1 | PDF text extraction pre-chunking | G-09 | CRITICAL |
| 2 | Retry embeddings with exponential backoff | G-07 | HIGH |
| 3 | PI/LAB/FISC extraction extensions | G-18 | HIGH |
| 4 | Validación completitud facts vs FO.data_required | G-19 | HIGH |
| 5 | 'blocked' status in dd_fo_document_status | G-21 | MEDIUM |
| 6 | BullMQ queue system foundation | G-23 | HIGH |
| 7 | Trigger automático SENSE post-ingesta | G-22 | CRITICAL |
| 8 | Push notifications VDR via Realtime | G-04 | HIGH |
| 9 | BM25 en API routes | G-10 | MEDIUM |
| 10 | Evidence threshold configurable | G-11 | MEDIUM |
| 11 | Worker dashboard UI | — | HIGH |
| 12 | Seed carpetas por defecto | G-05 | LOW |

---

## Task 1: PDF Text Extraction Pre-Chunking (G-09 CRITICAL)

**Files:**
- Create: `src/lib/vdr/pdf-extractor.ts`
- Modify: `src/lib/vdr/ingest.ts:24-35`
- Modify: `package.json` (add pdf-parse dependency)

**Step 1: Install pdf-parse dependency**

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

**Step 2: Create pdf-extractor.ts**

```typescript
/**
 * PDF Text Extractor — Horizonte 2 (G-09)
 *
 * Extracts text content from PDF files using pdf-parse.
 * Integrates with VDR ingest pipeline pre-chunking.
 */

import pdf from 'pdf-parse';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  success: boolean;
  error?: string;
}

/**
 * Extract text from a PDF stored in Supabase Storage.
 *
 * @param storagePath - Path to the PDF in Supabase Storage
 * @param bucket - Storage bucket name (default: 'vdr-documents')
 * @returns Extracted text and metadata
 */
export async function extractPdfText(
  storagePath: string,
  bucket: string = 'vdr-documents'
): Promise<PdfExtractionResult> {
  try {
    // Download PDF from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (error || !data) {
      return {
        text: '',
        pageCount: 0,
        metadata: {},
        success: false,
        error: `Failed to download PDF: ${error?.message || 'Unknown error'}`,
      };
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await pdf(buffer);

    return {
      text: pdfData.text,
      pageCount: pdfData.numpages,
      metadata: {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        creationDate: pdfData.info?.CreationDate,
        modificationDate: pdfData.info?.ModDate,
      },
      success: true,
    };
  } catch (err) {
    return {
      text: '',
      pageCount: 0,
      metadata: {},
      success: false,
      error: `PDF parsing failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Check if a file is a PDF based on its name or MIME type.
 */
export function isPdfFile(filename: string, mimeType?: string): boolean {
  if (mimeType === 'application/pdf') return true;
  return filename.toLowerCase().endsWith('.pdf');
}

/**
 * Extract text from a VDR document by its ID.
 * Fetches the latest version's storage path and extracts text.
 */
export async function extractPdfFromDocument(
  documentId: string
): Promise<PdfExtractionResult> {
  // Get document with latest version
  const { data: doc, error: docError } = await supabaseAdmin
    .from('vdr_documents')
    .select(`
      id,
      name,
      vdr_document_versions!inner (
        id,
        storage_path,
        mime_type,
        version_number
      )
    `)
    .eq('id', documentId)
    .order('version_number', { foreignTable: 'vdr_document_versions', ascending: false })
    .limit(1, { foreignTable: 'vdr_document_versions' })
    .single();

  if (docError || !doc) {
    return {
      text: '',
      pageCount: 0,
      metadata: {},
      success: false,
      error: `Document not found: ${documentId}`,
    };
  }

  const versions = doc.vdr_document_versions as Array<{
    storage_path: string;
    mime_type: string;
  }>;

  if (!versions || versions.length === 0) {
    return {
      text: '',
      pageCount: 0,
      metadata: {},
      success: false,
      error: 'No versions found for document',
    };
  }

  const latestVersion = versions[0];

  if (!isPdfFile(doc.name, latestVersion.mime_type)) {
    return {
      text: '',
      pageCount: 0,
      metadata: {},
      success: false,
      error: 'Document is not a PDF',
    };
  }

  return extractPdfText(latestVersion.storage_path);
}
```

**Step 3: Modify ingest.ts to use PDF extraction**

Modify `src/lib/vdr/ingest.ts` at line 24-35 (inside `processIngestion`):

```typescript
// Add import at top of file
import { extractPdfFromDocument, isPdfFile } from './pdf-extractor';

// Replace lines 31-35 with:
    let textContent = doc.description || doc.name;

    // Try to extract text from PDF if applicable
    if (isPdfFile(doc.name)) {
      const pdfResult = await extractPdfFromDocument(documentId);
      if (pdfResult.success && pdfResult.text.trim().length > 0) {
        textContent = pdfResult.text;
        console.log(`[ingest] Extracted ${pdfResult.pageCount} pages from PDF ${doc.name}`);
      } else if (pdfResult.error) {
        console.warn(`[ingest] PDF extraction failed for ${doc.name}: ${pdfResult.error}`);
        // Fall back to description/name
      }
    }

    if (versionId) {
      const { data: version } = await supabaseAdmin.from('vdr_document_versions').select('change_notes').eq('id', versionId).single();
      if (version?.change_notes) textContent = version.change_notes + '\n\n' + textContent;
    }
```

**Step 4: Run build to verify**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 5: Commit**

```bash
git add src/lib/vdr/pdf-extractor.ts src/lib/vdr/ingest.ts package.json package-lock.json
git commit -m "feat(vdr): add PDF text extraction pre-chunking (G-09)

- Add pdf-parse for extracting text from PDF files
- Integrate PDF extraction into ingest pipeline
- Fall back to description if PDF extraction fails
- Extract metadata (title, author, dates) from PDF

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Retry Embeddings with Exponential Backoff (G-07)

**Files:**
- Modify: `src/lib/embeddings/openai.ts:28-50`

**Step 1: Update fetchWithRetry with proper exponential backoff**

Replace the `fetchWithRetry` function in `src/lib/embeddings/openai.ts`:

```typescript
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 4s, 16s

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000, // 1 minute max
};

async function fetchWithRetry(
  texts: string[],
  apiKey: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: MODEL, input: texts }),
      });

      // Handle rate limiting with Retry-After header
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(config.baseDelayMs * Math.pow(4, attempt), config.maxDelayMs);

        console.warn(`[embeddings] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${config.maxRetries}`);
        await sleep(waitMs);
        continue;
      }

      // Handle server errors (5xx) with exponential backoff
      if (res.status >= 500 && res.status < 600) {
        const waitMs = Math.min(config.baseDelayMs * Math.pow(4, attempt), config.maxDelayMs);
        console.warn(`[embeddings] Server error (${res.status}), waiting ${waitMs}ms before retry ${attempt + 1}/${config.maxRetries}`);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
      }

      const body: EmbeddingResponse = await res.json();
      return body.data.sort((a, b) => a.index - b.index).map(d => d.embedding);

    } catch (err) {
      lastError = err as Error;

      // Don't retry on non-transient errors
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        throw lastError;
      }

      if (attempt < config.maxRetries - 1) {
        const waitMs = Math.min(config.baseDelayMs * Math.pow(4, attempt), config.maxDelayMs);
        console.warn(`[embeddings] Request failed, waiting ${waitMs}ms before retry ${attempt + 1}/${config.maxRetries}: ${lastError.message}`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError || new Error('Embedding generation failed after all retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Step 2: Run build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/embeddings/openai.ts
git commit -m "feat(embeddings): add exponential backoff retry (G-07)

- Implement 3 retries with 1s, 4s, 16s delays
- Handle Retry-After header for rate limiting
- Separate handling for 5xx vs 4xx errors
- Skip retry for auth errors (401, 403)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: PI/LAB/FISC Extraction Extensions (G-18)

**Files:**
- Modify: `src/lib/worker/fact-extractor.ts:160-166` (add new interfaces)
- Modify: `src/lib/worker/fact-extractor.ts:268-320` (add extension prompts)
- Modify: `src/lib/worker/fact-extractor.ts:300-320` (update getAreaExtensions)

**Step 1: Add PI/LAB/FISC fact interfaces**

Add after line 159 (after AdministrativeFacts interface):

```typescript
export interface PIFacts {
  registros: Array<{
    tipo: 'marca' | 'patente' | 'diseno' | 'nombre_comercial' | 'otro';
    numero_registro: string;
    clases_niza: number[];
    territorio: string;
    fecha_concesion: string | null;
    fecha_renovacion: string | null;
    titular: string;
    estado: 'vigente' | 'caducada' | 'en_tramite' | 'cancelada';
  }>;
  licencias: Array<{
    tipo: 'inbound' | 'outbound';
    licenciante: string;
    licenciatario: string;
    exclusiva: boolean;
    territorio: string;
    royalty_percent: number | null;
    duracion: string | null;
    objeto: string;
  }>;
  conflictos: Array<{
    tipo: 'oposicion' | 'nulidad' | 'infraccion' | 'otro';
    contraparte: string;
    estado: string;
    riesgo: 'alto' | 'medio' | 'bajo';
  }>;
}

export interface LaboralFacts {
  plantilla: {
    total: number | null;
    fijos: number | null;
    temporales: number | null;
    directivos: number | null;
    fecha_datos: string | null;
  };
  convenio: {
    vigente: boolean;
    denominacion: string | null;
    fecha_vencimiento: string | null;
    ultraactividad: boolean;
  };
  litigios: Array<{
    tipo: 'despido' | 'reclamacion_cantidad' | 'accidente' | 'acoso' | 'otro';
    demandante: string;
    cuantia: number | null;
    estado: string;
    provision: number | null;
  }>;
  alta_direccion: Array<{
    nombre: string;
    cargo: string;
    blindaje_meses: number | null;
    non_compete_meses: number | null;
    retribucion_fija: number | null;
    retribucion_variable: number | null;
  }>;
  ERE_ERTE: {
    vigente: boolean;
    tipo: 'ERE' | 'ERTE' | null;
    afectados: number | null;
    fecha_fin: string | null;
  };
}

export interface FiscalFacts {
  modelo: string | null;
  ejercicio: string | null;
  resultado_fiscal: number | null;
  bases_imponibles_negativas: number | null;
  creditos_fiscales: number | null;
  provisiones_fiscales: number | null;
  precios_transferencia: {
    existe_documentacion: boolean;
    entidades_vinculadas: string[];
    riesgo_ajuste: 'alto' | 'medio' | 'bajo' | null;
  };
  inspecciones: {
    abiertas: Array<{ impuesto: string; ejercicios: string; estado: string }>;
    actas_firmadas: Array<{ impuesto: string; importe: number; conformidad: boolean }>;
    recursos_pendientes: Array<{ organo: string; cuantia: number; estado: string }>;
  };
}
```

**Step 2: Add extraction prompt extensions**

Add after line 290 (after ADM_EXTRACTION_EXTENSION):

```typescript
const PI_EXTRACTION_EXTENSION = `

10. INTELLECTUAL PROPERTY (if area_codes includes PI)
    Extract:
    - registros: [{ tipo (marca/patente/diseno/nombre_comercial/otro), numero_registro, clases_niza[], territorio, fecha_concesion, fecha_renovacion, titular, estado }]
    - licencias: [{ tipo (inbound/outbound), licenciante, licenciatario, exclusiva, territorio, royalty_percent, duracion, objeto }]
    - conflictos: [{ tipo, contraparte, estado, riesgo }]

    Add to response: "pi": { ... }
`;

const LAB_EXTRACTION_EXTENSION = `

11. LABOR (if area_codes includes LAB)
    Extract:
    - plantilla: { total, fijos, temporales, directivos, fecha_datos }
    - convenio: { vigente, denominacion, fecha_vencimiento, ultraactividad }
    - litigios: [{ tipo, demandante, cuantia, estado, provision }]
    - alta_direccion: [{ nombre, cargo, blindaje_meses, non_compete_meses, retribucion_fija, retribucion_variable }]
    - ERE_ERTE: { vigente, tipo, afectados, fecha_fin }

    Add to response: "laboral": { ... }
`;

const FISC_EXTRACTION_EXTENSION = `

12. FISCAL (if area_codes includes FISC)
    Extract:
    - modelo, ejercicio, resultado_fiscal
    - bases_imponibles_negativas, creditos_fiscales, provisiones_fiscales
    - precios_transferencia: { existe_documentacion, entidades_vinculadas[], riesgo_ajuste }
    - inspecciones: { abiertas[], actas_firmadas[], recursos_pendientes[] }

    Add to response: "fiscal": { ... }
`;
```

**Step 3: Update getAreaExtensions function**

Replace the getAreaExtensions function (around line 300-320):

```typescript
export function getAreaExtensions(areaCodes: string[], docType: string): string {
  const extensions: string[] = [];

  // CA extraction for annual accounts documents
  const caDocTypes = ['cuentas_anuales', 'informe_auditoria', 'certificado_rm', 'einf'];
  if (areaCodes.includes('MERC') && caDocTypes.includes(docType)) {
    extensions.push(CA_EXTRACTION_EXTENSION);
  }

  // LIT extraction
  if (areaCodes.includes('LIT')) {
    extensions.push(LIT_EXTRACTION_EXTENSION);
  }

  // ADM extraction
  if (areaCodes.includes('ADM')) {
    extensions.push(ADM_EXTRACTION_EXTENSION);
  }

  // PI extraction
  if (areaCodes.includes('PI')) {
    extensions.push(PI_EXTRACTION_EXTENSION);
  }

  // LAB extraction
  if (areaCodes.includes('LAB')) {
    extensions.push(LAB_EXTRACTION_EXTENSION);
  }

  // FISC extraction
  if (areaCodes.includes('FISC')) {
    extensions.push(FISC_EXTRACTION_EXTENSION);
  }

  return extensions.join('\n');
}
```

**Step 4: Update ExtendedDocumentFacts interface**

Update the ExtendedDocumentFacts interface (around line 162-166):

```typescript
export interface ExtendedDocumentFacts extends DocumentFacts {
  annual_accounts?: AnnualAccountsFacts;
  litigation?: LitigationFacts;
  administrative?: AdministrativeFacts;
  pi?: PIFacts;
  laboral?: LaboralFacts;
  fiscal?: FiscalFacts;
}
```

**Step 5: Run build to verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/lib/worker/fact-extractor.ts
git commit -m "feat(worker): add PI/LAB/FISC extraction extensions (G-18)

- Add PIFacts interface for IP registrations, licenses, conflicts
- Add LaboralFacts interface for workforce, agreements, litigation
- Add FiscalFacts interface for tax data, inspections, transfer pricing
- Update getAreaExtensions to include all area prompts
- Extend ExtendedDocumentFacts with new area types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Validación Completitud Facts vs FO.data_required (G-19)

**Files:**
- Create: `src/lib/worker/completeness-validator.ts`
- Modify: `src/lib/worker/sense-phase.ts` (integrate validation)

**Step 1: Create completeness-validator.ts**

```typescript
/**
 * Completeness Validator — Horizonte 2 (G-19)
 *
 * Validates that extracted document facts satisfy FO data requirements.
 * Used by SENSE phase to determine FO evaluability.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { DocumentFacts } from './fact-extractor';

export interface DataRequirement {
  doc_types: string[];
  sample?: string;
  extractions: string[];
}

export interface CompletenessResult {
  objectiveKey: string;
  documentId: string;
  isComplete: boolean;
  missingDocTypes: string[];
  missingExtractions: string[];
  completenessScore: number; // 0-100
}

/**
 * Validate that a document's facts satisfy an FO's data requirements.
 */
export async function validateFactsCompleteness(
  documentId: string,
  projectId: string,
  objectiveKey: string
): Promise<CompletenessResult> {
  // 1. Get FO data requirements
  const { data: fo, error: foError } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('objective_key, data_required')
    .eq('objective_key', objectiveKey)
    .single();

  if (foError || !fo) {
    return {
      objectiveKey,
      documentId,
      isComplete: false,
      missingDocTypes: [],
      missingExtractions: ['FO not found'],
      completenessScore: 0,
    };
  }

  const dataRequired = fo.data_required as DataRequirement | null;

  if (!dataRequired) {
    // No requirements = always complete
    return {
      objectiveKey,
      documentId,
      isComplete: true,
      missingDocTypes: [],
      missingExtractions: [],
      completenessScore: 100,
    };
  }

  // 2. Get document facts
  const { data: facts, error: factsError } = await supabaseAdmin
    .from('dd_document_facts')
    .select('*')
    .eq('document_id', documentId)
    .eq('project_id', projectId)
    .single();

  if (factsError || !facts) {
    return {
      objectiveKey,
      documentId,
      isComplete: false,
      missingDocTypes: dataRequired.doc_types || [],
      missingExtractions: dataRequired.extractions || [],
      completenessScore: 0,
    };
  }

  // 3. Check doc_type match
  const missingDocTypes: string[] = [];
  if (dataRequired.doc_types && dataRequired.doc_types.length > 0) {
    const docType = facts.document_type;
    if (!docType || !dataRequired.doc_types.includes(docType)) {
      missingDocTypes.push(...dataRequired.doc_types);
    }
  }

  // 4. Check extraction completeness
  const missingExtractions: string[] = [];
  if (dataRequired.extractions && dataRequired.extractions.length > 0) {
    for (const extraction of dataRequired.extractions) {
      if (!hasExtraction(facts, extraction)) {
        missingExtractions.push(extraction);
      }
    }
  }

  // 5. Calculate completeness score
  const totalRequirements =
    (dataRequired.doc_types?.length || 0) +
    (dataRequired.extractions?.length || 0);

  const metRequirements =
    totalRequirements - missingDocTypes.length - missingExtractions.length;

  const completenessScore = totalRequirements > 0
    ? Math.round((metRequirements / totalRequirements) * 100)
    : 100;

  return {
    objectiveKey,
    documentId,
    isComplete: missingDocTypes.length === 0 && missingExtractions.length === 0,
    missingDocTypes,
    missingExtractions,
    completenessScore,
  };
}

/**
 * Check if facts contain a specific extraction type.
 */
function hasExtraction(facts: Record<string, unknown>, extraction: string): boolean {
  switch (extraction) {
    case 'parties':
      return Array.isArray(facts.parties) && facts.parties.length > 0;
    case 'dates':
      return !!(facts.effective_date || facts.signing_date || facts.expiration_date);
    case 'amounts':
      return Array.isArray(facts.amounts) && facts.amounts.length > 0;
    case 'clauses':
      return Array.isArray(facts.clauses) && facts.clauses.length > 0;
    case 'obligations':
      return Array.isArray(facts.obligations) && facts.obligations.length > 0;
    case 'classification':
      return !!(facts.document_type && facts.area_codes);
    case 'annual_accounts':
      return !!facts.metadata?.annual_accounts;
    case 'litigation':
      return !!facts.metadata?.litigation;
    case 'administrative':
      return !!facts.metadata?.administrative;
    case 'pi':
      return !!facts.metadata?.pi;
    case 'laboral':
      return !!facts.metadata?.laboral;
    case 'fiscal':
      return !!facts.metadata?.fiscal;
    default:
      // Check in metadata
      return !!facts.metadata?.[extraction];
  }
}

/**
 * Batch validate completeness for multiple FO-document pairs.
 */
export async function batchValidateCompleteness(
  projectId: string,
  pairs: Array<{ documentId: string; objectiveKey: string }>
): Promise<CompletenessResult[]> {
  const results: CompletenessResult[] = [];

  for (const pair of pairs) {
    const result = await validateFactsCompleteness(
      pair.documentId,
      projectId,
      pair.objectiveKey
    );
    results.push(result);
  }

  return results;
}
```

**Step 2: Run build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/worker/completeness-validator.ts
git commit -m "feat(worker): add completeness validation for facts vs FO requirements (G-19)

- Validate document facts against FO.data_required
- Check doc_types match and extraction completeness
- Calculate completeness score (0-100)
- Support batch validation for multiple pairs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 'blocked' Status in dd_fo_document_status (G-21)

**Files:**
- Create: `supabase/migrations/202602280032_add_blocked_status.sql`

**Step 1: Create migration**

```sql
-- Migration: Add 'blocked' status to dd_fo_document_status
-- Task 5 of 12: G-21 - Blocked status for missing documents
-- Allows marking FOs as blocked when required documents are missing

BEGIN;

-- Add blocked_reason column
ALTER TABLE dd_fo_document_status
ADD COLUMN IF NOT EXISTS blocked_reason TEXT DEFAULT NULL;

-- Add blocked_at timestamp
ALTER TABLE dd_fo_document_status
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ DEFAULT NULL;

-- Add missing_doc_types array
ALTER TABLE dd_fo_document_status
ADD COLUMN IF NOT EXISTS missing_doc_types TEXT[] DEFAULT '{}';

-- Update status enum to include 'blocked'
-- First, create a new type with the additional value
DO $$
BEGIN
  -- Check if 'blocked' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'blocked'
    AND enumtypid = 'dd_fo_doc_status_type'::regtype
  ) THEN
    ALTER TYPE dd_fo_doc_status_type ADD VALUE IF NOT EXISTS 'blocked' AFTER 'error';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Type doesn't exist, check constraint might be used instead
    NULL;
END $$;

-- If using CHECK constraint instead of enum type, update it
-- This handles both cases
DO $$
BEGIN
  -- Try to add blocked to check constraint if it exists
  ALTER TABLE dd_fo_document_status
  DROP CONSTRAINT IF EXISTS dd_fo_document_status_status_check;

  ALTER TABLE dd_fo_document_status
  ADD CONSTRAINT dd_fo_document_status_status_check
  CHECK (status IN ('pending', 'analyzing', 'analyzed', 'error', 'blocked'));
EXCEPTION
  WHEN undefined_object THEN
    -- Constraint doesn't exist, enum type is used
    NULL;
  WHEN others THEN
    NULL;
END $$;

-- Create index for blocked documents
CREATE INDEX IF NOT EXISTS idx_fo_doc_status_blocked
ON dd_fo_document_status (project_id, status)
WHERE status = 'blocked';

-- Add RPC to block FO-document pairs
CREATE OR REPLACE FUNCTION block_fo_document(
  p_document_id UUID,
  p_objective_id UUID,
  p_reason TEXT,
  p_missing_doc_types TEXT[] DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  UPDATE dd_fo_document_status
  SET
    status = 'blocked',
    blocked_reason = p_reason,
    blocked_at = NOW(),
    missing_doc_types = p_missing_doc_types
  WHERE document_id = p_document_id
    AND objective_id = p_objective_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RPC to unblock FO-document pairs
CREATE OR REPLACE FUNCTION unblock_fo_document(
  p_document_id UUID,
  p_objective_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE dd_fo_document_status
  SET
    status = 'pending',
    blocked_reason = NULL,
    blocked_at = NULL,
    missing_doc_types = '{}'
  WHERE document_id = p_document_id
    AND objective_id = p_objective_id
    AND status = 'blocked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RPC to get blocked FOs for a project
CREATE OR REPLACE FUNCTION get_blocked_fos(p_project_id UUID)
RETURNS TABLE (
  document_id UUID,
  objective_id UUID,
  objective_key TEXT,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  missing_doc_types TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fs.document_id,
    fs.objective_id,
    fo.objective_key,
    fs.blocked_reason,
    fs.blocked_at,
    fs.missing_doc_types
  FROM dd_fo_document_status fs
  JOIN dd_finding_objectives fo ON fo.id = fs.objective_id
  WHERE fs.project_id = p_project_id
    AND fs.status = 'blocked'
  ORDER BY fs.blocked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
```

**Step 2: Apply migration via Supabase MCP**

Use Supabase MCP tool to apply the migration.

**Step 3: Commit**

```bash
git add supabase/migrations/202602280032_add_blocked_status.sql
git commit -m "feat(db): add 'blocked' status to dd_fo_document_status (G-21)

- Add blocked status for FOs missing required documents
- Add blocked_reason, blocked_at, missing_doc_types columns
- Create block_fo_document and unblock_fo_document RPCs
- Add get_blocked_fos RPC for project-level view
- Index for efficient blocked status queries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: BullMQ Queue System Foundation (G-23)

**Files:**
- Create: `src/lib/queue/index.ts`
- Create: `src/lib/queue/workers/ingest-worker.ts`
- Create: `src/lib/queue/workers/extraction-worker.ts`
- Modify: `package.json` (add bullmq, ioredis)

**Step 1: Install dependencies**

```bash
npm install bullmq ioredis
```

**Step 2: Create queue/index.ts**

```typescript
/**
 * BullMQ Queue System — Horizonte 2 (G-23)
 *
 * Central queue management for async processing:
 * - Document ingestion
 * - Fact extraction
 * - FO evaluation
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection - use REDIS_URL env var or default to localhost
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    connection.on('error', (err) => {
      console.error('[queue] Redis connection error:', err);
    });

    connection.on('connect', () => {
      console.log('[queue] Connected to Redis');
    });
  }
  return connection;
}

// Queue definitions
export const QUEUE_NAMES = {
  INGEST: 'dd-ingest',
  EXTRACTION: 'dd-extraction',
  EVALUATION: 'dd-evaluation',
  WORKER_CYCLE: 'dd-worker-cycle',
} as const;

// Queue instances (lazy-initialized)
let queues: Map<string, Queue> = new Map();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 500,     // Keep last 500 failed
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

// Job type definitions
export interface IngestJobData {
  documentId: string;
  versionId?: string;
  projectId: string;
  priority?: number;
}

export interface ExtractionJobData {
  documentId: string;
  projectId: string;
  forceReExtract?: boolean;
}

export interface EvaluationJobData {
  projectId: string;
  objectiveKey?: string;
  documentId?: string;
  batchSize?: number;
}

export interface WorkerCycleJobData {
  projectId: string;
  mode: 'continuous' | 'targeted' | 'full_sweep' | 'on_demand';
  targetArea?: string;
}

// Queue helpers
export async function enqueueIngest(data: IngestJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.INGEST);
  const job = await queue.add('ingest', data, {
    priority: data.priority || 0,
    jobId: `ingest:${data.documentId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueExtraction(data: ExtractionJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EXTRACTION);
  const job = await queue.add('extract', data, {
    jobId: `extract:${data.documentId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueEvaluation(data: EvaluationJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EVALUATION);
  const job = await queue.add('evaluate', data, {
    jobId: `evaluate:${data.projectId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueWorkerCycle(data: WorkerCycleJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.WORKER_CYCLE);
  const job = await queue.add('cycle', data, {
    jobId: `cycle:${data.projectId}:${Date.now()}`,
  });
  return job.id || '';
}

// Queue stats
export async function getQueueStats(queueName: string) {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();

  if (connection) {
    await connection.quit();
    connection = null;
  }
}
```

**Step 3: Create workers/ingest-worker.ts**

```typescript
/**
 * Ingest Worker — BullMQ processor for document ingestion
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES, type IngestJobData } from '../index';
import { startIngestion } from '@/lib/vdr/ingest';

let worker: Worker | null = null;

export function startIngestWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<IngestJobData>(
    QUEUE_NAMES.INGEST,
    async (job: Job<IngestJobData>) => {
      const { documentId, versionId } = job.data;

      console.log(`[ingest-worker] Processing document ${documentId}`);

      try {
        const jobId = await startIngestion(documentId, versionId);
        return { success: true, ingestionJobId: jobId };
      } catch (error) {
        console.error(`[ingest-worker] Failed to process ${documentId}:`, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5, // Process 5 documents concurrently
      limiter: {
        max: 10,
        duration: 1000, // 10 jobs per second max
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[ingest-worker] Completed ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ingest-worker] Failed ${job?.id}:`, err);
  });

  return worker;
}

export function stopIngestWorker(): Promise<void> {
  if (worker) {
    return worker.close();
  }
  return Promise.resolve();
}
```

**Step 4: Create workers/extraction-worker.ts**

```typescript
/**
 * Extraction Worker — BullMQ processor for fact extraction
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES, type ExtractionJobData } from '../index';
import { extractDocumentFacts } from '@/lib/worker/fact-extractor';

let worker: Worker | null = null;

export function startExtractionWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<ExtractionJobData>(
    QUEUE_NAMES.EXTRACTION,
    async (job: Job<ExtractionJobData>) => {
      const { documentId, projectId, forceReExtract } = job.data;

      console.log(`[extraction-worker] Processing document ${documentId}`);

      try {
        const result = await extractDocumentFacts(documentId, projectId, {
          forceReExtract,
        });
        return {
          success: true,
          factId: result.factId,
          cached: result.cached,
          confidence: result.extractionConfidence,
        };
      } catch (error) {
        console.error(`[extraction-worker] Failed to extract ${documentId}:`, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3, // AI calls are expensive, limit concurrency
      limiter: {
        max: 5,
        duration: 1000, // 5 extractions per second max
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[extraction-worker] Completed ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[extraction-worker] Failed ${job?.id}:`, err);
  });

  return worker;
}

export function stopExtractionWorker(): Promise<void> {
  if (worker) {
    return worker.close();
  }
  return Promise.resolve();
}
```

**Step 5: Run build to verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/lib/queue package.json package-lock.json
git commit -m "feat(queue): add BullMQ queue system foundation (G-23)

- Add bullmq and ioredis dependencies
- Create central queue management module
- Add ingest worker with 5 concurrent jobs
- Add extraction worker with 3 concurrent jobs
- Queue stats and graceful shutdown support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Trigger Automático SENSE Post-Ingesta (G-22)

**Files:**
- Modify: `src/lib/vdr/ingest.ts` (add queue trigger)
- Create: `src/app/api/worker/trigger/route.ts`

**Step 1: Modify ingest.ts to trigger SENSE after successful ingestion**

Add after line 95 in `ingest.ts` (after the Worker classification hook):

```typescript
    // G-22: Trigger automatic SENSE phase after successful ingestion
    // This ensures the Worker picks up new documents immediately
    if (DD_WORKER_ENABLED && doc.project_id) {
      triggerWorkerSense(doc.project_id).catch(err => {
        console.error(`[ingest] Failed to trigger SENSE for project ${doc.project_id}:`, err);
      });
    }
```

Add the trigger function at the end of the file:

```typescript
/**
 * G-22: Trigger Worker SENSE phase for a project.
 * Non-blocking: queues a SENSE cycle if not already running.
 */
async function triggerWorkerSense(projectId: string): Promise<void> {
  try {
    // Check if worker is already running
    const { data: run } = await supabaseAdmin
      .from('dd_worker_runs')
      .select('id, status')
      .eq('project_id', projectId)
      .in('status', ['sensing', 'normalizing', 'evaluating', 'concluding'])
      .single();

    if (run) {
      // Worker already active, skip trigger
      console.log(`[ingest] Worker already active for ${projectId}, skipping SENSE trigger`);
      return;
    }

    // Queue a SENSE cycle via internal API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/worker/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ projectId }),
    });

    console.log(`[ingest] Triggered SENSE for project ${projectId}`);
  } catch (err) {
    console.error(`[ingest] Error triggering SENSE:`, err);
  }
}
```

**Step 2: Create worker trigger API route**

```typescript
/**
 * Worker Trigger API — POST /api/worker/trigger
 *
 * Triggers a Worker SENSE cycle for a project.
 * Protected by CRON_SECRET for internal use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { startWorker } from '@/lib/worker/worker-controller';

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET for internal calls
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required' },
        { status: 400 }
      );
    }

    // Start worker in on_demand mode
    const state = await startWorker({
      projectId,
      mode: 'on_demand',
    });

    return NextResponse.json({
      success: true,
      runId: state.runId,
      status: state.status,
    });
  } catch (error) {
    console.error('[worker/trigger] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 3: Run build to verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/vdr/ingest.ts src/app/api/worker/trigger/route.ts
git commit -m "feat(worker): add automatic SENSE trigger post-ingesta (G-22)

- Trigger Worker SENSE after successful document ingestion
- Check if worker is already active before triggering
- Add /api/worker/trigger endpoint for internal use
- Protected by CRON_SECRET for security

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Push Notifications VDR via Supabase Realtime (G-04)

**Files:**
- Create: `src/lib/vdr/realtime-notifications.ts`
- Create: `src/hooks/use-vdr-notifications.ts`

**Step 1: Create realtime-notifications.ts**

```typescript
/**
 * VDR Realtime Notifications — Horizonte 2 (G-04)
 *
 * Publishes events to Supabase Realtime when VDR documents change.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

export type VdrEventType =
  | 'document_uploaded'
  | 'document_ingested'
  | 'document_classified'
  | 'document_extracted'
  | 'gap_analysis_updated';

export interface VdrNotification {
  type: VdrEventType;
  projectId: string;
  documentId?: string;
  documentName?: string;
  areaCode?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Publish a VDR event to Supabase Realtime.
 * Clients can subscribe to `vdr-events:{projectId}` channel.
 */
export async function publishVdrEvent(notification: VdrNotification): Promise<void> {
  const channel = `vdr-events:${notification.projectId}`;

  try {
    // Use Supabase's broadcast feature
    await supabaseAdmin
      .channel(channel)
      .send({
        type: 'broadcast',
        event: notification.type,
        payload: notification,
      });

    console.log(`[vdr-realtime] Published ${notification.type} to ${channel}`);
  } catch (error) {
    console.error(`[vdr-realtime] Failed to publish event:`, error);
    // Non-blocking: don't throw, just log
  }
}

/**
 * Notify document uploaded.
 */
export async function notifyDocumentUploaded(
  projectId: string,
  documentId: string,
  documentName: string,
  areaCode?: string
): Promise<void> {
  await publishVdrEvent({
    type: 'document_uploaded',
    projectId,
    documentId,
    documentName,
    areaCode,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify document ingested (chunked & embedded).
 */
export async function notifyDocumentIngested(
  projectId: string,
  documentId: string,
  documentName: string,
  chunksCreated: number
): Promise<void> {
  await publishVdrEvent({
    type: 'document_ingested',
    projectId,
    documentId,
    documentName,
    timestamp: new Date().toISOString(),
    metadata: { chunksCreated },
  });
}

/**
 * Notify document classified.
 */
export async function notifyDocumentClassified(
  projectId: string,
  documentId: string,
  documentName: string,
  documentType: string,
  areaCodes: string[],
  confidence: number
): Promise<void> {
  await publishVdrEvent({
    type: 'document_classified',
    projectId,
    documentId,
    documentName,
    areaCode: areaCodes[0],
    timestamp: new Date().toISOString(),
    metadata: { documentType, areaCodes, confidence },
  });
}

/**
 * Notify document facts extracted.
 */
export async function notifyDocumentExtracted(
  projectId: string,
  documentId: string,
  documentName: string,
  extractionConfidence: number,
  cached: boolean
): Promise<void> {
  await publishVdrEvent({
    type: 'document_extracted',
    projectId,
    documentId,
    documentName,
    timestamp: new Date().toISOString(),
    metadata: { extractionConfidence, cached },
  });
}

/**
 * Notify gap analysis updated.
 */
export async function notifyGapAnalysisUpdated(
  projectId: string,
  coveragePercent: number,
  gapsCount: number
): Promise<void> {
  await publishVdrEvent({
    type: 'gap_analysis_updated',
    projectId,
    timestamp: new Date().toISOString(),
    metadata: { coveragePercent, gapsCount },
  });
}
```

**Step 2: Create use-vdr-notifications.ts hook**

```typescript
/**
 * React hook for subscribing to VDR Realtime notifications.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { VdrNotification, VdrEventType } from '@/lib/vdr/realtime-notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UseVdrNotificationsOptions {
  projectId: string;
  eventTypes?: VdrEventType[];
  onNotification?: (notification: VdrNotification) => void;
}

export function useVdrNotifications({
  projectId,
  eventTypes,
  onNotification,
}: UseVdrNotificationsOptions) {
  const [notifications, setNotifications] = useState<VdrNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleNotification = useCallback((notification: VdrNotification) => {
    // Filter by event type if specified
    if (eventTypes && !eventTypes.includes(notification.type)) {
      return;
    }

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    onNotification?.(notification);
  }, [eventTypes, onNotification]);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase.channel(`vdr-events:${projectId}`);

    channel
      .on('broadcast', { event: '*' }, ({ payload }) => {
        handleNotification(payload as VdrNotification);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, handleNotification]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    isConnected,
    clearNotifications,
  };
}
```

**Step 3: Run build to verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/vdr/realtime-notifications.ts src/hooks/use-vdr-notifications.ts
git commit -m "feat(vdr): add push notifications via Supabase Realtime (G-04)

- Publish VDR events on document upload, ingest, classify, extract
- Create useVdrNotifications React hook for subscriptions
- Support event type filtering
- Gap analysis update notifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: BM25 en API Routes (G-10)

**Files:**
- Create: `src/app/api/vdr/search/fulltext/route.ts`

**Step 1: Create fulltext search API route**

```typescript
/**
 * VDR Full-Text Search API — GET /api/vdr/search/fulltext
 *
 * BM25-based full-text search for VDR documents.
 * Uses the existing bm25_search_vdr_chunks RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(request: NextRequest) {
  // Auth check
  const authResult = await requirePermission(request, 'can_view_documents');
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const projectId = searchParams.get('project_id');
  const areaCode = searchParams.get('area_code');
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id required' },
      { status: 400 }
    );
  }

  try {
    // Call BM25 search RPC
    const { data: results, error } = await supabaseAdmin.rpc('bm25_search_vdr_chunks', {
      search_query: query.trim(),
      match_count: limit,
      p_project_id: projectId,
      p_area_code: areaCode || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Get document metadata for results
    const chunkIds = (results || []).map((r: { id: string }) => r.id);

    const { data: chunks } = await supabaseAdmin
      .from('vdr_chunks')
      .select(`
        id,
        content,
        chunk_index,
        page_number,
        section_title,
        document_id,
        vdr_documents!inner (
          id,
          name,
          category,
          area_code
        )
      `)
      .in('id', chunkIds);

    // Merge BM25 scores with chunk data
    const enrichedResults = (results || []).map((r: { id: string; rank: number }) => {
      const chunk = chunks?.find(c => c.id === r.id);
      return {
        chunk_id: r.id,
        bm25_rank: r.rank,
        content: chunk?.content || '',
        chunk_index: chunk?.chunk_index,
        page_number: chunk?.page_number,
        section_title: chunk?.section_title,
        document: chunk?.vdr_documents,
      };
    });

    return NextResponse.json({
      query,
      results: enrichedResults,
      count: enrichedResults.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[vdr/search/fulltext] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 2: Run build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/vdr/search/fulltext/route.ts
git commit -m "feat(vdr): add BM25 full-text search API route (G-10)

- GET /api/vdr/search/fulltext with BM25 ranking
- Filter by project_id and optional area_code
- Return enriched results with document metadata
- Pagination support via limit/offset

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Evidence Threshold Configurable (G-11)

**Files:**
- Create: `supabase/migrations/202602280033_add_evidence_threshold_config.sql`
- Modify: `src/lib/vdr/semantic-search.ts`

**Step 1: Create migration for threshold config**

```sql
-- Migration: Add configurable evidence thresholds
-- Task 10 of 12: G-11 - Configurable evidence thresholds per area/FO

BEGIN;

-- Add threshold columns to dd_finding_objectives
ALTER TABLE dd_finding_objectives
ADD COLUMN IF NOT EXISTS evidence_threshold NUMERIC(3,2) DEFAULT 0.60,
ADD COLUMN IF NOT EXISTS min_evidence_count INTEGER DEFAULT 1;

-- Add threshold columns to dd_scoring_config for area-level defaults
ALTER TABLE dd_scoring_config
ADD COLUMN IF NOT EXISTS default_evidence_threshold NUMERIC(3,2) DEFAULT 0.60;

-- Create RPC to get effective threshold for an FO
CREATE OR REPLACE FUNCTION get_evidence_threshold(
  p_objective_key TEXT,
  p_area_code TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_threshold NUMERIC;
BEGIN
  -- First try FO-specific threshold
  SELECT evidence_threshold INTO v_threshold
  FROM dd_finding_objectives
  WHERE objective_key = p_objective_key
    AND evidence_threshold IS NOT NULL;

  IF v_threshold IS NOT NULL THEN
    RETURN v_threshold;
  END IF;

  -- Fall back to area-level default
  IF p_area_code IS NOT NULL THEN
    SELECT default_evidence_threshold INTO v_threshold
    FROM dd_scoring_config
    WHERE config_key = 'area_' || p_area_code
      AND default_evidence_threshold IS NOT NULL
    LIMIT 1;

    IF v_threshold IS NOT NULL THEN
      RETURN v_threshold;
    END IF;
  END IF;

  -- Default fallback
  RETURN 0.60;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing FOs with area-appropriate thresholds
-- Critical areas get higher thresholds
UPDATE dd_finding_objectives
SET evidence_threshold = 0.70
WHERE objective_key LIKE 'FO-MERC-CA-%'
  AND evidence_threshold = 0.60;

UPDATE dd_finding_objectives
SET evidence_threshold = 0.65
WHERE objective_key LIKE 'FO-LIT-%'
  AND evidence_threshold = 0.60;

COMMIT;
```

**Step 2: Modify semantic-search.ts to use configurable threshold**

Add threshold parameter support to semantic search:

```typescript
// Add to semantic-search.ts

export interface SemanticSearchOptions {
  projectId: string;
  areaCode?: string;
  threshold?: number;  // Now configurable, default from DB
  limit?: number;
  objectiveKey?: string;  // For FO-specific threshold lookup
}

export async function getEffectiveThreshold(
  objectiveKey?: string,
  areaCode?: string
): Promise<number> {
  if (!objectiveKey && !areaCode) {
    return 0.60; // Default
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_evidence_threshold', {
      p_objective_key: objectiveKey || '',
      p_area_code: areaCode || null,
    });

    if (error || data === null) {
      return 0.60;
    }

    return parseFloat(data);
  } catch {
    return 0.60;
  }
}
```

**Step 3: Apply migration via Supabase MCP**

**Step 4: Run build to verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add supabase/migrations/202602280033_add_evidence_threshold_config.sql src/lib/vdr/semantic-search.ts
git commit -m "feat(evidence): add configurable thresholds per area/FO (G-11)

- Add evidence_threshold column to dd_finding_objectives
- Add default_evidence_threshold to dd_scoring_config
- Create get_evidence_threshold RPC for effective threshold
- Higher thresholds for CA (0.70) and LIT (0.65) areas
- Update semantic search to use configurable thresholds

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Worker Dashboard UI

**Files:**
- Create: `src/app/projects/[id]/worker/page.tsx`
- Create: `src/components/worker/worker-dashboard.tsx`
- Create: `src/components/worker/coverage-chart.tsx`
- Create: `src/hooks/use-worker-status.ts`

**Step 1: Create use-worker-status.ts hook**

```typescript
/**
 * React hook for fetching and subscribing to Worker status.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WorkerRunState } from '@/lib/worker/worker-controller';

interface UseWorkerStatusOptions {
  projectId: string;
  pollIntervalMs?: number;
}

export function useWorkerStatus({ projectId, pollIntervalMs = 5000 }: UseWorkerStatusOptions) {
  const [status, setStatus] = useState<WorkerRunState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('dd_session_token');
      const res = await fetch(`/api/worker/status?project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch status: ${res.status}`);
      }

      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  const startWorker = useCallback(async (mode: 'continuous' | 'on_demand' = 'on_demand') => {
    try {
      const token = localStorage.getItem('dd_session_token');
      const res = await fetch('/api/worker/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, mode }),
      });

      if (!res.ok) throw new Error('Failed to start worker');
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId, fetchStatus]);

  const pauseWorker = useCallback(async () => {
    try {
      const token = localStorage.getItem('dd_session_token');
      const res = await fetch('/api/worker/pause', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error('Failed to pause worker');
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId, fetchStatus]);

  const resumeWorker = useCallback(async () => {
    try {
      const token = localStorage.getItem('dd_session_token');
      const res = await fetch('/api/worker/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error('Failed to resume worker');
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    startWorker,
    pauseWorker,
    resumeWorker,
  };
}
```

**Step 2: Create coverage-chart.tsx**

```typescript
'use client';

import { useMemo } from 'react';

interface CoverageChartProps {
  coverageByArea: Record<string, number>;
  overallCoverage: number;
}

const AREA_COLORS: Record<string, string> = {
  MERC: '#004438', // Garrigues brand
  CONT: '#2563eb',
  FISC: '#7c3aed',
  LAB: '#db2777',
  PI: '#ea580c',
  LIT: '#dc2626',
  ADM: '#65a30d',
};

export function CoverageChart({ coverageByArea, overallCoverage }: CoverageChartProps) {
  const areas = useMemo(() => {
    return Object.entries(coverageByArea).map(([code, coverage]) => ({
      code,
      coverage,
      color: AREA_COLORS[code] || '#6b7280',
    }));
  }, [coverageByArea]);

  return (
    <div className="space-y-4">
      {/* Overall coverage */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">Cobertura Global</span>
          <span className="text-2xl font-bold">{overallCoverage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(overallCoverage, 100)}%`,
              backgroundColor: overallCoverage >= 80 ? '#22c55e' : overallCoverage >= 60 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Per-area coverage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {areas.map(({ code, coverage, color }) => (
          <div key={code} className="bg-white rounded-lg p-3 border">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">{code}</span>
              <span className="text-sm font-bold">{coverage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(coverage, 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create worker-dashboard.tsx**

```typescript
'use client';

import { useWorkerStatus } from '@/hooks/use-worker-status';
import { CoverageChart } from './coverage-chart';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface WorkerDashboardProps {
  projectId: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  idle: <Clock className="w-5 h-5 text-gray-500" />,
  sensing: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
  normalizing: <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />,
  evaluating: <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />,
  concluding: <Loader2 className="w-5 h-5 text-green-500 animate-spin" />,
  completed: <CheckCircle className="w-5 h-5 text-green-600" />,
  paused: <Pause className="w-5 h-5 text-yellow-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
};

export function WorkerDashboard({ projectId }: WorkerDashboardProps) {
  const {
    status,
    loading,
    error,
    refetch,
    startWorker,
    pauseWorker,
    resumeWorker,
  } = useWorkerStatus({ projectId });

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-50 border rounded-lg p-8 text-center">
        <p className="text-gray-600 mb-4">No hay ejecución activa del Worker</p>
        <button
          onClick={() => startWorker('on_demand')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--g-brand-3308)] text-white rounded-lg hover:opacity-90"
        >
          <Play className="w-4 h-4" />
          Iniciar Worker
        </button>
      </div>
    );
  }

  const isRunning = ['sensing', 'normalizing', 'evaluating', 'concluding'].includes(status.status);

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {STATUS_ICONS[status.status]}
            <div>
              <h3 className="font-medium capitalize">{status.status}</h3>
              {status.currentPhase && (
                <p className="text-sm text-gray-500">Fase: {status.currentPhase}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {status.status === 'paused' && (
              <button
                onClick={resumeWorker}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm"
              >
                <Play className="w-4 h-4" />
                Reanudar
              </button>
            )}

            {isRunning && (
              <button
                onClick={pauseWorker}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </button>
            )}

            {(status.status === 'idle' || status.status === 'completed' || status.status === 'error') && (
              <button
                onClick={() => startWorker('on_demand')}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--g-brand-3308)] text-white rounded-lg text-sm"
              >
                <Play className="w-4 h-4" />
                Iniciar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Coverage chart */}
      <CoverageChart
        coverageByArea={status.coverageSnapshot.by_area}
        overallCoverage={status.coverageSnapshot.overall}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Ciclos" value={status.cycleCount} />
        <MetricCard label="Docs Normalizados" value={status.metrics.docs_normalized} />
        <MetricCard label="FOs Evaluados" value={status.metrics.fos_evaluated} />
        <MetricCard label="Findings Creados" value={status.metrics.findings_created} />
        <MetricCard label="AI Calls" value={`${status.aiBudgetUsed}/${status.aiBudgetTotal}`} />
        <MetricCard label="Conclusiones" value={status.metrics.conclusions_generated} />
        <MetricCard label="Work Queue" value={status.workQueue.filter(w => w.status === 'pending').length} />
        <MetricCard label="Duración" value={`${Math.round(status.metrics.duration_ms / 1000)}s`} />
      </div>

      {/* Phase progress */}
      {status.phaseProgress.items_total > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-2">Progreso de Fase</h4>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${status.phaseProgress.percentage}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-gray-600">
              {status.phaseProgress.items_done}/{status.phaseProgress.items_total}
            </span>
          </div>
          {status.phaseProgress.items_error > 0 && (
            <p className="text-sm text-red-500 mt-1">
              {status.phaseProgress.items_error} errores
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {status.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {status.errorMessage}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
```

**Step 4: Create worker page**

```typescript
/**
 * Worker Dashboard Page — /projects/[id]/worker
 */

import { WorkerDashboard } from '@/components/worker/worker-dashboard';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkerPage({ params }: Props) {
  const { id: projectId } = await params;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">DD Worker</h1>
      <WorkerDashboard projectId={projectId} />
    </div>
  );
}
```

**Step 5: Run build to verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app/projects/[id]/worker src/components/worker src/hooks/use-worker-status.ts
git commit -m "feat(ui): add Worker dashboard with coverage visualization

- Add /projects/[id]/worker page
- Create WorkerDashboard component with controls
- Add CoverageChart for per-area coverage visualization
- Create useWorkerStatus hook with polling
- Show metrics, phase progress, and error states

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Seed Carpetas por Defecto (G-05)

**Files:**
- Create: `supabase/migrations/202602280034_seed_default_folders.sql`

**Step 1: Create migration**

```sql
-- Migration: Seed default VDR folder structure
-- Task 12 of 12: G-05 - Default folder structure per project

BEGIN;

-- Create function to seed default folders for a new project
CREATE OR REPLACE FUNCTION seed_project_folders(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_folder_id UUID;
BEGIN
  -- Only seed if project has no folders yet
  IF EXISTS (SELECT 1 FROM vdr_folders WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;

  -- 01 - Mercantil (MERC)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '01 - Mercantil', 'MERC', 1)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Escrituras y Estatutos', 'MERC', 1),
    (p_project_id, v_folder_id, 'Libros de Actas', 'MERC', 2),
    (p_project_id, v_folder_id, 'Cuentas Anuales', 'MERC', 3),
    (p_project_id, v_folder_id, 'Poderes y Certificados', 'MERC', 4);

  -- 02 - Contractual (CONT)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '02 - Contractual', 'CONT', 2)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Contratos Financieros', 'CONT', 1),
    (p_project_id, v_folder_id, 'Contratos Mercantiles', 'CONT', 2),
    (p_project_id, v_folder_id, 'Pólizas de Seguros', 'CONT', 3),
    (p_project_id, v_folder_id, 'Contratos Intragrupo', 'CONT', 4);

  -- 03 - Fiscal (FISC)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '03 - Fiscal', 'FISC', 3)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Declaraciones', 'FISC', 1),
    (p_project_id, v_folder_id, 'Precios de Transferencia', 'FISC', 2),
    (p_project_id, v_folder_id, 'Certificados', 'FISC', 3);

  -- 04 - Laboral (LAB)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '04 - Laboral', 'LAB', 4)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Plantilla', 'LAB', 1),
    (p_project_id, v_folder_id, 'Alta Dirección', 'LAB', 2),
    (p_project_id, v_folder_id, 'Convenios y Litigios', 'LAB', 3);

  -- 05 - Propiedad Intelectual (PI)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '05 - Propiedad Intelectual', 'PI', 5)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Marcas y Patentes', 'PI', 1),
    (p_project_id, v_folder_id, 'Licencias', 'PI', 2);

  -- 06 - Litigios (LIT)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '06 - Litigios', 'LIT', 6)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Procedimientos Activos', 'LIT', 1),
    (p_project_id, v_folder_id, 'Resoluciones', 'LIT', 2),
    (p_project_id, v_folder_id, 'Compliance', 'LIT', 3);

  -- 07 - Administrativo (ADM)
  INSERT INTO vdr_folders (project_id, name, area_code, sort_order)
  VALUES (p_project_id, '07 - Administrativo', 'ADM', 7)
  RETURNING id INTO v_folder_id;

  INSERT INTO vdr_folders (project_id, parent_id, name, area_code, sort_order)
  VALUES
    (p_project_id, v_folder_id, 'Licencias y Permisos', 'ADM', 1),
    (p_project_id, v_folder_id, 'Contratos Públicos', 'ADM', 2),
    (p_project_id, v_folder_id, 'Subvenciones', 'ADM', 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-seed folders on new project
CREATE OR REPLACE FUNCTION trg_seed_project_folders()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_project_folders(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_seed_project_folders'
  ) THEN
    CREATE TRIGGER trigger_seed_project_folders
    AFTER INSERT ON dd_projects
    FOR EACH ROW
    EXECUTE FUNCTION trg_seed_project_folders();
  END IF;
END $$;

-- Seed folders for existing projects that don't have them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM dd_projects LOOP
    PERFORM seed_project_folders(r.id);
  END LOOP;
END $$;

COMMIT;
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Commit**

```bash
git add supabase/migrations/202602280034_seed_default_folders.sql
git commit -m "feat(vdr): seed default folder structure per project (G-05)

- Create seed_project_folders function with 7-area structure
- Add trigger to auto-seed on new project creation
- Create subfolders for each area (CA, intragrupo, compliance, etc.)
- Seed existing projects that lack folders

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Final Verification

**Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Update CLAUDE.md**

Update the project documentation to reflect:
- PDF extraction capability
- BullMQ queue system
- Worker dashboard
- New API routes
- Migration count update

**Step 3: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Horizonte 2 completion

- Add PDF extraction and BullMQ to stack
- Document new API routes
- Update migration count
- Add Worker dashboard reference

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Execution Summary

| Task | Gap | Files | Status |
|------|-----|-------|--------|
| 1 | G-09 | pdf-extractor.ts, ingest.ts | 🔲 |
| 2 | G-07 | openai.ts | 🔲 |
| 3 | G-18 | fact-extractor.ts | 🔲 |
| 4 | G-19 | completeness-validator.ts | 🔲 |
| 5 | G-21 | migration 032 | 🔲 |
| 6 | G-23 | queue/index.ts, workers/ | 🔲 |
| 7 | G-22 | ingest.ts, trigger/route.ts | 🔲 |
| 8 | G-04 | realtime-notifications.ts | 🔲 |
| 9 | G-10 | fulltext/route.ts | 🔲 |
| 10 | G-11 | migration 033, semantic-search.ts | 🔲 |
| 11 | — | worker-dashboard.tsx | 🔲 |
| 12 | G-05 | migration 034 | 🔲 |

**Total:** 12 tasks, ~20 files, 3 migrations, 2 npm packages
