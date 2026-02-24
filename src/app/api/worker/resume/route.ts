/**
 * POST /api/worker/resume
 *
 * Resume a paused DD Worker for a project.
 * Requires PM or CLO role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { resumeWorker, getWorkerStatus } from '@/lib/worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Check authorization (PM or CLO can resume worker)
    const { authorized, error: authError } = await requirePermission(
      request,
      project_id,
      'can_manage_roles'
    );
    if (!authorized) return authError!;

    await resumeWorker(project_id);

    // Get updated status
    const state = await getWorkerStatus(project_id);

    return NextResponse.json({
      success: true,
      data: {
        run_id: state?.runId,
        status: state?.status,
        current_phase: state?.currentPhase,
        message: 'Worker resumed successfully',
      },
    });
  } catch (error) {
    console.error('[api/worker/resume] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
