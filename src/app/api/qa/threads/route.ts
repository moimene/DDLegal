import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, projectId, 'can_respond_qa');
    if (!authorized) return authError!;

    let query = supabaseAdmin.from('qa_threads').select('*').eq('project_id', projectId);

    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);
    const priority = searchParams.get('priority');
    if (priority) query = query.eq('priority', priority);
    const areaCode = searchParams.get('area_code');
    if (areaCode) query = query.eq('area_code', areaCode);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, threads: data || [] });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, area_code, subject, priority, source, assigned_to, due_date, sla_hours, client_visible, related_task_id, related_contingency_id, tags, created_by } = body;
        if (!project_id || !subject) return NextResponse.json({ error: 'project_id and subject required' }, { status: 400 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, project_id, 'can_manage_qa');
        if (!authorized) return authError!;

        const { data, error } = await supabaseAdmin
            .from('qa_threads')
            .insert({
                project_id,
                area_code: area_code || null,
                subject,
                priority: priority || 'medium',
                status: 'draft',
                source: source || 'manual',
                assigned_to: assigned_to || null,
                due_date: due_date || null,
                sla_hours: sla_hours || null,
                client_visible: client_visible || false,
                related_task_id: related_task_id || null,
                related_contingency_id: related_contingency_id || null,
                tags: tags || [],
                created_by: created_by || null,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Create SLA tracking if sla_hours specified
        if (sla_hours && data) {
            const targetAt = new Date(Date.now() + sla_hours * 3600 * 1000).toISOString();
            await supabaseAdmin.from('qa_slas').insert({
                thread_id: data.id,
                sla_type: 'response',
                target_at: targetAt,
            });
        }

        return NextResponse.json({ success: true, thread: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
