import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function POST(req: NextRequest, { params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;
  const userId = req.headers.get('x-user-id');

  // Permission check
  const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_war_room');
  if (!authorized) return authError!;

  try {
    const body = await req.json();
    const { decision_type, title, rationale, contingency_id, alert_id, evidence_refs, client_visible } = body;
    if (!decision_type || !title) return NextResponse.json({ success: false, error: 'decision_type and title required' }, { status: 400 });
    const validTypes = ['accept_risk', 'mitigate', 'transfer', 'reject', 'defer', 'escalate'];
    if (!validTypes.includes(decision_type)) return NextResponse.json({ success: false, error: `decision_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });

    const { data, error } = await supabaseAdmin.from('dd_war_room_decisions').insert({
      project_id, decision_type, title, rationale: rationale || null,
      contingency_id: contingency_id || null, alert_id: alert_id || null,
      evidence_refs: evidence_refs || [], decided_by: userId || null, client_visible: client_visible ?? false,
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, decision: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;

  // Permission check
  const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_war_room');
  if (!authorized) return authError!;

  const { data, error } = await supabaseAdmin.from('dd_war_room_decisions').select('*').eq('project_id', project_id).order('decided_at', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, decisions: data || [] });
}
