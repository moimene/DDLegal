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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

  const scoredFindings: ScoredFinding[] = [];
  const dealBreakers: ScoredFinding[] = [];
  const areaScores: Record<string, AreaScore> = {};

  const bestCaseAreaSums: Record<string, { total: number; count: number }> = {};
  const worstCaseAreaSums: Record<string, { total: number; count: number }> = {};

  let totalEconomicExposure = 0;

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const hitl = f.hitl_decision?.toLowerCase();
    if (hitl === 'reject' || hitl === 'rejected') {
      continue;
    }

    const areaCode = f.area_code?.toUpperCase() || 'GENERAL';
    const areaWeight = weights[areaCode] ?? weights['GENERAL'] ?? 0.5;

    const sevStr = f.severity?.toLowerCase();
    const probStr = f.probability?.toLowerCase();
    const timingStr = f.timing?.toLowerCase();

    const sevWeight = sevStr ? SEVERITY_WEIGHTS[sevStr] ?? 0 : 0;
    const probWeight = probStr ? PROBABILITY_WEIGHTS[probStr] ?? 0.4 : 0.4;
    const timingMult = timingStr ? TIMING_MULTIPLIER[timingStr] ?? 1.0 : 1.0;

    const baseMult = sevWeight * timingMult * 100;

    // Normal score
    const rawScore = baseMult * probWeight;
    const weightedScore = rawScore * areaWeight;
    const sfWeightedScoreRounded = Math.round(weightedScore * 100) / 100;

    const isDB = sevStr === 'critical' && (probStr === 'certain' || probStr === 'alta') && timingStr === 'blocking';

    const sf: ScoredFinding = {
      id: f.id,
      title: f.title,
      raw_score: Math.round(rawScore * 100) / 100,
      weighted_score: sfWeightedScoreRounded,
      is_deal_breaker: isDB,
      area_code: areaCode,
    };

    scoredFindings.push(sf);
    if (isDB) dealBreakers.push(sf);

    if (!areaScores[areaCode]) {
      areaScores[areaCode] = { score: 0, finding_count: 0, critical_count: 0 };
    }
    const area = areaScores[areaCode];
    area.score += sfWeightedScoreRounded;
    area.finding_count += 1;
    if (sevStr === 'critical') {
      area.critical_count += 1;
    }

    totalEconomicExposure += (f.economic_impact_amount ?? 0);

    // Best case (remote)
    const bestRaw = baseMult * (PROBABILITY_WEIGHTS['remote'] ?? 0.15);
    if (!bestCaseAreaSums[areaCode]) bestCaseAreaSums[areaCode] = { total: 0, count: 0 };
    bestCaseAreaSums[areaCode].total += bestRaw * areaWeight;
    bestCaseAreaSums[areaCode].count += 1;

    // Worst case (certain)
    const worstRaw = baseMult * (PROBABILITY_WEIGHTS['certain'] ?? 1.0);
    if (!worstCaseAreaSums[areaCode]) worstCaseAreaSums[areaCode] = { total: 0, count: 0 };
    worstCaseAreaSums[areaCode].total += worstRaw * areaWeight;
    worstCaseAreaSums[areaCode].count += 1;
  }

  // Normalize area scores and calculate overall score
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const code of Object.keys(areaScores)) {
    const area = areaScores[code];
    if (area.finding_count > 0) {
      area.score = Math.round(clamp(area.score / area.finding_count, 0, 100) * 100) / 100;
    }

    const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
    totalWeightedScore += area.score * w;
    totalWeight += w;
  }
  const overallScore = totalWeight > 0
    ? Math.round(clamp(totalWeightedScore / totalWeight, 0, 100) * 100) / 100
    : 0;

  // Sensitivity analysis finalization
  let bestWeightedScore = 0;
  let bestTotalWeight = 0;
  for (const [code, data] of Object.entries(bestCaseAreaSums)) {
    const areaAvg = data.count > 0 ? clamp(data.total / data.count, 0, 100) : 0;
    const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
    bestWeightedScore += areaAvg * w;
    bestTotalWeight += w;
  }
  const bestCaseScore = bestTotalWeight > 0 ? Math.round(clamp(bestWeightedScore / bestTotalWeight, 0, 100) * 100) / 100 : 0;

  let worstWeightedScore = 0;
  let worstTotalWeight = 0;
  for (const [code, data] of Object.entries(worstCaseAreaSums)) {
    const areaAvg = data.count > 0 ? clamp(data.total / data.count, 0, 100) : 0;
    const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
    worstWeightedScore += areaAvg * w;
    worstTotalWeight += w;
  }
  const worstCaseScore = worstTotalWeight > 0 ? Math.round(clamp(worstWeightedScore / worstTotalWeight, 0, 100) * 100) / 100 : 0;

  // Top 10 risks by weighted_score descending
  const topRisks = [...scoredFindings]
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .slice(0, 10);

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
