import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// GET — Return the unread notification count for a project
//
// This performs quick counts across the main activity sources from the last
// 24 hours so the bell badge stays responsive.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
    // Verify authenticated user
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) {
        return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let count = 0;

    try {
        // Tool executions completed/error in the last 24h
        const { count: execCount } = await supabaseAdmin
            .from('dd_tool_executions')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', since)
            .in('status', ['completed', 'error']);
        count += execCount ?? 0;

        // New VDR documents in the last 24h
        const { count: docCount } = await supabaseAdmin
            .from('vdr_documents')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', since);
        count += docCount ?? 0;

        // QA threads updated in the last 24h
        const { count: qaCount } = await supabaseAdmin
            .from('qa_threads')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('updated_at', since);
        count += qaCount ?? 0;

        // Tasks needing HITL review
        const { count: hitlCount } = await supabaseAdmin
            .from('dd_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('ai_status', 'completed')
            .is('hitl_reviewed_at', null)
            .gte('updated_at', since);
        count += hitlCount ?? 0;

        return NextResponse.json({ count });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
