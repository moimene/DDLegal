/**
 * Document Classifier Service — Worker Architecture v1.0
 *
 * Fast, lightweight document classification using pattern matching
 * and optional AI fallback for complex cases.
 *
 * Part of NORMALIZE phase Step 1: CLASSIFY
 *
 * This is a fast path that runs before full extraction:
 * 1. Pattern-based classification (no AI call)
 * 2. AI fallback only when patterns don't match
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getHarveyGateway } from '@/lib/harvey';

// ============================================================================
// Types
// ============================================================================

export interface ClassificationResult {
  document_type: DocumentType;
  document_subtype: string | null;
  area_codes: AreaCode[];
  jurisdiction: Jurisdiction | null;
  language: string;
  confidence: number;
  method: 'pattern' | 'ai' | 'fallback';
}

export type DocumentType =
  | 'contrato_material'
  | 'contrato_menor'
  | 'acta_junta'
  | 'escritura_constitucion'
  | 'certificado_registro'
  | 'informe_fiscal'
  | 'nomina'
  | 'convenio_colectivo'
  | 'patente'
  | 'marca'
  | 'licencia'
  | 'poliza_seguro'
  | 'permiso_administrativo'
  | 'resolucion_judicial'
  | 'otro';

export type AreaCode = 'MERC' | 'CONT' | 'FISC' | 'LAB' | 'PI' | 'LIT' | 'ADM';

export type Jurisdiction = 'ES' | 'UE' | 'UK' | 'US' | 'otro';

// ============================================================================
// Pattern-Based Classification Rules
// ============================================================================

interface ClassificationPattern {
  patterns: RegExp[];
  document_type: DocumentType;
  area_codes: AreaCode[];
  confidence: number;
}

const CLASSIFICATION_PATTERNS: ClassificationPattern[] = [
  // Mercantil (MERC)
  {
    patterns: [
      /acta\s+(de\s+)?(junta|consejo|reunión)/i,
      /board\s+meeting\s+minutes/i,
      /minutes\s+of\s+(the\s+)?meeting/i,
    ],
    document_type: 'acta_junta',
    area_codes: ['MERC'],
    confidence: 0.9,
  },
  {
    patterns: [
      /escritura\s+(de\s+)?constitución/i,
      /deed\s+of\s+incorporation/i,
      /articles\s+of\s+(incorporation|association)/i,
      /certificate\s+of\s+incorporation/i,
    ],
    document_type: 'escritura_constitucion',
    area_codes: ['MERC'],
    confidence: 0.95,
  },
  {
    patterns: [
      /certificado\s+(del\s+)?registro\s+mercantil/i,
      /commercial\s+registry\s+certificate/i,
      /registro\s+mercantil/i,
    ],
    document_type: 'certificado_registro',
    area_codes: ['MERC'],
    confidence: 0.9,
  },

  // Contractual (CONT)
  {
    patterns: [
      /contrato\s+(de\s+)?(suministro|distribución|servicios|licencia|arrendamiento)/i,
      /acuerdo\s+(de\s+)?(confidencialidad|exclusividad|colaboración)/i,
      /master\s+(service\s+)?agreement/i,
      /supply\s+agreement/i,
      /distribution\s+agreement/i,
      /license\s+agreement/i,
    ],
    document_type: 'contrato_material',
    area_codes: ['CONT'],
    confidence: 0.85,
  },
  {
    patterns: [
      /contrato\s+(de\s+)?(compraventa|cesión|traspaso)/i,
      /(share|asset)\s+purchase\s+agreement/i,
      /spa\s+[^a-z]/i,
    ],
    document_type: 'contrato_material',
    area_codes: ['CONT', 'MERC'],
    confidence: 0.9,
  },

  // Fiscal (FISC)
  {
    patterns: [
      /informe\s+(de\s+)?(auditoría|fiscal|tributario)/i,
      /audit\s+report/i,
      /tax\s+(return|report|certificate)/i,
      /declaración\s+(de\s+)?(impuestos|renta|iva)/i,
      /modelo\s+(200|202|303|347|390)/i,
    ],
    document_type: 'informe_fiscal',
    area_codes: ['FISC'],
    confidence: 0.9,
  },

  // Laboral (LAB)
  {
    patterns: [
      /nómina|payslip|payroll/i,
      /recibo\s+(de\s+)?salario/i,
    ],
    document_type: 'nomina',
    area_codes: ['LAB'],
    confidence: 0.95,
  },
  {
    patterns: [
      /convenio\s+colectivo/i,
      /collective\s+(bargaining\s+)?agreement/i,
    ],
    document_type: 'convenio_colectivo',
    area_codes: ['LAB'],
    confidence: 0.95,
  },
  {
    patterns: [
      /contrato\s+(de\s+)?trabajo/i,
      /employment\s+(contract|agreement)/i,
    ],
    document_type: 'contrato_material',
    area_codes: ['LAB'],
    confidence: 0.85,
  },

  // Propiedad Intelectual (PI)
  {
    patterns: [
      /patente|patent/i,
      /solicitud\s+(de\s+)?patente/i,
    ],
    document_type: 'patente',
    area_codes: ['PI'],
    confidence: 0.9,
  },
  {
    patterns: [
      /marca\s+(registrada|comercial)/i,
      /trademark/i,
      /registro\s+(de\s+)?marca/i,
    ],
    document_type: 'marca',
    area_codes: ['PI'],
    confidence: 0.9,
  },
  {
    patterns: [
      /licencia\s+(de\s+)?(software|uso|explotación)/i,
      /software\s+license/i,
      /ip\s+license/i,
    ],
    document_type: 'licencia',
    area_codes: ['PI', 'CONT'],
    confidence: 0.85,
  },

  // Litigios (LIT)
  {
    patterns: [
      /sentencia|judgment|ruling/i,
      /resolución\s+judicial/i,
      /auto\s+(judicial|del\s+juzgado)/i,
      /demanda|complaint|claim/i,
    ],
    document_type: 'resolucion_judicial',
    area_codes: ['LIT'],
    confidence: 0.85,
  },

  // Administrativo (ADM)
  {
    patterns: [
      /permiso\s+(de\s+)?(obra|actividad|ambiental)/i,
      /licencia\s+(de\s+)?(apertura|actividad|urbanística)/i,
      /autorización\s+administrativa/i,
    ],
    document_type: 'permiso_administrativo',
    area_codes: ['ADM'],
    confidence: 0.85,
  },
  {
    patterns: [
      /póliza\s+(de\s+)?seguro/i,
      /insurance\s+policy/i,
      /certificado\s+(de\s+)?seguro/i,
    ],
    document_type: 'poliza_seguro',
    area_codes: ['ADM'],
    confidence: 0.9,
  },
];

// Jurisdiction detection patterns
const JURISDICTION_PATTERNS: Array<{ patterns: RegExp[]; jurisdiction: Jurisdiction }> = [
  {
    patterns: [
      /ley\s+española/i,
      /derecho\s+español/i,
      /legislación\s+española/i,
      /juzgado\s+(de\s+)?madrid|barcelona|valencia|sevilla/i,
      /españa|spanish\s+law/i,
      /registro\s+mercantil\s+de/i,
    ],
    jurisdiction: 'ES',
  },
  {
    patterns: [
      /european\s+union|unión\s+europea/i,
      /eu\s+regulation|reglamento\s+ue/i,
      /gdpr|rgpd/i,
    ],
    jurisdiction: 'UE',
  },
  {
    patterns: [
      /english\s+law/i,
      /governed\s+by\s+the\s+laws?\s+of\s+(england|uk)/i,
      /companies\s+house/i,
    ],
    jurisdiction: 'UK',
  },
  {
    patterns: [
      /delaware|new\s+york|california/i,
      /us\s+(federal\s+)?law/i,
      /governed\s+by\s+the\s+laws?\s+of\s+(the\s+)?(united\s+states|usa)/i,
    ],
    jurisdiction: 'US',
  },
];

// Language detection patterns
const LANGUAGE_PATTERNS: Array<{ patterns: RegExp[]; language: string }> = [
  { patterns: [/\b(el|la|los|las|de|del|que|con|por|para|una?)\b/gi], language: 'es' },
  { patterns: [/\b(the|and|of|to|in|for|with|that|this)\b/gi], language: 'en' },
  { patterns: [/\b(der|die|das|und|von|mit|für|auf)\b/gi], language: 'de' },
  { patterns: [/\b(le|la|les|de|du|des|que|avec|pour)\b/gi], language: 'fr' },
];

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classifies a VDR document using pattern matching (fast path).
 * Falls back to AI classification only if patterns don't match.
 */
export async function classifyDocument(
  documentId: string,
  options: { useAiFallback?: boolean } = {}
): Promise<ClassificationResult> {
  const { useAiFallback = true } = options;

  // 1. Fetch document metadata and initial content
  const { data: doc, error: docError } = await supabaseAdmin
    .from('vdr_documents')
    .select('id, name, description, category, area_code')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // 2. Fetch first chunk for content analysis
  const { data: chunks } = await supabaseAdmin
    .from('vdr_chunks')
    .select('content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
    .limit(3);

  const textContent = [
    doc.name,
    doc.description || '',
    ...(chunks || []).map(c => c.content),
  ].join('\n');

  // 3. Try pattern-based classification
  const patternResult = classifyByPatterns(textContent, doc.name);

  if (patternResult.confidence >= 0.7) {
    return {
      ...patternResult,
      method: 'pattern',
    };
  }

  // 4. AI fallback if patterns don't match confidently
  if (useAiFallback) {
    try {
      const aiResult = await classifyWithAI(textContent.slice(0, 10000), doc.name);
      return {
        ...aiResult,
        method: 'ai',
      };
    } catch (error) {
      console.error('[document-classifier] AI classification failed:', error);
    }
  }

  // 5. Return pattern result even with low confidence, or default
  return patternResult.document_type !== 'otro'
    ? { ...patternResult, method: 'fallback' }
    : {
        document_type: 'otro',
        document_subtype: null,
        area_codes: doc.area_code ? [doc.area_code as AreaCode] : [],
        jurisdiction: null,
        language: 'es',
        confidence: 0.3,
        method: 'fallback',
      };
}

/**
 * Batch classify multiple documents.
 */
export async function classifyDocumentsBatch(
  documentIds: string[],
  options: { useAiFallback?: boolean } = {}
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  for (const documentId of documentIds) {
    try {
      const result = await classifyDocument(documentId, options);
      results.set(documentId, result);
    } catch (error) {
      console.error(`[document-classifier] Failed to classify ${documentId}:`, error);
    }
  }

  return results;
}

// ============================================================================
// Pattern-Based Classification
// ============================================================================

function classifyByPatterns(
  content: string,
  filename: string
): Omit<ClassificationResult, 'method'> {
  let bestMatch: ClassificationPattern | null = null;
  let bestConfidence = 0;

  // Check all patterns
  for (const pattern of CLASSIFICATION_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(content) || regex.test(filename)) {
        if (pattern.confidence > bestConfidence) {
          bestMatch = pattern;
          bestConfidence = pattern.confidence;
        }
        break; // Found match in this pattern group
      }
    }
  }

  // Detect jurisdiction
  let jurisdiction: Jurisdiction | null = null;
  for (const jPattern of JURISDICTION_PATTERNS) {
    for (const regex of jPattern.patterns) {
      if (regex.test(content)) {
        jurisdiction = jPattern.jurisdiction;
        break;
      }
    }
    if (jurisdiction) break;
  }

  // Detect language
  const language = detectLanguage(content);

  if (bestMatch) {
    return {
      document_type: bestMatch.document_type,
      document_subtype: null,
      area_codes: bestMatch.area_codes,
      jurisdiction,
      language,
      confidence: bestConfidence,
    };
  }

  return {
    document_type: 'otro',
    document_subtype: null,
    area_codes: [],
    jurisdiction,
    language,
    confidence: 0.3,
  };
}

function detectLanguage(content: string): string {
  const counts: Record<string, number> = {};

  for (const { patterns, language } of LANGUAGE_PATTERNS) {
    counts[language] = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      counts[language] += matches?.length || 0;
    }
  }

  // Find language with most matches
  let maxLang = 'es';
  let maxCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxLang = lang;
    }
  }

  return maxLang;
}

// ============================================================================
// AI-Based Classification
// ============================================================================

const CLASSIFICATION_PROMPT = `Classify this legal document:

Document name: {filename}
Content excerpt:
{content}

Return ONLY a JSON object:
{
  "document_type": "contrato_material|contrato_menor|acta_junta|escritura_constitucion|certificado_registro|informe_fiscal|nomina|convenio_colectivo|patente|marca|licencia|poliza_seguro|permiso_administrativo|resolucion_judicial|otro",
  "document_subtype": "more specific type or null",
  "area_codes": ["MERC"|"CONT"|"FISC"|"LAB"|"PI"|"LIT"|"ADM"],
  "jurisdiction": "ES|UE|UK|US|otro|null",
  "language": "es|en|de|fr|it|pt",
  "confidence": 0.0-1.0
}`;

async function classifyWithAI(
  content: string,
  filename: string
): Promise<Omit<ClassificationResult, 'method'>> {
  const gateway = getHarveyGateway();

  const prompt = CLASSIFICATION_PROMPT
    .replace('{filename}', filename)
    .replace('{content}', content.slice(0, 8000));

  const response = await gateway.completion({
    prompt,
    system_prompt: 'You are a legal document classifier. Return only valid JSON.',
  });

  // Parse response
  let jsonText = response.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '');
  }

  const parsed = JSON.parse(jsonText.trim());

  return {
    document_type: validateDocType(parsed.document_type),
    document_subtype: typeof parsed.document_subtype === 'string' ? parsed.document_subtype : null,
    area_codes: validateAreaCodesArray(parsed.area_codes),
    jurisdiction: validateJuris(parsed.jurisdiction),
    language: typeof parsed.language === 'string' ? parsed.language : 'es',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_DOC_TYPES: DocumentType[] = [
  'contrato_material', 'contrato_menor', 'acta_junta', 'escritura_constitucion',
  'certificado_registro', 'informe_fiscal', 'nomina', 'convenio_colectivo',
  'patente', 'marca', 'licencia', 'poliza_seguro', 'permiso_administrativo',
  'resolucion_judicial', 'otro'
];

function validateDocType(value: unknown): DocumentType {
  if (typeof value === 'string' && VALID_DOC_TYPES.includes(value as DocumentType)) {
    return value as DocumentType;
  }
  return 'otro';
}

const VALID_AREA_CODES: AreaCode[] = ['MERC', 'CONT', 'FISC', 'LAB', 'PI', 'LIT', 'ADM'];

function validateAreaCodesArray(value: unknown): AreaCode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => typeof v === 'string' && VALID_AREA_CODES.includes(v as AreaCode)) as AreaCode[];
}

const VALID_JURISDICTIONS: Jurisdiction[] = ['ES', 'UE', 'UK', 'US', 'otro'];

function validateJuris(value: unknown): Jurisdiction | null {
  if (typeof value === 'string' && VALID_JURISDICTIONS.includes(value as Jurisdiction)) {
    return value as Jurisdiction;
  }
  return null;
}
