import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { semanticSearch } from '@/lib/vdr/semantic-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, query, threshold, limit, area_code } = body;
    if (!project_id || !query) return NextResponse.json({ success: false, error: 'project_id and query required' }, { status: 400 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_contingencies');
    if (!authorized) return authError!;

    const results = await semanticSearch(project_id, query, { threshold: threshold ?? 0.7, limit: limit ?? 10, areaCode: area_code });
    return NextResponse.json({ success: true, results, count: results.length });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
