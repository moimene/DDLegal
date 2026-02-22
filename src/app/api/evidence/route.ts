import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * List evidence by entity
 * GET /api/evidence?project_id=&task_id=&execution_id=&contingency_id=&source_type=&limit=
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        const taskId = searchParams.get('task_id');
        const executionId = searchParams.get('execution_id');
        const contingencyId = searchParams.get('contingency_id');
        const sourceType = searchParams.get('source_type');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

        // At least one filter required
        if (!projectId && !taskId && !executionId && !contingencyId) {
            return NextResponse.json(
                { error: 'At least one filter required: project_id, task_id, execution_id, or contingency_id' },
                { status: 400 }
            );
        }

        // Permission check
        if (projectId) {
            const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_contingencies');
            if (!authorized) return authError!;
        } else {
            const userId = req.headers.get('x-user-id');
            if (!userId) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        let query = supabase
            .from('dd_evidence')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (taskId) {
            query = query.eq('task_id', taskId);
        }

        if (executionId) {
            query = query.eq('tool_execution_id', executionId);
        }

        if (contingencyId) {
            query = query.eq('contingency_id', contingencyId);
        }

        if (sourceType) {
            query = query.eq('source_type', sourceType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Evidence list error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch evidence' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            evidence: data || [],
            count: data?.length || 0,
        });

    } catch (error) {
        console.error('Evidence API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
