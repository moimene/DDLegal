import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Harvey AI Integration — API Route
 * This route proxies requests to Harvey AI (or n8n webhook which orchestrates Harvey).
 * Enhanced with skills catalog lookup for richer prompts.
 * Includes telemetry tracking for tool executions.
 * POST /api/harvey
 */
export async function POST(req: NextRequest) {
    try {
        const startTime = Date.now();

        const body = await req.json();
        const { project_id, process_id, prompt, target_company, sector } = body;

        if (!project_id || !process_id || !prompt) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, project_id, 'can_edit_tasks');
        if (!authorized) return authError!;

        // Enrich the prompt with project context
        const enrichedPrompt = prompt
            .replace(/\[sociedad target\]/gi, target_company || '[Sociedad Target]')
            .replace(/\[indicar sector\]/gi, sector || '[Sector]')
            .replace(/\[sector\]/gi, sector || '[Sector]')
            .replace(/\[años\]/gi, '2022-2025');

        // Get process info including area
        const { data: proc } = await supabase
            .from('dd_processes')
            .select('area_id')
            .eq('id', process_id)
            .single();

        // Create or update the task
        const { data: existingTask } = await supabase
            .from('dd_tasks')
            .select('id')
            .eq('project_id', project_id)
            .eq('process_id', process_id)
            .single();

        if (existingTask) {
            await supabase.from('dd_tasks').update({
                ai_status: 'running',
                updated_at: new Date().toISOString(),
            }).eq('id', existingTask.id);
        } else {
            await supabase.from('dd_tasks').insert({
                project_id,
                process_id,
                area_id: proc?.area_id,
                status: 'in_progress',
                ai_status: 'running',
            });
        }

        // ============================================================
        // Skills catalog enhancement (backward compatible)
        // Look up matching skills by area_code for richer prompts
        // ============================================================
        let skillContext: {
            prompt_template?: string;
            expected_output_schema?: Record<string, unknown> | null;
            evidence_requirements?: unknown;
            agent_pipeline?: string[] | null;
        } | null = null;

        if (proc?.area_id) {
            // Get area code from area_id
            const { data: area } = await supabase
                .from('dd_areas')
                .select('code')
                .eq('id', proc.area_id)
                .single();

            if (area?.code) {
                // Look for matching skills in this area
                const { data: skills } = await supabase
                    .from('dd_skills_catalog')
                    .select('prompt_template, expected_output_schema, evidence_requirements, agent_pipeline')
                    .eq('area_code', area.code)
                    .eq('is_active', true)
                    .eq('category', 'verificacion')
                    .limit(1);

                if (skills && skills.length > 0) {
                    skillContext = skills[0];
                }
            }
        }

        // ============================================================
        // Harvey Gateway routing (S0 Strangler Fig)
        // Feature flag: 'gateway' = direct Harvey API, 'n8n' = legacy webhook
        // ============================================================
        const featureFlag = process.env.HARVEY_FEATURE_FLAG || 'gateway';
        let aiResult: Record<string, unknown> = {};

        if (featureFlag === 'gateway') {
            // Direct Harvey call via Gateway
            try {
                const { getHarveyGateway } = await import('@/lib/harvey');
                const gateway = getHarveyGateway();
                const harveyResult = await gateway.completion({
                    prompt: enrichedPrompt,
                    system_prompt: skillContext?.prompt_template,
                    client_matter_id: `${project_id}:${process_id}`,
                });
                aiResult = {
                    text: harveyResult.text,
                    model: harveyResult.model,
                    id: harveyResult.id,
                    tokens_in: harveyResult.usage?.prompt_tokens,
                    tokens_out: harveyResult.usage?.completion_tokens,
                    source: 'gateway',
                    skill_enriched: !!skillContext,
                };
            } catch (gatewayError) {
                console.warn('Gateway call failed, falling back to n8n:', gatewayError);
                // Fallback to n8n on gateway failure
                aiResult = await callN8nFallback(enrichedPrompt, project_id, process_id, target_company, sector, skillContext);
            }
        } else {
            // Legacy n8n path
            aiResult = await callN8nFallback(enrichedPrompt, project_id, process_id, target_company, sector, skillContext);
        }

        // Update task with result
        const taskFilter = existingTask
            ? supabase.from('dd_tasks').update({
                ai_output: aiResult,
                ai_status: aiResult.status === 'queued' ? 'none' : 'completed',
                status: aiResult.status === 'queued' ? 'in_progress' : 'review',
            }).eq('id', existingTask.id)
            : supabase.from('dd_tasks').update({
                ai_output: aiResult,
                ai_status: aiResult.status === 'queued' ? 'none' : 'completed',
                status: aiResult.status === 'queued' ? 'in_progress' : 'review',
            }).eq('project_id', project_id).eq('process_id', process_id);

        await taskFilter;

        // ============================================================
        // Telemetry: record execution metrics in dd_tool_executions
        // ============================================================
        const durationMs = Date.now() - startTime;

        try {
            // Extract telemetry data from AI response when available
            const tokensIn = typeof aiResult.tokens_in === 'number' ? aiResult.tokens_in : null;
            const tokensOut = typeof aiResult.tokens_out === 'number' ? aiResult.tokens_out : null;
            const modelUsed = typeof aiResult.model === 'string' ? aiResult.model : 'harvey-default';
            const groundingScore = typeof aiResult.grounding_score === 'number'
                ? aiResult.grounding_score
                : null;
            const agentStatus = aiResult.status === 'queued' ? 'pending' : 'completed';

            // Find the harvey tool in dd_tools (best-effort)
            const { data: harveyTool } = await supabaseAdmin
                .from('dd_tools')
                .select('id')
                .eq('slug', 'harvey-ai')
                .maybeSingle();

            if (harveyTool) {
                await supabaseAdmin.from('dd_tool_executions').insert({
                    tool_id: harveyTool.id,
                    project_id,
                    input_params: {
                        process_id,
                        prompt: enrichedPrompt.substring(0, 500), // truncate for storage
                        target_company,
                        sector,
                        skill_enriched: !!skillContext,
                    },
                    output_data: {
                        tokens_in: tokensIn,
                        tokens_out: tokensOut,
                        model_used: modelUsed,
                        grounding_score: groundingScore,
                    },
                    status: agentStatus,
                    duration_ms: durationMs,
                    started_at: new Date(startTime).toISOString(),
                    completed_at: new Date().toISOString(),
                });
            }
        } catch (telemetryError) {
            // Telemetry is best-effort; do not fail the main request
            console.warn('Harvey telemetry write failed:', telemetryError);
        }

        return NextResponse.json({
            success: true,
            result: aiResult,
            skill_enriched: !!skillContext,
            telemetry: {
                duration_ms: durationMs,
            },
        });

    } catch (error) {
        console.error('Harvey API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Legacy n8n fallback for Harvey AI calls.
 * Used when HARVEY_FEATURE_FLAG=n8n or when gateway fails.
 */
async function callN8nFallback(
    enrichedPrompt: string,
    project_id: string,
    process_id: string,
    target_company: string | undefined,
    sector: string | undefined,
    skillContext: {
        prompt_template?: string;
        expected_output_schema?: Record<string, unknown> | null;
        evidence_requirements?: unknown;
        agent_pipeline?: string[] | null;
    } | null
): Promise<Record<string, unknown>> {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;

    if (n8nUrl) {
        try {
            const n8nPayload: Record<string, unknown> = {
                prompt: enrichedPrompt,
                project_id,
                process_id,
                target_company,
                sector,
            };

            if (skillContext) {
                n8nPayload.skill_prompt = skillContext.prompt_template;
                n8nPayload.expected_output_schema = skillContext.expected_output_schema;
                n8nPayload.evidence_requirements = skillContext.evidence_requirements;
                n8nPayload.agent_pipeline = skillContext.agent_pipeline;
            }

            const n8nResp = await fetch(`${n8nUrl}/dd-harvey-invoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(n8nPayload),
            });
            if (n8nResp.ok) {
                const result = await n8nResp.json();
                return { ...result, source: 'n8n' };
            }
        } catch {
            // n8n not reachable
        }
    }

    return {
        status: 'queued',
        message: 'Harvey integration pending. Prompt stored for manual execution.',
        prompt: enrichedPrompt,
        skill_enriched: !!skillContext,
        source: 'fallback',
    };
}
