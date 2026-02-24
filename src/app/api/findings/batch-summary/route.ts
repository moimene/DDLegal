import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { batchGenerateSummaries } from '@/lib/findings/summary-generator';

/**
 * POST /api/findings/batch-summary
 *
 * Generate summaries for findings that don't have one.
 * Requires can_edit_findings permission on the project (if project_id provided).
 *
 * Body:
 *   - project_id?: string — Limit to a specific project
 *   - limit?: number — Max findings to process (default: 10, max: 50)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectId = body.project_id as string | undefined;
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);

  // Permission check if project_id provided
  if (projectId) {
    const { authorized, error: authError } = await requirePermission(
      req,
      projectId,
      'can_edit_findings'
    );
    if (!authorized) return authError!;
  }

  try {
    const result = await batchGenerateSummaries(projectId, limit);

    return NextResponse.json({
      success: true,
      data: {
        generated: result.generated,
        errors: result.errors,
        message: result.generated > 0
          ? `Generated ${result.generated} summaries`
          : 'No findings without summaries found',
      },
    });
  } catch (error) {
    console.error('[BatchSummary] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}
