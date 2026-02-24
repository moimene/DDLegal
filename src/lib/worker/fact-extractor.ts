/**
 * Fact Extractor Service — Worker Architecture v1.0
 *
 * Extracts structured facts from VDR documents using Harvey AI.
 * Implements the NORMALIZE phase of the Worker loop.
 *
 * Key features:
 * - Content-hash based caching (skip re-extraction if document unchanged)
 * - Structured extraction via Harvey AI prompt
 * - Upsert to dd_document_facts with versioning
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getHarveyGateway } from '@/lib/harvey';
import { computeContentHash } from '@/lib/vdr/content-hash';

// ============================================================================
// Types
// ============================================================================

export interface DocumentFacts {
  document_type: string | null;
  document_subtype: string | null;
  area_codes: string[];
  jurisdiction: string | null;
  language: string;
  parties: Party[];
  effective_date: string | null;
  expiration_date: string | null;
  signing_date: string | null;
  key_dates: KeyDate[];
  amounts: Amount[];
  total_value: number | null;
  total_value_currency: string;
  clauses: Clause[];
  obligations: Obligation[];
}

export interface Party {
  name: string;
  role: 'vendor' | 'client' | 'employer' | 'employee' | 'licensor' | 'licensee' | 'other';
  normalized_id?: string;
  is_target: boolean;
  is_counterparty: boolean;
}

export interface KeyDate {
  type: string;
  date: string;
  description: string;
}

export interface Amount {
  type: 'contract_value' | 'penalty' | 'cap' | 'deductible' | 'salary' | 'fee' | 'other';
  amount: number;
  currency: string;
  description?: string;
  annualized: boolean;
}

export interface Clause {
  clause_type: string;
  present: boolean;
  page?: number;
  excerpt?: string;
  confidence: number;
}

export interface Obligation {
  type: string;
  description: string;
  party: string;
  deadline?: string;
  consequence?: string;
}

export interface ExtractionResult {
  factId: string;
  documentId: string;
  projectId: string;
  facts: DocumentFacts;
  extractionMethod: 'ai_harvey' | 'rule_based' | 'manual' | 'hybrid';
  extractionConfidence: number;
  extractionModel: string;
  cached: boolean;
  version: number;
}

export interface ExtractionOptions {
  forceReExtract?: boolean;
  extractionModel?: string;
}

// ============================================================================
// Extraction Prompt Template
// ============================================================================

const EXTRACTION_PROMPT = `[DOCUMENT FACT EXTRACTION]
Document: {filename} ({document_id})
Pages: {page_count}
Content (chunked): {chunks_text}

Extract the following structured information:

1. CLASSIFICATION
   - document_type: one of [contrato_material, contrato_menor, acta_junta, escritura_constitucion,
     certificado_registro, informe_fiscal, nomina, convenio_colectivo, patente, marca, licencia,
     poliza_seguro, permiso_administrativo, resolucion_judicial, otro]
   - document_subtype: more specific type (e.g., suministro, servicios, laboral)
   - area_codes: array of [MERC, CONT, FISC, LAB, PI, LIT, ADM]
   - jurisdiction: ES | UE | UK | US | otro
   - language: es | en | de | fr | it | pt

2. PARTIES
   For each party: { name, role (vendor/client/employer/employee/licensor/licensee/other),
   is_target (boolean), is_counterparty (boolean) }

3. KEY DATES
   - effective_date: YYYY-MM-DD format
   - expiration_date: YYYY-MM-DD format
   - signing_date: YYYY-MM-DD format
   - Additional key dates with type and description

4. AMOUNTS
   For each amount: { type (contract_value/penalty/cap/deductible/salary/fee/other),
   amount (numeric), currency (EUR/USD/GBP), description, annualized (boolean) }

5. CLAUSES
   For each relevant clause type, indicate: { clause_type, present (boolean),
   page (number), excerpt (max 200 chars), confidence (0-1) }

   Check for: coc (change of control), non_compete, termination, indemnity,
   warranty, ip_assignment, confidentiality, exclusivity, most_favored_nation,
   liquidated_damages, force_majeure, governing_law, arbitration

6. OBLIGATIONS
   Key obligations: { type, description, party, deadline (YYYY-MM-DD), consequence_if_breach }

RESPONSE FORMAT: JSON object with the exact structure:
{
  "document_type": "string or null",
  "document_subtype": "string or null",
  "area_codes": ["CONT", "MERC"],
  "jurisdiction": "ES",
  "language": "es",
  "parties": [{ "name": "...", "role": "...", "is_target": false, "is_counterparty": true }],
  "effective_date": "2024-01-01",
  "expiration_date": null,
  "signing_date": "2023-12-15",
  "key_dates": [{ "type": "renewal", "date": "2025-01-01", "description": "..." }],
  "amounts": [{ "type": "contract_value", "amount": 50000, "currency": "EUR", "annualized": true }],
  "total_value": 50000,
  "total_value_currency": "EUR",
  "clauses": [{ "clause_type": "coc", "present": true, "page": 3, "excerpt": "...", "confidence": 0.95 }],
  "obligations": [{ "type": "payment", "description": "...", "party": "Client", "deadline": "2024-02-01" }]
}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.`;

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extracts structured facts from a VDR document using Harvey AI.
 *
 * @param documentId - UUID of the VDR document
 * @param projectId - UUID of the project
 * @param options - Extraction options
 * @returns Extraction result with facts and metadata
 */
export async function extractDocumentFacts(
  documentId: string,
  projectId: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { forceReExtract = false, extractionModel = 'harvey-legal-v1' } = options;

  // 1. Fetch document metadata
  const { data: doc, error: docError } = await supabaseAdmin
    .from('vdr_documents')
    .select('id, name, description, category, area_code, content_hash')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // 2. Fetch document chunks for content
  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from('vdr_chunks')
    .select('content, chunk_index, page_number, section_title')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
  }

  const chunksText = (chunks || []).map(c => c.content).join('\n\n---\n\n');
  const contentHash = doc.content_hash || computeContentHash(chunksText);

  // 3. Check cache - skip if content unchanged and not forcing re-extraction
  if (!forceReExtract) {
    const { data: existingFacts } = await supabaseAdmin
      .from('dd_document_facts')
      .select('*')
      .eq('document_id', documentId)
      .eq('project_id', projectId)
      .eq('source_content_hash', contentHash)
      .single();

    if (existingFacts) {
      return {
        factId: existingFacts.id,
        documentId,
        projectId,
        facts: {
          document_type: existingFacts.document_type,
          document_subtype: existingFacts.document_subtype,
          area_codes: existingFacts.area_codes || [],
          jurisdiction: existingFacts.jurisdiction,
          language: existingFacts.language || 'es',
          parties: existingFacts.parties || [],
          effective_date: existingFacts.effective_date,
          expiration_date: existingFacts.expiration_date,
          signing_date: existingFacts.signing_date,
          key_dates: existingFacts.key_dates || [],
          amounts: existingFacts.amounts || [],
          total_value: existingFacts.total_value,
          total_value_currency: existingFacts.total_value_currency || 'EUR',
          clauses: existingFacts.clauses || [],
          obligations: existingFacts.obligations || [],
        },
        extractionMethod: existingFacts.extraction_method,
        extractionConfidence: existingFacts.extraction_confidence,
        extractionModel: existingFacts.extraction_model,
        cached: true,
        version: existingFacts.version,
      };
    }
  }

  // 4. Build extraction prompt
  const prompt = EXTRACTION_PROMPT
    .replace('{filename}', doc.name)
    .replace('{document_id}', documentId)
    .replace('{page_count}', String(chunks?.length || 0))
    .replace('{chunks_text}', chunksText.slice(0, 50000)); // Limit to ~50K chars

  // 5. Call Harvey AI for extraction
  const gateway = getHarveyGateway();
  const response = await gateway.completion({
    prompt,
    system_prompt: 'You are a legal document analyzer. Extract structured facts from documents. Always respond with valid JSON only.',
    client_matter_id: `fact-extraction:${projectId}:${documentId}`,
  });

  // 6. Parse AI response
  let facts: DocumentFacts;
  let extractionConfidence = 0.8; // Default confidence

  try {
    // Remove potential markdown code blocks
    let jsonText = response.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }

    const parsed = JSON.parse(jsonText.trim());
    facts = validateAndNormalizeFacts(parsed);

    // Calculate confidence from clause confidences
    const clauseConfidences = facts.clauses
      .filter(c => c.present)
      .map(c => c.confidence);
    if (clauseConfidences.length > 0) {
      extractionConfidence = clauseConfidences.reduce((a, b) => a + b, 0) / clauseConfidences.length;
    }
  } catch (parseError) {
    console.error('[fact-extractor] Failed to parse AI response:', parseError);
    // Return minimal facts with low confidence
    facts = createEmptyFacts();
    extractionConfidence = 0.3;
  }

  // 7. Get existing version for versioning
  const { data: existingFact } = await supabaseAdmin
    .from('dd_document_facts')
    .select('id, version')
    .eq('document_id', documentId)
    .eq('project_id', projectId)
    .single();

  const newVersion = existingFact ? existingFact.version + 1 : 1;

  // 8. Upsert to dd_document_facts
  const factRow = {
    document_id: documentId,
    project_id: projectId,
    document_type: facts.document_type,
    document_subtype: facts.document_subtype,
    area_codes: facts.area_codes,
    jurisdiction: facts.jurisdiction,
    language: facts.language,
    parties: facts.parties,
    effective_date: facts.effective_date,
    expiration_date: facts.expiration_date,
    signing_date: facts.signing_date,
    key_dates: facts.key_dates,
    amounts: facts.amounts,
    total_value: facts.total_value,
    total_value_currency: facts.total_value_currency,
    clauses: facts.clauses,
    obligations: facts.obligations,
    extraction_method: 'ai_harvey' as const,
    extraction_confidence: extractionConfidence,
    extraction_model: extractionModel,
    extracted_at: new Date().toISOString(),
    source_content_hash: contentHash,
    version: newVersion,
    previous_version_id: existingFact?.id || null,
  };

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('dd_document_facts')
    .upsert(factRow, {
      onConflict: 'document_id,project_id',
    })
    .select('id')
    .single();

  if (upsertError || !upserted) {
    throw new Error(`Failed to upsert facts: ${upsertError?.message}`);
  }

  return {
    factId: upserted.id,
    documentId,
    projectId,
    facts,
    extractionMethod: 'ai_harvey',
    extractionConfidence,
    extractionModel,
    cached: false,
    version: newVersion,
  };
}

/**
 * Batch extract facts for multiple documents.
 */
export async function extractDocumentFactsBatch(
  documents: Array<{ documentId: string; projectId: string }>,
  options: ExtractionOptions = {}
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];

  for (const { documentId, projectId } of documents) {
    try {
      const result = await extractDocumentFacts(documentId, projectId, options);
      results.push(result);
    } catch (error) {
      console.error(`[fact-extractor] Failed to extract facts for ${documentId}:`, error);
      // Continue with next document
    }
  }

  return results;
}

/**
 * Get facts for a document (read-only).
 */
export async function getDocumentFacts(
  documentId: string,
  projectId: string
): Promise<DocumentFacts | null> {
  const { data } = await supabaseAdmin
    .from('dd_document_facts')
    .select('*')
    .eq('document_id', documentId)
    .eq('project_id', projectId)
    .single();

  if (!data) return null;

  return {
    document_type: data.document_type,
    document_subtype: data.document_subtype,
    area_codes: data.area_codes || [],
    jurisdiction: data.jurisdiction,
    language: data.language || 'es',
    parties: data.parties || [],
    effective_date: data.effective_date,
    expiration_date: data.expiration_date,
    signing_date: data.signing_date,
    key_dates: data.key_dates || [],
    amounts: data.amounts || [],
    total_value: data.total_value,
    total_value_currency: data.total_value_currency || 'EUR',
    clauses: data.clauses || [],
    obligations: data.obligations || [],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function validateAndNormalizeFacts(parsed: unknown): DocumentFacts {
  const input = parsed as Record<string, unknown>;

  return {
    document_type: validateDocumentType(input.document_type),
    document_subtype: typeof input.document_subtype === 'string' ? input.document_subtype : null,
    area_codes: validateAreaCodes(input.area_codes),
    jurisdiction: validateJurisdiction(input.jurisdiction),
    language: typeof input.language === 'string' ? input.language : 'es',
    parties: validateParties(input.parties),
    effective_date: validateDate(input.effective_date),
    expiration_date: validateDate(input.expiration_date),
    signing_date: validateDate(input.signing_date),
    key_dates: validateKeyDates(input.key_dates),
    amounts: validateAmounts(input.amounts),
    total_value: typeof input.total_value === 'number' ? input.total_value : null,
    total_value_currency: typeof input.total_value_currency === 'string' ? input.total_value_currency : 'EUR',
    clauses: validateClauses(input.clauses),
    obligations: validateObligations(input.obligations),
  };
}

function createEmptyFacts(): DocumentFacts {
  return {
    document_type: null,
    document_subtype: null,
    area_codes: [],
    jurisdiction: null,
    language: 'es',
    parties: [],
    effective_date: null,
    expiration_date: null,
    signing_date: null,
    key_dates: [],
    amounts: [],
    total_value: null,
    total_value_currency: 'EUR',
    clauses: [],
    obligations: [],
  };
}

const VALID_DOC_TYPES = [
  'contrato_material', 'contrato_menor', 'acta_junta', 'escritura_constitucion',
  'certificado_registro', 'informe_fiscal', 'nomina', 'convenio_colectivo',
  'patente', 'marca', 'licencia', 'poliza_seguro', 'permiso_administrativo',
  'resolucion_judicial', 'otro'
];

function validateDocumentType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return VALID_DOC_TYPES.includes(value) ? value : 'otro';
}

const VALID_AREA_CODES = ['MERC', 'CONT', 'FISC', 'LAB', 'PI', 'LIT', 'ADM'];

function validateAreaCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => typeof v === 'string' && VALID_AREA_CODES.includes(v));
}

function validateJurisdiction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const valid = ['ES', 'UE', 'UK', 'US', 'otro'];
  return valid.includes(value) ? value : null;
}

function validateDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Basic ISO date validation
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function validateParties(value: unknown): Party[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(p => typeof p === 'object' && p !== null)
    .map(p => ({
      name: typeof p.name === 'string' ? p.name : 'Unknown',
      role: validatePartyRole(p.role),
      normalized_id: typeof p.normalized_id === 'string' ? p.normalized_id : undefined,
      is_target: Boolean(p.is_target),
      is_counterparty: Boolean(p.is_counterparty),
    }));
}

function validatePartyRole(value: unknown): Party['role'] {
  const validRoles = ['vendor', 'client', 'employer', 'employee', 'licensor', 'licensee', 'other'];
  return typeof value === 'string' && validRoles.includes(value) ? value as Party['role'] : 'other';
}

function validateKeyDates(value: unknown): KeyDate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(d => typeof d === 'object' && d !== null)
    .map(d => ({
      type: typeof d.type === 'string' ? d.type : 'other',
      date: validateDate(d.date) || '',
      description: typeof d.description === 'string' ? d.description : '',
    }))
    .filter(d => d.date); // Only keep dates that are valid
}

function validateAmounts(value: unknown): Amount[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(a => typeof a === 'object' && a !== null && typeof a.amount === 'number')
    .map(a => ({
      type: validateAmountType(a.type),
      amount: a.amount,
      currency: typeof a.currency === 'string' ? a.currency : 'EUR',
      description: typeof a.description === 'string' ? a.description : undefined,
      annualized: Boolean(a.annualized),
    }));
}

function validateAmountType(value: unknown): Amount['type'] {
  const validTypes = ['contract_value', 'penalty', 'cap', 'deductible', 'salary', 'fee', 'other'];
  return typeof value === 'string' && validTypes.includes(value) ? value as Amount['type'] : 'other';
}

function validateClauses(value: unknown): Clause[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(c => typeof c === 'object' && c !== null)
    .map(c => ({
      clause_type: typeof c.clause_type === 'string' ? c.clause_type : 'other',
      present: Boolean(c.present),
      page: typeof c.page === 'number' ? c.page : undefined,
      excerpt: typeof c.excerpt === 'string' ? c.excerpt.slice(0, 200) : undefined,
      confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
    }));
}

function validateObligations(value: unknown): Obligation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(o => typeof o === 'object' && o !== null)
    .map(o => ({
      type: typeof o.type === 'string' ? o.type : 'other',
      description: typeof o.description === 'string' ? o.description : '',
      party: typeof o.party === 'string' ? o.party : 'Unknown',
      deadline: validateDate(o.deadline) || undefined,
      consequence: typeof o.consequence === 'string' ? o.consequence : undefined,
    }));
}
