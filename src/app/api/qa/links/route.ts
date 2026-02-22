import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { thread_id, entity_type, entity_id, link_type } = body;
        if (!thread_id || !entity_type || !entity_id) {
            return NextResponse.json({ error: 'thread_id, entity_type, and entity_id required' }, { status: 400 });
        }

        // Fetch thread to get project_id for permission check
        const { data: thread } = await supabaseAdmin
            .from('qa_threads')
            .select('project_id')
            .eq('id', thread_id)
            .single();
        if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, thread.project_id, 'can_manage_qa');
        if (!authorized) return authError!;

        const { data, error } = await supabaseAdmin
            .from('qa_links')
            .insert({
                thread_id,
                entity_type,
                entity_id,
                link_type: link_type || 'related',
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, link: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('id');
    if (!linkId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Fetch link to get thread_id, then thread to get project_id for permission check
    const { data: link } = await supabaseAdmin
        .from('qa_links')
        .select('thread_id')
        .eq('id', linkId)
        .single();
    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    const { data: thread } = await supabaseAdmin
        .from('qa_threads')
        .select('project_id')
        .eq('id', link.thread_id)
        .single();
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, thread.project_id, 'can_manage_qa');
    if (!authorized) return authError!;

    const { error } = await supabaseAdmin.from('qa_links').delete().eq('id', linkId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
