// src/lib/findings/rule-evaluator.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';
import type { FindingObjective, EvaluationCriterion } from './objective-types';

export interface EvaluationFacts {
  document_id: string;
  document_type: string;
  content_hash: string;
  chunks: Array<{ id: string; content: string; page?: number }>;
  extracted_data?: Record<string, unknown>;
}

export interface CriterionResult {
  criterion_id: string;
  criterion: string;
  result: boolean;
  confidence: number;
  evidence?: string;
  eval_type: string;
}

export interface RuleEvaluationResult {
  objective_id: string;
  objective_key: string;
  document_id: string;
  applicable: boolean;
  applicability_reason?: string;
  criteria_results: CriterionResult[];
  overall_score: number;
  severity_computed: string;
  severity_modifiers_applied: string[];
  finding_generated: boolean;
  finding_data?: {
    title: string;
    description: string;
    evidence_refs: string[];
  };
  execution_duration_ms: number;
  ai_calls_made: number;
}

/**
 * Evaluate a Finding Objective against document facts
 */
export async function evaluateObjective(
  fo: FindingObjective,
  facts: EvaluationFacts,
  dealContext: Record<string, unknown>
): Promise<RuleEvaluationResult> {
  const startTime = Date.now();
  let aiCalls = 0;

  const criteriaResults: CriterionResult[] = [];

  // Evaluate each criterion
  for (let i = 0; i < fo.evaluation_criteria.length; i++) {
    const criterion = fo.evaluation_criteria[i];
    const result = await evaluateCriterion(criterion, facts, fo);

    if (result.usedAi) aiCalls++;

    criteriaResults.push({
      criterion_id: `EC-${String(i + 1).padStart(3, '0')}`,
      criterion: criterion.criterion,
      result: result.passed,
      confidence: result.confidence,
      evidence: result.evidence,
      eval_type: criterion.eval_type,
    });
  }

  // Calculate overall score (weighted)
  const overallScore = criteriaResults.reduce((sum, cr, idx) => {
    const weight = fo.evaluation_criteria[idx]?.weight ?? 0;
    return sum + (cr.result ? weight * cr.confidence : 0);
  }, 0);

  // Determine if finding should be generated (score > 0.5)
  const findingGenerated = overallScore >= 0.5;

  // Compute severity with modifiers
  let severityComputed = fo.severity_if_positive;
  const modifiersApplied: string[] = [];

  if (findingGenerated) {
    for (const mod of fo.severity_modifiers) {
      // Simple condition check - in real impl, evaluate against facts
      if (shouldApplyModifier(mod, facts, dealContext)) {
        severityComputed = applySeverityAction(severityComputed, mod.action);
        modifiersApplied.push(mod.justification);
      }
    }
  }

  const executionDuration = Date.now() - startTime;

  return {
    objective_id: fo.id,
    objective_key: fo.objective_key,
    document_id: facts.document_id,
    applicable: true,
    criteria_results: criteriaResults,
    overall_score: overallScore,
    severity_computed: findingGenerated ? severityComputed : 'none',
    severity_modifiers_applied: modifiersApplied,
    finding_generated: findingGenerated,
    finding_data: findingGenerated ? {
      title: `[${fo.objective_key}] ${fo.title}`,
      description: buildFindingDescription(fo, criteriaResults),
      evidence_refs: criteriaResults
        .filter(cr => cr.evidence)
        .map(cr => cr.evidence!)
        .slice(0, 5),
    } : undefined,
    execution_duration_ms: executionDuration,
    ai_calls_made: aiCalls,
  };
}

async function evaluateCriterion(
  criterion: EvaluationCriterion,
  facts: EvaluationFacts,
  _fo: FindingObjective
): Promise<{ passed: boolean; confidence: number; evidence?: string; usedAi: boolean }> {
  // For now, return placeholder - will integrate with Harvey in full implementation
  // This is where semantic_analysis criteria would call Harvey

  switch (criterion.eval_type) {
    case 'document_review':
    case 'document_verification':
      // Check if document exists and has content
      return {
        passed: facts.chunks.length > 0,
        confidence: 0.8,
        evidence: facts.chunks[0]?.content?.slice(0, 200),
        usedAi: false,
      };

    case 'semantic_analysis':
      // TODO: Integrate with Harvey for semantic analysis
      return {
        passed: false,
        confidence: 0.0,
        evidence: undefined,
        usedAi: true, // Would be true when Harvey integration added
      };

    case 'registry_check':
    case 'timeline_verification':
    case 'litigation_review':
    case 'compliance_check':
    case 'jurisdiction_mapping':
    case 'procedure_analysis':
    case 'threshold_calculation':
      // These require specific implementation per type
      return {
        passed: false,
        confidence: 0.0,
        usedAi: false,
      };

    default:
      return { passed: false, confidence: 0.0, usedAi: false };
  }
}

function shouldApplyModifier(
  modifier: { condition: string },
  facts: EvaluationFacts,
  _context: Record<string, unknown>
): boolean {
  // Simple keyword matching for now
  const condition = modifier.condition.toLowerCase();
  const factString = JSON.stringify(facts).toLowerCase();

  // Check if condition keywords appear in facts
  const keywords = condition.split(/\s+/).filter(w => w.length > 4);
  return keywords.some(kw => factString.includes(kw));
}

function applySeverityAction(current: string, action: string): string {
  const severityOrder = ['informational', 'low', 'medium', 'high', 'critical'];
  const currentIdx = severityOrder.indexOf(current);

  if (action.includes('upgrade_to_critical')) return 'critical';
  if (action.includes('upgrade_to_high')) return currentIdx < 3 ? 'high' : current;
  if (action.includes('downgrade_to_medium')) return currentIdx > 2 ? 'medium' : current;
  if (action.includes('downgrade_to_low')) return currentIdx > 1 ? 'low' : current;
  if (action.includes('downgrade_to_informational')) return 'informational';

  return current;
}

function buildFindingDescription(fo: FindingObjective, results: CriterionResult[]): string {
  const passedCriteria = results.filter(r => r.result);
  const criteriaText = passedCriteria
    .map(r => `- ${r.criterion} (${Math.round(r.confidence * 100)}% confidence)`)
    .join('\n');

  return `${fo.description}\n\nCriterios evaluados:\n${criteriaText}`;
}

/**
 * Record rule execution in audit trail
 */
export async function recordRuleExecution(
  projectId: string,
  result: RuleEvaluationResult,
  dealContext: Record<string, unknown>,
  findingId?: string
): Promise<string | null> {
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ objective_id: result.objective_id, document_id: result.document_id }))
    .digest('hex')
    .slice(0, 64);

  const { data, error } = await supabaseAdmin
    .from('dd_rule_executions')
    .insert({
      project_id: projectId,
      objective_id: result.objective_id,
      document_id: result.document_id,
      objective_version: '1.0', // TODO: Get from FO
      deal_context: dealContext,
      input_data_hash: inputHash,
      applicability_result: result.applicable,
      applicability_reason: result.applicability_reason,
      evaluation_results: result.criteria_results,
      severity_computed: result.finding_generated ? result.severity_computed : null,
      severity_modifiers_applied: result.severity_modifiers_applied,
      finding_generated: result.finding_generated,
      finding_id: findingId,
      execution_duration_ms: result.execution_duration_ms,
      ai_calls_made: result.ai_calls_made,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[RuleEvaluator] Failed to record execution:', error.message);
    return null;
  }

  return data?.id ?? null;
}
