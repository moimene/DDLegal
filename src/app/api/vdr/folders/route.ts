import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('vdr_folders')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, folders: data || [] });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, parent_id, name, area_code, sort_order } = body;
        if (!project_id || !name) return NextResponse.json({ error: 'project_id and name required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('vdr_folders')
            .insert({ project_id, parent_id: parent_id || null, name, area_code: area_code || null, sort_order: sort_order || 0 })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, folder: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
