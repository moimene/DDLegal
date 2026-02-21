import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
        .from('vdr_document_versions')
        .select('*')
        .eq('document_id', id)
        .order('version_number', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, versions: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { original_filename, file_type, file_size_bytes, storage_path, checksum_sha256, change_notes, uploaded_by } = body;
        if (!original_filename || !file_type || !storage_path) {
            return NextResponse.json({ error: 'original_filename, file_type, and storage_path required' }, { status: 400 });
        }

        // Get next version number
        const { data: latest } = await supabaseAdmin
            .from('vdr_document_versions')
            .select('version_number')
            .eq('document_id', id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        const nextVersion = (latest?.version_number || 0) + 1;

        const { data, error } = await supabaseAdmin
            .from('vdr_document_versions')
            .insert({
                document_id: id,
                version_number: nextVersion,
                original_filename,
                file_type,
                file_size_bytes: file_size_bytes || 0,
                storage_path,
                checksum_sha256: checksum_sha256 || null,
                change_notes: change_notes || null,
                uploaded_by: uploaded_by || null,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Update document status to uploaded
        await supabaseAdmin
            .from('vdr_documents')
            .update({ status: 'uploaded', updated_at: new Date().toISOString() })
            .eq('id', id);

        return NextResponse.json({ success: true, version: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
