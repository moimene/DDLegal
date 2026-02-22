import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

// ---------------------------------------------------------------------------
// GET /api/kanban/config?project_id=...
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  }

  // Permission check — any user who can view the board can read config
  const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_contingencies');
  if (!authorized) return authError!;

  const { data, error } = await supabaseAdmin
    .from('dd_kanban_config')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, config: data });
}

// ---------------------------------------------------------------------------
// PUT /api/kanban/config
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { project_id, column_state, wip_limit, dor_criteria, dod_criteria } = body;

  if (!project_id || !column_state) {
    return NextResponse.json(
      { success: false, error: 'project_id and column_state required' },
      { status: 400 },
    );
  }

  // Permission check — only roles with can_manage_roles may update config
  const { authorized, error: authError } = await requirePermission(req, project_id, 'can_manage_roles');
  if (!authorized) return authError!;

  // Build the update payload with only the fields that were provided
  const updates: Record<string, unknown> = {};
  if (wip_limit !== undefined) updates.wip_limit = wip_limit;
  if (dor_criteria !== undefined) updates.dor_criteria = dor_criteria;
  if (dod_criteria !== undefined) updates.dod_criteria = dod_criteria;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No fields to update. Provide wip_limit, dor_criteria, or dod_criteria.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('dd_kanban_config')
    .update(updates)
    .eq('project_id', project_id)
    .eq('column_state', column_state)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: `Config not found for column_state "${column_state}"` },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, config: data });
}
