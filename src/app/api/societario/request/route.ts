import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Societario Request
 * POST /api/societario/request
 * Body: { sociedad_target, nif_hint?, periodo_anios?, project_id?, idempotency_key? }
 *
 * Creates a new DD request and linked tool execution record.
 * Supports idempotency via unique key.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sociedad_target, nif_hint, periodo_anios, project_id, idempotency_key } = body;

        if (!sociedad_target || !sociedad_target.trim()) {
            return NextResponse.json(
                { error: 'sociedad_target is required' },
                { status: 400 }
            );
        }

        const periodo = periodo_anios || 5;

        // Generate idempotency key if not provided
        const idemKey = idempotency_key ||
            `soc:${sociedad_target.trim().toLowerCase()}:${nif_hint || ''}:${periodo}`;

        // Check for existing request with same idempotency key
        const { data: existing } = await supabaseAdmin
            .from('dd_requests')
            .select('id, status, pipeline_step, tool_execution_id, sociedad_id')
            .eq('idempotency_key', idemKey)
            .single();

        if (existing) {
            return NextResponse.json({
                success: true,
                request_id: existing.id,
                execution_id: existing.tool_execution_id,
                status: existing.status,
                pipeline_step: existing.pipeline_step,
                sociedad_id: existing.sociedad_id,
                idempotent: true,
            });
        }

        // Look up the societario tool
        const { data: tool } = await supabaseAdmin
            .from('dd_tools')
            .select('id')
            .eq('slug', 'societario')
            .eq('is_active', true)
            .single();

        // Create tool execution record
        let executionId: string | null = null;
        if (tool) {
            const { data: execution } = await supabaseAdmin
                .from('dd_tool_executions')
                .insert({
                    tool_id: tool.id,
                    project_id: project_id || null,
                    input_params: {
                        sociedad_target: sociedad_target.trim(),
                        nif_hint: nif_hint || null,
                        periodo_anios: periodo,
                    },
                    status: 'pending',
                    executed_by: 'system',
                })
                .select('id')
                .single();

            executionId = execution?.id || null;
        }

        // Create the request record
        const { data: request, error: reqErr } = await supabaseAdmin
            .from('dd_requests')
            .insert({
                tool_execution_id: executionId,
                idempotency_key: idemKey,
                sociedad_input: sociedad_target.trim(),
                nif_hint: nif_hint || null,
                periodo_anios: periodo,
                status: 'pending',
                pipeline_step: 'created',
                requested_by: 'system',
            })
            .select()
            .single();

        if (reqErr || !request) {
            console.error('Failed to create request:', reqErr);
            return NextResponse.json(
                { error: 'Failed to create request' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            request_id: request.id,
            execution_id: executionId,
            status: 'pending',
            pipeline_step: 'created',
        });

    } catch (error) {
        console.error('Societario request error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/societario/request?id=<request_id>
 * Get request status with all related data.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
        }

        const { data: request, error } = await supabaseAdmin
            .from('dd_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Get related data based on pipeline step
        const related: Record<string, unknown> = {};

        if (request.sociedad_id) {
            const { data: sociedad } = await supabaseAdmin
                .from('sociedades')
                .select('*')
                .eq('id', request.sociedad_id)
                .single();
            related.sociedad = sociedad;
        }

        if (request.status === 'needs_review') {
            const { data: candidates } = await supabaseAdmin
                .from('sociedad_candidates')
                .select('*')
                .eq('request_id', id)
                .order('similarity_score', { ascending: false });
            related.candidates = candidates;
        }

        // Get snapshot if it exists
        const { data: snapshot } = await supabaseAdmin
            .from('dd_snapshots')
            .select('*')
            .eq('request_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (snapshot) related.snapshot = snapshot;

        // Get report if it exists
        const { data: report } = await supabaseAdmin
            .from('dd_reports')
            .select('*')
            .eq('request_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (report) related.report = report;

        return NextResponse.json({
            success: true,
            request,
            ...related,
        });

    } catch (error) {
        console.error('Societario request GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
