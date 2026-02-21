import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { thread_id, entity_type, entity_id, link_type } = body;
        if (!thread_id || !entity_type || !entity_id) {
            return NextResponse.json({ error: 'thread_id, entity_type, and entity_id required' }, { status: 400 });
        }

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

    const { error } = await supabaseAdmin.from('qa_links').delete().eq('id', linkId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
