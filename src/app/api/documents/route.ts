import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
        return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    // Get uploaded documents
    const { data: documents, error: docErr } = await supabaseAdmin
        .from('dd_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    // Get expected documents for gap analysis
    const { data: expected, error: expErr } = await supabaseAdmin
        .from('dd_expected_documents')
        .select('*')
        .order('sort_order');

    if (docErr) {
        return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    // Build gap list: expected docs not yet uploaded
    const uploadedCategories = new Set((documents || []).map(d => `${d.area_code}:${d.category}`));
    const gaps = (expected || []).filter(e => !uploadedCategories.has(`${e.area_code}:${e.category}`));

    return NextResponse.json({
        success: true,
        documents: documents || [],
        expected: expected || [],
        gaps,
        stats: {
            total_uploaded: (documents || []).length,
            total_expected: (expected || []).length,
            gaps_count: gaps.length,
            coverage_pct: (expected || []).length > 0
                ? Math.round(((expected || []).length - gaps.length) / (expected || []).length * 100)
                : 100,
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, area_code, name, original_filename, file_type, file_size_bytes, storage_path, category } = body;

        if (!project_id || !name || !original_filename || !file_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('dd_documents')
            .insert({
                project_id,
                area_code: area_code || null,
                name,
                original_filename,
                file_type,
                file_size_bytes: file_size_bytes || 0,
                storage_path: storage_path || null,
                category: category || 'general',
                status: 'uploaded',
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, document: data });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
