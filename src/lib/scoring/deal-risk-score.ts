/**
 * H3 Scoring Engine — Deal Risk Score
 *
 * Aggregates findings (contingencies + negotiation alerts) across all DD areas
 * into a consolidated 0-100 risk score with go/conditional_go/no_go recommendation.
 *
 * Scoring formula per finding:
 *   raw_score = severity_weight * probability_weight * timing_multiplier * 100
 *   weighted_score = raw_score * area_weight
 *
 * Overall score: weighted average of area scores, clamped 0-100.
 * Deal breaker: severity=critical AND (probability=certain|alta) AND timing=blocking
 */

// ---------------------------------------------------------------------------
// Weight tables
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.4,
  low: 0.15,
  informational: 0.0,
};

const PROBABILITY_WEIGHTS: Record<string, number> = {
  certain: 1.0,
  probable: 0.75,
  possible: 0.4,
  remote: 0.15,
  alta: 0.9,
  media: 0.5,
  baja: 0.2,
};

const TIMING_MULTIPLIER: Record<string, number> = {
  blocking: 1.5,
  post_closing: 1.0,
};

/** Default area weights — configurable per deal type */
export const DEFAULT_AREA_WEIGHTS: Record<string, number> = {
  MERC: 1.0,
  CONT: 1.2,
  LAB: 0.8,
  FISC: 1.0,
  PI: 0.7,
  GENERAL: 0.5,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringInput {
  id: string;
  title: string;
  severity: string;
  probability: string;
  economic_impact_amount?: number;
  timing?: string;
  area_code: string;
  hitl_decision?: string;
}

export interface ScoredFinding {
  id: string;
  title: string;
  raw_score: number;
  weighted_score: number;
  is_deal_breaker: boolean;
  area_code: string;
  original_severity?: string;
}

export interface AreaScore {
  score: number;
  finding_count: number;
  critical_count: number;
}

export interface SensitivityAnalysis {
  best_case: number;
  base_case: number;
  worst_case: number;
}

export interface DealRiskScoreOutput {
  overall_score: number;
  recommendation: 'go' | 'conditional_go' | 'no_go';
  area_scores: Record<string, AreaScore>;
  deal_breakers: ScoredFinding[];
  top_risks: ScoredFinding[];
  sensitivity: SensitivityAnalysis;
  total_economic_exposure: number;
  scored_findings: ScoredFinding[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lookupWeight(table: Record<string, number>, key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  return table[key.toLowerCase()] ?? fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Determine if a finding qualifies as a deal breaker:
 * severity = critical AND probability in (certain, alta) AND timing = blocking
 */
function isDealBreaker(finding: ScoringInput): boolean {
  const sev = finding.severity?.toLowerCase();
  const prob = finding.probability?.toLowerCase();
  const timing = finding.timing?.toLowerCase();
  return (
    sev === 'critical' &&
    (prob === 'certain' || prob === 'alta') &&
    timing === 'blocking'
  );
}

/**
 * Score a single finding. Returns raw_score 0-100 (before area weighting).
 */
function scoreFinding(finding: ScoringInput): number {
  const sevWeight = lookupWeight(SEVERITY_WEIGHTS, finding.severity, 0);
  const probWeight = lookupWeight(PROBABILITY_WEIGHTS, finding.probability, 0.4);
  const timingMult = lookupWeight(TIMING_MULTIPLIER, finding.timing, 1.0);
  return sevWeight * probWeight * timingMult * 100;
}

/**
 * Compute a sensitivity-adjusted raw score for a finding using a given
 * probability override.
 */
function scoreFindingWithProbability(finding: ScoringInput, probOverride: string): number {
  const sevWeight = lookupWeight(SEVERITY_WEIGHTS, finding.severity, 0);
  const probWeight = lookupWeight(PROBABILITY_WEIGHTS, probOverride, 0.4);
  const timingMult = lookupWeight(TIMING_MULTIPLIER, finding.timing, 1.0);
  return sevWeight * probWeight * timingMult * 100;
}

/**
 * Determine recommendation bucket based on overall score.
 *   < 30  => 'go'
 *   30-65 => 'conditional_go'
 *   > 65  => 'no_go'
 */
function deriveRecommendation(score: number): 'go' | 'conditional_go' | 'no_go' {
  if (score < 30) return 'go';
  if (score <= 65) return 'conditional_go';
  return 'no_go';
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Calculate the consolidated Deal Risk Score for a set of findings.
 *
 * @param findings - Array of scoring inputs (contingencies + alerts)
 * @param areaWeights - Optional area weight overrides (defaults to DEFAULT_AREA_WEIGHTS)
 * @returns Full DealRiskScoreOutput with overall score, area breakdown, deal breakers, etc.
 */
export function calculateDealRiskScore(
  findings: ScoringInput[],
  areaWeights?: Record<string, number>,
): DealRiskScoreOutput {
  const weights = { ...DEFAULT_AREA_WEIGHTS, ...(areaWeights ?? {}) };

  // Filter out HITL-rejected findings
  const activeFindingsAll = findings.filter(
    (f) => f.hitl_decision?.toLowerCase() !== 'reject' && f.hitl_decision?.toLowerCase() !== 'rejected',
  );

  // Score each finding
  const scoredFindings: ScoredFinding[] = activeFindingsAll.map((f) => {
    const areaCode = f.area_code?.toUpperCase() || 'GENERAL';
    const rawScore = scoreFinding(f);
    const areaWeight = weights[areaCode] ?? weights['GENERAL'] ?? 0.5;
    const weightedScore = rawScore * areaWeight;
    return {
      id: f.id,
      title: f.title,
      raw_score: Math.round(rawScore * 100) / 100,
      weighted_score: Math.round(weightedScore * 100) / 100,
      is_deal_breaker: isDealBreaker(f),
      area_code: areaCode,
      original_severity: f.severity,
    };
  });

  // Group by area
  const areaScores: Record<string, AreaScore> = {};
  for (const sf of scoredFindings) {
    if (!areaScores[sf.area_code]) {
      areaScores[sf.area_code] = { score: 0, finding_count: 0, critical_count: 0 };
    }
    const area = areaScores[sf.area_code];
    area.score += sf.weighted_score;
    area.finding_count += 1;
    // Check original severity from the input
    if (sf.original_severity?.toLowerCase() === 'critical') {
      area.critical_count += 1;
    }
  }

  // Normalize area scores: average per area (score / finding_count), then clamp 0-100
  for (const code of Object.keys(areaScores)) {
    const area = areaScores[code];
    if (area.finding_count > 0) {
      area.score = Math.round(clamp(area.score / area.finding_count, 0, 100) * 100) / 100;
    }
  }

  // Overall score: weighted average of area scores using area weights
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const [code, area] of Object.entries(areaScores)) {
    const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
    totalWeightedScore += area.score * w;
    totalWeight += w;
  }
  const overallScore = totalWeight > 0
    ? Math.round(clamp(totalWeightedScore / totalWeight, 0, 100) * 100) / 100
    : 0;

  // Deal breakers
  const dealBreakers = scoredFindings.filter((sf) => sf.is_deal_breaker);

  // Top 10 risks by weighted_score descending
  const topRisks = [...scoredFindings]
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .slice(0, 10);

  // Total economic exposure
  const totalEconomicExposure = activeFindingsAll.reduce((sum, f) => {
    return sum + (f.economic_impact_amount ?? 0);
  }, 0);

  // Sensitivity analysis: best, base, worst
  const bestCaseScore = computeSensitivityScore(activeFindingsAll, weights, 'remote');
  const worstCaseScore = computeSensitivityScore(activeFindingsAll, weights, 'certain');

  const recommendation = deriveRecommendation(overallScore);

  return {
    overall_score: overallScore,
    recommendation,
    area_scores: areaScores,
    deal_breakers: dealBreakers,
    top_risks: topRisks,
    sensitivity: {
      best_case: bestCaseScore,
      base_case: overallScore,
      worst_case: worstCaseScore,
    },
    total_economic_exposure: Math.round(totalEconomicExposure * 100) / 100,
    scored_findings: scoredFindings,
  };
}

// ---------------------------------------------------------------------------
// Sensitivity helper
// ---------------------------------------------------------------------------

/**
 * Compute a scenario score by overriding all findings' probability to a given value.
 */
function computeSensitivityScore(
  findings: ScoringInput[],
  weights: Record<string, number>,
  probabilityOverride: string,
): number {
  // Group scores by area
  const areaSums: Record<string, { total: number; count: number }> = {};

  for (const f of findings) {
    const areaCode = f.area_code?.toUpperCase() || 'GENERAL';
    const rawScore = scoreFindingWithProbability(f, probabilityOverride);
    const areaWeight = weights[areaCode] ?? weights['GENERAL'] ?? 0.5;
    const weightedScore = rawScore * areaWeight;

    if (!areaSums[areaCode]) {
      areaSums[areaCode] = { total: 0, count: 0 };
    }
    areaSums[areaCode].total += weightedScore;
    areaSums[areaCode].count += 1;
  }

  // Average per area, then weighted average across areas
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const [code, data] of Object.entries(areaSums)) {
    const areaAvg = data.count > 0 ? clamp(data.total / data.count, 0, 100) : 0;
    const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
    totalWeightedScore += areaAvg * w;
    totalWeight += w;
  }

  const score = totalWeight > 0 ? clamp(totalWeightedScore / totalWeight, 0, 100) : 0;
  return Math.round(score * 100) / 100;
}
