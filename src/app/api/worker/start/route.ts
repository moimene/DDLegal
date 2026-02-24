/**
 * POST /api/worker/start
 *
 * Start the DD Worker for a project.
 * Requires PM or CLO role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { startWorker, type ExecutionMode } from '@/lib/worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      project_id,
      mode = 'continuous',
      ai_budget_per_cycle = 15,
      docs_per_cycle = 20,
      coverage_threshold = 80,
      target_area,
      target_objective_key,
    } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Check authorization (PM or CLO can start worker)
    const { authorized, error: authError } = await requirePermission(
      request,
      project_id,
      'can_manage_roles'
    );
    if (!authorized) return authError!;

    // Validate mode
    const validModes: ExecutionMode[] = ['continuous', 'targeted', 'full_sweep', 'on_demand'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check feature flag
    if (process.env.DD_WORKER !== 'true') {
      return NextResponse.json(
        { error: 'DD_WORKER feature flag is not enabled' },
        { status: 403 }
      );
    }

    const state = await startWorker({
      projectId: project_id,
      mode,
      aiBudgetPerCycle: ai_budget_per_cycle,
      docsPerCycle: docs_per_cycle,
      coverageThreshold: coverage_threshold,
      targetArea: target_area,
      targetObjectiveKey: target_objective_key,
    });

    return NextResponse.json({
      success: true,
      data: {
        run_id: state.runId,
        project_id: state.projectId,
        status: state.status,
        execution_mode: state.executionMode,
        started_at: state.startedAt,
      },
    });
  } catch (error) {
    console.error('[api/worker/start] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
