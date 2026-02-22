import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateRedFlagReport } from '@/lib/reporting/red-flag-report-generator';
import type { RedFlagReportOutput } from '@/lib/reporting/red-flag-report-generator';

/**
 * Red Flag Report API
 *
 * GET  /api/reports/red-flags?project_id=xxx
 *   Generate and return a red flag report (not persisted).
 *
 * POST /api/reports/red-flags
 *   Body: { project_id }
 *   Generate, persist to dd_reports, and return the report.
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
    const report: RedFlagReportOutput = await generateRedFlagReport(projectId);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    console.error('Red Flag Report GET error:', err);
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

    // Generate the report
    const report: RedFlagReportOutput = await generateRedFlagReport(project_id);

    // Persist to dd_reports
    const { data: reportRow, error: insertErr } = await supabaseAdmin
      .from('dd_reports')
      .insert({
        report_type: 'red_flags_digest',
        prompt_used: `Red Flag Report for project ${project_id}`,
        evidence_pack: {},
        harvey_response: report as unknown as Record<string, unknown>,
        grounding_score: 0,
        grounding_issues: [],
        status: 'done',
      })
      .select('id, created_at')
      .single();

    if (insertErr) {
      console.error('Failed to persist red flag report:', insertErr);
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
    console.error('Red Flag Report POST error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
