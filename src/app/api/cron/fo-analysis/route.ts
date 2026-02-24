// src/app/api/cron/fo-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runFOAnalysisWorker } from '@/lib/findings/fo-analysis-worker';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature flag
  if (process.env.FINDING_OBJECTIVES !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'FINDING_OBJECTIVES feature flag is not enabled'
    });
  }

  // Also check FINDINGS_FIRST dependency
  if (process.env.FINDINGS_FIRST !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'FINDINGS_FIRST must be enabled for FINDING_OBJECTIVES'
    });
  }

  try {
    const result = await runFOAnalysisWorker({
      batchSize: 10,
      maxAiCallsPerRun: 5,
    });

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/FOAnalysis] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
