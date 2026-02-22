import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Admin check: verify authenticated user has an admin-level role (clo or pm_transaccion)
// ---------------------------------------------------------------------------
async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { data: adminRole } = await supabaseAdmin
        .from('dd_project_user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['clo', 'pm_transaccion'])
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
    if (!adminRole) {
        return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 });
    }
    return null; // authorized
}

/**
 * Skills Telemetry API — Aggregate execution stats from dd_tool_executions
 * GET /api/configuracion/skills/telemetry?project_id=xxx&period=last_7d|last_30d|all
 *
 * Returns per-skill and overall aggregated telemetry:
 *   - total executions, avg latency (duration_ms), success rate, avg grounding_score
 *   - model_used distribution
 */
export async function GET(req: NextRequest) {
    try {
        const adminErr = await requireAdmin(req);
        if (adminErr) return adminErr;

        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        const period = searchParams.get('period') || 'last_30d';

        // Determine date filter
        let dateFilter: string | null = null;
        const now = new Date();
        if (period === 'last_7d') {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            dateFilter = d.toISOString();
        } else if (period === 'last_30d') {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            dateFilter = d.toISOString();
        }
        // period === 'all' => no date filter

        // Fetch executions with tool info (including skills_used)
        let query = supabase
            .from('dd_tool_executions')
            .select(`
                id,
                tool_id,
                project_id,
                status,
                duration_ms,
                output_data,
                input_params,
                created_at,
                dd_tools!inner ( slug, name, skills_used )
            `)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (dateFilter) {
            query = query.gte('created_at', dateFilter);
        }

        const { data: executions, error } = await query;

        if (error) {
            console.error('Telemetry fetch error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch telemetry data' },
                { status: 500 }
            );
        }

        const rows = executions || [];

        // ============================================================
        // Build per-skill aggregation
        // ============================================================
        // Each execution's tool may reference multiple skills via dd_tools.skills_used
        // We also check input_params.skill_enriched for skill correlation

        interface SkillStats {
            skill_key: string;
            total: number;
            success: number;
            error: number;
            total_latency: number;
            latency_count: number;
            total_grounding: number;
            grounding_count: number;
            models: Record<string, number>;
        }

        const skillMap: Record<string, SkillStats> = {};
        let overallTotal = 0;
        let overallSuccess = 0;
        let overallError = 0;
        let overallLatencySum = 0;
        let overallLatencyCount = 0;
        let overallGroundingSum = 0;
        let overallGroundingCount = 0;

        for (const exec of rows) {
            overallTotal++;
            const isSuccess = exec.status === 'completed';
            const isError = exec.status === 'error';
            if (isSuccess) overallSuccess++;
            if (isError) overallError++;

            const latency = typeof exec.duration_ms === 'number' ? exec.duration_ms : null;
            if (latency !== null) {
                overallLatencySum += latency;
                overallLatencyCount++;
            }

            const outputData = (exec.output_data || {}) as Record<string, unknown>;
            const groundingScore = typeof outputData.grounding_score === 'number'
                ? outputData.grounding_score
                : null;
            if (groundingScore !== null) {
                overallGroundingSum += groundingScore;
                overallGroundingCount++;
            }

            const modelUsed = typeof outputData.model_used === 'string'
                ? outputData.model_used
                : null;

            // Determine skill keys associated with this execution
            const tool = exec.dd_tools as unknown as { slug: string; name: string; skills_used: string[] | null };
            const skillKeys: string[] = tool?.skills_used || [];

            // If no skills are mapped, aggregate under the tool slug as fallback
            const keys = skillKeys.length > 0 ? skillKeys : [tool?.slug || 'unknown'];

            for (const key of keys) {
                if (!skillMap[key]) {
                    skillMap[key] = {
                        skill_key: key,
                        total: 0,
                        success: 0,
                        error: 0,
                        total_latency: 0,
                        latency_count: 0,
                        total_grounding: 0,
                        grounding_count: 0,
                        models: {},
                    };
                }
                const s = skillMap[key];
                s.total++;
                if (isSuccess) s.success++;
                if (isError) s.error++;
                if (latency !== null) {
                    s.total_latency += latency;
                    s.latency_count++;
                }
                if (groundingScore !== null) {
                    s.total_grounding += groundingScore;
                    s.grounding_count++;
                }
                if (modelUsed) {
                    s.models[modelUsed] = (s.models[modelUsed] || 0) + 1;
                }
            }
        }

        // ============================================================
        // Format response
        // ============================================================
        const perSkill = Object.values(skillMap)
            .map(s => ({
                skill_key: s.skill_key,
                total_executions: s.total,
                avg_latency_ms: s.latency_count > 0 ? Math.round(s.total_latency / s.latency_count) : null,
                success_rate: s.total > 0 ? Math.round((s.success / s.total) * 100) : null,
                error_rate: s.total > 0 ? Math.round((s.error / s.total) * 100) : null,
                avg_grounding: s.grounding_count > 0 ? Math.round(s.total_grounding / s.grounding_count) : null,
                model_distribution: s.models,
            }))
            .sort((a, b) => b.total_executions - a.total_executions);

        const overall = {
            total_executions: overallTotal,
            avg_latency_ms: overallLatencyCount > 0 ? Math.round(overallLatencySum / overallLatencyCount) : null,
            success_rate: overallTotal > 0 ? Math.round((overallSuccess / overallTotal) * 100) : null,
            error_rate: overallTotal > 0 ? Math.round((overallError / overallTotal) * 100) : null,
            avg_grounding: overallGroundingCount > 0 ? Math.round(overallGroundingSum / overallGroundingCount) : null,
        };

        return NextResponse.json({
            success: true,
            period,
            overall,
            per_skill: perSkill,
        });

    } catch (error) {
        console.error('Skills telemetry API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
