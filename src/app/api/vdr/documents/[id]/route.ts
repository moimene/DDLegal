import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data: doc, error } = await supabaseAdmin
        .from('vdr_documents')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const { data: versions } = await supabaseAdmin
        .from('vdr_document_versions')
        .select('*')
        .eq('document_id', id)
        .order('version_number', { ascending: false });

    return NextResponse.json({ success: true, document: doc, versions: versions || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const allowedFields = ['name', 'description', 'category', 'status', 'folder_id', 'area_code', 'is_confidential', 'tags', 'approved_by', 'approved_at'];
        const updates: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (key in body) updates[key] = body[key];
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('vdr_documents')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, document: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
        .from('vdr_documents')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, document: data });
}
