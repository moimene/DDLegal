/**
 * Worker Trigger API — POST /api/worker/trigger
 *
 * Triggers a Worker SENSE cycle for a project.
 * Protected by CRON_SECRET for internal use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { startWorker } from '@/lib/worker/worker-controller';

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET for internal calls
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required' },
        { status: 400 }
      );
    }

    // Start worker in on_demand mode
    const state = await startWorker({
      projectId,
      mode: 'on_demand',
    });

    return NextResponse.json({
      success: true,
      runId: state.runId,
      status: state.status,
    });
  } catch (error) {
    console.error('[worker/trigger] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
