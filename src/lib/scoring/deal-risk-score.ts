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

  // Track sensitivity scenarios by area simultaneously
  const bestCaseSums: Record<string, { total: number; count: number }> = {};
  const worstCaseSums: Record<string, { total: number; count: number }> = {};

  let totalEconomicExposure = 0;

  // Pre-lookup probability weights for sensitivity
  const bestCaseProbWeight = lookupWeight(PROBABILITY_WEIGHTS, 'remote', 0.4);
  const worstCaseProbWeight = lookupWeight(PROBABILITY_WEIGHTS, 'certain', 0.4);

  // ⚡ Bolt: Consolidated mapping, filtering, grouping, and aggregations into a single O(N) pass
  // instead of multiple O(N) passes and an O(N^2) array.find lookup.
  for (const f of findings) {
    const hitl = f.hitl_decision?.toLowerCase();
    if (hitl === 'reject' || hitl === 'rejected') continue;

    const areaCode = f.area_code?.toUpperCase() || 'GENERAL';
    const areaWeight = weights[areaCode] ?? weights['GENERAL'] ?? 0.5;

    // Cache static lookups to avoid redundant calls
    const sevWeight = lookupWeight(SEVERITY_WEIGHTS, f.severity, 0);
    const timingMult = lookupWeight(TIMING_MULTIPLIER, f.timing, 1.0);
    const baseMult = sevWeight * timingMult * 100;

    // Standard score
    const probWeight = lookupWeight(PROBABILITY_WEIGHTS, f.probability, 0.4);
    const rawScore = baseMult * probWeight;
    const weightedScore = rawScore * areaWeight;

    const isBreaker = isDealBreaker(f);

    const sf: ScoredFinding = {
      id: f.id,
      title: f.title,
      raw_score: Math.round(rawScore * 100) / 100,
      weighted_score: Math.round(weightedScore * 100) / 100,
      is_deal_breaker: isBreaker,
      area_code: areaCode,
    };

    scoredFindings.push(sf);
    if (isBreaker) dealBreakers.push(sf);

    // Group by area for base score
    if (!areaScores[areaCode]) {
      areaScores[areaCode] = { score: 0, finding_count: 0, critical_count: 0 };
    }
    areaScores[areaCode].score += sf.weighted_score;
    areaScores[areaCode].finding_count += 1;
    if (f.severity?.toLowerCase() === 'critical') {
      areaScores[areaCode].critical_count += 1;
    }

    // Economic Exposure
    totalEconomicExposure += (f.economic_impact_amount ?? 0);

    // Sensitivity Calculations
    const bestRaw = baseMult * bestCaseProbWeight;
    const worstRaw = baseMult * worstCaseProbWeight;

    if (!bestCaseSums[areaCode]) bestCaseSums[areaCode] = { total: 0, count: 0 };
    bestCaseSums[areaCode].total += bestRaw * areaWeight;
    bestCaseSums[areaCode].count += 1;

    if (!worstCaseSums[areaCode]) worstCaseSums[areaCode] = { total: 0, count: 0 };
    worstCaseSums[areaCode].total += worstRaw * areaWeight;
    worstCaseSums[areaCode].count += 1;
  }

  // Normalize area scores: average per area (score / finding_count), then clamp 0-100
  for (const code of Object.keys(areaScores)) {
    const area = areaScores[code];
    if (area.finding_count > 0) {
      area.score = Math.round(clamp(area.score / area.finding_count, 0, 100) * 100) / 100;
    }
  }

  // Base overall score computation exactly matching original logic
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

  // Sensitivity computation exactly matching original computeSensitivityScore logic
  const getSensitivity = (sums: Record<string, { total: number; count: number }>) => {
    let tScore = 0;
    let tWeight = 0;
    for (const [code, data] of Object.entries(sums)) {
      const areaAvg = data.count > 0 ? clamp(data.total / data.count, 0, 100) : 0;
      const w = weights[code] ?? weights['GENERAL'] ?? 0.5;
      tScore += areaAvg * w;
      tWeight += w;
    }
    return tWeight > 0 ? Math.round(clamp(tScore / tWeight, 0, 100) * 100) / 100 : 0;
  }

  const bestCaseScore = getSensitivity(bestCaseSums);
  const worstCaseScore = getSensitivity(worstCaseSums);

  // Top 10 risks by weighted_score descending
  const topRisks = [...scoredFindings]
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .slice(0, 10);

  return {
    overall_score: overallScore,
    recommendation: deriveRecommendation(overallScore),
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
