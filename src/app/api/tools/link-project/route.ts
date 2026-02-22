import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Link a tool execution to a DD project
 * POST /api/tools/link-project
 * Body: { execution_id, project_id, notes? }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { execution_id, project_id, notes } = body;

        if (!execution_id || !project_id) {
            return NextResponse.json(
                { error: 'execution_id and project_id are required' },
                { status: 400 }
            );
        }

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, project_id, 'can_edit_tasks');
        if (!authorized) return authError!;

        // Verify execution exists
        const { data: execution } = await supabaseAdmin
            .from('dd_tool_executions')
            .select('id, status')
            .eq('id', execution_id)
            .single();

        if (!execution) {
            return NextResponse.json(
                { error: 'Execution not found' },
                { status: 404 }
            );
        }

        // Verify project exists
        const { data: project } = await supabaseAdmin
            .from('dd_projects')
            .select('id, name')
            .eq('id', project_id)
            .single();

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Create the link (upsert to avoid duplicates)
        const { data: link, error } = await supabaseAdmin
            .from('dd_tool_project_links')
            .upsert({
                tool_execution_id: execution_id,
                project_id,
                linked_by: 'manual',
                notes: notes || null,
            }, { onConflict: 'tool_execution_id,project_id' })
            .select()
            .single();

        if (error) {
            console.error('Link project error:', error);
            return NextResponse.json(
                { error: 'Failed to link execution to project' },
                { status: 500 }
            );
        }

        // Also update any evidence from this execution to include the project
        await supabaseAdmin
            .from('dd_evidence')
            .update({ project_id })
            .eq('tool_execution_id', execution_id)
            .is('project_id', null);

        return NextResponse.json({
            success: true,
            link,
            project_name: project.name,
        });

    } catch (error) {
        console.error('Link project API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
