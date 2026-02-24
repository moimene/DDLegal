import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  getProjectFindings,
  getProjectFindingsSummary,
  type FindingStatus,
} from '@/lib/findings/findings-service';

// ---------------------------------------------------------------------------
// GET /api/findings?project_id=...&tier=1,2&status=identified,validated&area_code=MERC&summary=true
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_view_findings',
  );
  if (!authorized) return authError!;

  // Summary mode: return aggregated metrics
  const isSummary = searchParams.get('summary') === 'true';
  if (isSummary) {
    const summary = await getProjectFindingsSummary(projectId);
    return NextResponse.json({ success: true, data: summary });
  }

  // List mode: return paginated findings
  const tierParam = searchParams.get('tier');
  const statusParam = searchParams.get('status');
  const areaCode = searchParams.get('area_code');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const findings = await getProjectFindings(projectId, {
    tier: tierParam ? tierParam.split(',').map(Number).filter(n => [1, 2, 3].includes(n)) : undefined,
    status: statusParam ? statusParam.split(',') as FindingStatus[] : undefined,
    area_code: areaCode || undefined,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: findings,
    pagination: { limit, offset, count: findings.length },
  });
}
