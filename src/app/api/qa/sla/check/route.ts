import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const now = new Date().toISOString();

    // Find SLAs that are past target but not yet resolved
    const { data: breached, error } = await supabaseAdmin
        .from('qa_slas')
        .select('*, qa_threads!inner(*)')
        .eq('qa_threads.project_id', projectId)
        .is('actual_at', null)
        .lt('target_at', now);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark breached threads
    for (const sla of breached || []) {
        await supabaseAdmin
            .from('qa_slas')
            .update({ is_met: false })
            .eq('id', sla.id)
            .is('is_met', null);

        await supabaseAdmin
            .from('qa_threads')
            .update({ sla_breached: true })
            .eq('id', sla.thread_id);
    }

    return NextResponse.json({
        success: true,
        breached_count: (breached || []).length,
        breached_slas: breached || [],
    });
}
