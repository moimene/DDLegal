import { NextRequest, NextResponse } from 'next/server';
import { generateWorkflowReport } from '@/lib/reporting/report-generator';

/**
 * GET /api/reports/workflow?instance_id=<uuid>
 * Generate a structured report from a workflow instance's phase results.
 */
export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get('instance_id');

  if (!instanceId) {
    return NextResponse.json(
      { success: false, error: 'instance_id query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const report = await generateWorkflowReport(instanceId);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
