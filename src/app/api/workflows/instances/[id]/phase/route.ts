import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { advancePhase } from '@/lib/workflows/phase-engine';
import type { WorkflowPhase } from '@/lib/workflows/template-types';

/**
 * PATCH /api/workflows/instances/[id]/phase
 * Advances phase on a workflow instance.
 * Body: { phase, dod_checks?, results? }
 * Auth: Looks up instance's project_id, then requirePermission(req, project_id, 'can_manage_qa')
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: instanceId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { phase, dod_checks, results } = body as {
    phase?: WorkflowPhase;
    dod_checks?: Record<string, boolean>;
    results?: Record<string, unknown>;
  };

  if (!phase) {
    return NextResponse.json(
      { success: false, error: 'phase is required' },
      { status: 400 }
    );
  }

  // Look up the instance to find its project_id for auth
  const { data: instanceRow, error: lookupErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('project_id')
    .eq('id', instanceId)
    .single();

  if (lookupErr || !instanceRow) {
    return NextResponse.json(
      { success: false, error: `Workflow instance "${instanceId}" not found` },
      { status: 404 }
    );
  }

  // Permission check using the instance's project_id
  const { authorized, error: authError } = await requirePermission(
    req,
    instanceRow.project_id,
    'can_manage_qa'
  );
  if (!authorized) return authError!;

  try {
    const result = await advancePhase({
      instance_id: instanceId,
      phase,
      dod_checks,
      results,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;

    // Domain errors (not found, status mismatch, phase mismatch)
    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }
    if (
      message.includes('Cannot advance') ||
      message.includes('Phase mismatch')
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
