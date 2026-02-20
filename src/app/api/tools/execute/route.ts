import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Execute a microtool
 * POST /api/tools/execute
 * Body: { tool_slug, params: { ... }, project_id? }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tool_slug, params, project_id } = body;

        if (!tool_slug || !params) {
            return NextResponse.json(
                { error: 'tool_slug and params are required' },
                { status: 400 }
            );
        }

        // 1. Look up the tool
        const { data: tool, error: toolErr } = await supabaseAdmin
            .from('dd_tools')
            .select('*')
            .eq('slug', tool_slug)
            .eq('is_active', true)
            .single();

        if (toolErr || !tool) {
            return NextResponse.json(
                { error: `Tool "${tool_slug}" not found or inactive` },
                { status: 404 }
            );
        }

        if (tool.requires_project && !project_id) {
            return NextResponse.json(
                { error: 'This tool requires a project_id' },
                { status: 400 }
            );
        }

        // 2. Create execution record
        const { data: execution, error: execErr } = await supabaseAdmin
            .from('dd_tool_executions')
            .insert({
                tool_id: tool.id,
                project_id: project_id || null,
                input_params: params,
                status: 'pending',
                executed_by: 'system',
            })
            .select()
            .single();

        if (execErr || !execution) {
            console.error('Failed to create execution:', execErr);
            return NextResponse.json(
                { error: 'Failed to create execution record' },
                { status: 500 }
            );
        }

        // 3. Look up matching skills for enriched context
        const skillKeys = tool.skills_used || [];
        let skills: Array<{
            skill_key: string;
            prompt_template: string;
            expected_output_schema: Record<string, unknown> | null;
            evidence_requirements: unknown;
            agent_pipeline: string[] | null;
        }> = [];

        if (skillKeys.length > 0) {
            const { data: skillData } = await supabaseAdmin
                .from('dd_skills_catalog')
                .select('skill_key, prompt_template, expected_output_schema, evidence_requirements, agent_pipeline')
                .in('skill_key', skillKeys)
                .eq('is_active', true);

            skills = skillData || [];
        }

        // 4. Mark as running
        await supabaseAdmin
            .from('dd_tool_executions')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', execution.id);

        // 5. Build enriched payload for n8n
        const enrichedParams = { ...params };
        const skillPrompts = skills.map(s => ({
            skill_key: s.skill_key,
            prompt: s.prompt_template,
            output_schema: s.expected_output_schema,
            evidence_requirements: s.evidence_requirements,
            pipeline: s.agent_pipeline,
        }));

        // 6. Call n8n webhook
        const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
        let result: Record<string, unknown> = {};
        let evidenceItems: Array<{
            source_type: string;
            source_reference: string;
            source_name?: string;
            page_range?: string;
            snippet?: string;
            snippet_hash?: string;
            confidence_score?: number;
        }> = [];

        if (n8nUrl) {
            try {
                const n8nResp = await fetch(`${n8nUrl}/dd-tool-${tool_slug}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        execution_id: execution.id,
                        tool_slug,
                        params: enrichedParams,
                        skills: skillPrompts,
                        project_id,
                    }),
                });

                if (n8nResp.ok) {
                    const data = await n8nResp.json();
                    result = data.output || data;
                    evidenceItems = data.evidence || [];
                } else {
                    result = {
                        status: 'error',
                        message: `n8n returned ${n8nResp.status}`,
                    };
                }
            } catch {
                result = {
                    status: 'queued',
                    message: 'n8n webhook not reachable. Execution stored for retry.',
                    params: enrichedParams,
                    skills: skillPrompts,
                };
            }
        } else {
            // No n8n configured — store for later
            result = {
                status: 'queued',
                message: 'n8n not configured. Execution stored.',
                params: enrichedParams,
                skills: skillPrompts,
            };
        }

        // 7. Update execution with results
        const isError = result.status === 'error';
        const isQueued = result.status === 'queued';
        const finalStatus = isError ? 'error' : isQueued ? 'pending' : 'completed';

        await supabaseAdmin
            .from('dd_tool_executions')
            .update({
                output_data: result,
                status: finalStatus,
                error_message: isError ? String(result.message || '') : null,
                completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
                duration_ms: finalStatus === 'completed'
                    ? Date.now() - new Date(execution.created_at).getTime()
                    : null,
                evidence_count: evidenceItems.length,
            })
            .eq('id', execution.id);

        // 8. Insert evidence items
        if (evidenceItems.length > 0) {
            const evidenceRows = evidenceItems.map(e => ({
                project_id: project_id || null,
                tool_execution_id: execution.id,
                source_type: e.source_type || 'ai_output',
                source_reference: e.source_reference || tool_slug,
                source_name: e.source_name || null,
                page_range: e.page_range || null,
                snippet: e.snippet || null,
                snippet_hash: e.snippet_hash || null,
                confidence_score: e.confidence_score || null,
                metadata: {},
            }));

            await supabaseAdmin
                .from('dd_evidence')
                .insert(evidenceRows);
        }

        // 9. Auto-link to project if provided
        if (project_id && finalStatus === 'completed') {
            await supabaseAdmin
                .from('dd_tool_project_links')
                .upsert({
                    tool_execution_id: execution.id,
                    project_id,
                    linked_by: 'auto',
                }, { onConflict: 'tool_execution_id,project_id' });
        }

        return NextResponse.json({
            success: true,
            execution_id: execution.id,
            status: finalStatus,
            result,
            evidence_count: evidenceItems.length,
        });

    } catch (error) {
        console.error('Tool execute error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
