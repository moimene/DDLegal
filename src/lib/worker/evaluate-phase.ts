/**
 * Evaluate Phase — Worker Architecture v1.0
 *
 * Responsibility: Evaluate Finding Objectives against document facts,
 * generating findings with complete traceability.
 *
 * Pipeline:
 * 1. Resolve FO applicability (deal_type, jurisdiction, materiality)
 * 2. Verify data requirements (check dd_document_facts)
 * 3. Evaluate criteria (hybrid rules + AI)
 * 4. Classify severity (base + modifiers)
 * 5. Persist findings + audit trail
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveEvaluationOrder, type EvaluationWave } from './dependency-resolver';
import { evaluateObjective, recordRuleExecution, type EvaluationFacts, type RuleEvaluationResult } from '@/lib/findings/rule-evaluator';
import { persistFindings } from '@/lib/findings/findings-service';
import type { FindingObjective } from '@/lib/findings/objective-types';
import type { WorkerRunState, WorkerConfig, WorkItem, CoverageSnapshot } from './worker-controller';

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
  workQueue?: WorkItem[];
}

interface DocumentFacts {
  id: string;
  document_id: string;
  project_id: string;
  document_type: string;
  area_codes: string[];
  jurisdiction: string;
  language: string;
  parties: Array<{
    name: string;
    role: string;
    is_target: boolean;
    is_counterparty: boolean;
  }>;
  key_dates: Array<{
    type: string;
    date: string;
    description?: string;
  }>;
  amounts: Array<{
    type: string;
    amount: number;
    currency: string;
    annualized: boolean;
  }>;
  clauses: Array<{
    clause_type: string;
    present: boolean;
    page?: number;
    excerpt?: string;
    confidence: number;
  }>;
  obligations: Array<{
    type: string;
    description: string;
    party?: string;
    deadline?: string;
  }>;
  source_content_hash: string;
}

interface EvaluationBatchResult {
  evaluated: number;
  findingsCreated: number;
  findingsUpdated: number;
  errors: number;
  aiCalls: number;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Execute the EVALUATE phase of the worker loop.
 *
 * 1. Get work queue items marked for evaluation
 * 2. Group by document, load facts
 * 3. Resolve FO dependencies into waves
 * 4. Evaluate each wave in order
 * 5. Persist findings and update status
 */
export async function runEvaluatePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  const startTime = Date.now();

  try {
    // Get pending work items
    const pendingItems = state.workQueue.filter(w => w.status === 'pending' || w.status === 'done');

    if (pendingItems.length === 0) {
      return createEmptyResult(startTime);
    }

    // Get unique documents and their facts
    const documentIds = Array.from(new Set(pendingItems.map(w => w.document_id)));
    const factsMap = await loadDocumentFacts(config.projectId, documentIds);

    // Get applicable FOs
    const objectiveIds = Array.from(new Set(pendingItems.map(w => w.objective_id)));
    const objectives = await loadObjectives(objectiveIds);

    // Get deal context
    const dealContext = await getDealContext(config.projectId);

    // Resolve dependency order
    const resolution = resolveEvaluationOrder(objectives);

    if (resolution.hasCircularDependencies) {
      console.warn('[evaluate-phase] Circular dependencies detected, proceeding with best effort');
    }

    // Process waves in order
    let totalEvaluated = 0;
    let totalFindingsCreated = 0;
    let totalFindingsUpdated = 0;
    let totalErrors = 0;
    let totalAiCalls = 0;

    const remainingBudget = config.aiBudgetPerCycle - state.aiBudgetUsed;

    for (const wave of resolution.waves) {
      // Check AI budget
      if (totalAiCalls >= remainingBudget) {
        console.log('[evaluate-phase] AI budget exhausted, stopping evaluation');
        break;
      }

      const waveResult = await evaluateWave(
        wave,
        factsMap,
        dealContext,
        config.projectId,
        state.runId,
        remainingBudget - totalAiCalls
      );

      totalEvaluated += waveResult.evaluated;
      totalFindingsCreated += waveResult.findingsCreated;
      totalFindingsUpdated += waveResult.findingsUpdated;
      totalErrors += waveResult.errors;
      totalAiCalls += waveResult.aiCalls;

      // Update work queue status for evaluated items
      await updateWorkQueueForWave(state.runId, wave, 'done');
    }

    // Compute updated coverage
    const coverage = await computeEvaluationCoverage(config.projectId);

    return {
      itemsTotal: pendingItems.length,
      itemsDone: totalEvaluated,
      itemsError: totalErrors,
      docsNormalized: 0,
      fosEvaluated: totalEvaluated,
      findingsCreated: totalFindingsCreated,
      findingsUpdated: totalFindingsUpdated,
      conclusionsGenerated: 0,
      aiCallsMade: totalAiCalls,
      durationMs: Date.now() - startTime,
      coverageSnapshot: coverage,
    };
  } catch (error) {
    console.error('[evaluate-phase] Error:', error);
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
// Wave Evaluation
// ============================================================================

/**
 * Evaluate all FOs in a wave against all applicable documents.
 */
async function evaluateWave(
  wave: EvaluationWave,
  factsMap: Map<string, DocumentFacts>,
  dealContext: Record<string, unknown>,
  projectId: string,
  runId: string,
  aiBudget: number
): Promise<EvaluationBatchResult> {
  let evaluated = 0;
  let findingsCreated = 0;
  let findingsUpdated = 0;
  let errors = 0;
  let aiCalls = 0;

  for (const fo of wave.objectives) {
    // Find documents applicable to this FO
    const applicableDocs = getApplicableDocuments(fo, factsMap);

    for (const [docId, facts] of Array.from(applicableDocs.entries())) {
      // Check AI budget
      if (aiCalls >= aiBudget) {
        return { evaluated, findingsCreated, findingsUpdated, errors, aiCalls };
      }

      try {
        // Convert facts to evaluation format
        const evalFacts = buildEvaluationFacts(docId, facts);

        // Evaluate the FO against this document
        const result = await evaluateObjective(fo, evalFacts, dealContext);

        aiCalls += result.ai_calls_made;
        evaluated++;

        // Record rule execution
        let findingId: string | undefined;

        if (result.finding_generated && result.finding_data) {
          // Persist finding using the correct interface
          const persistResult = await persistFindings([
            {
              project_id: projectId,
              source_type: 'ai_analysis',
              area_code: fo.area_code,
              finding: {
                title: result.finding_data.title,
                severity: result.severity_computed as 'critical' | 'high' | 'medium' | 'low' | 'informational',
                probability: 'media', // Default probability
                timing: 'blocking',
                mitigation: result.finding_data.description,
                verifiability: 'verified',
                evidence_refs: result.finding_data.evidence_refs,
              },
            },
          ]);

          if (persistResult.persisted > 0 && persistResult.finding_ids.length > 0) {
            findingId = persistResult.finding_ids[0];
            findingsCreated++;
          }
        }

        // Record audit trail
        await recordRuleExecution(projectId, result, dealContext, findingId);

        // Update FO-document status
        await updateFODocumentStatus(
          projectId,
          docId,
          fo.id,
          result.finding_generated ? 'analyzed' : 'skipped'
        );
      } catch (error) {
        console.error(`[evaluate-phase] Error evaluating ${fo.objective_key} on ${docId}:`, error);
        errors++;
        await updateFODocumentStatus(projectId, docId, fo.id, 'error');
      }
    }
  }

  return { evaluated, findingsCreated, findingsUpdated, errors, aiCalls };
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load document facts for a set of documents.
 */
async function loadDocumentFacts(
  projectId: string,
  documentIds: string[]
): Promise<Map<string, DocumentFacts>> {
  const { data: facts, error } = await supabaseAdmin
    .from('dd_document_facts')
    .select('*')
    .eq('project_id', projectId)
    .in('document_id', documentIds);

  if (error) {
    console.error('[evaluate-phase] Failed to load document facts:', error);
    return new Map();
  }

  const factsMap = new Map<string, DocumentFacts>();
  for (const fact of facts || []) {
    factsMap.set(fact.document_id, fact as DocumentFacts);
  }

  return factsMap;
}

/**
 * Load Finding Objectives by ID.
 */
async function loadObjectives(objectiveIds: string[]): Promise<FindingObjective[]> {
  const { data: objectives, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .in('id', objectiveIds)
    .eq('is_active', true);

  if (error) {
    console.error('[evaluate-phase] Failed to load objectives:', error);
    return [];
  }

  return (objectives || []) as FindingObjective[];
}

/**
 * Get deal context for the project.
 */
async function getDealContext(projectId: string): Promise<Record<string, unknown>> {
  const { data: project, error } = await supabaseAdmin
    .from('dd_projects')
    .select('deal_type, jurisdiction, total_deal_value, target_name, target_entity_type')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return {};
  }

  return {
    deal_type: project.deal_type,
    jurisdiction: project.jurisdiction,
    total_deal_value: project.total_deal_value,
    target_name: project.target_name,
    target_entity_type: project.target_entity_type,
  };
}

// ============================================================================
// Document-FO Matching
// ============================================================================

/**
 * Get documents applicable to a Finding Objective based on area codes.
 */
function getApplicableDocuments(
  fo: FindingObjective,
  factsMap: Map<string, DocumentFacts>
): Map<string, DocumentFacts> {
  const applicable = new Map<string, DocumentFacts>();

  for (const [docId, facts] of Array.from(factsMap.entries())) {
    // Check if document's area codes overlap with FO's area
    const docAreas = facts.area_codes || [];
    if (docAreas.includes(fo.area_code)) {
      applicable.set(docId, facts);
    }
  }

  return applicable;
}

/**
 * Convert DocumentFacts to EvaluationFacts format.
 */
function buildEvaluationFacts(documentId: string, facts: DocumentFacts): EvaluationFacts {
  return {
    document_id: documentId,
    document_type: facts.document_type || 'unknown',
    content_hash: facts.source_content_hash || '',
    chunks: [], // Would be populated from VDR if needed
    extracted_data: {
      parties: facts.parties,
      key_dates: facts.key_dates,
      amounts: facts.amounts,
      clauses: facts.clauses,
      obligations: facts.obligations,
      jurisdiction: facts.jurisdiction,
    },
  };
}

// ============================================================================
// Status Updates
// ============================================================================

/**
 * Update FO-document status after evaluation.
 */
async function updateFODocumentStatus(
  projectId: string,
  documentId: string,
  objectiveId: string,
  status: 'analyzed' | 'skipped' | 'error'
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('dd_fo_document_status')
    .upsert(
      {
        project_id: projectId,
        document_id: documentId,
        objective_id: objectiveId,
        status,
        analyzed_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,objective_id,document_id' }
    );

  if (error) {
    console.error('[evaluate-phase] Failed to update FO document status:', error);
  }
}

/**
 * Update work queue status for a wave.
 */
async function updateWorkQueueForWave(
  runId: string,
  wave: EvaluationWave,
  status: 'done' | 'error'
): Promise<void> {
  // Get current work queue
  const { data: run } = await supabaseAdmin
    .from('dd_worker_runs')
    .select('work_queue')
    .eq('id', runId)
    .single();

  if (!run) return;

  const workQueue = (run.work_queue as WorkItem[]) || [];
  const waveObjectiveIds = new Set(wave.objectives.map(fo => fo.id));

  // Update status for items in this wave
  const updatedQueue = workQueue.map(item => {
    if (waveObjectiveIds.has(item.objective_id)) {
      return { ...item, status };
    }
    return item;
  });

  await supabaseAdmin
    .from('dd_worker_runs')
    .update({ work_queue: updatedQueue })
    .eq('id', runId);
}

// ============================================================================
// Coverage Computation
// ============================================================================

/**
 * Compute evaluation coverage for the project.
 */
async function computeEvaluationCoverage(projectId: string): Promise<CoverageSnapshot> {
  const { data: statusData } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      status,
      dd_finding_objectives!inner(area_code)
    `)
    .eq('project_id', projectId);

  if (!statusData || statusData.length === 0) {
    return { by_area: {}, overall: 0 };
  }

  // Calculate by area
  const areaStats: Record<string, { total: number; analyzed: number }> = {};
  let totalItems = 0;
  let analyzedItems = 0;

  for (const row of statusData) {
    // Handle both array and object forms from Supabase join
    const foData = row.dd_finding_objectives;
    const areaCode = Array.isArray(foData)
      ? (foData[0] as { area_code: string })?.area_code
      : (foData as { area_code: string })?.area_code;

    if (!areaCode) continue;

    if (!areaStats[areaCode]) {
      areaStats[areaCode] = { total: 0, analyzed: 0 };
    }
    areaStats[areaCode].total++;
    totalItems++;

    if (row.status === 'analyzed') {
      areaStats[areaCode].analyzed++;
      analyzedItems++;
    }
  }

  const byArea: Record<string, number> = {};
  for (const [area, stats] of Object.entries(areaStats)) {
    byArea[area] = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;
  }

  return {
    by_area: byArea,
    overall: totalItems > 0 ? Math.round((analyzedItems / totalItems) * 100) : 0,
  };
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

// ============================================================================
// Enhanced Criterion Evaluation
// ============================================================================

/**
 * Evaluate a criterion using document facts.
 * This extends the base rule-evaluator with fact-based evaluation.
 */
export async function evaluateCriterionWithFacts(
  criterionType: string,
  facts: DocumentFacts,
  criterion: { criterion: string; threshold?: number; clause_type?: string }
): Promise<{ passed: boolean; confidence: number; evidence?: string }> {
  switch (criterionType) {
    case 'threshold_calculation':
      return evaluateThreshold(facts, criterion.threshold || 0);

    case 'compliance_check':
      return evaluateClausePresence(facts, criterion.clause_type || '');

    case 'document_review':
      return {
        passed: facts.clauses.length > 0 || facts.obligations.length > 0,
        confidence: 0.9,
        evidence: facts.clauses[0]?.excerpt,
      };

    case 'jurisdiction_mapping':
      return {
        passed: !!facts.jurisdiction,
        confidence: facts.jurisdiction ? 0.95 : 0.0,
        evidence: `Jurisdiction: ${facts.jurisdiction}`,
      };

    default:
      return { passed: false, confidence: 0.0 };
  }
}

/**
 * Evaluate threshold criterion against extracted amounts.
 */
function evaluateThreshold(
  facts: DocumentFacts,
  threshold: number
): { passed: boolean; confidence: number; evidence?: string } {
  const totalAmount = facts.amounts.reduce((sum, a) => {
    // Annualize if needed
    const value = a.annualized ? a.amount : a.amount;
    return sum + value;
  }, 0);

  const passed = totalAmount >= threshold;

  return {
    passed,
    confidence: 0.9,
    evidence: `Total amount: ${totalAmount} EUR (threshold: ${threshold})`,
  };
}

/**
 * Evaluate clause presence criterion.
 */
function evaluateClausePresence(
  facts: DocumentFacts,
  clauseType: string
): { passed: boolean; confidence: number; evidence?: string } {
  const clause = facts.clauses.find(c =>
    c.clause_type.toLowerCase() === clauseType.toLowerCase()
  );

  if (clause) {
    return {
      passed: clause.present,
      confidence: clause.confidence,
      evidence: clause.excerpt,
    };
  }

  return {
    passed: false,
    confidence: 0.0,
    evidence: `Clause ${clauseType} not found in document`,
  };
}
