import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

// ---------------------------------------------------------------------------
// DoR criterion checks
// ---------------------------------------------------------------------------

interface DorCriterion {
  check: string;
  required: boolean;
}

interface TaskRecord {
  description?: string | null;
  evidence_refs?: string[] | null;
  assigned_to?: string | null;
  due_date?: string | null;
  reviewer?: string | null;
  ai_status?: string | null;
  hitl_required?: boolean;
  hitl_decision?: string | null;
  [key: string]: unknown;
}

function evaluateCriterion(check: string, task: TaskRecord): boolean {
  switch (check) {
    case 'has_description':
      return !!task.description && task.description.trim().length > 0;
    case 'has_evidence':
      return Array.isArray(task.evidence_refs) && task.evidence_refs.length > 0;
    case 'has_assignment':
      return task.assigned_to != null;
    case 'has_due_date':
      return task.due_date != null;
    case 'has_reviewer':
      return task.reviewer != null;
    case 'ai_completed':
      return task.ai_status === 'done';
    case 'hitl_decided':
      return !task.hitl_required || task.hitl_decision != null;
    default:
      // Unknown criterion — treat as passing to avoid blocking on misconfiguration
      return true;
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/kanban/tasks/[id]/move
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { target_state, force } = body;

  if (!target_state) {
    return NextResponse.json({ success: false, error: 'target_state required' }, { status: 400 });
  }

  // Fetch the task
  const { data: task, error: fetchErr } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(req, task.project_id, 'can_edit_tasks');
  if (!authorized) return authError!;

  // Fetch target column config (WIP limit + DoR criteria)
  const { data: config } = await supabaseAdmin
    .from('dd_kanban_config')
    .select('wip_limit, dor_criteria')
    .eq('project_id', task.project_id)
    .eq('column_state', target_state)
    .single();

  // --- WIP limit check ---
  if (config && config.wip_limit > 0) {
    const { count } = await supabaseAdmin
      .from('dd_kanban_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', task.project_id)
      .eq('state', target_state);

    if ((count || 0) >= config.wip_limit) {
      return NextResponse.json({
        success: false,
        error: `WIP limit reached for ${target_state} (limit: ${config.wip_limit})`,
      }, { status: 409 });
    }
  }

  // --- DoR validation (skip if force === true) ---
  if (!force && config?.dor_criteria) {
    const criteria: DorCriterion[] = Array.isArray(config.dor_criteria)
      ? config.dor_criteria
      : [];

    const unmet: string[] = [];
    for (const criterion of criteria) {
      if (criterion.required && !evaluateCriterion(criterion.check, task as TaskRecord)) {
        unmet.push(criterion.check);
      }
    }

    if (unmet.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'DoR criteria not met for target state',
        unmet_criteria: unmet,
      }, { status: 422 });
    }
  }

  // --- Perform the move ---
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .update({ state: target_state })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, task: updated });
}
