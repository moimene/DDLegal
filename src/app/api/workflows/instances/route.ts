import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import type { WorkflowInstanceStatus } from '@/lib/workflows/template-types';

/**
 * GET /api/workflows/instances?project_id=X&status=in_progress
 * Lists workflow instances for a project.
 * Auth: requirePermission(req, project_id, 'can_view_contingencies')
 *       (proxy for project-level view access)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status') as WorkflowInstanceStatus | null;

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 }
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_view_contingencies'
  );
  if (!authorized) return authError!;

  try {
    let query = supabaseAdmin
      .from('dd_workflow_instances')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, instances: data || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
