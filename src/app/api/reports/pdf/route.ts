import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * GET /api/reports/pdf?report_version_id=UUID&project_id=UUID
 *
 * Generates a PDF from a cached HTML report version using Puppeteer.
 * On-demand: HTML is already rendered and stored in dd_report_versions.
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

  // Load HTML content from report version
  const { data: version, error } = await supabaseAdmin
    .from('dd_report_versions')
    .select('html_content, report_type, project_id, version')
    .eq('id', reportVersionId)
    .eq('project_id', projectId)
    .single();

  if (error || !version) {
    return NextResponse.json(
      { success: false, error: 'Report version not found' },
      { status: 404 },
    );
  }

  if (!version.html_content) {
    return NextResponse.json(
      { success: false, error: 'Report version has no HTML content for PDF generation' },
      { status: 422 },
    );
  }

  // Dynamic import puppeteer to keep it server-side only
  // puppeteer is an optional peer dependency — installed at deploy time
  let pdfBytes: ArrayBuffer;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
    const puppeteer = require('puppeteer') as any;
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(version.html_content, {
        waitUntil: 'networkidle0',
        timeout: 30_000,
      });

      const result = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
        scale: 0.95,
      });

      // Convert to ArrayBuffer for NextResponse compatibility
      const uint8 = new Uint8Array(result);
      pdfBytes = uint8.buffer as ArrayBuffer;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[pdf] Puppeteer error:', err);
    return NextResponse.json(
      { success: false, error: 'PDF generation failed. Puppeteer may not be available.' },
      { status: 500 },
    );
  }

  const sanitizedType = version.report_type.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedType}_v${version.version}.pdf`;

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
