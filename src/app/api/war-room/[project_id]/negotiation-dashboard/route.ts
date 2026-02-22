import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * GET /api/war-room/[project_id]/negotiation-dashboard
 * O.2: Negotiation Actions Dashboard
 *
 * Aggregated view of all negotiation actions with:
 *   - by_status:        count per status (proposed, accepted, rejected, counter, deferred, withdrawn)
 *   - by_action_type:   count per action type
 *   - by_workflow:      count/accepted/pending grouped by workflow_instance_id
 *   - economic_summary: total proposed, total accepted, total rejected
 *   - progress:         resolution_rate, acceptance_rate, pending_count, avg_days_to_resolution
 *
 * Returns: { success, dashboard }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_view_war_room'
  );
  if (!authorized) return authError!;

  try {
    const { data: actions, error } = await supabaseAdmin
      .from('dd_negotiation_actions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const allActions = actions || [];
    const total = allActions.length;

    // 1. Aggregate by status
    const STATUSES = [
      'proposed',
      'accepted',
      'rejected',
      'counter',
      'deferred',
      'withdrawn',
    ] as const;
    const by_status: Record<string, number> = {};
    for (const s of STATUSES) {
      by_status[s] = 0;
    }
    for (const a of allActions) {
      by_status[a.status] = (by_status[a.status] || 0) + 1;
    }

    // 2. Aggregate by action_type
    const ACTION_TYPES = [
      'condition_precedent',
      'indemnity',
      'price_adjustment',
      'warranty',
      'covenant',
      'escrow',
      'cap_basket',
      'carve_out',
      'disclosure',
      'remediation',
      'insurance',
      'other',
    ] as const;
    const by_action_type: Record<string, number> = {};
    for (const t of ACTION_TYPES) {
      by_action_type[t] = 0;
    }
    for (const a of allActions) {
      by_action_type[a.action_type] = (by_action_type[a.action_type] || 0) + 1;
    }

    // 3. Aggregate by workflow
    const workflowMap = new Map<
      string,
      { count: number; accepted: number; pending: number }
    >();
    for (const a of allActions) {
      const wfKey = a.workflow_instance_id || '__no_workflow__';
      if (!workflowMap.has(wfKey)) {
        workflowMap.set(wfKey, { count: 0, accepted: 0, pending: 0 });
      }
      const entry = workflowMap.get(wfKey)!;
      entry.count++;
      if (a.status === 'accepted') entry.accepted++;
      if (['proposed', 'counter', 'deferred'].includes(a.status))
        entry.pending++;
    }
    const by_workflow: Record<
      string,
      { count: number; accepted: number; pending: number }
    > = {};
    workflowMap.forEach((val, key) => {
      by_workflow[key] = val;
    });

    // 4. Economic summary
    const economic_summary = {
      total_proposed: 0,
      total_accepted: 0,
      total_rejected: 0,
      currency: 'EUR',
    };
    for (const a of allActions) {
      const amount = Number(a.economic_impact_amount) || 0;
      economic_summary.total_proposed += amount;
      if (a.status === 'accepted') economic_summary.total_accepted += amount;
      if (a.status === 'rejected') economic_summary.total_rejected += amount;
    }

    // 5. Progress metrics
    const resolvedStatuses = ['accepted', 'rejected', 'withdrawn'];
    const pendingStatuses = ['proposed', 'counter', 'deferred'];

    const resolvedCount = allActions.filter((a) =>
      resolvedStatuses.includes(a.status)
    ).length;
    const acceptedCount = by_status['accepted'] || 0;
    const pendingCount = allActions.filter((a) =>
      pendingStatuses.includes(a.status)
    ).length;

    const resolution_rate =
      total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
    const acceptance_rate =
      total > 0 ? Math.round((acceptedCount / total) * 100) : 0;

    // Calculate average days to resolution for resolved actions
    let totalResolutionDays = 0;
    let resolvedWithDates = 0;
    for (const a of allActions) {
      if (
        resolvedStatuses.includes(a.status) &&
        a.updated_at &&
        a.created_at
      ) {
        const created = new Date(a.created_at).getTime();
        const resolved = new Date(a.updated_at).getTime();
        if (resolved > created) {
          totalResolutionDays += (resolved - created) / (1000 * 60 * 60 * 24);
          resolvedWithDates++;
        }
      }
    }
    const avg_days_to_resolution =
      resolvedWithDates > 0
        ? Math.round((totalResolutionDays / resolvedWithDates) * 10) / 10
        : 0;

    return NextResponse.json({
      success: true,
      project_id,
      dashboard: {
        total_actions: total,
        by_status,
        by_action_type,
        by_workflow,
        economic_summary,
        progress: {
          resolution_rate,
          acceptance_rate,
          pending_count: pendingCount,
          resolved_count: resolvedCount,
          avg_days_to_resolution,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
