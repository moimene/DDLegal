import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    let query = supabaseAdmin.from('vdr_documents').select('*').eq('project_id', projectId);

    const folderId = searchParams.get('folder_id');
    if (folderId) query = query.eq('folder_id', folderId);

    const areaCode = searchParams.get('area_code');
    if (areaCode) query = query.eq('area_code', areaCode);

    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, documents: data || [] });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, folder_id, area_code, name, description, category, is_confidential, tags } = body;
        if (!project_id || !name) return NextResponse.json({ error: 'project_id and name required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('vdr_documents')
            .insert({
                project_id,
                folder_id: folder_id || null,
                area_code: area_code || null,
                name,
                description: description || null,
                category: category || 'general',
                is_confidential: is_confidential || false,
                tags: tags || [],
                status: 'draft',
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, document: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
