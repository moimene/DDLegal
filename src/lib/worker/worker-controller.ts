/**
 * Worker Controller — Worker Architecture v1.0
 *
 * State machine that orchestrates the DD Worker loop:
 * SENSE → NORMALIZE → EVALUATE → CONCLUDE
 *
 * Responsibilities:
 * - Manage worker state transitions
 * - Execute worker cycles with AI budget management
 * - Track coverage and convergence
 * - Handle pausing, resuming, and error recovery
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================================================
// Types
// ============================================================================

export type WorkerStatus =
  | 'idle'
  | 'sensing'
  | 'normalizing'
  | 'evaluating'
  | 'concluding'
  | 'paused'
  | 'error'
  | 'completed';

export type WorkerPhase = 'sense' | 'normalize' | 'evaluate' | 'conclude';

export type ExecutionMode = 'continuous' | 'targeted' | 'full_sweep' | 'on_demand';

export interface WorkerConfig {
  projectId: string;
  mode: ExecutionMode;
  aiBudgetPerCycle: number;          // default: 15
  docsPerCycle: number;              // default: 20
  coverageThreshold: number;         // default: 80 (%)
  targetArea?: string;               // for 'targeted' mode
  targetObjectiveKey?: string;       // for 'targeted' mode
}

export interface WorkerRunState {
  runId: string;
  projectId: string;
  status: WorkerStatus;
  currentPhase: WorkerPhase | null;
  phaseProgress: PhaseProgress;
  cycleCount: number;
  aiBudgetTotal: number;
  aiBudgetUsed: number;
  coverageSnapshot: CoverageSnapshot;
  workQueue: WorkItem[];
  executionMode: ExecutionMode;
  executionConfig: ExecutionConfig;
  startedAt: string;
  lastHeartbeatAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  errorMessage: string | null;
  metrics: CycleMetrics;
}

export interface PhaseProgress {
  items_total: number;
  items_done: number;
  items_error: number;
  percentage: number;
}

export interface CoverageSnapshot {
  by_area: Record<string, number>;
  overall: number;
}

export interface WorkItem {
  document_id: string;
  objective_id: string;
  priority_score: number;
  status: 'pending' | 'processing' | 'done' | 'error';
}

export interface ExecutionConfig {
  target_area?: string;
  target_fo?: string;
  coverage_threshold: number;
  docs_per_cycle: number;
}

export interface CycleMetrics {
  docs_normalized: number;
  fos_evaluated: number;
  findings_created: number;
  findings_updated: number;
  conclusions_generated: number;
  ai_calls_total: number;
  duration_ms: number;
}

export interface WorkerCycleResult {
  runId: string;
  cycleNumber: number;
  phase: WorkerPhase;

  // Métricas del ciclo
  docsNormalized: number;
  fosEvaluated: number;
  findingsCreated: number;
  findingsUpdated: number;
  conclusionsGenerated: number;
  aiCallsMade: number;
  durationMs: number;

  // Estado de convergencia
  coverageByArea: Record<string, number>;
  overallCoverage: number;
  pendingWorkItems: number;

  // Siguiente acción
  nextAction: 'continue' | 'wait' | 'pause' | 'complete';
  nextActionReason: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Omit<WorkerConfig, 'projectId'> = {
  mode: 'continuous',
  aiBudgetPerCycle: 15,
  docsPerCycle: 20,
  coverageThreshold: 80,
};

// ============================================================================
// State Machine Transitions
// ============================================================================

const VALID_TRANSITIONS: Record<WorkerStatus, WorkerStatus[]> = {
  idle: ['sensing', 'paused'],
  sensing: ['normalizing', 'paused', 'error', 'completed'],
  normalizing: ['evaluating', 'paused', 'error'],
  evaluating: ['concluding', 'paused', 'error'],
  concluding: ['sensing', 'completed', 'paused', 'error'],
  paused: ['sensing', 'idle'],
  error: ['idle', 'sensing'],
  completed: ['idle'],
};

// ============================================================================
// Worker Controller Functions
// ============================================================================

/**
 * Start a worker cycle for a project.
 * Creates a new run if none exists, or resumes an existing one.
 */
export async function startWorker(
  config: Partial<WorkerConfig> & { projectId: string }
): Promise<WorkerRunState> {
  const fullConfig: WorkerConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Get or create worker run
  const { data: runIdResult, error: rpcError } = await supabaseAdmin
    .rpc('get_or_create_worker_run', { p_project_id: fullConfig.projectId });

  if (rpcError || !runIdResult) {
    throw new Error(`Failed to get/create worker run: ${rpcError?.message}`);
  }

  const runId = runIdResult as string;

  // Update run with configuration
  const { error: updateError } = await supabaseAdmin
    .from('dd_worker_runs')
    .update({
      status: 'sensing',
      current_phase: 'sense',
      execution_mode: fullConfig.mode,
      execution_config: {
        target_area: fullConfig.targetArea,
        target_fo: fullConfig.targetObjectiveKey,
        coverage_threshold: fullConfig.coverageThreshold,
        docs_per_cycle: fullConfig.docsPerCycle,
      },
      ai_budget_total: fullConfig.aiBudgetPerCycle,
      ai_budget_used: 0,
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      paused_at: null,
      error_message: null,
    })
    .eq('id', runId);

  if (updateError) {
    throw new Error(`Failed to start worker: ${updateError.message}`);
  }

  const state = await getWorkerStatus(fullConfig.projectId);
  if (!state) {
    throw new Error('Failed to get worker state after starting');
  }
  return state;
}

/**
 * Run a single worker cycle.
 * This is the main entry point for the cron job.
 */
export async function runWorkerCycle(
  config: WorkerConfig
): Promise<WorkerCycleResult> {
  const startTime = Date.now();

  // Get current worker state
  const state = await getWorkerStatus(config.projectId);

  if (!state) {
    throw new Error(`No worker run found for project ${config.projectId}`);
  }

  // Check if worker is in a runnable state
  if (state.status === 'paused' || state.status === 'error' || state.status === 'completed') {
    return {
      runId: state.runId,
      cycleNumber: state.cycleCount,
      phase: state.currentPhase || 'sense',
      docsNormalized: 0,
      fosEvaluated: 0,
      findingsCreated: 0,
      findingsUpdated: 0,
      conclusionsGenerated: 0,
      aiCallsMade: 0,
      durationMs: Date.now() - startTime,
      coverageByArea: state.coverageSnapshot.by_area,
      overallCoverage: state.coverageSnapshot.overall,
      pendingWorkItems: state.workQueue.filter(w => w.status === 'pending').length,
      nextAction: state.status === 'completed' ? 'complete' : 'wait',
      nextActionReason: `Worker is ${state.status}`,
    };
  }

  // Update heartbeat
  await supabaseAdmin.rpc('worker_heartbeat', { p_run_id: state.runId });

  // Execute current phase
  let phaseResult: PhaseResult;

  try {
    switch (state.currentPhase || 'sense') {
      case 'sense':
        phaseResult = await executeSensePhase(state, config);
        break;
      case 'normalize':
        phaseResult = await executeNormalizePhase(state, config);
        break;
      case 'evaluate':
        phaseResult = await executeEvaluatePhase(state, config);
        break;
      case 'conclude':
        phaseResult = await executeConcludePhase(state, config);
        break;
      default:
        throw new Error(`Unknown phase: ${state.currentPhase}`);
    }
  } catch (error) {
    // Transition to error state
    await transitionWorkerStatus(state.runId, 'error', {
      error_message: (error as Error).message,
    });

    throw error;
  }

  // Update state based on phase result
  const nextPhase = getNextPhase(state.currentPhase || 'sense', phaseResult);
  const nextStatus = getStatusForPhase(nextPhase);

  await supabaseAdmin
    .from('dd_worker_runs')
    .update({
      status: nextStatus,
      current_phase: nextPhase,
      cycle_count: nextPhase === 'sense' ? state.cycleCount + 1 : state.cycleCount,
      ai_budget_used: state.aiBudgetUsed + phaseResult.aiCallsMade,
      phase_progress: {
        items_total: phaseResult.itemsTotal,
        items_done: phaseResult.itemsDone,
        items_error: phaseResult.itemsError,
        percentage: phaseResult.itemsTotal > 0
          ? Math.round((phaseResult.itemsDone / phaseResult.itemsTotal) * 100)
          : 100,
      },
      coverage_snapshot: phaseResult.coverageSnapshot || state.coverageSnapshot,
      metrics: {
        docs_normalized: (state.metrics.docs_normalized || 0) + phaseResult.docsNormalized,
        fos_evaluated: (state.metrics.fos_evaluated || 0) + phaseResult.fosEvaluated,
        findings_created: (state.metrics.findings_created || 0) + phaseResult.findingsCreated,
        findings_updated: (state.metrics.findings_updated || 0) + phaseResult.findingsUpdated,
        conclusions_generated: (state.metrics.conclusions_generated || 0) + phaseResult.conclusionsGenerated,
        ai_calls_total: (state.metrics.ai_calls_total || 0) + phaseResult.aiCallsMade,
        duration_ms: (state.metrics.duration_ms || 0) + phaseResult.durationMs,
      },
      last_heartbeat_at: new Date().toISOString(),
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', state.runId);

  // Determine next action
  const coverageSnapshot = phaseResult.coverageSnapshot || state.coverageSnapshot;
  const { nextAction, reason } = determineNextAction(
    nextStatus,
    coverageSnapshot.overall,
    config.coverageThreshold,
    state.aiBudgetUsed + phaseResult.aiCallsMade,
    config.aiBudgetPerCycle
  );

  return {
    runId: state.runId,
    cycleNumber: state.cycleCount,
    phase: state.currentPhase || 'sense',
    docsNormalized: phaseResult.docsNormalized,
    fosEvaluated: phaseResult.fosEvaluated,
    findingsCreated: phaseResult.findingsCreated,
    findingsUpdated: phaseResult.findingsUpdated,
    conclusionsGenerated: phaseResult.conclusionsGenerated,
    aiCallsMade: phaseResult.aiCallsMade,
    durationMs: Date.now() - startTime,
    coverageByArea: coverageSnapshot.by_area,
    overallCoverage: coverageSnapshot.overall,
    pendingWorkItems: state.workQueue.filter(w => w.status === 'pending').length,
    nextAction,
    nextActionReason: reason,
  };
}

/**
 * Pause the worker.
 */
export async function pauseWorker(
  projectId: string,
  reason: string
): Promise<void> {
  const state = await getWorkerStatus(projectId);

  if (!state) {
    throw new Error(`No worker run found for project ${projectId}`);
  }

  if (!VALID_TRANSITIONS[state.status].includes('paused')) {
    throw new Error(`Cannot pause worker in ${state.status} state`);
  }

  await transitionWorkerStatus(state.runId, 'paused', {
    paused_at: new Date().toISOString(),
    error_message: reason,
  });
}

/**
 * Resume a paused worker.
 */
export async function resumeWorker(projectId: string): Promise<void> {
  const state = await getWorkerStatus(projectId);

  if (!state) {
    throw new Error(`No worker run found for project ${projectId}`);
  }

  if (state.status !== 'paused') {
    throw new Error(`Worker is not paused (current: ${state.status})`);
  }

  await transitionWorkerStatus(state.runId, 'sensing', {
    paused_at: null,
    current_phase: 'sense',
    last_heartbeat_at: new Date().toISOString(),
  });
}

/**
 * Get current worker status for a project.
 */
export async function getWorkerStatus(
  projectId: string
): Promise<WorkerRunState | null> {
  const { data, error } = await supabaseAdmin
    .from('dd_worker_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    runId: data.id,
    projectId: data.project_id,
    status: data.status as WorkerStatus,
    currentPhase: data.current_phase as WorkerPhase | null,
    phaseProgress: data.phase_progress as PhaseProgress || { items_total: 0, items_done: 0, items_error: 0, percentage: 0 },
    cycleCount: data.cycle_count,
    aiBudgetTotal: data.ai_budget_total,
    aiBudgetUsed: data.ai_budget_used,
    coverageSnapshot: data.coverage_snapshot as CoverageSnapshot || { by_area: {}, overall: 0 },
    workQueue: data.work_queue as WorkItem[] || [],
    executionMode: data.execution_mode as ExecutionMode,
    executionConfig: data.execution_config as ExecutionConfig || { coverage_threshold: 80, docs_per_cycle: 20 },
    startedAt: data.started_at,
    lastHeartbeatAt: data.last_heartbeat_at,
    completedAt: data.completed_at,
    pausedAt: data.paused_at,
    errorMessage: data.error_message,
    metrics: data.metrics as CycleMetrics || {
      docs_normalized: 0,
      fos_evaluated: 0,
      findings_created: 0,
      findings_updated: 0,
      conclusions_generated: 0,
      ai_calls_total: 0,
      duration_ms: 0,
    },
  };
}

// ============================================================================
// Internal Helper Functions
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

async function transitionWorkerStatus(
  runId: string,
  newStatus: WorkerStatus,
  additionalUpdates: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('dd_worker_runs')
    .update({
      status: newStatus,
      ...additionalUpdates,
    })
    .eq('id', runId);

  if (error) {
    throw new Error(`Failed to transition worker status: ${error.message}`);
  }
}

function getNextPhase(currentPhase: WorkerPhase, result: PhaseResult): WorkerPhase | null {
  // Phase progression: sense → normalize → evaluate → conclude → (loop back to sense)
  const progression: Record<WorkerPhase, WorkerPhase | null> = {
    sense: 'normalize',
    normalize: 'evaluate',
    evaluate: 'conclude',
    conclude: 'sense', // Loop back
  };

  return progression[currentPhase];
}

function getStatusForPhase(phase: WorkerPhase | null): WorkerStatus {
  if (!phase) return 'completed';

  const statusMap: Record<WorkerPhase, WorkerStatus> = {
    sense: 'sensing',
    normalize: 'normalizing',
    evaluate: 'evaluating',
    conclude: 'concluding',
  };

  return statusMap[phase];
}

function determineNextAction(
  status: WorkerStatus,
  overallCoverage: number,
  coverageThreshold: number,
  aiBudgetUsed: number,
  aiBudgetTotal: number
): { nextAction: WorkerCycleResult['nextAction']; reason: string } {
  if (status === 'completed') {
    return { nextAction: 'complete', reason: 'Worker completed' };
  }

  if (status === 'paused') {
    return { nextAction: 'wait', reason: 'Worker is paused' };
  }

  if (status === 'error') {
    return { nextAction: 'wait', reason: 'Worker encountered an error' };
  }

  if (overallCoverage >= coverageThreshold) {
    return { nextAction: 'complete', reason: `Coverage threshold reached: ${overallCoverage}% >= ${coverageThreshold}%` };
  }

  if (aiBudgetUsed >= aiBudgetTotal) {
    return { nextAction: 'wait', reason: `AI budget exhausted: ${aiBudgetUsed}/${aiBudgetTotal}` };
  }

  return { nextAction: 'continue', reason: 'More work to do' };
}

// ============================================================================
// Phase Execution Stubs (to be implemented in separate files)
// ============================================================================

async function executeSensePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  // Import dynamically to avoid circular dependencies
  const { runSensePhase } = await import('./sense-phase');
  return runSensePhase(state, config);
}

async function executeNormalizePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  const { runNormalizePhase } = await import('./normalize-phase');
  return runNormalizePhase(state, config);
}

async function executeEvaluatePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  // Evaluate phase uses existing FO analysis worker
  const { runFOAnalysisWorker } = await import('@/lib/findings/fo-analysis-worker');

  const startTime = Date.now();
  const remainingBudget = config.aiBudgetPerCycle - state.aiBudgetUsed;

  const result = await runFOAnalysisWorker({
    projectId: config.projectId,
    batchSize: config.docsPerCycle,
    maxAiCallsPerRun: remainingBudget,
  });

  return {
    itemsTotal: result.processed + result.skipped,
    itemsDone: result.processed,
    itemsError: result.errors,
    docsNormalized: 0,
    fosEvaluated: result.processed,
    findingsCreated: result.findings_created,
    findingsUpdated: 0,
    conclusionsGenerated: 0,
    aiCallsMade: result.processed, // Each processed item typically uses 1 AI call
    durationMs: Date.now() - startTime,
  };
}

async function executeConcludePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  // Conclude phase: compute coverage and generate summaries
  const startTime = Date.now();

  // Compute coverage
  const coverage = await computeProjectCoverage(config.projectId);

  return {
    itemsTotal: 1,
    itemsDone: 1,
    itemsError: 0,
    docsNormalized: 0,
    fosEvaluated: 0,
    findingsCreated: 0,
    findingsUpdated: 0,
    conclusionsGenerated: 1,
    aiCallsMade: 0,
    durationMs: Date.now() - startTime,
    coverageSnapshot: coverage,
  };
}

async function computeProjectCoverage(projectId: string): Promise<CoverageSnapshot> {
  // Query coverage stats from dd_fo_document_status
  const { data: statusData, error } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      status,
      dd_finding_objectives!inner(area_code)
    `)
    .eq('project_id', projectId);

  if (error || !statusData || statusData.length === 0) {
    if (error) {
      console.error('[worker-controller] Failed to compute coverage:', error);
    }
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
