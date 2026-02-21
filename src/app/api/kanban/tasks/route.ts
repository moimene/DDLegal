import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, area_code, title, description, priority, assigned_to, workflow_key, skill_key } = body;

  if (!project_id || !area_code || !title) {
    return NextResponse.json({ success: false, error: 'project_id, area_code, title required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .insert({
      project_id,
      area_code,
      title,
      description: description || null,
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
      state: 'backlog',
      workflow_key: workflow_key || null,
      skill_key: skill_key || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, task: data }, { status: 201 });
}
