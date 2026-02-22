import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { emitEvent } from '@/lib/events';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Auto-Classification endpoint
 * POST /api/ai/classify
 *
 * Input:  { document_id, project_id, filename, content_preview? }
 * Output: { area_code, category, tags, confidence, auto_applied: boolean }
 *
 * Filename patterns are matched against FILENAME_PATTERNS to determine
 * area_code and category. If confidence > 80%, results are auto-applied
 * to the document. Otherwise the doc is queued for HITL review.
 */

// ────────────────────────────────────────────────────────────
// Pattern database
// ────────────────────────────────────────────────────────────

interface FilenamePattern {
  pattern: RegExp;
  area_code: string | null;
  category: string;
  weight: number; // higher = more specific
}

const FILENAME_PATTERNS: FilenamePattern[] = [
  // Mercantil
  { pattern: /contrat|acuerdo|convenio/i, area_code: 'MERC', category: 'contrato', weight: 10 },
  { pattern: /escritura|notari/i, area_code: 'MERC', category: 'escritura', weight: 10 },
  { pattern: /estatut/i, area_code: 'MERC', category: 'estatutos', weight: 10 },
  { pattern: /p[oó]liza|seguro|cobertura/i, area_code: 'MERC', category: 'poliza', weight: 8 },
  { pattern: /acta.*junta|junta.*general/i, area_code: 'MERC', category: 'acta', weight: 10 },
  { pattern: /poder|apoderamiento/i, area_code: 'MERC', category: 'poder', weight: 8 },

  // Contable / Fiscal
  { pattern: /cuentas.+anual|balance|pl\b/i, area_code: 'CONT', category: 'cuentas_anuales', weight: 10 },
  { pattern: /factura|iva|impuest|fiscal/i, area_code: 'CONT', category: 'informe', weight: 8 },
  { pattern: /audit[oó]r[ií]a|informe.+audit/i, area_code: 'CONT', category: 'auditoria', weight: 10 },

  // Laboral
  { pattern: /n[oó]mina|salari|empleo|laboral/i, area_code: 'LAB', category: 'nomina', weight: 10 },
  { pattern: /ss\.cc|seguridad.+social|cotizaci/i, area_code: 'LAB', category: 'certificado', weight: 10 },
  { pattern: /convenio.+colectivo/i, area_code: 'LAB', category: 'convenio', weight: 12 },
  { pattern: /despido|ERE|ERTE/i, area_code: 'LAB', category: 'expediente', weight: 10 },

  // Administrativo
  { pattern: /licencia|permiso|autorizaci/i, area_code: 'ADM', category: 'licencia', weight: 8 },
  { pattern: /subvenci[oó]n|ayuda.+p[uú]blica/i, area_code: 'ADM', category: 'subvencion', weight: 8 },

  // Procesal / Litigios
  { pattern: /sentencia|demanda|juzgado|litig/i, area_code: 'PROC', category: 'sentencia', weight: 10 },
  { pattern: /laudo|arbitr/i, area_code: 'PROC', category: 'laudo', weight: 10 },
  { pattern: /reclamaci[oó]n/i, area_code: 'PROC', category: 'reclamacion', weight: 6 },

  // Propiedad Industrial / Intelectual
  { pattern: /patent|marca|dise[ñn]o|propiedad.+ind/i, area_code: 'IP', category: 'certificado', weight: 10 },
  { pattern: /dominio|nombre.+dominio/i, area_code: 'IP', category: 'dominio', weight: 8 },

  // Medioambiente
  { pattern: /ambiental|medioambient|residuo/i, area_code: 'MAM', category: 'informe', weight: 10 },
  { pattern: /evaluaci[oó]n.+impacto/i, area_code: 'MAM', category: 'evaluacion', weight: 12 },

  // Inmobiliario
  { pattern: /inmuebl|finca|catastro|registr/i, area_code: 'INM', category: 'certificado', weight: 8 },
  { pattern: /arrendamiento|alquiler/i, area_code: 'INM', category: 'contrato', weight: 10 },
  { pattern: /nota.+simple/i, area_code: 'INM', category: 'nota_simple', weight: 12 },

  // Compliance / Datos
  { pattern: /rgpd|protecci[oó]n.+datos|privacidad/i, area_code: 'COMP', category: 'informe', weight: 10 },
  { pattern: /compliance|cumplimiento/i, area_code: 'COMP', category: 'informe', weight: 6 },
  { pattern: /blanqueo|pbc|prevenci[oó]n/i, area_code: 'COMP', category: 'informe', weight: 8 },

  // Generic fallbacks (lower weight)
  { pattern: /informe|report|dictamen/i, area_code: null, category: 'informe', weight: 3 },
  { pattern: /certificad/i, area_code: null, category: 'certificado', weight: 3 },
  { pattern: /anexo/i, area_code: null, category: 'anexo', weight: 2 },
  { pattern: /acta/i, area_code: null, category: 'acta', weight: 3 },
];

// ────────────────────────────────────────────────────────────
// Tag suggestion patterns
// ────────────────────────────────────────────────────────────

interface TagPattern {
  pattern: RegExp;
  tag: string;
}

const TAG_PATTERNS: TagPattern[] = [
  { pattern: /2024|2025|2026/i, tag: 'anual' },
  { pattern: /trimest|Q[1-4]/i, tag: 'trimestral' },
  { pattern: /borrador|draft/i, tag: 'borrador' },
  { pattern: /firmad|sign/i, tag: 'firmado' },
  { pattern: /confidencial|reservad/i, tag: 'confidencial' },
  { pattern: /vigente|activ/i, tag: 'vigente' },
  { pattern: /vencid|expirad|caducad/i, tag: 'vencido' },
  { pattern: /copia|duplicado/i, tag: 'copia' },
  { pattern: /original/i, tag: 'original' },
  { pattern: /escaneado|scan/i, tag: 'escaneado' },
  { pattern: /traducci[oó]n|traduc/i, tag: 'traduccion' },
  { pattern: /urgente|priority/i, tag: 'urgente' },
  { pattern: /pendiente/i, tag: 'pendiente_revision' },
];

// ────────────────────────────────────────────────────────────
// Classification logic
// ────────────────────────────────────────────────────────────

interface ClassificationResult {
  area_code: string | null;
  category: string;
  tags: string[];
  confidence: number;
  matches: Array<{ pattern: string; area_code: string | null; category: string; weight: number }>;
}

function classifyFilename(filename: string, contentPreview?: string): ClassificationResult {
  const normalizedFilename = filename
    .replace(/[_\-\.]/g, ' ')
    .replace(/\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i, '')
    .toLowerCase();

  const textToAnalyze = contentPreview
    ? `${normalizedFilename} ${contentPreview.substring(0, 500)}`
    : normalizedFilename;

  // Find all matching patterns
  const matches: Array<{ pattern: string; area_code: string | null; category: string; weight: number }> = [];

  for (const fp of FILENAME_PATTERNS) {
    if (fp.pattern.test(textToAnalyze)) {
      matches.push({
        pattern: fp.pattern.source,
        area_code: fp.area_code,
        category: fp.category,
        weight: fp.weight,
      });
    }
  }

  // Sort by weight descending
  matches.sort((a, b) => b.weight - a.weight);

  // Determine best area_code and category
  let area_code: string | null = null;
  let category = 'otro';

  if (matches.length > 0) {
    // Take the highest-weight match for category
    category = matches[0].category;

    // For area_code, prefer the highest-weight match that has one
    const withArea = matches.find(m => m.area_code !== null);
    if (withArea) {
      area_code = withArea.area_code;
    }
  }

  // Extract tags
  const tags: string[] = [];
  for (const tp of TAG_PATTERNS) {
    if (tp.pattern.test(textToAnalyze)) {
      tags.push(tp.tag);
    }
  }

  // Calculate confidence score (0-100)
  let confidence = 0;

  if (matches.length > 0) {
    // Base confidence from best match weight
    const bestWeight = matches[0].weight;
    confidence = Math.min(bestWeight * 8, 70); // max 70 from weight alone

    // Bonus for having area_code
    if (area_code) confidence += 15;

    // Bonus for multiple confirming matches
    if (matches.length >= 2) confidence += 10;
    if (matches.length >= 3) confidence += 5;

    // Bonus for content preview available
    if (contentPreview && contentPreview.length > 50) confidence += 5;

    // Penalty for conflicting area codes
    const areaCodes = new Set(matches.filter(m => m.area_code).map(m => m.area_code));
    if (areaCodes.size > 1) confidence -= 15;

    confidence = Math.max(0, Math.min(100, confidence));
  }

  return { area_code, category, tags, confidence, matches };
}

// ────────────────────────────────────────────────────────────
// API Route
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id, project_id, filename, content_preview } = body as {
      document_id?: string;
      project_id?: string;
      filename?: string;
      content_preview?: string;
    };

    if (!document_id || !filename) {
      return NextResponse.json(
        { error: 'document_id y filename son requeridos' },
        { status: 400 }
      );
    }

    // Permission check
    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }
    const { authorized, error: authError } = await requirePermission(request, project_id, 'can_upload_vdr');
    if (!authorized) return authError!;

    // Run classification
    const result = classifyFilename(filename, content_preview);

    const autoApplied = result.confidence > 80;

    // If confidence is high enough, auto-apply to the document
    if (autoApplied) {
      const updatePayload: Record<string, unknown> = {
        category: result.category,
        tags: result.tags,
        metadata: {
          ai_classified: true,
          ai_confidence: result.confidence,
          ai_area_code: result.area_code,
          ai_classified_at: new Date().toISOString(),
        },
      };

      if (result.area_code) {
        updatePayload.area_code = result.area_code;
      }

      const { error: updateError } = await supabaseAdmin
        .from('vdr_documents')
        .update(updatePayload)
        .eq('id', document_id);

      if (updateError) {
        console.error('[AI Classify] Update error:', updateError.message);
        // Non-fatal: still return the classification result
      }

      // Emit event for auto-classification
      if (project_id) {
        await emitEvent({
          type: 'document_uploaded',
          payload: {
            document_id,
            project_id,
          },
        });
      }
    } else {
      // Queue for HITL review: mark in metadata but don't auto-apply
      const { error: metaError } = await supabaseAdmin
        .from('vdr_documents')
        .update({
          metadata: {
            ai_suggestion: {
              area_code: result.area_code,
              category: result.category,
              tags: result.tags,
              confidence: result.confidence,
              suggested_at: new Date().toISOString(),
            },
            needs_hitl_classification: true,
          },
        })
        .eq('id', document_id);

      if (metaError) {
        console.error('[AI Classify] HITL metadata error:', metaError.message);
      }

      // Emit HITL required event
      if (project_id) {
        await emitEvent({
          type: 'hitl_decision_required',
          payload: {
            task_id: document_id,
            project_id,
            confidence_score: result.confidence,
          },
        });
      }
    }

    return NextResponse.json({
      area_code: result.area_code,
      category: result.category,
      tags: result.tags,
      confidence: result.confidence,
      auto_applied: autoApplied,
      matches: result.matches,
    });
  } catch (error) {
    console.error('[AI Classify] Error:', error);
    return NextResponse.json(
      { error: 'Error interno en la clasificacion' },
      { status: 500 }
    );
  }
}
