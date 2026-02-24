// src/lib/findings/objective-resolver.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { FindingObjective } from './objective-types';

export interface DealContext {
  deal_type: string;
  jurisdiction: string;
  project_id: string;
  target_company?: string;
  materiality_threshold?: number;
  [key: string]: unknown;
}

export interface ResolvedObjective {
  objective: FindingObjective;
  applicable: boolean;
  reason?: string;
}

/**
 * Resolve applicable Finding Objectives for a given context
 */
export async function resolveApplicableObjectives(
  dealContext: DealContext,
  options?: {
    area_code?: string;
    skill_key?: string;
  }
): Promise<ResolvedObjective[]> {
  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('is_active', true);

  if (options?.area_code) {
    query = query.eq('area_code', options.area_code);
  }

  if (options?.skill_key) {
    query = query.eq('skill_key', options.skill_key);
  }

  const { data: objectives, error } = await query;

  if (error || !objectives) {
    console.error('[ObjectiveResolver] Failed to load objectives:', error?.message);
    return [];
  }

  return objectives.map((fo) => {
    const result = evaluateApplicability(fo as FindingObjective, dealContext);
    return {
      objective: fo as FindingObjective,
      applicable: result.applicable,
      reason: result.reason,
    };
  });
}

/**
 * Evaluate if a Finding Objective applies to the given deal context
 */
function evaluateApplicability(
  fo: FindingObjective,
  context: DealContext
): { applicable: boolean; reason?: string } {
  // Check deal_type
  if (fo.deal_types.length > 0 && !fo.deal_types.includes(context.deal_type)) {
    return { applicable: false, reason: `deal_type ${context.deal_type} not in ${fo.deal_types.join(',')}` };
  }

  // Check jurisdiction
  if (fo.jurisdictions.length > 0 && !fo.jurisdictions.includes(context.jurisdiction)) {
    return { applicable: false, reason: `jurisdiction ${context.jurisdiction} not in ${fo.jurisdictions.join(',')}` };
  }

  // Check materiality threshold
  if (fo.materiality_threshold_amount && context.materiality_threshold) {
    if (context.materiality_threshold < fo.materiality_threshold_amount) {
      return { applicable: false, reason: `below materiality threshold ${fo.materiality_threshold_amount}` };
    }
  }

  // Check applies_when rules (JSON rules evaluation)
  if (Array.isArray(fo.applies_when) && fo.applies_when.length > 0) {
    const rulesPass = evaluateJsonRules(fo.applies_when, context);
    if (!rulesPass) {
      return { applicable: false, reason: 'applies_when rules not satisfied' };
    }
  }

  return { applicable: true };
}

/**
 * Evaluate JSON rules against context
 */
function evaluateJsonRules(rules: unknown[], context: DealContext): boolean {
  // Simple rule evaluation - can be extended for complex rules
  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) continue;

    const r = rule as Record<string, unknown>;

    // Handle "all" condition
    if ('all' in r && Array.isArray(r.all)) {
      const allPass = r.all.every((cond) => evaluateSingleCondition(cond, context));
      if (!allPass) return false;
    }

    // Handle "any" condition
    if ('any' in r && Array.isArray(r.any)) {
      const anyPass = r.any.some((cond) => evaluateSingleCondition(cond, context));
      if (!anyPass) return false;
    }
  }

  return true;
}

function evaluateSingleCondition(condition: unknown, context: DealContext): boolean {
  if (typeof condition !== 'object' || condition === null) return true;

  const c = condition as Record<string, unknown>;
  const field = c.field as string;
  const op = c.op as string;
  const value = c.value;

  if (!field || !op) return true;

  // Get value from context using dot notation
  const contextValue = getNestedValue(context, field);

  switch (op) {
    case 'eq': return contextValue === value;
    case 'neq': return contextValue !== value;
    case 'in': return Array.isArray(value) && value.includes(contextValue);
    case 'contains': return Array.isArray(contextValue) && contextValue.includes(value);
    case 'gt': return typeof contextValue === 'number' && contextValue > (value as number);
    case 'gte': return typeof contextValue === 'number' && contextValue >= (value as number);
    case 'lt': return typeof contextValue === 'number' && contextValue < (value as number);
    case 'lte': return typeof contextValue === 'number' && contextValue <= (value as number);
    default: return true;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

export async function getObjectivesForSkill(skillKey: string): Promise<FindingObjective[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('skill_key', skillKey)
    .eq('is_active', true);

  if (error) {
    console.error('[ObjectiveResolver] Failed to load objectives for skill:', error.message);
    return [];
  }

  return data as FindingObjective[];
}

export async function getObjectiveByKey(objectiveKey: string): Promise<FindingObjective | null> {
  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('objective_key', objectiveKey)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[ObjectiveResolver] Failed to load objective:', error.message);
    return null;
  }

  return data as FindingObjective;
}
