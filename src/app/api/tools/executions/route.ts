import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * List tool executions with optional filters
 * GET /api/tools/executions?tool_slug=&project_id=&status=&limit=
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const toolSlug = searchParams.get('tool_slug');
        const projectId = searchParams.get('project_id');
        const status = searchParams.get('status');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

        let query = supabase
            .from('dd_tool_executions')
            .select(`
                *,
                dd_tools!inner ( slug, name, icon, area_codes )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (toolSlug) {
            query = query.eq('dd_tools.slug', toolSlug);
        }

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Executions list error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch executions' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            executions: data || [],
            count: data?.length || 0,
        });

    } catch (error) {
        console.error('Executions API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
