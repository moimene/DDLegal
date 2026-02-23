import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * GET /api/reports/md?report_version_id=UUID&project_id=UUID
 *
 * Downloads the markdown content of a report version.
 * Markdown is pre-generated alongside HTML in dd_report_render.
 * Useful for external formatting into .doc / .pptx.
 */
export async function GET(request: NextRequest) {
  const reportVersionId = request.nextUrl.searchParams.get('report_version_id');
  const projectId = request.nextUrl.searchParams.get('project_id');

  if (!reportVersionId) {
    return NextResponse.json(
      { success: false, error: 'report_version_id query parameter is required' },
      { status: 400 },
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 },
    );
  }

  // Auth check
  const auth = await requirePermission(request, projectId, 'can_view_reports');
  if (!auth.authorized) return auth.error!;

  // Load markdown content from report version
  const { data: version, error } = await supabaseAdmin
    .from('dd_report_versions')
    .select('md_content, report_type, version, project_id')
    .eq('id', reportVersionId)
    .eq('project_id', projectId)
    .single();

  if (error || !version) {
    return NextResponse.json(
      { success: false, error: 'Report version not found' },
      { status: 404 },
    );
  }

  if (!version.md_content) {
    return NextResponse.json(
      { success: false, error: 'Report version has no markdown content' },
      { status: 422 },
    );
  }

  const sanitizedType = version.report_type.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedType}_v${version.version}.md`;

  return new NextResponse(version.md_content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
