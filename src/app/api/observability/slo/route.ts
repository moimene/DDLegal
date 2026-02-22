import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WORKFLOW_PHASES } from '@/lib/workflows/template-types';
import type { WorkflowPhase } from '@/lib/workflows/template-types';

/**
 * GET /api/observability/slo
 *
 * SLO dashboard metrics. Two sections:
 *
 *   1. Gateway SLOs — p50/p95/p99 latency, 429 rate, error rate, retry rate
 *      (from dd_gateway_telemetry)
 *
 *   2. Workflow Phase Metrics — average duration per phase, completion rates,
 *      bottleneck detection (phases averaging >3 days)
 *      (from dd_workflow_instances)
 *
 * Query params:
 *   - hours  — lookback window for gateway metrics (default 24, max 720)
 */
export async function GET(req: NextRequest) {
  // Verify authenticated user
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const hours = Math.min(parseInt(req.nextUrl.searchParams.get('hours') || '24', 10), 720);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // ── 1. Gateway SLOs ───────────────────────────────────────
  const { data: telemetry } = await supabaseAdmin
    .from('dd_gateway_telemetry')
    .select('duration_ms, status_code, retries, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const entries = telemetry || [];
  const total = entries.length;

  let gatewaySlo;

  if (total === 0) {
    gatewaySlo = {
      total: 0,
      period_hours: hours,
      p50_ms: 0,
      p95_ms: 0,
      p99_ms: 0,
      rate_429_pct: 0,
      error_rate_pct: 0,
      retry_rate_pct: 0,
    };
  } else {
    const latencies = entries.map(e => e.duration_ms).sort((a: number, b: number) => a - b);
    const p50 = latencies[Math.floor(total * 0.50)];
    const p95 = latencies[Math.floor(total * 0.95)];
    const p99 = latencies[Math.floor(total * 0.99)];

    const count429 = entries.filter(e => e.status_code === 429).length;
    const countErrors = entries.filter(e => e.status_code >= 400).length;
    const countRetries = entries.filter(e => e.retries > 0).length;

    gatewaySlo = {
      total,
      period_hours: hours,
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
      rate_429_pct: Math.round((count429 / total) * 10000) / 100,
      error_rate_pct: Math.round((countErrors / total) * 10000) / 100,
      retry_rate_pct: Math.round((countRetries / total) * 10000) / 100,
    };
  }

  // ── 2. Workflow Phase Metrics ─────────────────────────────
  const { data: instances } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('id, status, current_phase, phase_status, phase_started_at, phase_completed_at, hitl_pending_count, created_at, updated_at');

  const workflowInstances = instances || [];
  const workflowPhaseMetrics = computePhaseMetrics(workflowInstances);

  return NextResponse.json({
    success: true,
    slo: gatewaySlo,
    workflow_phases: workflowPhaseMetrics,
  });
}

// ── Phase Metrics Computation ─────────────────────────────

interface PhaseMetric {
  phase: WorkflowPhase;
  /** Number of instances that have entered this phase */
  instances_entered: number;
  /** Number of instances that have completed this phase */
  instances_completed: number;
  /** Completion rate as percentage */
  completion_rate_pct: number;
  /** Average duration in hours for completed phases */
  avg_duration_hours: number;
  /** Max duration in hours among completed phases */
  max_duration_hours: number;
  /** Whether this phase qualifies as a bottleneck (>3 day average = >72h) */
  is_bottleneck: boolean;
  /** Number of instances currently stuck in this phase */
  currently_in_progress: number;
}

interface WorkflowPhaseReport {
  total_instances: number;
  instances_by_status: Record<string, number>;
  phases: PhaseMetric[];
  bottlenecks: string[];
}

interface InstanceRow {
  id: string;
  status: string;
  current_phase: string;
  phase_status: Record<string, string>;
  phase_started_at: Record<string, string>;
  phase_completed_at: Record<string, string>;
  hitl_pending_count: number;
  created_at: string;
  updated_at: string;
}

function computePhaseMetrics(instances: InstanceRow[]): WorkflowPhaseReport {
  const totalInstances = instances.length;

  // Count instances by status
  const instancesByStatus: Record<string, number> = {};
  for (const inst of instances) {
    instancesByStatus[inst.status] = (instancesByStatus[inst.status] || 0) + 1;
  }

  const bottlenecks: string[] = [];
  const BOTTLENECK_THRESHOLD_HOURS = 72; // 3 days

  const phases: PhaseMetric[] = WORKFLOW_PHASES.map((phase) => {
    let entered = 0;
    let completed = 0;
    let currentlyInProgress = 0;
    const durations: number[] = [];

    for (const inst of instances) {
      const pStatus = inst.phase_status?.[phase];
      const startedAt = inst.phase_started_at?.[phase];
      const completedAt = inst.phase_completed_at?.[phase];

      // Count entered (any phase status except 'pending' or undefined)
      if (pStatus && pStatus !== 'pending') {
        entered++;
      }

      // Count completed
      if (pStatus === 'completed' && startedAt && completedAt) {
        completed++;
        const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
        if (durationMs > 0) {
          durations.push(durationMs / (1000 * 60 * 60)); // convert to hours
        }
      }

      // Count currently in progress
      if (pStatus === 'in_progress') {
        currentlyInProgress++;
      }
    }

    const avgDurationHours = durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100
      : 0;

    const maxDurationHours = durations.length > 0
      ? Math.round(Math.max(...durations) * 100) / 100
      : 0;

    const isBottleneck = avgDurationHours > BOTTLENECK_THRESHOLD_HOURS;
    if (isBottleneck) {
      bottlenecks.push(phase);
    }

    return {
      phase,
      instances_entered: entered,
      instances_completed: completed,
      completion_rate_pct: entered > 0 ? Math.round((completed / entered) * 10000) / 100 : 0,
      avg_duration_hours: avgDurationHours,
      max_duration_hours: maxDurationHours,
      is_bottleneck: isBottleneck,
      currently_in_progress: currentlyInProgress,
    };
  });

  return {
    total_instances: totalInstances,
    instances_by_status: instancesByStatus,
    phases,
    bottlenecks,
  };
}
