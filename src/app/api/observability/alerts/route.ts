import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WORKFLOW_PHASES } from '@/lib/workflows/template-types';

/**
 * GET /api/observability/alerts
 *
 * Evaluates SLO thresholds and workflow health, returning structured alerts
 * with severity levels (warning / critical).
 *
 * Alert categories:
 *
 *   Gateway SLO alerts:
 *     - p95 latency > 30s                      (warning > 30s, critical > 60s)
 *     - 429 rate > 10%                          (warning > 10%, critical > 25%)
 *     - Error rate > 5%                         (warning > 5%, critical > 15%)
 *
 *   Workflow alerts:
 *     - Phase stuck > 5 days (120h)             (warning > 5d, critical > 10d)
 *     - hitl_pending_count > 0 for > 24h        (warning > 24h, critical > 72h)
 *
 * Query params:
 *   - hours — lookback window for gateway metrics (default 24, max 720)
 */
export async function GET(req: NextRequest) {
  // Verify authenticated user
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const hours = Math.min(parseInt(req.nextUrl.searchParams.get('hours') || '24', 10), 720);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const now = Date.now();

  const alerts: Alert[] = [];

  // ── 1. Gateway SLO Alerts ─────────────────────────────────
  const { data: telemetry } = await supabaseAdmin
    .from('dd_gateway_telemetry')
    .select('duration_ms, status_code, retries, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const entries = telemetry || [];
  const total = entries.length;

  if (total > 0) {
    // p95 latency check
    const latencies = entries.map(e => e.duration_ms).sort((a: number, b: number) => a - b);
    const p95 = latencies[Math.floor(total * 0.95)];

    if (p95 > 60_000) {
      alerts.push({
        id: 'gateway_p95_latency',
        category: 'gateway',
        severity: 'critical',
        title: 'P95 latency critically high',
        message: `P95 latency is ${Math.round(p95 / 1000)}s (threshold: 60s critical, 30s warning)`,
        metric: 'p95_latency_ms',
        current_value: p95,
        threshold: 60_000,
        timestamp: new Date().toISOString(),
      });
    } else if (p95 > 30_000) {
      alerts.push({
        id: 'gateway_p95_latency',
        category: 'gateway',
        severity: 'warning',
        title: 'P95 latency exceeds SLO',
        message: `P95 latency is ${Math.round(p95 / 1000)}s (threshold: 30s)`,
        metric: 'p95_latency_ms',
        current_value: p95,
        threshold: 30_000,
        timestamp: new Date().toISOString(),
      });
    }

    // 429 rate check
    const count429 = entries.filter(e => e.status_code === 429).length;
    const rate429 = (count429 / total) * 100;

    if (rate429 > 25) {
      alerts.push({
        id: 'gateway_429_rate',
        category: 'gateway',
        severity: 'critical',
        title: 'Rate limiting critically high',
        message: `429 rate is ${Math.round(rate429 * 100) / 100}% (threshold: 25% critical, 10% warning)`,
        metric: 'rate_429_pct',
        current_value: Math.round(rate429 * 100) / 100,
        threshold: 25,
        timestamp: new Date().toISOString(),
      });
    } else if (rate429 > 10) {
      alerts.push({
        id: 'gateway_429_rate',
        category: 'gateway',
        severity: 'warning',
        title: 'Rate limiting exceeds SLO',
        message: `429 rate is ${Math.round(rate429 * 100) / 100}% (threshold: 10%)`,
        metric: 'rate_429_pct',
        current_value: Math.round(rate429 * 100) / 100,
        threshold: 10,
        timestamp: new Date().toISOString(),
      });
    }

    // Error rate check
    const countErrors = entries.filter(e => e.status_code >= 400).length;
    const errorRate = (countErrors / total) * 100;

    if (errorRate > 15) {
      alerts.push({
        id: 'gateway_error_rate',
        category: 'gateway',
        severity: 'critical',
        title: 'Error rate critically high',
        message: `Error rate is ${Math.round(errorRate * 100) / 100}% (threshold: 15% critical, 5% warning)`,
        metric: 'error_rate_pct',
        current_value: Math.round(errorRate * 100) / 100,
        threshold: 15,
        timestamp: new Date().toISOString(),
      });
    } else if (errorRate > 5) {
      alerts.push({
        id: 'gateway_error_rate',
        category: 'gateway',
        severity: 'warning',
        title: 'Error rate exceeds SLO',
        message: `Error rate is ${Math.round(errorRate * 100) / 100}% (threshold: 5%)`,
        metric: 'error_rate_pct',
        current_value: Math.round(errorRate * 100) / 100,
        threshold: 5,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── 2. Workflow Alerts ────────────────────────────────────
  const { data: instances } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('id, status, current_phase, phase_status, phase_started_at, phase_completed_at, hitl_pending_count, updated_at')
    .in('status', ['created', 'in_progress', 'paused']);

  const activeInstances = instances || [];

  for (const inst of activeInstances) {
    // ── Check for stuck phases ──────────────────────────────
    for (const phase of WORKFLOW_PHASES) {
      const pStatus = inst.phase_status?.[phase];
      const startedAt = inst.phase_started_at?.[phase];

      if (pStatus === 'in_progress' && startedAt) {
        const elapsedHours = (now - new Date(startedAt).getTime()) / (1000 * 60 * 60);

        if (elapsedHours > 240) { // >10 days
          alerts.push({
            id: `workflow_stuck_phase_${inst.id}_${phase}`,
            category: 'workflow',
            severity: 'critical',
            title: `Phase "${phase}" stuck >10 days`,
            message: `Workflow instance ${inst.id.slice(0, 8)} has been in phase "${phase}" for ${Math.round(elapsedHours)}h (${Math.round(elapsedHours / 24)}d)`,
            metric: 'phase_stuck_hours',
            current_value: Math.round(elapsedHours),
            threshold: 240,
            instance_id: inst.id,
            phase,
            timestamp: new Date().toISOString(),
          });
        } else if (elapsedHours > 120) { // >5 days
          alerts.push({
            id: `workflow_stuck_phase_${inst.id}_${phase}`,
            category: 'workflow',
            severity: 'warning',
            title: `Phase "${phase}" stuck >5 days`,
            message: `Workflow instance ${inst.id.slice(0, 8)} has been in phase "${phase}" for ${Math.round(elapsedHours)}h (${Math.round(elapsedHours / 24)}d)`,
            metric: 'phase_stuck_hours',
            current_value: Math.round(elapsedHours),
            threshold: 120,
            instance_id: inst.id,
            phase,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // ── Check for pending HITL decisions ─────────────────────
    if (inst.hitl_pending_count > 0) {
      const updatedAt = new Date(inst.updated_at).getTime();
      const pendingHours = (now - updatedAt) / (1000 * 60 * 60);

      if (pendingHours > 72) {
        alerts.push({
          id: `workflow_hitl_pending_${inst.id}`,
          category: 'workflow',
          severity: 'critical',
          title: `HITL decisions pending >72h`,
          message: `Workflow instance ${inst.id.slice(0, 8)} has ${inst.hitl_pending_count} HITL decision(s) pending for ${Math.round(pendingHours)}h`,
          metric: 'hitl_pending_hours',
          current_value: Math.round(pendingHours),
          threshold: 72,
          instance_id: inst.id,
          timestamp: new Date().toISOString(),
        });
      } else if (pendingHours > 24) {
        alerts.push({
          id: `workflow_hitl_pending_${inst.id}`,
          category: 'workflow',
          severity: 'warning',
          title: `HITL decisions pending >24h`,
          message: `Workflow instance ${inst.id.slice(0, 8)} has ${inst.hitl_pending_count} HITL decision(s) pending for ${Math.round(pendingHours)}h`,
          metric: 'hitl_pending_hours',
          current_value: Math.round(pendingHours),
          threshold: 24,
          instance_id: inst.id,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // ── Sort alerts: critical first, then warning ─────────────
  alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });

  const summary = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    gateway_alerts: alerts.filter(a => a.category === 'gateway').length,
    workflow_alerts: alerts.filter(a => a.category === 'workflow').length,
  };

  return NextResponse.json({
    success: true,
    summary,
    alerts,
    evaluated_at: new Date().toISOString(),
    period_hours: hours,
  });
}

// ── Types ───────────────────────────────────────────────────

interface Alert {
  id: string;
  category: 'gateway' | 'workflow';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  metric: string;
  current_value: number;
  threshold: number;
  timestamp: string;
  instance_id?: string;
  phase?: string;
}
