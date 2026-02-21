import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  }

  const { data: tasks } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select('state, entered_state_at, area_code, hitl_required, ai_status')
    .eq('project_id', projectId);

  if (!tasks) {
    return NextResponse.json({ success: true, metrics: {} });
  }

  const now = Date.now();
  const aging = tasks.map(t => ({
    state: t.state,
    area_code: t.area_code,
    days_in_state: Math.floor((now - new Date(t.entered_state_at).getTime()) / (1000 * 60 * 60 * 24)),
    hitl_required: t.hitl_required,
    ai_status: t.ai_status,
  }));

  const stale = aging.filter(a => a.days_in_state > 3);

  const byState: Record<string, number> = {};
  for (const t of tasks) {
    byState[t.state] = (byState[t.state] || 0) + 1;
  }

  const byArea: Record<string, number> = {};
  for (const t of tasks) {
    byArea[t.area_code] = (byArea[t.area_code] || 0) + 1;
  }

  return NextResponse.json({
    success: true,
    metrics: {
      total_tasks: tasks.length,
      by_state: byState,
      by_area: byArea,
      stale_tasks: stale.length,
      stale_details: stale,
      hitl_pending: tasks.filter(t => t.hitl_required && t.state === 'hitl_revision').length,
      ai_running: tasks.filter(t => t.ai_status === 'running').length,
    },
  });
}
