import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Deal Cockpit / War Room — Aggregation Endpoint
 * GET /api/projects/[id]/cockpit
 *
 * Pulls data from multiple tables to power the Deal Cockpit page:
 * - Project info (dd_projects)
 * - Area status with task counts (dd_areas + dd_tasks)
 * - VDR coverage (vdr_documents + dd_expected_documents)
 * - Top red flags (dd_contingencies)
 * - Q&A pulse (qa_threads)
 * - Contingency summary with negotiation breakdown (dd_contingencies + dd_contingencies_ext)
 * - Timeline of upcoming deadlines (dd_tasks)
 */

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // ── 1. Project info ──────────────────────────────────────
        const { data: project, error: projectError } = await supabaseAdmin
            .from('dd_projects')
            .select('id, name, status, review_depth, deal_type, target_company')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // ── Parallel queries for the remaining sections ──────────
        const [
            areasRes,
            tasksRes,
            processesRes,
            vdrDocsRes,
            expectedDocsRes,
            contingenciesRes,
            contingenciesExtRes,
            qaThreadsRes,
        ] = await Promise.all([
            supabaseAdmin
                .from('dd_areas')
                .select('id, code, name, color, icon, sort_order')
                .order('sort_order'),
            supabaseAdmin
                .from('dd_tasks')
                .select('id, area_id, process_id, status, due_date')
                .eq('project_id', projectId),
            supabaseAdmin
                .from('dd_processes')
                .select('id, number, name, area_id')
                .order('sort_order'),
            supabaseAdmin
                .from('vdr_documents')
                .select('id, area_code, category, status')
                .eq('project_id', projectId)
                .not('status', 'in', '("archived","error")'),
            supabaseAdmin
                .from('dd_expected_documents')
                .select('id, area_code, category, name, is_mandatory'),
            supabaseAdmin
                .from('dd_contingencies')
                .select('id, area_id, title, description, severity, probability, estimated_amount, amount_currency, status, recommendation')
                .eq('project_id', projectId),
            supabaseAdmin
                .from('dd_contingencies_ext')
                .select('id, contingency_id, treatment, cap_amount, negotiation_status, rwi_coverage'),
            supabaseAdmin
                .from('qa_threads')
                .select('id, status, priority, sla_breached')
                .eq('project_id', projectId),
        ]);

        const areas = areasRes.data || [];
        const tasks = tasksRes.data || [];
        const processes = processesRes.data || [];
        const vdrDocs = vdrDocsRes.data || [];
        const expectedDocs = expectedDocsRes.data || [];
        const contingencies = contingenciesRes.data || [];
        const contingenciesExt = contingenciesExtRes.data || [];
        const qaThreads = qaThreadsRes.data || [];

        // Build lookup maps
        const processById = new Map(processes.map((p: { id: string; number: number; name: string; area_id: string }) => [p.id, p]));
        const areaById = new Map(areas.map((a: { id: string; code: string; name: string }) => [a.id, a]));

        const extByContingencyId = new Map<string, Record<string, unknown>>();
        for (const ext of contingenciesExt) {
            extByContingencyId.set(ext.contingency_id, ext);
        }

        // ── 2. Area status ───────────────────────────────────────
        const areasStatus = areas.map((area) => {
            const areaTasks = tasks.filter((t) => t.area_id === area.id);
            const total = areaTasks.length;
            const byStatus: Record<string, number> = {};
            for (const t of areaTasks) {
                byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            }
            const completed = byStatus['completed'] || 0;
            const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                area_id: area.id,
                code: area.code,
                name: area.name,
                color: area.color,
                icon: area.icon,
                total_tasks: total,
                by_status: byStatus,
                completion_pct: completionPct,
            };
        }).filter((a) => a.total_tasks > 0);

        // ── 3. VDR coverage ──────────────────────────────────────
        const totalVdrDocs = vdrDocs.length;
        const totalExpected = expectedDocs.length;
        const coverage = totalExpected > 0
            ? Math.round((totalVdrDocs / totalExpected) * 100) / 100
            : 1;

        const vdr = {
            total: totalVdrDocs,
            expected: totalExpected,
            coverage,
        };

        // ── 4. Top red flags ─────────────────────────────────────
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const redFlags = contingencies
            .filter((c) => c.severity === 'critical' || c.severity === 'high')
            .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99))
            .slice(0, 10)
            .map((c) => {
                const area = areaById.get(c.area_id);
                return {
                    id: c.id,
                    title: c.title,
                    description: c.description,
                    severity: c.severity,
                    probability: c.probability,
                    estimated_amount: c.estimated_amount,
                    amount_currency: c.amount_currency,
                    status: c.status,
                    recommendation: c.recommendation,
                    area_id: c.area_id,
                    area_code: area?.code || null,
                };
            });

        // ── 5. Q&A pulse ─────────────────────────────────────────
        const qaByStatus: Record<string, number> = {};
        let slaBreaches = 0;
        for (const t of qaThreads) {
            qaByStatus[t.status] = (qaByStatus[t.status] || 0) + 1;
            if (t.sla_breached) slaBreaches++;
        }
        const qaPulse = {
            total: qaThreads.length,
            by_status: qaByStatus,
            sla_breaches: slaBreaches,
        };

        // ── 6. Contingency summary ──────────────────────────────
        const bySeverity: Record<string, number> = {};
        let totalImpact = 0;
        for (const c of contingencies) {
            bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
            if (c.estimated_amount) {
                totalImpact += Number(c.estimated_amount);
            }
        }

        const negotiationBreakdown: Record<string, number> = {};
        for (const ext of contingenciesExt) {
            const ns = ext.negotiation_status || 'open';
            negotiationBreakdown[ns] = (negotiationBreakdown[ns] || 0) + 1;
        }

        const contingencySummary = {
            total: contingencies.length,
            by_severity: bySeverity,
            total_impact: totalImpact,
            negotiation: negotiationBreakdown,
        };

        // ── 7. Timeline — upcoming deadlines (includes overdue) ──
        const timeline = tasks
            .filter((t) => t.due_date && t.status !== 'completed')
            .sort((a, b) => {
                const aDate = new Date(a.due_date!).getTime();
                const bDate = new Date(b.due_date!).getTime();
                return aDate - bDate;
            })
            .slice(0, 12)
            .map((t) => {
                const process = processById.get(t.process_id);
                const area = areaById.get(t.area_id);
                return {
                    task_id: t.id,
                    title: process ? `P${process.number}. ${process.name}` : t.id,
                    area_id: t.area_id,
                    area_code: area?.code || null,
                    status: t.status,
                    due_date: t.due_date,
                };
            });

        // ── Response ─────────────────────────────────────────────
        return NextResponse.json({
            success: true,
            cockpit: {
                project: {
                    id: project.id,
                    name: project.name,
                    status: project.status,
                    review_depth: project.review_depth,
                    deal_type: project.deal_type,
                    target_company: project.target_company,
                },
                areas: areasStatus,
                vdr,
                red_flags: redFlags,
                qa_pulse: qaPulse,
                contingencies: contingencySummary,
                timeline,
            },
        });
    } catch (error) {
        console.error('Cockpit API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
