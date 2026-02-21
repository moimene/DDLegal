import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('qa_assignments')
        .select('*')
        .eq('project_id', projectId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, assignments: data || [] });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, area_code, default_assignee, sla_hours, escalation_after_hours, escalation_to } = body;
        if (!project_id || !area_code) return NextResponse.json({ error: 'project_id and area_code required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('qa_assignments')
            .upsert({
                project_id,
                area_code,
                default_assignee: default_assignee || null,
                sla_hours: sla_hours || 48,
                escalation_after_hours: escalation_after_hours || 72,
                escalation_to: escalation_to || null,
            }, { onConflict: 'project_id,area_code' })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, assignment: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('qa_assignments')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, assignment: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
