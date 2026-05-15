import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, projectId, 'can_manage_qa');
    if (!authorized) return authError!;

    const now = new Date().toISOString();

    // Find SLAs that are past target but not yet resolved
    const { data: breached, error } = await supabaseAdmin
        .from('qa_slas')
        .select('*, qa_threads!inner(*)')
        .eq('qa_threads.project_id', projectId)
        .is('actual_at', null)
        .lt('target_at', now);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark breached threads (Optimized: N+1 to 2 queries)
    if (breached && breached.length > 0) {
        const slaIds = breached.map(sla => sla.id);
        const threadIds = [...new Set(breached.map(sla => sla.thread_id))];

        await Promise.all([
            supabaseAdmin
                .from('qa_slas')
                .update({ is_met: false })
                .in('id', slaIds)
                .is('is_met', null),
            supabaseAdmin
                .from('qa_threads')
                .update({ sla_breached: true })
                .in('id', threadIds)
        ]);
    }

    return NextResponse.json({
        success: true,
        breached_count: (breached || []).length,
        breached_slas: breached || [],
    });
}
