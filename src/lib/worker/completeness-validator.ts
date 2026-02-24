/**
 * Completeness Validator — Worker Architecture v1.0
 *
 * Validates if document facts satisfy a Finding Objective's data requirements.
 * Part of Task 4: Validacion Completitud Facts vs FO.data_required (G-19)
 *
 * Key features:
 * - Checks if document_type matches required doc_types
 * - Checks if required extractions are present in facts
 * - Calculates completeness score (0-100)
 * - Supports batch validation for multiple document/FO pairs
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================================================
// Interfaces
// ============================================================================

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

// Internal interface for facts from dd_document_facts table
interface DocumentFactsRow {
  id: string;
  document_id: string;
  project_id: string;
  document_type: string | null;
  document_subtype: string | null;
  area_codes: string[] | null;
  jurisdiction: string | null;
  language: string | null;
  parties: unknown[] | null;
  effective_date: string | null;
  expiration_date: string | null;
  signing_date: string | null;
  key_dates: unknown[] | null;
  amounts: unknown[] | null;
  total_value: number | null;
  total_value_currency: string | null;
  clauses: unknown[] | null;
  obligations: unknown[] | null;
  extraction_method: string | null;
  extraction_confidence: number | null;
  extraction_model: string | null;
  // Extended metadata for area-specific extractions (may be stored as separate columns or in a metadata field)
  metadata?: {
    annual_accounts?: unknown;
    litigation?: unknown;
    administrative?: unknown;
    pi?: unknown;
    laboral?: unknown;
    fiscal?: unknown;
  };
}

// Interface for FO data_required from database (may come in different formats)
interface FODataRequired {
  doc_type?: string;
  doc_types?: string[];
  sample?: string;
  extractions: string[];
}

// Interface for finding objective row
interface FindingObjectiveRow {
  id: string;
  objective_key: string;
  data_required: FODataRequired[] | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a specific extraction type is present in the facts.
 *
 * Extraction types supported:
 * - `parties` - facts.parties array has items
 * - `dates` - effective_date, signing_date, or expiration_date exists
 * - `amounts` - facts.amounts array has items
 * - `clauses` - facts.clauses array has items
 * - `obligations` - facts.obligations array has items
 * - `classification` - document_type and area_codes exist
 * - `annual_accounts` - facts.metadata?.annual_accounts exists
 * - `litigation` - facts.metadata?.litigation exists
 * - `administrative` - facts.metadata?.administrative exists
 * - `pi` - facts.metadata?.pi exists
 * - `laboral` - facts.metadata?.laboral exists
 * - `fiscal` - facts.metadata?.fiscal exists
 *
 * @param facts - The document facts record
 * @param extraction - The extraction type to check
 * @returns true if the extraction exists and has data
 */
function hasExtraction(facts: DocumentFactsRow, extraction: string): boolean {
  const normalizedExtraction = extraction.toLowerCase().trim();

  switch (normalizedExtraction) {
    case 'parties':
    case 'partes':
    case 'otorgantes':
      return Array.isArray(facts.parties) && facts.parties.length > 0;

    case 'dates':
    case 'fechas':
    case 'fecha':
      return !!(
        facts.effective_date ||
        facts.signing_date ||
        facts.expiration_date ||
        (Array.isArray(facts.key_dates) && facts.key_dates.length > 0)
      );

    case 'amounts':
    case 'importes':
    case 'cantidades':
      return Array.isArray(facts.amounts) && facts.amounts.length > 0;

    case 'clauses':
    case 'clausulas':
    case 'cláusulas':
      return Array.isArray(facts.clauses) && facts.clauses.length > 0;

    case 'obligations':
    case 'obligaciones':
      return Array.isArray(facts.obligations) && facts.obligations.length > 0;

    case 'classification':
    case 'clasificacion':
    case 'clasificación':
      return !!(
        facts.document_type &&
        Array.isArray(facts.area_codes) &&
        facts.area_codes.length > 0
      );

    case 'annual_accounts':
    case 'cuentas_anuales':
      return !!facts.metadata?.annual_accounts;

    case 'litigation':
    case 'litigios':
      return !!facts.metadata?.litigation;

    case 'administrative':
    case 'administrativo':
      return !!facts.metadata?.administrative;

    case 'pi':
    case 'propiedad_intelectual':
    case 'intellectual_property':
      return !!facts.metadata?.pi;

    case 'laboral':
    case 'labor':
      return !!facts.metadata?.laboral;

    case 'fiscal':
    case 'tax':
      return !!facts.metadata?.fiscal;

    // Document-specific extractions that map to basic fields
    case 'estatutos':
    case 'acuerdos':
    case 'inscripciones':
    case 'asambleas':
    case 'modificaciones':
    case 'órganos':
    case 'estructura':
    case 'cargos':
    case 'decisiones':
    case 'mandatos':
    case 'asientos':
    case 'defectos':
    case 'observaciones':
    case 'documentos':
    case 'asistentes':
    case 'votos':
    case 'socios':
    case 'representación':
    case 'quórum':
    case 'mayorías':
    case 'validación':
    case 'aprobación':
    case 'derechos':
    case 'restricciones':
    case 'transmisión':
    case 'limitaciones':
    case 'preferencias':
    case 'protecciones':
      // These are document-specific extractions that would be found in clauses, obligations, or key_dates
      // Check if the facts have any relevant structured data
      return (
        (Array.isArray(facts.clauses) && facts.clauses.length > 0) ||
        (Array.isArray(facts.obligations) && facts.obligations.length > 0) ||
        (Array.isArray(facts.key_dates) && facts.key_dates.length > 0)
      );

    default:
      // For unknown extraction types, check if they might exist in clauses or metadata
      if (Array.isArray(facts.clauses)) {
        const clauseTypes = facts.clauses
          .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
          .map(c => String(c.clause_type || '').toLowerCase());
        if (clauseTypes.includes(normalizedExtraction)) {
          return true;
        }
      }
      // Unknown extraction type - assume not present
      return false;
  }
}

/**
 * Normalizes the data_required field from FO to a consistent format.
 * The database may store doc_type (singular) or doc_types (array).
 */
function normalizeDataRequirements(dataRequired: FODataRequired[]): DataRequirement[] {
  return dataRequired.map(req => ({
    doc_types: req.doc_types || (req.doc_type ? [req.doc_type] : []),
    sample: req.sample,
    extractions: req.extractions || [],
  }));
}

/**
 * Checks if the document type matches any of the required doc types.
 * Uses fuzzy matching to handle variations in naming.
 */
function matchesDocType(documentType: string | null, requiredDocTypes: string[]): boolean {
  if (!documentType || requiredDocTypes.length === 0) {
    return requiredDocTypes.length === 0; // No requirement = match
  }

  const normalizedDocType = documentType.toLowerCase().trim();

  for (const required of requiredDocTypes) {
    const normalizedRequired = required.toLowerCase().trim();

    // Direct match
    if (normalizedDocType === normalizedRequired) {
      return true;
    }

    // Partial match (document type contains required or vice versa)
    if (
      normalizedDocType.includes(normalizedRequired) ||
      normalizedRequired.includes(normalizedDocType)
    ) {
      return true;
    }

    // Common variations
    const variations: Record<string, string[]> = {
      escritura_constitucion: ['escritura', 'constitución', 'constitucion'],
      acta_junta: ['acta', 'junta', 'actas'],
      contrato_material: ['contrato', 'material'],
      certificado_registro: ['certificado', 'certificación', 'registro'],
      estatutos: ['estatutos', 'estatuto', 'estatutos_vigentes'],
      libros_sociales: ['libros', 'libro', 'sociales'],
      pactos_parasociales: ['pacto', 'pactos', 'parasocial'],
    };

    for (const [key, alts] of Object.entries(variations)) {
      if (normalizedRequired.includes(key) || alts.some(a => normalizedRequired.includes(a))) {
        if (normalizedDocType.includes(key) || alts.some(a => normalizedDocType.includes(a))) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validates if a document's facts satisfy a Finding Objective's data requirements.
 *
 * @param documentId - UUID of the VDR document
 * @param projectId - UUID of the project
 * @param objectiveKey - The FO objective_key (e.g., 'FO-MERC-001')
 * @returns CompletenessResult with validation details
 */
export async function validateFactsCompleteness(
  documentId: string,
  projectId: string,
  objectiveKey: string
): Promise<CompletenessResult> {
  // 1. Fetch the FO's data_required from dd_finding_objectives
  const { data: fo, error: foError } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('id, objective_key, data_required')
    .eq('objective_key', objectiveKey)
    .eq('is_active', true)
    .single();

  if (foError || !fo) {
    // FO not found - return incomplete with error indication
    return {
      objectiveKey,
      documentId,
      isComplete: false,
      missingDocTypes: [],
      missingExtractions: [],
      completenessScore: 0,
    };
  }

  const foRow = fo as FindingObjectiveRow;

  // 2. If FO has no data_required, return complete with score 100
  if (!foRow.data_required || foRow.data_required.length === 0) {
    return {
      objectiveKey,
      documentId,
      isComplete: true,
      missingDocTypes: [],
      missingExtractions: [],
      completenessScore: 100,
    };
  }

  // 3. Fetch the document's facts from dd_document_facts
  const { data: facts, error: factsError } = await supabaseAdmin
    .from('dd_document_facts')
    .select('*')
    .eq('document_id', documentId)
    .eq('project_id', projectId)
    .single();

  if (factsError || !facts) {
    // Document has no facts - return incomplete with all requirements as missing
    const requirements = normalizeDataRequirements(foRow.data_required);
    const allDocTypes = new Set<string>();
    const allExtractions = new Set<string>();

    for (const req of requirements) {
      req.doc_types.forEach(dt => allDocTypes.add(dt));
      req.extractions.forEach(ex => allExtractions.add(ex));
    }

    return {
      objectiveKey,
      documentId,
      isComplete: false,
      missingDocTypes: Array.from(allDocTypes),
      missingExtractions: Array.from(allExtractions),
      completenessScore: 0,
    };
  }

  const factsRow = facts as DocumentFactsRow;

  // 4. Normalize data requirements
  const requirements = normalizeDataRequirements(foRow.data_required);

  // 5. Check document type match and extractions
  const missingDocTypes: string[] = [];
  const missingExtractions: string[] = [];
  let totalRequirements = 0;
  let metRequirements = 0;

  for (const requirement of requirements) {
    // Check document type match
    if (requirement.doc_types.length > 0) {
      totalRequirements++;
      if (matchesDocType(factsRow.document_type, requirement.doc_types)) {
        metRequirements++;
      } else {
        // Add missing doc types that don't match
        for (const dt of requirement.doc_types) {
          if (!missingDocTypes.includes(dt)) {
            missingDocTypes.push(dt);
          }
        }
      }
    }

    // Check extractions
    for (const extraction of requirement.extractions) {
      totalRequirements++;
      if (hasExtraction(factsRow, extraction)) {
        metRequirements++;
      } else {
        if (!missingExtractions.includes(extraction)) {
          missingExtractions.push(extraction);
        }
      }
    }
  }

  // 6. Calculate completeness score (0-100)
  const completenessScore =
    totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;

  const isComplete = missingDocTypes.length === 0 && missingExtractions.length === 0;

  return {
    objectiveKey,
    documentId,
    isComplete,
    missingDocTypes,
    missingExtractions,
    completenessScore,
  };
}

/**
 * Batch validation for multiple document/FO pairs.
 *
 * @param projectId - UUID of the project
 * @param pairs - Array of document/FO pairs to validate
 * @returns Array of CompletenessResult for each pair
 */
export async function batchValidateCompleteness(
  projectId: string,
  pairs: Array<{ documentId: string; objectiveKey: string }>
): Promise<CompletenessResult[]> {
  // Optimize by fetching all FOs and facts in bulk first

  // 1. Get unique objective keys
  const uniqueObjectiveKeys = Array.from(new Set(pairs.map(p => p.objectiveKey)));

  // 2. Fetch all FOs in one query
  const { data: fos } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('id, objective_key, data_required')
    .in('objective_key', uniqueObjectiveKeys)
    .eq('is_active', true);

  const foMap = new Map<string, FindingObjectiveRow>();
  if (fos) {
    for (const fo of fos as FindingObjectiveRow[]) {
      foMap.set(fo.objective_key, fo);
    }
  }

  // 3. Get unique document IDs
  const uniqueDocumentIds = Array.from(new Set(pairs.map(p => p.documentId)));

  // 4. Fetch all facts in one query
  const { data: allFacts } = await supabaseAdmin
    .from('dd_document_facts')
    .select('*')
    .in('document_id', uniqueDocumentIds)
    .eq('project_id', projectId);

  const factsMap = new Map<string, DocumentFactsRow>();
  if (allFacts) {
    for (const facts of allFacts as DocumentFactsRow[]) {
      factsMap.set(facts.document_id, facts);
    }
  }

  // 5. Validate each pair
  const results: CompletenessResult[] = [];

  for (const { documentId, objectiveKey } of pairs) {
    const fo = foMap.get(objectiveKey);
    const facts = factsMap.get(documentId);

    // FO not found
    if (!fo) {
      results.push({
        objectiveKey,
        documentId,
        isComplete: false,
        missingDocTypes: [],
        missingExtractions: [],
        completenessScore: 0,
      });
      continue;
    }

    // No data_required = complete
    if (!fo.data_required || fo.data_required.length === 0) {
      results.push({
        objectiveKey,
        documentId,
        isComplete: true,
        missingDocTypes: [],
        missingExtractions: [],
        completenessScore: 100,
      });
      continue;
    }

    // No facts = incomplete with all requirements missing
    if (!facts) {
      const requirements = normalizeDataRequirements(fo.data_required);
      const allDocTypes = new Set<string>();
      const allExtractions = new Set<string>();

      for (const req of requirements) {
        req.doc_types.forEach(dt => allDocTypes.add(dt));
        req.extractions.forEach(ex => allExtractions.add(ex));
      }

      results.push({
        objectiveKey,
        documentId,
        isComplete: false,
        missingDocTypes: Array.from(allDocTypes),
        missingExtractions: Array.from(allExtractions),
        completenessScore: 0,
      });
      continue;
    }

    // Validate completeness
    const requirements = normalizeDataRequirements(fo.data_required);
    const missingDocTypes: string[] = [];
    const missingExtractions: string[] = [];
    let totalRequirements = 0;
    let metRequirements = 0;

    for (const requirement of requirements) {
      if (requirement.doc_types.length > 0) {
        totalRequirements++;
        if (matchesDocType(facts.document_type, requirement.doc_types)) {
          metRequirements++;
        } else {
          for (const dt of requirement.doc_types) {
            if (!missingDocTypes.includes(dt)) {
              missingDocTypes.push(dt);
            }
          }
        }
      }

      for (const extraction of requirement.extractions) {
        totalRequirements++;
        if (hasExtraction(facts, extraction)) {
          metRequirements++;
        } else {
          if (!missingExtractions.includes(extraction)) {
            missingExtractions.push(extraction);
          }
        }
      }
    }

    const completenessScore =
      totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;

    const isComplete = missingDocTypes.length === 0 && missingExtractions.length === 0;

    results.push({
      objectiveKey,
      documentId,
      isComplete,
      missingDocTypes,
      missingExtractions,
      completenessScore,
    });
  }

  return results;
}

/**
 * Get completeness summary for all FOs against a single document.
 *
 * @param documentId - UUID of the VDR document
 * @param projectId - UUID of the project
 * @param areaCode - Optional area code to filter FOs
 * @returns Array of CompletenessResult for each applicable FO
 */
export async function getDocumentCompleteness(
  documentId: string,
  projectId: string,
  areaCode?: string
): Promise<CompletenessResult[]> {
  // Fetch applicable FOs
  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('objective_key')
    .eq('is_active', true);

  if (areaCode) {
    query = query.eq('area_code', areaCode);
  }

  const { data: fos } = await query;

  if (!fos || fos.length === 0) {
    return [];
  }

  const pairs = fos.map(fo => ({
    documentId,
    objectiveKey: fo.objective_key,
  }));

  return batchValidateCompleteness(projectId, pairs);
}

/**
 * Get completeness summary for all documents against a single FO.
 *
 * @param projectId - UUID of the project
 * @param objectiveKey - The FO objective_key
 * @returns Array of CompletenessResult for each document with facts
 */
export async function getFOCompleteness(
  projectId: string,
  objectiveKey: string
): Promise<CompletenessResult[]> {
  // Fetch all documents with facts for this project
  const { data: factDocs } = await supabaseAdmin
    .from('dd_document_facts')
    .select('document_id')
    .eq('project_id', projectId);

  if (!factDocs || factDocs.length === 0) {
    return [];
  }

  const pairs = factDocs.map(doc => ({
    documentId: doc.document_id,
    objectiveKey,
  }));

  return batchValidateCompleteness(projectId, pairs);
}
