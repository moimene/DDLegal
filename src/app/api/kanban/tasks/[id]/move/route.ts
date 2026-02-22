import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target_state } = await req.json();

  if (!target_state) {
    return NextResponse.json({ success: false, error: 'target_state required' }, { status: 400 });
  }

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

  const { data: config } = await supabaseAdmin
    .from('dd_kanban_config')
    .select('wip_limit')
    .eq('project_id', task.project_id)
    .eq('column_state', target_state)
    .single();

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
