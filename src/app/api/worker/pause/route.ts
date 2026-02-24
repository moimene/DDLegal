/**
 * POST /api/worker/pause
 *
 * Pause the DD Worker for a project.
 * Requires PM or CLO role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { pauseWorker, getWorkerStatus } from '@/lib/worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, reason = 'User requested pause' } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Check authorization (PM or CLO can pause worker)
    const { authorized, error: authError } = await requirePermission(
      request,
      project_id,
      'can_manage_roles'
    );
    if (!authorized) return authError!;

    await pauseWorker(project_id, reason);

    // Get updated status
    const state = await getWorkerStatus(project_id);

    return NextResponse.json({
      success: true,
      data: {
        run_id: state?.runId,
        status: state?.status,
        paused_at: state?.pausedAt,
        message: 'Worker paused successfully',
      },
    });
  } catch (error) {
    console.error('[api/worker/pause] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
