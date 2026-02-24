/**
 * GET /api/worker/status
 *
 * Get current worker status for a project.
 * Query params: project_id (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { getWorkerStatus } from '@/lib/worker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id query parameter is required' },
        { status: 400 }
      );
    }

    // Check authorization
    const { authorized, error: authError } = await requirePermission(
      request,
      projectId,
      'can_view_reports'
    );
    if (!authorized) return authError!;

    const state = await getWorkerStatus(projectId);

    if (!state) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'not_started',
          message: 'No worker run found for this project',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        run_id: state.runId,
        project_id: state.projectId,
        status: state.status,
        current_phase: state.currentPhase,
        phase_progress: state.phaseProgress,
        cycle_count: state.cycleCount,
        ai_budget: {
          total: state.aiBudgetTotal,
          used: state.aiBudgetUsed,
          remaining: state.aiBudgetTotal - state.aiBudgetUsed,
        },
        coverage: state.coverageSnapshot,
        execution_mode: state.executionMode,
        execution_config: state.executionConfig,
        work_queue_size: state.workQueue.length,
        pending_items: state.workQueue.filter(w => w.status === 'pending').length,
        metrics: state.metrics,
        timing: {
          started_at: state.startedAt,
          last_heartbeat_at: state.lastHeartbeatAt,
          completed_at: state.completedAt,
          paused_at: state.pausedAt,
        },
        error_message: state.errorMessage,
      },
    });
  } catch (error) {
    console.error('[api/worker/status] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
