/**
 * Conclude Phase — Worker Architecture v1.0
 *
 * Responsibility: Transform findings into actionable conclusions.
 *
 * Pipeline:
 * 1. AREA SYNTHESIS: Group findings by area, calculate risk scores
 * 2. RED FLAG CONSOLIDATION: Extract Tier 1 findings, detect patterns
 * 3. DEAL RISK SCORING: Apply weighted scoring, generate recommendation
 * 4. REPORT GENERATION: Generate area reports and executive summary
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getHarveyGateway } from '@/lib/harvey/factory';
import type { WorkerRunState, WorkerConfig, CoverageSnapshot } from './worker-controller';

// ============================================================================
// Types
// ============================================================================

interface PhaseResult {
  itemsTotal: number;
  itemsDone: number;
  itemsError: number;
  docsNormalized: number;
  fosEvaluated: number;
  findingsCreated: number;
  findingsUpdated: number;
  conclusionsGenerated: number;
  aiCallsMade: number;
  durationMs: number;
  coverageSnapshot?: CoverageSnapshot;
}

interface FindingForConclusion {
  id: string;
  title: string;
  area_code: string;
  severity: string;
  probability: string;
  timing: string;
  is_deal_breaker: boolean;
  economic_impact_amount: number | null;
  relevance_tier: number;
  status: string;
}

interface AreaStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  dealBreakers: number;
  economicExposure: number;
  tierOneCount: number;
}

interface AreaConclusion {
  areaCode: string;
  narrative: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  riskScore: number;
  stats: AreaStats;
  recommendations: Recommendation[];
  patterns: Pattern[];
  keyFindings: KeyFinding[];
}

interface Recommendation {
  type: 'mitigation' | 'negotiation' | 'condition_precedent' | 'indemnity';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedCost?: number;
  relatedFindings: string[];
}

interface Pattern {
  patternType: string;
  description: string;
  affectedFindings: string[];
  severityImpact: 'amplifying' | 'neutral' | 'mitigating';
}

interface KeyFinding {
  findingId: string;
  title: string;
  severity: string;
  economicImpact?: number;
}

// Area code to name mapping
const AREA_NAMES: Record<string, string> = {
  MERC: 'Mercantil y Societario',
  CONT: 'Contractual',
  FISC: 'Fiscal y Tributario',
  LAB: 'Laboral',
  PI: 'Propiedad Intelectual',
  LIT: 'Litigios',
  ADM: 'Administrativo',
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Execute the CONCLUDE phase of the worker loop.
 *
 * 1. Get all findings for the project
 * 2. Group by area and calculate statistics
 * 3. Generate area conclusions (with AI assistance)
 * 4. Compute deal risk score
 * 5. Persist conclusions
 */
export async function runConcludePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  const startTime = Date.now();

  try {
    // Get all non-dismissed findings for the project
    const findings = await getProjectFindings(config.projectId);

    if (findings.length === 0) {
      return createEmptyResult(startTime);
    }

    // Group findings by area
    const findingsByArea = groupFindingsByArea(findings);

    // Generate conclusions for each area
    let conclusionsGenerated = 0;
    let aiCallsMade = 0;
    const remainingBudget = config.aiBudgetPerCycle - state.aiBudgetUsed;

    for (const [areaCode, areaFindings] of Object.entries(findingsByArea)) {
      // Check AI budget
      if (aiCallsMade >= remainingBudget) {
        console.log('[conclude-phase] AI budget exhausted');
        break;
      }

      try {
        const conclusion = await generateAreaConclusion(
          config.projectId,
          areaCode,
          areaFindings,
          aiCallsMade < remainingBudget
        );

        if (conclusion) {
          await persistAreaConclusion(config.projectId, conclusion);
          conclusionsGenerated++;
          if (conclusion.narrative) aiCallsMade++;
        }
      } catch (error) {
        console.error(`[conclude-phase] Error generating conclusion for ${areaCode}:`, error);
      }
    }

    // Compute coverage
    const coverage = await computeConclusionCoverage(config.projectId);

    return {
      itemsTotal: Object.keys(findingsByArea).length,
      itemsDone: conclusionsGenerated,
      itemsError: Object.keys(findingsByArea).length - conclusionsGenerated,
      docsNormalized: 0,
      fosEvaluated: 0,
      findingsCreated: 0,
      findingsUpdated: 0,
      conclusionsGenerated,
      aiCallsMade,
      durationMs: Date.now() - startTime,
      coverageSnapshot: coverage,
    };
  } catch (error) {
    console.error('[conclude-phase] Error:', error);
    return {
      itemsTotal: 0,
      itemsDone: 0,
      itemsError: 1,
      docsNormalized: 0,
      fosEvaluated: 0,
      findingsCreated: 0,
      findingsUpdated: 0,
      conclusionsGenerated: 0,
      aiCallsMade: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Get all non-dismissed findings for a project.
 */
async function getProjectFindings(projectId: string): Promise<FindingForConclusion[]> {
  const { data: findings, error } = await supabaseAdmin
    .from('dd_findings')
    .select(`
      id,
      title,
      area_code,
      severity,
      probability,
      timing,
      is_deal_breaker,
      economic_impact_amount,
      relevance_tier,
      status
    `)
    .eq('project_id', projectId)
    .neq('status', 'dismissed');

  if (error) {
    console.error('[conclude-phase] Failed to load findings:', error);
    return [];
  }

  return (findings || []) as FindingForConclusion[];
}

/**
 * Group findings by area code.
 */
function groupFindingsByArea(
  findings: FindingForConclusion[]
): Record<string, FindingForConclusion[]> {
  const grouped: Record<string, FindingForConclusion[]> = {};

  for (const finding of findings) {
    const area = finding.area_code || 'OTROS';
    if (!grouped[area]) {
      grouped[area] = [];
    }
    grouped[area].push(finding);
  }

  return grouped;
}

// ============================================================================
// Area Conclusion Generation
// ============================================================================

/**
 * Generate conclusion for a single area.
 */
async function generateAreaConclusion(
  projectId: string,
  areaCode: string,
  findings: FindingForConclusion[],
  useAi: boolean
): Promise<AreaConclusion | null> {
  // Calculate statistics
  const stats = calculateAreaStats(findings);

  // Determine risk level
  const riskLevel = determineRiskLevel(stats);
  const riskScore = calculateRiskScore(stats);

  // Get key findings (top 5 by severity)
  const keyFindings = getKeyFindings(findings);

  // Detect patterns
  const patterns = detectPatterns(findings);

  // Generate recommendations
  const recommendations = generateRecommendations(findings, patterns);

  // Generate narrative (with AI if available)
  let narrative = '';
  if (useAi && findings.length > 0) {
    narrative = await generateNarrativeWithAI(areaCode, findings, stats, keyFindings);
  } else {
    narrative = generateNarrativeTemplate(areaCode, stats, keyFindings);
  }

  return {
    areaCode,
    narrative,
    riskLevel,
    riskScore,
    stats,
    recommendations,
    patterns,
    keyFindings,
  };
}

/**
 * Calculate statistics for an area's findings.
 */
function calculateAreaStats(findings: FindingForConclusion[]): AreaStats {
  const stats: AreaStats = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    dealBreakers: 0,
    economicExposure: 0,
    tierOneCount: 0,
  };

  for (const finding of findings) {
    // Severity counts
    switch (finding.severity) {
      case 'critical':
        stats.critical++;
        break;
      case 'high':
        stats.high++;
        break;
      case 'medium':
        stats.medium++;
        break;
      case 'low':
        stats.low++;
        break;
    }

    // Deal breakers
    if (finding.is_deal_breaker) {
      stats.dealBreakers++;
    }

    // Economic exposure
    if (finding.economic_impact_amount) {
      stats.economicExposure += finding.economic_impact_amount;
    }

    // Tier 1 (Decisorio)
    if (finding.relevance_tier === 1) {
      stats.tierOneCount++;
    }
  }

  return stats;
}

/**
 * Determine overall risk level for an area.
 */
function determineRiskLevel(stats: AreaStats): 'critical' | 'high' | 'medium' | 'low' | 'minimal' {
  if (stats.dealBreakers > 0 || stats.critical >= 2) {
    return 'critical';
  }
  if (stats.critical >= 1 || stats.high >= 3) {
    return 'high';
  }
  if (stats.high >= 1 || stats.medium >= 5) {
    return 'medium';
  }
  if (stats.medium >= 1 || stats.low >= 3) {
    return 'low';
  }
  return 'minimal';
}

/**
 * Calculate numeric risk score (0-100).
 */
function calculateRiskScore(stats: AreaStats): number {
  // Weighted scoring
  const score =
    stats.critical * 25 +
    stats.high * 15 +
    stats.medium * 8 +
    stats.low * 3 +
    stats.dealBreakers * 20 +
    stats.tierOneCount * 10;

  return Math.min(100, score);
}

/**
 * Get top findings by severity.
 */
function getKeyFindings(findings: FindingForConclusion[]): KeyFinding[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

  return findings
    .sort((a, b) => {
      const aOrder = severityOrder[a.severity as keyof typeof severityOrder] ?? 5;
      const bOrder = severityOrder[b.severity as keyof typeof severityOrder] ?? 5;
      return aOrder - bOrder;
    })
    .slice(0, 5)
    .map(f => ({
      findingId: f.id,
      title: f.title,
      severity: f.severity,
      economicImpact: f.economic_impact_amount || undefined,
    }));
}

/**
 * Detect patterns across findings.
 */
function detectPatterns(findings: FindingForConclusion[]): Pattern[] {
  const patterns: Pattern[] = [];

  // Pattern: Multiple blocking findings
  const blockingFindings = findings.filter(f => f.timing === 'blocking');
  if (blockingFindings.length >= 2) {
    patterns.push({
      patternType: 'multiple_blocking',
      description: `${blockingFindings.length} hallazgos con timing "blocking" que podrían afectar el cierre`,
      affectedFindings: blockingFindings.map(f => f.id),
      severityImpact: 'amplifying',
    });
  }

  // Pattern: Concentrated deal breakers
  const dealBreakers = findings.filter(f => f.is_deal_breaker);
  if (dealBreakers.length >= 2) {
    patterns.push({
      patternType: 'concentrated_deal_breakers',
      description: `${dealBreakers.length} deal breakers identificados en esta área`,
      affectedFindings: dealBreakers.map(f => f.id),
      severityImpact: 'amplifying',
    });
  }

  // Pattern: High economic exposure
  const totalExposure = findings.reduce((sum, f) => sum + (f.economic_impact_amount || 0), 0);
  if (totalExposure > 1000000) {
    const highExposureFindings = findings.filter(f => (f.economic_impact_amount || 0) > 100000);
    patterns.push({
      patternType: 'high_economic_exposure',
      description: `Exposición económica total: ${totalExposure.toLocaleString('es-ES')} EUR`,
      affectedFindings: highExposureFindings.map(f => f.id),
      severityImpact: 'amplifying',
    });
  }

  return patterns;
}

/**
 * Generate recommendations based on findings and patterns.
 */
function generateRecommendations(
  findings: FindingForConclusion[],
  patterns: Pattern[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Recommendation for deal breakers
  const dealBreakers = findings.filter(f => f.is_deal_breaker);
  if (dealBreakers.length > 0) {
    recommendations.push({
      type: 'condition_precedent',
      description: `Resolver ${dealBreakers.length} deal breaker(s) como condición precedente al cierre`,
      priority: 'high',
      relatedFindings: dealBreakers.map(f => f.id),
    });
  }

  // Recommendation for critical findings
  const criticalFindings = findings.filter(f => f.severity === 'critical' && !f.is_deal_breaker);
  if (criticalFindings.length > 0) {
    recommendations.push({
      type: 'indemnity',
      description: `Negociar indemnidad específica para ${criticalFindings.length} hallazgo(s) crítico(s)`,
      priority: 'high',
      relatedFindings: criticalFindings.map(f => f.id),
    });
  }

  // Recommendation for high economic exposure
  const highExposure = findings.filter(f => (f.economic_impact_amount || 0) > 500000);
  if (highExposure.length > 0) {
    const totalExposure = highExposure.reduce((sum, f) => sum + (f.economic_impact_amount || 0), 0);
    recommendations.push({
      type: 'negotiation',
      description: `Negociar ajuste de precio o retención por exposición de ${totalExposure.toLocaleString('es-ES')} EUR`,
      priority: 'medium',
      estimatedCost: totalExposure,
      relatedFindings: highExposure.map(f => f.id),
    });
  }

  // Recommendation for blocking timing
  const blockingFindings = findings.filter(f => f.timing === 'blocking');
  if (blockingFindings.length > 0) {
    recommendations.push({
      type: 'mitigation',
      description: `Establecer plan de mitigación para ${blockingFindings.length} hallazgo(s) con timing blocking`,
      priority: 'high',
      relatedFindings: blockingFindings.map(f => f.id),
    });
  }

  return recommendations;
}

// ============================================================================
// Narrative Generation
// ============================================================================

/**
 * Generate narrative with Harvey AI.
 */
async function generateNarrativeWithAI(
  areaCode: string,
  findings: FindingForConclusion[],
  stats: AreaStats,
  keyFindings: KeyFinding[]
): Promise<string> {
  const areaName = AREA_NAMES[areaCode] || areaCode;

  const prompt = `Genera una conclusión ejecutiva en español para el área de ${areaName} de un informe de Due Diligence legal.

Estadísticas del área:
- Total de hallazgos: ${stats.total}
- Críticos: ${stats.critical}
- Altos: ${stats.high}
- Medios: ${stats.medium}
- Bajos: ${stats.low}
- Deal breakers: ${stats.dealBreakers}
- Exposición económica total: ${stats.economicExposure.toLocaleString('es-ES')} EUR

Principales hallazgos:
${keyFindings.map(f => `- ${f.title} (${f.severity}${f.economicImpact ? `, ${f.economicImpact.toLocaleString('es-ES')} EUR` : ''})`).join('\n')}

Genera un párrafo de 3-5 frases que:
1. Resuma el estado general del área
2. Destaque los riesgos más significativos
3. Indique el nivel de atención requerido

Responde SOLO con el párrafo de conclusión, sin encabezados ni formato adicional.`;

  try {
    const gateway = getHarveyGateway();
    const response = await gateway.completion({ prompt });

    return response.text || generateNarrativeTemplate(areaCode, stats, keyFindings);
  } catch (error) {
    console.error('[conclude-phase] AI narrative generation failed:', error);
    return generateNarrativeTemplate(areaCode, stats, keyFindings);
  }
}

/**
 * Generate template-based narrative (fallback).
 */
function generateNarrativeTemplate(
  areaCode: string,
  stats: AreaStats,
  keyFindings: KeyFinding[]
): string {
  const areaName = AREA_NAMES[areaCode] || areaCode;

  let riskDescription: string;
  if (stats.dealBreakers > 0) {
    riskDescription = `presenta ${stats.dealBreakers} deal breaker(s) que requieren resolución antes del cierre`;
  } else if (stats.critical > 0) {
    riskDescription = `presenta ${stats.critical} hallazgo(s) crítico(s) que requieren atención prioritaria`;
  } else if (stats.high > 0) {
    riskDescription = `presenta ${stats.high} hallazgo(s) de alta severidad a gestionar`;
  } else if (stats.total > 0) {
    riskDescription = `presenta ${stats.total} hallazgo(s) de severidad media-baja`;
  } else {
    riskDescription = 'no presenta hallazgos significativos';
  }

  let exposureText = '';
  if (stats.economicExposure > 0) {
    exposureText = ` La exposición económica identificada asciende a ${stats.economicExposure.toLocaleString('es-ES')} EUR.`;
  }

  let topFindingText = '';
  if (keyFindings.length > 0) {
    topFindingText = ` El hallazgo principal es "${keyFindings[0].title}" (${keyFindings[0].severity}).`;
  }

  return `El área de ${areaName} ${riskDescription}.${exposureText}${topFindingText}`;
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * Persist area conclusion to database.
 */
async function persistAreaConclusion(
  projectId: string,
  conclusion: AreaConclusion
): Promise<void> {
  // Get or create conclusion record
  const { data: existingId } = await supabaseAdmin
    .rpc('get_or_create_area_conclusion', {
      p_project_id: projectId,
      p_area_code: conclusion.areaCode,
    });

  const conclusionId = existingId;

  // Update with generated data
  await supabaseAdmin
    .from('dd_area_conclusions')
    .update({
      conclusion_narrative: conclusion.narrative,
      risk_level: conclusion.riskLevel,
      risk_score: conclusion.riskScore,
      findings_total: conclusion.stats.total,
      findings_critical: conclusion.stats.critical,
      findings_high: conclusion.stats.high,
      findings_medium: conclusion.stats.medium,
      findings_low: conclusion.stats.low,
      deal_breakers: conclusion.stats.dealBreakers,
      recommendations: conclusion.recommendations,
      patterns: conclusion.patterns,
      key_findings: conclusion.keyFindings,
      generated_at: new Date().toISOString(),
      generated_by: 'worker',
      review_status: 'pending',
    })
    .eq('id', conclusionId);
}

// ============================================================================
// Coverage Computation
// ============================================================================

/**
 * Compute conclusion coverage (how many areas have conclusions).
 */
async function computeConclusionCoverage(projectId: string): Promise<CoverageSnapshot> {
  // Get areas with findings
  const { data: findingsData } = await supabaseAdmin
    .from('dd_findings')
    .select('area_code')
    .eq('project_id', projectId)
    .neq('status', 'dismissed');

  const areasWithFindings = new Set((findingsData || []).map(f => f.area_code));

  // Get areas with conclusions
  const { data: conclusionsData } = await supabaseAdmin
    .from('dd_area_conclusions')
    .select('area_code')
    .eq('project_id', projectId);

  const areasWithConclusions = new Set((conclusionsData || []).map(c => c.area_code));

  // Calculate coverage
  const byArea: Record<string, number> = {};
  for (const area of Array.from(areasWithFindings)) {
    byArea[area] = areasWithConclusions.has(area) ? 100 : 0;
  }

  const total = areasWithFindings.size;
  const covered = Array.from(areasWithFindings).filter(a => areasWithConclusions.has(a)).length;
  const overall = total > 0 ? Math.round((covered / total) * 100) : 100;

  return { by_area: byArea, overall };
}

// ============================================================================
// Helpers
// ============================================================================

function createEmptyResult(startTime: number): PhaseResult {
  return {
    itemsTotal: 0,
    itemsDone: 0,
    itemsError: 0,
    docsNormalized: 0,
    fosEvaluated: 0,
    findingsCreated: 0,
    findingsUpdated: 0,
    conclusionsGenerated: 0,
    aiCallsMade: 0,
    durationMs: Date.now() - startTime,
  };
}
