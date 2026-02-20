import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Harvey Report Generator
 * POST /api/societario/report
 * Body: { request_id }
 *
 * Builds Evidence Pack v1.1, calls Harvey AI via n8n,
 * stores report, and runs grounding validation.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        // Get request
        const { data: request } = await supabaseAdmin
            .from('dd_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (!request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Get snapshot
        const { data: snapshot } = await supabaseAdmin
            .from('dd_snapshots')
            .select('*')
            .eq('request_id', request_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!snapshot) {
            return NextResponse.json(
                { error: 'Snapshot must exist before generating report' },
                { status: 400 }
            );
        }

        // Get BORME announcements for evidence pack
        const { data: announcements } = await supabaseAdmin
            .from('borme_announcements')
            .select('*')
            .eq('sociedad_id', request.sociedad_id)
            .order('borme_date', { ascending: true });

        // Get skills for prompt enrichment
        const { data: skills } = await supabaseAdmin
            .from('dd_skills_catalog')
            .select('skill_key, prompt_template, expected_output_schema, evidence_requirements')
            .in('skill_key', ['societario.consulta_borme', 'societario.analisis_organos'])
            .eq('is_active', true);

        // Build Evidence Pack v1.1
        const sources = (announcements || []).map((a: Record<string, unknown>, idx: number) => ({
            id: `SRC-${String(idx + 1).padStart(3, '0')}`,
            type: 'borme',
            url: a.source_url || `https://boe.es/borme/dias/${(a.borme_date as string).replace(/-/g, '/')}`,
            date: a.borme_date,
            snippet: a.raw_text ? (a.raw_text as string).slice(0, 200) : '',
            tipo_acto: a.tipo_acto,
            borme_code: a.borme_code,
        }));

        const evidencePack = {
            evidence_pack_version: '1.1',
            sources,
            instructions: [
                'CITE every factual claim using [SRC-XXX] format.',
                'Do NOT invent or fabricate any source references.',
                'All source URLs must be from boe.es or borme.es domains.',
                'Include all required sections: datos_generales, administradores, conclusiones.',
                'Flag any inconsistencies between BORME data and company records.',
            ].join(' '),
            snapshot: {
                datos_generales: snapshot.datos_generales,
                administradores: snapshot.administradores,
                apoderamientos: snapshot.apoderamientos,
                modificaciones: snapshot.modificaciones,
                capital_history: snapshot.capital_history,
                red_flags: snapshot.red_flags,
                timeline_eventos: snapshot.timeline_eventos,
            },
        };

        // Build enriched prompt from skills
        let prompt = `Genera un informe de Due Diligence Societaria para "${request.sociedad_input}".\n\n`;
        if (skills && skills.length > 0) {
            for (const skill of skills) {
                prompt += `--- Skill: ${skill.skill_key} ---\n${skill.prompt_template}\n\n`;
            }
        }
        prompt += `\nDatos del snapshot y evidencias adjuntas en el evidence_pack.`;

        // Create report record
        const { data: report, error: repErr } = await supabaseAdmin
            .from('dd_reports')
            .insert({
                request_id,
                snapshot_id: snapshot.id,
                report_type: 'societario_standard',
                prompt_used: prompt,
                evidence_pack: evidencePack,
                status: 'generating',
            })
            .select()
            .single();

        if (repErr || !report) {
            console.error('Report creation error:', repErr);
            return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 });
        }

        // Call n8n webhook for Harvey report generation
        const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
        let harveyResponse: Record<string, unknown> = {};
        let reportStatus = 'pending';

        if (n8nUrl) {
            try {
                const n8nResp = await fetch(`${n8nUrl}/dd-tool-societario-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        report_id: report.id,
                        request_id,
                        prompt,
                        evidence_pack: evidencePack,
                        snapshot,
                        skills: skills || [],
                    }),
                    signal: AbortSignal.timeout(60000), // 60s timeout for Harvey
                });

                if (n8nResp.ok) {
                    const data = await n8nResp.json();
                    harveyResponse = data.output || data;
                    reportStatus = 'done';
                } else {
                    harveyResponse = {
                        status: 'error',
                        message: `n8n returned ${n8nResp.status}`,
                    };
                    reportStatus = 'failed';
                }
            } catch {
                harveyResponse = {
                    status: 'queued',
                    message: 'n8n webhook not reachable. Report queued for processing.',
                };
                reportStatus = 'pending';
            }
        } else {
            harveyResponse = {
                status: 'queued',
                message: 'n8n not configured. Report data stored for manual review.',
                evidence_summary: {
                    total_sources: sources.length,
                    snapshot_date: snapshot.snapshot_date,
                    red_flags: (snapshot.red_flags as unknown[]).length,
                },
            };
            reportStatus = 'pending';
        }

        // Run grounding validation if we have a response
        let groundingScore = 0;
        const groundingIssues: Record<string, unknown>[] = [];

        if (reportStatus === 'done' && harveyResponse) {
            const responseText = JSON.stringify(harveyResponse);

            // Check 1: Citation presence
            const citationPattern = /\[SRC-\d{3}\]/g;
            const citations = responseText.match(citationPattern) || [];
            const uniqueCitations = Array.from(new Set(citations));

            // Check 2: All citations reference valid sources
            const validSourceIds = new Set(sources.map((s: Record<string, unknown>) => s.id));
            for (const cite of uniqueCitations) {
                const srcId = cite.replace(/[\[\]]/g, '');
                if (!validSourceIds.has(srcId)) {
                    groundingIssues.push({
                        type: 'invalid_citation',
                        citation: cite,
                        message: `Citation ${cite} does not match any source in evidence pack`,
                    });
                }
            }

            // Check 3: Coverage (% of sources cited)
            const citedSources = new Set(uniqueCitations.map(c => c.replace(/[\[\]]/g, '')));
            const coverage = sources.length > 0 ? (citedSources.size / sources.length) * 100 : 100;

            if (coverage < 50) {
                groundingIssues.push({
                    type: 'low_coverage',
                    coverage_percent: Math.round(coverage),
                    message: `Only ${Math.round(coverage)}% of sources are cited in the report`,
                });
            }

            // Check 4: URL allowlist
            const urlPattern = /https?:\/\/[^\s"'>\]]+/g;
            const urls = responseText.match(urlPattern) || [];
            const allowedDomains = ['boe.es', 'borme.es', 'registradores.org'];
            for (const url of urls) {
                const isAllowed = allowedDomains.some(d => url.includes(d));
                if (!isAllowed) {
                    groundingIssues.push({
                        type: 'unauthorized_url',
                        url,
                        message: `URL ${url} is not in the allowed domains list`,
                    });
                }
            }

            // Calculate grounding score
            const totalChecks = uniqueCitations.length + 3; // citations + coverage + url + sections
            const failedChecks = groundingIssues.length;
            groundingScore = Math.max(0, Math.round(((totalChecks - failedChecks) / totalChecks) * 100));
        }

        // Update report
        await supabaseAdmin
            .from('dd_reports')
            .update({
                harvey_response: harveyResponse,
                status: reportStatus,
                grounding_score: groundingScore,
                grounding_issues: groundingIssues,
                updated_at: new Date().toISOString(),
            })
            .eq('id', report.id);

        // Update request pipeline step
        const pipelineStep = reportStatus === 'done' ? 'report_generated' : 'snapshot_built';
        const requestStatus = reportStatus === 'done' ? 'done' : reportStatus === 'failed' ? 'failed' : 'running';

        await supabaseAdmin
            .from('dd_requests')
            .update({
                pipeline_step: pipelineStep,
                status: requestStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        // Update tool execution if exists
        if (request.tool_execution_id) {
            const execStatus = reportStatus === 'done' ? 'completed' : reportStatus === 'failed' ? 'error' : 'pending';
            await supabaseAdmin
                .from('dd_tool_executions')
                .update({
                    output_data: harveyResponse,
                    status: execStatus,
                    completed_at: reportStatus === 'done' ? new Date().toISOString() : null,
                })
                .eq('id', request.tool_execution_id);
        }

        return NextResponse.json({
            success: true,
            report_id: report.id,
            status: reportStatus,
            grounding_score: groundingScore,
            grounding_issues: groundingIssues.length,
            evidence_sources: sources.length,
        });

    } catch (error) {
        console.error('Report generation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
