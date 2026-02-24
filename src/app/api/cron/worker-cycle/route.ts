/**
 * GET /api/cron/worker-cycle
 *
 * Vercel Cron job to run worker cycles for all active projects.
 * Protected by CRON_SECRET header.
 *
 * Schedule: Every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { runWorkerCycle, getWorkerStatus, type WorkerConfig } from '@/lib/worker';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature flag
  if (process.env.DD_WORKER !== 'true') {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'DD_WORKER feature flag is not enabled',
    });
  }

  try {
    // Get all active worker runs
    const { data: activeRuns, error: queryError } = await supabaseAdmin
      .from('dd_worker_runs')
      .select('id, project_id, execution_mode, execution_config, ai_budget_total')
      .in('status', ['sensing', 'normalizing', 'evaluating', 'concluding', 'idle'])
      .order('last_heartbeat_at', { ascending: true });

    if (queryError) {
      throw new Error(`Failed to query active runs: ${queryError.message}`);
    }

    if (!activeRuns || activeRuns.length === 0) {
      return NextResponse.json({
        success: true,
        runs_processed: 0,
        message: 'No active worker runs to process',
      });
    }

    const results: Array<{
      project_id: string;
      run_id: string;
      status: string;
      phase: string;
      next_action: string;
      error?: string;
    }> = [];

    // Process each active run
    for (const run of activeRuns) {
      try {
        const config: WorkerConfig = {
          projectId: run.project_id,
          mode: run.execution_mode as WorkerConfig['mode'],
          aiBudgetPerCycle: run.ai_budget_total || 15,
          docsPerCycle: (run.execution_config as { docs_per_cycle?: number })?.docs_per_cycle || 20,
          coverageThreshold: (run.execution_config as { coverage_threshold?: number })?.coverage_threshold || 80,
          targetArea: (run.execution_config as { target_area?: string })?.target_area,
          targetObjectiveKey: (run.execution_config as { target_fo?: string })?.target_fo,
        };

        const cycleResult = await runWorkerCycle(config);

        results.push({
          project_id: run.project_id,
          run_id: run.id,
          status: 'completed',
          phase: cycleResult.phase,
          next_action: cycleResult.nextAction,
        });
      } catch (error) {
        console.error(`[cron/worker-cycle] Error processing run ${run.id}:`, error);
        results.push({
          project_id: run.project_id,
          run_id: run.id,
          status: 'error',
          phase: 'unknown',
          next_action: 'wait',
          error: (error as Error).message,
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      runs_processed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('[cron/worker-cycle] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Add to vercel.json crons:
// {
//   "crons": [
//     {
//       "path": "/api/cron/worker-cycle",
//       "schedule": "*/5 * * * *"
//     }
//   ]
// }
