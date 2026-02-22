import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  }

  // Permission check — requires can_view_all_areas
  const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_all_areas');
  if (!authorized) return authError!;

  const { data: tasks, error } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();

  const headers = [
    'id',
    'title',
    'state',
    'priority',
    'area_code',
    'assigned_to',
    'due_date',
    'ai_status',
    'hitl_required',
    'entered_state_at',
    'days_in_state',
  ];

  const rows = (tasks || []).map(t => {
    const daysInState = t.entered_state_at
      ? Math.floor((now - new Date(t.entered_state_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return [
      csvEscape(t.id),
      csvEscape(t.title),
      csvEscape(t.state),
      csvEscape(t.priority),
      csvEscape(t.area_code),
      csvEscape(t.assigned_to),
      csvEscape(t.due_date),
      csvEscape(t.ai_status),
      t.hitl_required ? 'true' : 'false',
      csvEscape(t.entered_state_at),
      String(daysInState),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="kanban-export-${projectId}.csv"`,
    },
  });
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
