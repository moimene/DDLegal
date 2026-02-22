import { NextRequest, NextResponse } from 'next/server';
import { loadAllTemplates } from '@/lib/workflows/template-loader';

/**
 * GET /api/workflows/templates
 * Lists all active published workflow templates.
 * No project-level permission needed -- templates are global.
 * Auth: just verify the x-user-id header exists (user is logged in).
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const templates = await loadAllTemplates();

    return NextResponse.json({ success: true, templates });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
