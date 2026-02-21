import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    let query = supabaseAdmin.from('vdr_acl').select('*').eq('project_id', projectId);
    const folderId = searchParams.get('folder_id');
    if (folderId) query = query.eq('folder_id', folderId);
    const documentId = searchParams.get('document_id');
    if (documentId) query = query.eq('document_id', documentId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, acl: data || [] });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, document_id, folder_id, role, area_code, permission } = body;
        if (!project_id || !role || !permission) return NextResponse.json({ error: 'project_id, role, and permission required' }, { status: 400 });
        if (!document_id && !folder_id) return NextResponse.json({ error: 'document_id or folder_id required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('vdr_acl')
            .insert({ project_id, document_id: document_id || null, folder_id: folder_id || null, role, area_code: area_code || null, permission })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, entry: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const aclId = searchParams.get('id');
    if (!aclId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('vdr_acl').delete().eq('id', aclId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
