import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_contingencies');
  if (!authorized) return authError!;

  const [tasksRes, configRes] = await Promise.all([
    supabaseAdmin
      .from('dd_kanban_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('dd_kanban_config')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);

  if (tasksRes.error) {
    return NextResponse.json({ success: false, error: tasksRes.error.message }, { status: 500 });
  }

  const columns: Record<string, typeof tasksRes.data> = {};
  for (const task of tasksRes.data || []) {
    if (!columns[task.state]) columns[task.state] = [];
    columns[task.state].push(task);
  }

  const board = (configRes.data || []).map(col => ({
    state: col.column_state,
    wip_limit: col.wip_limit,
    dor_criteria: col.dor_criteria,
    dod_criteria: col.dod_criteria,
    tasks: columns[col.column_state] || [],
    task_count: (columns[col.column_state] || []).length,
    wip_exceeded: col.wip_limit > 0 && (columns[col.column_state] || []).length > col.wip_limit,
  }));

  return NextResponse.json({ success: true, board });
}
