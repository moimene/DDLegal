import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { runWorkflowInstance } from '@/lib/workflows/instance-runner';

/**
 * POST /api/workflows/instances/run-batch
 * Executes multiple workflow instances in parallel.
 * Body: {
 *   project_id: string,
 *   instance_ids: string[],
 *   inputs_by_instance?: Record<instance_id, Record<string, unknown>>
 * }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const {
    project_id,
    instance_ids,
    inputs_by_instance,
  } = body as {
    project_id?: string;
    instance_ids?: string[];
    inputs_by_instance?: Record<string, Record<string, unknown>>;
  };

  if (!project_id || !Array.isArray(instance_ids) || instance_ids.length === 0) {
    return NextResponse.json(
      { success: false, error: 'project_id and non-empty instance_ids[] are required' },
      { status: 400 },
    );
  }

  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_manage_qa',
  );
  if (!authorized) return authError!;

  const { data: instanceRows, error: rowsErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('id')
    .eq('project_id', project_id)
    .in('id', instance_ids);

  if (rowsErr) {
    return NextResponse.json(
      { success: false, error: rowsErr.message },
      { status: 500 },
    );
  }

  const foundIds = new Set((instanceRows ?? []).map((r) => r.id));
  const missingIds = instance_ids.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Some instances were not found in the provided project',
        missing_instance_ids: missingIds,
      },
      { status: 400 },
    );
  }

  const settled = await Promise.allSettled(
    instance_ids.map((instanceId) =>
      runWorkflowInstance({
        instanceId,
        input: inputs_by_instance?.[instanceId] ?? {},
      }),
    ),
  );

  const results = settled.map((entry, index) => {
    const instanceId = instance_ids[index];
    if (entry.status === 'fulfilled') {
      return {
        instance_id: instanceId,
        ...entry.value,
      };
    }
    return {
      instance_id: instanceId,
      success: false,
      code: 'execution_error',
      message: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    };
  });

  return NextResponse.json({
    success: true,
    total: results.length,
    completed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}

