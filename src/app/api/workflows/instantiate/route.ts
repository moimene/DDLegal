import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { instantiateWorkflow } from '@/lib/workflows/instantiate';

/**
 * POST /api/workflows/instantiate
 * Creates a workflow instance on a project from a template.
 * Body: { project_id, template_key, overrides?, initiated_by? }
 * Auth: requirePermission(req, project_id, 'can_manage_qa')
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { project_id, template_key, overrides, initiated_by } = body as {
    project_id?: string;
    template_key?: string;
    overrides?: Record<string, unknown>;
    initiated_by?: string;
  };

  if (!project_id || !template_key) {
    return NextResponse.json(
      { success: false, error: 'project_id and template_key are required' },
      { status: 400 }
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_manage_qa'
  );
  if (!authorized) return authError!;

  try {
    const result = await instantiateWorkflow({
      project_id,
      template_key,
      overrides,
      initiated_by,
    });

    return NextResponse.json({
      success: true,
      instance: result.instance,
      task_groups: result.task_groups,
      kanban_tasks_created: result.kanban_tasks_created,
    });
  } catch (err) {
    const message = (err as Error).message;

    // Feature flag or template not found are client errors
    if (
      message.includes('not enabled') ||
      message.includes('not found') ||
      message.includes('no phases defined')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
