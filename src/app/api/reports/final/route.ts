import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { compileFinalReport } from '@/lib/reporting/final-report-compiler';
import type { FinalReportOutput } from '@/lib/reporting/final-report-compiler';

/**
 * Final Report API (WF-16)
 *
 * GET  /api/reports/final?project_id=xxx
 *   Compile and return the final consolidated DD report (not persisted).
 *
 * POST /api/reports/final
 *   Body: { project_id }
 *   Compile, persist to dd_reports, and return the report.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const report: FinalReportOutput = await compileFinalReport(projectId);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    console.error('Final Report GET error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { project_id } = body as { project_id?: string };

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: 'project_id is required in request body' },
        { status: 400 },
      );
    }

    // Compile the final report
    const report: FinalReportOutput = await compileFinalReport(project_id);

    // Persist to dd_reports
    const { data: reportRow, error: insertErr } = await supabaseAdmin
      .from('dd_reports')
      .insert({
        report_type: 'deal_summary_executive',
        prompt_used: `Final DD Report for project ${project_id} (${report.project_name})`,
        evidence_pack: {},
        harvey_response: report as unknown as Record<string, unknown>,
        grounding_score: 0,
        grounding_issues: [],
        status: 'done',
      })
      .select('id, created_at')
      .single();

    if (insertErr) {
      console.error('Failed to persist final report:', insertErr);
      // Still return the report even if persistence fails
      return NextResponse.json({
        success: true,
        report,
        persisted: false,
        persistence_error: insertErr.message,
      });
    }

    return NextResponse.json({
      success: true,
      report,
      persisted: true,
      report_id: reportRow.id,
      created_at: reportRow.created_at,
    });
  } catch (err) {
    console.error('Final Report POST error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
