import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // Get project review_depth
    const { data: project } = await supabaseAdmin
        .from('dd_projects')
        .select('review_depth')
        .eq('id', projectId)
        .single();

    const reviewDepth = project?.review_depth || 'standard';

    // Get expected documents filtered by review_depth
    const { data: expected } = await supabaseAdmin
        .from('dd_expected_documents')
        .select('*')
        .or(`review_depth.eq.${reviewDepth},review_depth.is.null,review_depth.eq.standard`)
        .order('sort_order');

    // Get uploaded VDR documents
    const { data: uploaded } = await supabaseAdmin
        .from('vdr_documents')
        .select('*')
        .eq('project_id', projectId)
        .not('status', 'in', '("archived","error")');

    const uploadedKeys = new Set((uploaded || []).map(d => `${d.area_code}:${d.category}`));
    const gaps = (expected || []).filter(e => !uploadedKeys.has(`${e.area_code}:${e.category}`));
    const totalExpected = (expected || []).length;
    const covered = totalExpected - gaps.length;

    return NextResponse.json({
        success: true,
        review_depth: reviewDepth,
        expected: expected || [],
        uploaded: uploaded || [],
        gaps,
        stats: {
            total_expected: totalExpected,
            total_uploaded: (uploaded || []).length,
            gaps_count: gaps.length,
            coverage_pct: totalExpected > 0 ? Math.round((covered / totalExpected) * 100) : 100,
        },
    });
}
