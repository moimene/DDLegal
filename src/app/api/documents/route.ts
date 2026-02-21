import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
        return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    // Read from compatibility view (VDR v2 data in legacy format)
    // Falls back to dd_documents if view doesn't exist yet
    let documents;
    const { data: compatData, error: compatErr } = await supabaseAdmin
        .from('dd_documents_compat')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (compatErr) {
        // Fallback to original table if view not yet created
        const { data: fallbackData, error: fallbackErr } = await supabaseAdmin
            .from('dd_documents')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (fallbackErr) {
            return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
        }
        documents = fallbackData;
    } else {
        documents = compatData;
    }

    // Get expected documents for gap analysis
    const { data: expected } = await supabaseAdmin
        .from('dd_expected_documents')
        .select('*')
        .order('sort_order');

    // Build gap list
    const uploadedCategories = new Set((documents || []).map((d: Record<string, unknown>) => `${d.area_code}:${d.category}`));
    const gaps = (expected || []).filter((e: Record<string, unknown>) => !uploadedCategories.has(`${e.area_code}:${e.category}`));

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
    // Redirect new uploads to VDR v2 API
    try {
        const body = await req.json();
        const { project_id, area_code, name, original_filename, file_type, file_size_bytes, storage_path, category } = body;

        if (!project_id || !name || !original_filename || !file_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create in VDR v2 instead of legacy dd_documents
        const { data: doc, error: docErr } = await supabaseAdmin
            .from('vdr_documents')
            .insert({
                project_id,
                area_code: area_code || null,
                name,
                category: category || 'general',
                status: 'uploaded',
            })
            .select()
            .single();

        if (docErr) {
            // Fallback to legacy table if VDR v2 tables don't exist yet
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

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, document: data });
        }

        // Create version 1
        await supabaseAdmin.from('vdr_document_versions').insert({
            document_id: doc.id,
            version_number: 1,
            original_filename,
            file_type,
            file_size_bytes: file_size_bytes || 0,
            storage_path: storage_path || `projects/${project_id}/${Date.now()}_${original_filename}`,
        });

        return NextResponse.json({ success: true, document: doc });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
