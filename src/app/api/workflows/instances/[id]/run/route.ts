import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { runWorkflowInstance } from '@/lib/workflows/instance-runner';

/**
 * POST /api/workflows/instances/[id]/run
 * Executes current phase of a workflow instance, then attempts phase advancement.
 * Body: { input?: Record<string, unknown> }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: instanceId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data: instanceRow, error: lookupErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('project_id')
    .eq('id', instanceId)
    .single();

  if (lookupErr || !instanceRow) {
    return NextResponse.json(
      { success: false, error: `Workflow instance "${instanceId}" not found` },
      { status: 404 },
    );
  }

  const { authorized, error: authError } = await requirePermission(
    req,
    instanceRow.project_id,
    'can_manage_qa',
  );
  if (!authorized) return authError!;

  const result = await runWorkflowInstance({
    instanceId,
    input: (body.input as Record<string, unknown>) ?? {},
  });

  if (!result.success && result.code === 'information_required') {
    return NextResponse.json(result, { status: 409 });
  }

  if (!result.success && result.code === 'execution_error') {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}

