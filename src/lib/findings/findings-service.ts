/**
 * Findings Service — Dual-Write Layer
 *
 * Central service for persisting findings into the canonical dd_findings table.
 * Called from workflow engine, instance runner, and API routes.
 *
 * Part of Phase B (Dual-Write) of the Finding-Centric Architecture refactor.
 * While the FINDINGS_FIRST feature flag is off, findings are written here
 * AND continue to flow through legacy JSONB paths. When the flag is on,
 * reads will shift to dd_findings as the source of truth.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WorkflowFinding } from '@/lib/workflows/types';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

const FINDINGS_FIRST_FLAG = 'FINDINGS_FIRST';

export function isFindingsFirstEnabled(): boolean {
  const val = (process.env[FINDINGS_FIRST_FLAG] || '').toLowerCase();
  return ['1', 'true', 'enabled', 'on'].includes(val);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingSourceType =
  // New values (preferred)
  | 'workflow_execution'
  | 'manual_entry'
  | 'ai_analysis'
  | 'document_review'
  | 'registry_scrape'
  | 'backfill'
  // Legacy DB values (kept for compatibility)
  | 'workflow_ai'
  | 'manual'
  | 'import'
  | 'tool_societario'
  | 'tool_ip';

export type FindingStatus =
  | 'identified'
  | 'under_review'
  | 'validated'
  | 'contested'
  | 'accepted'
  | 'mitigated'
  | 'reported'
  | 'negotiated'
  | 'resolved'
  | 'dismissed';

export interface PersistFindingInput {
  project_id: string;
  workflow_instance_id?: string;
  workflow_phase?: string;
  workflow_key?: string;
  finding: WorkflowFinding;
  source_type?: FindingSourceType;
  /** Override area_code if already known */
  area_code?: string;
  /** ID of the user who triggered the creation (if available) */
  created_by?: string;
}

export interface PersistFindingsResult {
  persisted: number;
  skipped: number;
  finding_ids: string[];
  errors: string[];
}

export interface FindingRow {
  id: string;
  project_id: string;
  external_ref: string;
  title: string;
  description: string | null;
  severity: string;
  probability: string;
  timing: string;
  status: FindingStatus;
  relevance_tier: number;
  tier_auto_calculated: number;
  raw_score: number;
  weighted_score: number | null;
  area_code: string;
  is_deal_breaker: boolean;
  is_red_flag: boolean;
  contingency_id: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Area code inference (mirrors engine.ts logic)
// ---------------------------------------------------------------------------

const AREA_HINT_MAP: Record<string, string> = {
  societario: 'MERC',
  mercantil: 'MERC',
  corporate: 'MERC',
  contratos: 'CONT',
  contracts: 'CONT',
  laboral: 'LAB',
  labor: 'LAB',
  employment: 'LAB',
  fiscal: 'FISC',
  tax: 'FISC',
  'propiedad intelectual': 'PI',
  ip: 'PI',
  intellectual: 'PI',
  general: 'GENERAL',
};

function inferAreaCode(title: string): string {
  const text = title.toLowerCase();
  for (const [hint, code] of Object.entries(AREA_HINT_MAP)) {
    if (text.includes(hint)) return code;
  }
  return 'GENERAL';
}

// ---------------------------------------------------------------------------
// External ref builder (idempotency key)
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Build a deterministic external_ref for deduplication.
 * Format: `{instance_id}:{phase}:{slugified_title}`
 * For non-workflow sources: `{source_type}:{project_id}:{slugified_title}`
 */
function buildExternalRef(input: PersistFindingInput): string {
  const titleSlug = slugify(input.finding.title || 'untitled');

  if (input.workflow_instance_id && input.workflow_phase) {
    return `${input.workflow_instance_id}:${input.workflow_phase}:${titleSlug}`;
  }

  return `${input.source_type || 'unknown'}:${input.project_id}:${titleSlug}`;
}

// ---------------------------------------------------------------------------
// Tier & score calculation (mirrors SQL RPC functions)
// ---------------------------------------------------------------------------

function calculateTier(finding: WorkflowFinding): number {
  const { severity, probability, timing, economic_impact } = finding;

  // Tier 1: Decisorio
  if (severity === 'critical' && timing === 'blocking') return 1;
  if (severity === 'critical') return 1;
  if (severity === 'high' && (probability === 'alta')) return 1;

  // Tier 2: Gestión
  if ((severity === 'high' || severity === 'medium') && economic_impact?.amount && economic_impact.amount > 0) return 2;
  if (timing === 'blocking') return 2;
  if (severity === 'high') return 2;

  // Tier 3: Registro
  return 3;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.4,
  low: 0.15,
  informational: 0.0,
};

const PROBABILITY_WEIGHTS: Record<string, number> = {
  certain: 1.0,
  alta: 0.9,
  probable: 0.75,
  media: 0.5,
  possible: 0.4,
  baja: 0.2,
  remote: 0.15,
};

function calculateScore(finding: WorkflowFinding): number {
  const sevWeight = SEVERITY_WEIGHTS[finding.severity] ?? 0;
  const probWeight = PROBABILITY_WEIGHTS[finding.probability] ?? 0.3;
  const timingMult = finding.timing === 'blocking' ? 1.5 : 1.0;
  return Math.round(sevWeight * probWeight * timingMult * 100 * 100) / 100;
}

function isDealBreaker(finding: WorkflowFinding): boolean {
  return (
    finding.severity === 'critical' &&
    finding.probability === 'alta' &&
    finding.timing === 'blocking'
  );
}

// ---------------------------------------------------------------------------
// Core: Persist a batch of findings (dual-write)
// ---------------------------------------------------------------------------

/**
 * Persist one or more WorkflowFinding objects into dd_findings.
 * Uses external_ref for idempotent upsert — if a finding with the same
 * external_ref already exists, it's skipped (not overwritten).
 *
 * Also creates dd_finding_evidence rows for any evidence_refs that
 * reference VDR chunks.
 */
export async function persistFindings(
  inputs: PersistFindingInput[],
): Promise<PersistFindingsResult> {
  const result: PersistFindingsResult = {
    persisted: 0,
    skipped: 0,
    finding_ids: [],
    errors: [],
  };

  if (inputs.length === 0) return result;

  // Build external refs and check for existing ones
  const externalRefs = inputs.map(buildExternalRef);

  const { data: existingRows } = await supabaseAdmin
    .from('dd_findings')
    .select('external_ref, id')
    .in('external_ref', externalRefs);

  const existingRefMap = new Map(
    (existingRows || []).map((row: { external_ref: string; id: string }) => [row.external_ref, row.id])
  );

  // Prepare rows to insert (skip existing)
  const rowsToInsert: Record<string, unknown>[] = [];
  const inputsToInsert: PersistFindingInput[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const extRef = externalRefs[i];

    if (existingRefMap.has(extRef)) {
      result.skipped += 1;
      result.finding_ids.push(existingRefMap.get(extRef)!);
      continue;
    }

    const f = input.finding;
    const areaCode = input.area_code || inferAreaCode(f.title);
    const tier = calculateTier(f);
    const score = calculateScore(f);

    rowsToInsert.push({
      project_id: input.project_id,
      external_ref: extRef,
      title: f.title,
      description: f.mitigation || null,
      severity: f.severity,
      probability: f.probability,
      timing: f.timing,
      verifiability: f.verifiability,
      area_code: areaCode,
      source_type: input.source_type || 'workflow_execution',
      source_workflow_instance_id: input.workflow_instance_id || null,
      source_phase: input.workflow_phase || null,
      status: 'identified' as FindingStatus,
      relevance_tier: tier,
      tier_auto_calculated: tier,
      raw_score: score,
      is_deal_breaker: isDealBreaker(f),
      is_red_flag: f.severity === 'critical' || f.severity === 'high',
      economic_impact_amount: f.economic_impact?.amount ?? null,
      economic_impact_currency: f.economic_impact?.currency || 'EUR',
      economic_impact_type: f.economic_impact?.type || null,
      mitigation_recommended: f.mitigation || null,
      hitl_required: f.severity === 'critical' || f.severity === 'high',
      created_by: input.created_by || null,
    });
    inputsToInsert.push(input);
  }

  if (rowsToInsert.length === 0) return result;

  // Insert findings
  const { data: insertedRows, error: insertErr } = await supabaseAdmin
    .from('dd_findings')
    .insert(rowsToInsert)
    .select('id, external_ref');

  if (insertErr) {
    result.errors.push(`Failed to insert findings: ${insertErr.message}`);
    console.error('[FindingsService] Insert error:', insertErr.message);
    return result;
  }

  const insertedMap = new Map(
    (insertedRows || []).map((row: { id: string; external_ref: string }) => [row.external_ref, row.id])
  );

  result.persisted = insertedRows?.length ?? 0;

  // Collect IDs
  for (const extRef of externalRefs) {
    const id = insertedMap.get(extRef);
    if (id && !result.finding_ids.includes(id)) {
      result.finding_ids.push(id);
    }
  }

  // Create evidence links for findings with evidence_refs
  await linkEvidenceToFindings(insertedMap, inputsToInsert, externalRefs.filter(ref => !existingRefMap.has(ref)));

  return result;
}

// ---------------------------------------------------------------------------
// Evidence linking
// ---------------------------------------------------------------------------

async function linkEvidenceToFindings(
  findingIdMap: Map<string, string>,
  inputs: PersistFindingInput[],
  insertedRefs: string[],
): Promise<void> {
  const evidenceRows: Record<string, unknown>[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const refs = input.finding.evidence_refs || [];
    if (refs.length === 0) continue;

    const extRef = insertedRefs[i];
    if (!extRef) continue;
    const findingId = findingIdMap.get(extRef);
    if (!findingId) continue;

    for (const sourceId of refs) {
      evidenceRows.push({
        finding_id: findingId,
        chunk_id: sourceId,
        link_method: 'workflow_output',
        relevance_label: 'primary',
      });
    }
  }

  if (evidenceRows.length === 0) return;

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < evidenceRows.length; i += batchSize) {
    const batch = evidenceRows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin
      .from('dd_finding_evidence')
      .insert(batch);

    if (error) {
      // Non-fatal: evidence links may fail if chunk_id doesn't exist in VDR
      console.warn('[FindingsService] Evidence link batch error (non-fatal):', error.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

/**
 * Transition a finding's status, enforcing the state machine.
 * Returns the updated finding row or null if transition is invalid.
 */
export async function transitionFindingStatus(
  findingId: string,
  newStatus: FindingStatus,
  transitionedBy?: string,
): Promise<FindingRow | null> {
  // Load current status
  const { data: finding, error: loadErr } = await supabaseAdmin
    .from('dd_findings')
    .select('id, status')
    .eq('id', findingId)
    .single();

  if (loadErr || !finding) {
    console.error('[FindingsService] Finding not found:', findingId);
    return null;
  }

  // Validate transition via RPC
  const { data: isValid } = await supabaseAdmin
    .rpc('validate_finding_transition', {
      p_current_status: finding.status,
      p_new_status: newStatus,
    });

  if (!isValid) {
    console.warn(
      `[FindingsService] Invalid transition: ${finding.status} → ${newStatus} for finding ${findingId}`
    );
    return null;
  }

  // Apply transition
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
  };

  // Store resolution metadata in the JSONB metadata column
  if (newStatus === 'resolved' || newStatus === 'dismissed') {
    updatePayload.metadata = {
      resolved_at: new Date().toISOString(),
      resolved_by: transitionedBy || null,
    };
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('dd_findings')
    .update(updatePayload)
    .eq('id', findingId)
    .select()
    .single();

  if (updateErr) {
    console.error('[FindingsService] Status transition failed:', updateErr.message);
    return null;
  }

  return updated as unknown as FindingRow;
}

// ---------------------------------------------------------------------------
// Tier override
// ---------------------------------------------------------------------------

/**
 * Override the relevance tier of a finding (manual escalation/demotion).
 * Records who changed it and the justification.
 */
export async function overrideFindingTier(
  findingId: string,
  newTier: 1 | 2 | 3,
  overriddenBy: string | null,
  justification?: string,
): Promise<FindingRow | null> {
  const updatePayload: Record<string, unknown> = {
    relevance_tier: newTier,
    tier_override_reason: justification || null,
  };
  // Only set tier_override_by if a valid UUID is provided (FK to auth.users)
  if (overriddenBy) {
    updatePayload.tier_override_by = overriddenBy;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('dd_findings')
    .update(updatePayload)
    .eq('id', findingId)
    .select()
    .single();

  if (error) {
    console.error('[FindingsService] Tier override failed:', error.message);
    return null;
  }

  return updated as unknown as FindingRow;
}

// ---------------------------------------------------------------------------
// Link finding to contingency (bidirectional FK)
// ---------------------------------------------------------------------------

/**
 * Link a finding to a contingency (or create the link).
 * Updates both dd_findings.contingency_id and dd_contingencies.finding_id.
 */
export async function linkFindingToContingency(
  findingId: string,
  contingencyId: string,
): Promise<boolean> {
  const [findingUpdate, contingencyUpdate] = await Promise.all([
    supabaseAdmin
      .from('dd_findings')
      .update({ contingency_id: contingencyId })
      .eq('id', findingId),
    supabaseAdmin
      .from('dd_contingencies')
      .update({ finding_id: findingId })
      .eq('id', contingencyId),
  ]);

  if (findingUpdate.error || contingencyUpdate.error) {
    console.error(
      '[FindingsService] Link finding↔contingency failed:',
      findingUpdate.error?.message,
      contingencyUpdate.error?.message
    );
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Get all findings for a project, optionally filtered.
 */
export async function getProjectFindings(
  projectId: string,
  options?: {
    status?: FindingStatus[];
    tier?: number[];
    area_code?: string;
    limit?: number;
    offset?: number;
  },
): Promise<FindingRow[]> {
  let query = supabaseAdmin
    .from('dd_findings')
    .select('*')
    .eq('project_id', projectId)
    .order('raw_score', { ascending: false });

  if (options?.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  if (options?.tier && options.tier.length > 0) {
    query = query.in('relevance_tier', options.tier);
  }
  if (options?.area_code) {
    query = query.eq('area_code', options.area_code);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[FindingsService] Query failed:', error.message);
    return [];
  }

  return (data || []) as unknown as FindingRow[];
}

/**
 * Get finding detail with all related entities via RPC.
 */
export async function getFindingDetail(findingId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.rpc('get_finding_with_evidence', {
    p_finding_id: findingId,
  });

  if (error) {
    console.error('[FindingsService] Detail RPC failed:', error.message);
    return null;
  }

  return data as Record<string, unknown>;
}

/**
 * Get project findings summary via RPC.
 */
export async function getProjectFindingsSummary(projectId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.rpc('get_project_findings_summary', {
    p_project_id: projectId,
  });

  if (error) {
    console.error('[FindingsService] Summary RPC failed:', error.message);
    return null;
  }

  return data as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Fase C: FINDINGS_FIRST read helpers
// These functions provide findings data in the shapes expected by consumers
// (scoring engine, red flag report, war room, etc.)
// ---------------------------------------------------------------------------

/**
 * Get findings formatted as ScoringInput[] for the deal-risk-score engine.
 * Replaces the legacy dd_contingencies + dd_negotiation_alerts read path.
 */
export async function getFindingsForScoring(
  projectId: string,
): Promise<{
  id: string;
  title: string;
  severity: string;
  probability: string;
  timing?: string;
  economic_impact_amount?: number;
  area_code: string;
  hitl_decision?: string;
  is_deal_breaker: boolean;
  raw_score: number;
}[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_findings')
    .select('id, title, severity, probability, timing, economic_impact_amount, area_code, hitl_decision, is_deal_breaker, raw_score, status')
    .eq('project_id', projectId)
    .not('status', 'eq', 'dismissed');

  if (error) {
    console.error('[FindingsService] getFindingsForScoring error:', error.message);
    return [];
  }

  return (data || []).map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    probability: f.probability,
    timing: f.timing ?? undefined,
    economic_impact_amount: f.economic_impact_amount ? Number(f.economic_impact_amount) : undefined,
    area_code: f.area_code ?? 'GENERAL',
    hitl_decision: f.hitl_decision ?? undefined,
    is_deal_breaker: f.is_deal_breaker ?? false,
    raw_score: Number(f.raw_score ?? 0),
  }));
}

/**
 * Get red-flag findings for the Red Flag Report generator.
 * Replaces the legacy dd_contingencies(critical/high) + dd_negotiation_alerts read path.
 */
export async function getRedFlagFindings(
  projectId: string,
): Promise<{
  id: string;
  title: string;
  area_code: string;
  severity: string;
  probability: string;
  economic_impact?: number;
  source: 'finding';
  source_id: string;
  mitigation?: string;
  hitl_status?: string;
  status: string;
  is_deal_breaker: boolean;
  contingency_id: string | null;
}[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_findings')
    .select('id, title, area_code, severity, probability, economic_impact_amount, mitigation_recommended, hitl_decision, status, is_deal_breaker, is_red_flag, contingency_id')
    .eq('project_id', projectId)
    .or('is_red_flag.eq.true,severity.in.(critical,high)')
    .not('status', 'eq', 'dismissed');

  if (error) {
    console.error('[FindingsService] getRedFlagFindings error:', error.message);
    return [];
  }

  return (data || []).map((f) => ({
    id: f.id,
    title: f.title,
    area_code: f.area_code ?? 'GENERAL',
    severity: f.severity,
    probability: f.probability,
    economic_impact: f.economic_impact_amount ? Number(f.economic_impact_amount) : undefined,
    source: 'finding' as const,
    source_id: f.id,
    mitigation: f.mitigation_recommended ?? undefined,
    hitl_status: f.hitl_decision ?? undefined,
    status: f.status,
    is_deal_breaker: f.is_deal_breaker ?? false,
    contingency_id: f.contingency_id,
  }));
}

/**
 * Get findings for a specific workflow instance + phase.
 * Replaces the legacy metadata.phase_results_{phase}.findings JSONB path.
 */
export async function getFindingsByWorkflowInstance(
  instanceId: string,
  phase?: string,
): Promise<FindingRow[]> {
  let query = supabaseAdmin
    .from('dd_findings')
    .select('*')
    .eq('source_workflow_instance_id', instanceId)
    .order('raw_score', { ascending: false });

  if (phase) {
    query = query.eq('source_phase', phase);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[FindingsService] getFindingsByWorkflowInstance error:', error.message);
    return [];
  }

  return (data || []) as unknown as FindingRow[];
}

/**
 * Get project-level red flags digest for the final report compiler.
 * Replaces the legacy dd_contingencies(critical/high) count.
 */
export async function getRedFlagsDigest(
  projectId: string,
): Promise<{ total: number; deal_breakers: number; critical: number }> {
  const { data, error } = await supabaseAdmin
    .from('dd_findings')
    .select('severity, is_deal_breaker')
    .eq('project_id', projectId)
    .or('is_red_flag.eq.true,severity.in.(critical,high)')
    .not('status', 'eq', 'dismissed');

  if (error) {
    console.error('[FindingsService] getRedFlagsDigest error:', error.message);
    return { total: 0, deal_breakers: 0, critical: 0 };
  }

  const rows = data || [];
  return {
    total: rows.length,
    deal_breakers: rows.filter((r) => r.is_deal_breaker).length,
    critical: rows.filter((r) => r.severity === 'critical').length,
  };
}
