import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data: thread, error } = await supabaseAdmin
        .from('qa_threads')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, thread.project_id, 'can_respond_qa');
    if (!authorized) return authError!;

    const { data: messages } = await supabaseAdmin
        .from('qa_messages')
        .select('*')
        .eq('thread_id', id)
        .order('created_at');

    const { data: slas } = await supabaseAdmin
        .from('qa_slas')
        .select('*')
        .eq('thread_id', id);

    const { data: links } = await supabaseAdmin
        .from('qa_links')
        .select('*')
        .eq('thread_id', id);

    return NextResponse.json({ success: true, thread, messages: messages || [], slas: slas || [], links: links || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        // Fetch thread to get project_id for permission check
        const { data: thread } = await supabaseAdmin
            .from('qa_threads')
            .select('project_id')
            .eq('id', id)
            .single();
        if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, thread.project_id, 'can_manage_qa');
        if (!authorized) return authError!;

        const body = await req.json();
        const allowedFields = ['status', 'priority', 'assigned_to', 'due_date', 'sla_hours', 'sla_breached', 'client_visible', 'tags'];
        const updates: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (key in body) updates[key] = body[key];
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('qa_threads')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, thread: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
