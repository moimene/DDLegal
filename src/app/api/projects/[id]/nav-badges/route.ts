import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    const [vdrRes, expectedRes, hitlRes, redFlagsRes] = await Promise.all([
        supabaseAdmin
            .from('vdr_documents')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
        supabaseAdmin
            .from('dd_expected_documents')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
        supabaseAdmin
            .from('dd_kanban_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('state', 'hitl_revision'),
        supabaseAdmin
            .from('dd_contingencies')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .in('severity', ['critical', 'high']),
    ]);

    const pendingDocs = Math.max(
        (expectedRes.count || 0) - (vdrRes.count || 0),
        0
    );

    return NextResponse.json({
        pending_docs: pendingDocs,
        pending_hitl: hitlRes.count || 0,
        red_flags: redFlagsRes.count || 0,
    });
}
