import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Harvey AI Integration — API Route
 * This route proxies requests to Harvey AI (or n8n webhook which orchestrates Harvey).
 * POST /api/harvey
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, process_id, prompt, target_company, sector } = body;

        if (!project_id || !process_id || !prompt) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Enrich the prompt with project context
        const enrichedPrompt = prompt
            .replace(/\[sociedad target\]/gi, target_company || '[Sociedad Target]')
            .replace(/\[indicar sector\]/gi, sector || '[Sector]')
            .replace(/\[sector\]/gi, sector || '[Sector]')
            .replace(/\[años\]/gi, '2022-2025');

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
            // Get process area
            const { data: proc } = await supabase
                .from('dd_processes')
                .select('area_id')
                .eq('id', process_id)
                .single();

            await supabase.from('dd_tasks').insert({
                project_id,
                process_id,
                area_id: proc?.area_id,
                status: 'in_progress',
                ai_status: 'running',
            });
        }

        // Attempt to call Harvey via n8n webhook
        const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
        let aiResult: Record<string, unknown> = {};

        if (n8nUrl) {
            try {
                const n8nResp = await fetch(`${n8nUrl}/dd-harvey-invoke`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: enrichedPrompt,
                        project_id,
                        process_id,
                        target_company,
                        sector,
                    }),
                });
                if (n8nResp.ok) {
                    aiResult = await n8nResp.json();
                }
            } catch {
                // n8n not reachable, store prompt for later
                aiResult = {
                    status: 'queued',
                    message: 'n8n webhook not reachable. Prompt stored for manual execution.',
                    prompt: enrichedPrompt,
                };
            }
        } else {
            aiResult = {
                status: 'queued',
                message: 'Harvey integration pending. Prompt stored.',
                prompt: enrichedPrompt,
            };
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

        return NextResponse.json({
            success: true,
            result: aiResult,
        });

    } catch (error) {
        console.error('Harvey API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
