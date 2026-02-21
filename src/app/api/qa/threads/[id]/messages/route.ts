import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
        .from('qa_messages')
        .select('*')
        .eq('thread_id', id)
        .order('created_at');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, messages: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { sender_role, sender_id, content, attachments, is_internal } = body;
        if (!sender_role || !content) return NextResponse.json({ error: 'sender_role and content required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('qa_messages')
            .insert({
                thread_id: id,
                sender_role,
                sender_id: sender_id || null,
                content,
                attachments: attachments || [],
                is_internal: is_internal || false,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Update thread status based on sender
        const statusUpdate = sender_role === 'target' ? 'answered' : sender_role === 'advisor' ? 'sent' : undefined;
        if (statusUpdate) {
            await supabaseAdmin
                .from('qa_threads')
                .update({ status: statusUpdate, updated_at: new Date().toISOString() })
                .eq('id', id);
        }

        return NextResponse.json({ success: true, message: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
