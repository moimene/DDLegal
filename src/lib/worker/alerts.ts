/**
 * Worker Alerts — Worker Architecture v1.0
 *
 * Responsibility: Monitor worker health and generate alerts.
 *
 * Alert Types:
 * - stalled: Worker hasn't sent heartbeat in 15 min
 * - error_rate: Error rate > 20% in last cycle
 * - coverage_regression: Coverage decreased between cycles
 * - ai_budget_exceeded: AI budget exhausted before completing work
 * - evaluation_failures: FO with > 3 failed evaluation attempts
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================================================
// Types
// ============================================================================

export type AlertType =
  | 'stalled'
  | 'error_rate'
  | 'coverage_regression'
  | 'ai_budget_exceeded'
  | 'evaluation_failures'
  | 'low_coverage'
  | 'deal_breaker_detected';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface WorkerAlert {
  id?: string;
  type: AlertType;
  severity: AlertSeverity;
  projectId: string;
  runId?: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface AlertCheckResult {
  alerts: WorkerAlert[];
  checksPerformed: number;
  checksDuration: number;
}

// Alert thresholds
const THRESHOLDS = {
  STALLED_MINUTES: 15,
  ERROR_RATE_PERCENT: 20,
  LOW_COVERAGE_PERCENT: 50,
  MAX_EVALUATION_FAILURES: 3,
};

// ============================================================================
// Alert Generation
// ============================================================================

/**
 * Check all alert conditions for a project's worker.
 */
export async function checkWorkerAlerts(projectId: string): Promise<AlertCheckResult> {
  const startTime = Date.now();
  const alerts: WorkerAlert[] = [];

  // Get current worker run
  const { data: run } = await supabaseAdmin
    .from('dd_worker_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!run) {
    return { alerts: [], checksPerformed: 0, checksDuration: Date.now() - startTime };
  }

  let checksPerformed = 0;

  // Check 1: Stalled worker
  checksPerformed++;
  const stalledAlert = checkStalledWorker(run, projectId);
  if (stalledAlert) alerts.push(stalledAlert);

  // Check 2: High error rate
  checksPerformed++;
  const errorRateAlert = checkErrorRate(run, projectId);
  if (errorRateAlert) alerts.push(errorRateAlert);

  // Check 3: Coverage regression
  checksPerformed++;
  const coverageAlert = await checkCoverageRegression(run, projectId);
  if (coverageAlert) alerts.push(coverageAlert);

  // Check 4: AI budget exceeded
  checksPerformed++;
  const budgetAlert = checkAiBudgetExceeded(run, projectId);
  if (budgetAlert) alerts.push(budgetAlert);

  // Check 5: Low coverage warning
  checksPerformed++;
  const lowCoverageAlert = checkLowCoverage(run, projectId);
  if (lowCoverageAlert) alerts.push(lowCoverageAlert);

  // Check 6: Deal breaker detection
  checksPerformed++;
  const dealBreakerAlert = await checkDealBreakers(projectId);
  if (dealBreakerAlert) alerts.push(dealBreakerAlert);

  // Persist new alerts
  if (alerts.length > 0) {
    await persistAlerts(alerts);
  }

  return {
    alerts,
    checksPerformed,
    checksDuration: Date.now() - startTime,
  };
}

// ============================================================================
// Individual Alert Checks
// ============================================================================

/**
 * Check if worker is stalled (no heartbeat in STALLED_MINUTES).
 */
function checkStalledWorker(
  run: Record<string, unknown>,
  projectId: string
): WorkerAlert | null {
  const status = run.status as string;
  const lastHeartbeat = run.last_heartbeat_at as string | null;

  // Only check active workers
  if (!['sensing', 'normalizing', 'evaluating', 'concluding'].includes(status)) {
    return null;
  }

  if (!lastHeartbeat) {
    return null;
  }

  const heartbeatTime = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  const minutesSinceHeartbeat = (now - heartbeatTime) / (1000 * 60);

  if (minutesSinceHeartbeat >= THRESHOLDS.STALLED_MINUTES) {
    return {
      type: 'stalled',
      severity: 'critical',
      projectId,
      runId: run.id as string,
      message: `Worker stalled: no heartbeat in ${Math.round(minutesSinceHeartbeat)} minutes`,
      metadata: {
        lastHeartbeat,
        minutesSinceHeartbeat: Math.round(minutesSinceHeartbeat),
        currentPhase: run.current_phase,
        status,
      },
    };
  }

  return null;
}

/**
 * Check if error rate exceeds threshold.
 */
function checkErrorRate(
  run: Record<string, unknown>,
  projectId: string
): WorkerAlert | null {
  const metrics = run.metrics as Record<string, number> | null;

  if (!metrics) return null;

  const total = (metrics.items_total || 0) as number;
  const errors = (metrics.items_error || 0) as number;

  if (total === 0) return null;

  const errorRate = (errors / total) * 100;

  if (errorRate >= THRESHOLDS.ERROR_RATE_PERCENT) {
    return {
      type: 'error_rate',
      severity: errorRate >= 50 ? 'critical' : 'warning',
      projectId,
      runId: run.id as string,
      message: `High error rate: ${errorRate.toFixed(1)}% (${errors}/${total} items failed)`,
      metadata: {
        errorRate,
        totalItems: total,
        errorItems: errors,
        currentPhase: run.current_phase,
      },
    };
  }

  return null;
}

/**
 * Check for coverage regression (coverage decreased).
 */
async function checkCoverageRegression(
  run: Record<string, unknown>,
  projectId: string
): Promise<WorkerAlert | null> {
  const currentSnapshot = run.coverage_snapshot as { overall?: number } | null;

  if (!currentSnapshot?.overall) return null;

  // Get previous run's coverage
  const { data: previousRun } = await supabaseAdmin
    .from('dd_worker_runs')
    .select('coverage_snapshot')
    .eq('project_id', projectId)
    .neq('id', run.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!previousRun) return null;

  const previousSnapshot = previousRun.coverage_snapshot as { overall?: number } | null;

  if (!previousSnapshot?.overall) return null;

  const currentCoverage = currentSnapshot.overall;
  const previousCoverage = previousSnapshot.overall;

  if (currentCoverage < previousCoverage) {
    const regression = previousCoverage - currentCoverage;
    return {
      type: 'coverage_regression',
      severity: regression > 10 ? 'critical' : 'warning',
      projectId,
      runId: run.id as string,
      message: `Coverage regression: ${previousCoverage}% → ${currentCoverage}% (-${regression}%)`,
      metadata: {
        previousCoverage,
        currentCoverage,
        regression,
      },
    };
  }

  return null;
}

/**
 * Check if AI budget was exceeded.
 */
function checkAiBudgetExceeded(
  run: Record<string, unknown>,
  projectId: string
): WorkerAlert | null {
  const budgetTotal = (run.ai_budget_total || 15) as number;
  const budgetUsed = (run.ai_budget_used || 0) as number;
  const workQueue = (run.work_queue || []) as Array<{ status: string }>;

  const pendingItems = workQueue.filter(w => w.status === 'pending').length;

  // Alert if budget exhausted but work remains
  if (budgetUsed >= budgetTotal && pendingItems > 0) {
    return {
      type: 'ai_budget_exceeded',
      severity: 'warning',
      projectId,
      runId: run.id as string,
      message: `AI budget exhausted with ${pendingItems} items still pending`,
      metadata: {
        budgetTotal,
        budgetUsed,
        pendingItems,
        currentPhase: run.current_phase,
      },
    };
  }

  return null;
}

/**
 * Check for low overall coverage.
 */
function checkLowCoverage(
  run: Record<string, unknown>,
  projectId: string
): WorkerAlert | null {
  const coverageSnapshot = run.coverage_snapshot as { overall?: number; by_area?: Record<string, number> } | null;
  const cycleCount = (run.cycle_count || 0) as number;

  // Only alert after several cycles
  if (cycleCount < 3) return null;

  if (!coverageSnapshot?.overall) return null;

  if (coverageSnapshot.overall < THRESHOLDS.LOW_COVERAGE_PERCENT) {
    // Find areas with lowest coverage
    const lowAreas = Object.entries(coverageSnapshot.by_area || {})
      .filter(([_, coverage]) => coverage < 30)
      .map(([area]) => area);

    return {
      type: 'low_coverage',
      severity: 'warning',
      projectId,
      runId: run.id as string,
      message: `Low coverage after ${cycleCount} cycles: ${coverageSnapshot.overall}%`,
      metadata: {
        overallCoverage: coverageSnapshot.overall,
        cycleCount,
        lowCoverageAreas: lowAreas,
      },
    };
  }

  return null;
}

/**
 * Check for new deal breakers.
 */
async function checkDealBreakers(projectId: string): Promise<WorkerAlert | null> {
  // Get recent deal breakers (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: dealBreakers } = await supabaseAdmin
    .from('dd_findings')
    .select('id, title, area_code, severity')
    .eq('project_id', projectId)
    .eq('is_deal_breaker', true)
    .gte('created_at', oneDayAgo);

  if (!dealBreakers || dealBreakers.length === 0) return null;

  // Check if we already alerted for these
  const { data: existingAlerts } = await supabaseAdmin
    .from('dd_worker_alerts')
    .select('metadata')
    .eq('project_id', projectId)
    .eq('type', 'deal_breaker_detected')
    .gte('created_at', oneDayAgo);

  const alertedIds = new Set<string>();
  for (const alert of existingAlerts || []) {
    const ids = (alert.metadata as { findingIds?: string[] })?.findingIds || [];
    ids.forEach(id => alertedIds.add(id));
  }

  const newDealBreakers = dealBreakers.filter(f => !alertedIds.has(f.id));

  if (newDealBreakers.length === 0) return null;

  return {
    type: 'deal_breaker_detected',
    severity: 'critical',
    projectId,
    message: `${newDealBreakers.length} new deal breaker(s) detected`,
    metadata: {
      findingIds: newDealBreakers.map(f => f.id),
      findings: newDealBreakers.map(f => ({
        id: f.id,
        title: f.title,
        area: f.area_code,
        severity: f.severity,
      })),
    },
  };
}

// ============================================================================
// Alert Persistence
// ============================================================================

/**
 * Persist alerts to database.
 */
async function persistAlerts(alerts: WorkerAlert[]): Promise<void> {
  // Check if table exists, if not log to console
  const rows = alerts.map(alert => ({
    type: alert.type,
    severity: alert.severity,
    project_id: alert.projectId,
    run_id: alert.runId,
    message: alert.message,
    metadata: alert.metadata,
  }));

  const { error } = await supabaseAdmin
    .from('dd_worker_alerts')
    .insert(rows);

  if (error) {
    // Table might not exist yet, log to console
    console.warn('[worker-alerts] Failed to persist alerts:', error.message);
    for (const alert of alerts) {
      console.log(`[ALERT:${alert.severity}] ${alert.type}: ${alert.message}`);
    }
  }
}

/**
 * Get active (unacknowledged) alerts for a project.
 */
export async function getActiveAlerts(projectId: string): Promise<WorkerAlert[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_worker_alerts')
    .select('*')
    .eq('project_id', projectId)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[worker-alerts] Failed to get alerts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    projectId: row.project_id,
    runId: row.run_id,
    message: row.message,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('dd_worker_alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('id', alertId);

  return !error;
}

/**
 * Get alert summary for a project.
 */
export async function getAlertSummary(
  projectId: string
): Promise<{ total: number; critical: number; warning: number; info: number }> {
  const { data, error } = await supabaseAdmin
    .from('dd_worker_alerts')
    .select('severity')
    .eq('project_id', projectId)
    .is('acknowledged_at', null);

  if (error || !data) {
    return { total: 0, critical: 0, warning: 0, info: 0 };
  }

  const summary = { total: data.length, critical: 0, warning: 0, info: 0 };

  for (const row of data) {
    const sev = row.severity as AlertSeverity;
    if (sev === 'critical') summary.critical++;
    else if (sev === 'warning') summary.warning++;
    else summary.info++;
  }

  return summary;
}
