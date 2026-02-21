import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;
  try {
    const [alertsRes, blockersRes, tasksRes, decisionsRes, notifsRes] = await Promise.all([
      supabaseAdmin.from('dd_negotiation_alerts').select('*').eq('project_id', project_id).in('severity', ['critical', 'high']).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('dd_kanban_tasks').select('id, title, area_code, state, entered_state_at, assigned_to').eq('project_id', project_id).eq('state', 'bloqueado').order('entered_state_at', { ascending: true }),
      supabaseAdmin.from('dd_kanban_tasks').select('area_code, state').eq('project_id', project_id),
      supabaseAdmin.from('dd_war_room_decisions').select('*').eq('project_id', project_id).order('decided_at', { ascending: false }).limit(20),
      supabaseAdmin.from('dd_war_room_notifications').select('*').eq('project_id', project_id).eq('is_read', false).order('created_at', { ascending: false }).limit(50),
    ]);

    const tasksByArea: Record<string, { total: number; completed: number; blocked: number }> = {};
    for (const task of tasksRes.data || []) {
      if (!tasksByArea[task.area_code]) tasksByArea[task.area_code] = { total: 0, completed: 0, blocked: 0 };
      tasksByArea[task.area_code].total++;
      if (['conclusion', 'integrado_en_informe'].includes(task.state)) tasksByArea[task.area_code].completed++;
      if (task.state === 'bloqueado') tasksByArea[task.area_code].blocked++;
    }

    const progress = Object.entries(tasksByArea).map(([area_code, stats]) => ({
      area_code, total_tasks: stats.total, completed_tasks: stats.completed, blocked_tasks: stats.blocked,
      pct_complete: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));

    return NextResponse.json({
      success: true, project_id,
      red_flags: (alertsRes.data || []).map(a => ({ id: a.id, title: a.titulo, severity: a.severity, area_code: a.area_code, status: a.status, evidence: a.evidencia || [], recommendation: a.recomendacion })),
      blockers: blockersRes.data || [], progress, decisions: decisionsRes.data || [], notifications: notifsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
