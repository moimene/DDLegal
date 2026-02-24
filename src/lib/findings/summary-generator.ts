/**
 * Finding Summary Generator
 *
 * Generates synthetic summaries (~200 chars) for findings using Harvey AI.
 * Used during finding creation and batch processing.
 */

import { getHarveyGateway } from '@/lib/harvey/factory';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SUMMARY_MAX_CHARS = 200;

const SUMMARY_SYSTEM_PROMPT = `Eres un abogado experto en Due Diligence legal.
Tu tarea es generar un resumen ejecutivo de un hallazgo (finding) en español.
El resumen debe ser conciso, profesional y capturar la esencia del riesgo identificado.
Máximo ${SUMMARY_MAX_CHARS} caracteres. No uses comillas ni puntos suspensivos al final.
Escribe en tercera persona y tiempo presente.`;

export interface FindingSummaryInput {
  title: string;
  description?: string | null;
  severity: string;
  area_code: string;
  probability?: string;
  timing?: string | null;
  mitigation?: string | null;
  evidence_snippets?: string[];
}

/**
 * Generate a summary for a single finding using Harvey AI.
 */
export async function generateFindingSummary(
  input: FindingSummaryInput
): Promise<string> {
  const gateway = getHarveyGateway();

  const prompt = buildSummaryPrompt(input);

  try {
    const response = await gateway.completion(
      {
        prompt,
        system_prompt: SUMMARY_SYSTEM_PROMPT,
      },
      { family: 'completion' }
    );

    // Truncate to max chars and clean up
    let summary = (response.text || '').trim();
    if (summary.length > SUMMARY_MAX_CHARS) {
      summary = summary.slice(0, SUMMARY_MAX_CHARS - 3).trim() + '...';
    }

    return summary;
  } catch (error) {
    console.error('[SummaryGenerator] Harvey error:', error);
    // Fallback: generate a basic summary from title
    return generateFallbackSummary(input);
  }
}

/**
 * Build the prompt for Harvey to generate the summary.
 */
function buildSummaryPrompt(input: FindingSummaryInput): string {
  const parts: string[] = [
    `Genera un resumen ejecutivo (máximo ${SUMMARY_MAX_CHARS} caracteres) del siguiente hallazgo de Due Diligence:`,
    '',
    `**Título:** ${input.title}`,
    `**Área:** ${input.area_code}`,
    `**Severidad:** ${input.severity}`,
  ];

  if (input.probability) {
    parts.push(`**Probabilidad:** ${input.probability}`);
  }

  if (input.timing) {
    parts.push(`**Timing:** ${input.timing}`);
  }

  if (input.description) {
    parts.push(`**Descripción:** ${input.description}`);
  }

  if (input.mitigation) {
    parts.push(`**Mitigación sugerida:** ${input.mitigation}`);
  }

  if (input.evidence_snippets && input.evidence_snippets.length > 0) {
    parts.push('');
    parts.push('**Extractos de evidencia:**');
    input.evidence_snippets.slice(0, 3).forEach((snippet, i) => {
      parts.push(`${i + 1}. "${snippet.slice(0, 200)}..."`);
    });
  }

  parts.push('');
  parts.push('Resumen ejecutivo:');

  return parts.join('\n');
}

/**
 * Generate a basic fallback summary when Harvey is unavailable.
 */
function generateFallbackSummary(input: FindingSummaryInput): string {
  const severityMap: Record<string, string> = {
    critical: 'crítico',
    high: 'alto',
    medium: 'medio',
    low: 'bajo',
    informational: 'informativo',
  };

  const sev = severityMap[input.severity] || input.severity;
  const base = `Hallazgo de riesgo ${sev} en área ${input.area_code}: ${input.title}`;

  if (base.length <= SUMMARY_MAX_CHARS) {
    return base;
  }

  return base.slice(0, SUMMARY_MAX_CHARS - 3) + '...';
}

/**
 * Batch generate summaries for findings that don't have one.
 * Returns the number of summaries generated.
 */
export async function batchGenerateSummaries(
  projectId?: string,
  limit: number = 10
): Promise<{ generated: number; errors: number }> {
  let query = supabaseAdmin
    .from('dd_findings')
    .select('id, title, description, severity, area_code, probability, timing, mitigation_recommended')
    .is('summary', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data: findings, error } = await query;

  if (error) {
    console.error('[SummaryGenerator] Batch query error:', error.message);
    return { generated: 0, errors: 1 };
  }

  if (!findings || findings.length === 0) {
    return { generated: 0, errors: 0 };
  }

  let generated = 0;
  let errors = 0;

  for (const finding of findings) {
    try {
      const summary = await generateFindingSummary({
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        area_code: finding.area_code,
        probability: finding.probability,
        timing: finding.timing,
        mitigation: finding.mitigation_recommended,
      });

      const { error: updateError } = await supabaseAdmin
        .from('dd_findings')
        .update({ summary })
        .eq('id', finding.id);

      if (updateError) {
        console.error(`[SummaryGenerator] Update error for ${finding.id}:`, updateError.message);
        errors++;
      } else {
        generated++;
        console.log(`[SummaryGenerator] Generated summary for finding ${finding.id}`);
      }
    } catch (err) {
      console.error(`[SummaryGenerator] Error generating summary for ${finding.id}:`, err);
      errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return { generated, errors };
}

/**
 * Update a single finding's summary.
 */
export async function updateFindingSummary(findingId: string): Promise<boolean> {
  const { data: finding, error: fetchError } = await supabaseAdmin
    .from('dd_findings')
    .select('id, title, description, severity, area_code, probability, timing, mitigation_recommended')
    .eq('id', findingId)
    .single();

  if (fetchError || !finding) {
    console.error(`[SummaryGenerator] Finding not found: ${findingId}`);
    return false;
  }

  try {
    const summary = await generateFindingSummary({
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      area_code: finding.area_code,
      probability: finding.probability,
      timing: finding.timing,
      mitigation: finding.mitigation_recommended,
    });

    const { error: updateError } = await supabaseAdmin
      .from('dd_findings')
      .update({ summary })
      .eq('id', findingId);

    if (updateError) {
      console.error(`[SummaryGenerator] Update error:`, updateError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[SummaryGenerator] Error:`, err);
    return false;
  }
}
