import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  }

  // Project membership check — user must have ANY active role on this project
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { data: roleData } = await supabaseAdmin
    .from('dd_project_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single();
  if (!roleData) {
    return NextResponse.json({ success: false, error: 'No role on project' }, { status: 403 });
  }

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
