import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * IP Report Generator (Harvey + Evidence Pack)
 * POST /api/ip/report
 * Body: { request_id }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        const { data: request } = await supabaseAdmin
            .from('ip_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (!request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Get snapshot
        const { data: snapshot } = await supabaseAdmin
            .from('ip_snapshots')
            .select('*')
            .eq('ip_request_id', request_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!snapshot) {
            return NextResponse.json({ error: 'Snapshot must exist before generating report' }, { status: 400 });
        }

        const snapshotData = snapshot.data as Record<string, unknown>;
        const marcas = (snapshotData?.marcas as unknown[]) || [];
        const disenos = (snapshotData?.disenos as unknown[]) || [];

        // Build Evidence Pack IP
        const sources = [
            ...marcas.map((m: unknown, idx: number) => {
                const marca = m as Record<string, unknown>;
                return {
                    id: `SRC-${String(idx + 1).padStart(3, '0')}`,
                    type: marca.jurisdiccion === 'ES' ? 'oepm' : 'euipo',
                    url: marca.jurisdiccion === 'ES'
                        ? `https://consultas2.oepm.es/LocalizadorWeb/DetalleExpediente?expediente=${marca.numero_expediente}`
                        : `https://euipo.europa.eu/eSearch/#details/trademarks/${marca.numero_expediente}`,
                    date: new Date().toISOString().split('T')[0],
                    snippet: `${marca.signo} — ${marca.jurisdiccion} — Clases: ${(marca.clases_niza as number[])?.join(', ')} — ${marca.estado_legal}`,
                };
            }),
            ...disenos.map((d: unknown, idx: number) => {
                const diseno = d as Record<string, unknown>;
                return {
                    id: `SRC-${String(marcas.length + idx + 1).padStart(3, '0')}`,
                    type: diseno.jurisdiccion === 'ES' ? 'oepm' : 'euipo',
                    url: diseno.jurisdiccion === 'ES'
                        ? `https://consultas2.oepm.es/LocalizadorWeb/DetalleExpediente?expediente=${diseno.numero_expediente}`
                        : `https://euipo.europa.eu/eSearch/#details/designs/${diseno.numero_expediente}`,
                    date: new Date().toISOString().split('T')[0],
                    snippet: `Diseno: ${diseno.titulo} — ${diseno.jurisdiccion} — ${diseno.estado_legal}`,
                };
            }),
        ];

        const evidencePack = {
            evidence_pack_version: '1.1',
            sources,
            instructions: [
                'CITE every factual claim using [SRC-XXX] format.',
                'Do NOT invent or fabricate any source references.',
                'All source URLs must be from oepm.es, euipo.europa.eu, or wipo.int domains.',
                'Include all required sections: titular, matriz_marcas, diagnostico, recomendaciones.',
                'If information is not available, state "No consta en las evidencias aportadas".',
                'Flag any expiring trademarks, coverage gaps, or titularity inconsistencies.',
            ].join(' '),
            snapshot: snapshotData,
        };

        // Get IP skills
        const { data: skills } = await supabaseAdmin
            .from('dd_skills_catalog')
            .select('skill_key, prompt_template')
            .in('skill_key', ['marcas.consulta_oepm', 'marcas.analisis_riesgo_pi'])
            .eq('is_active', true);

        let prompt = `Genera un informe de Propiedad Industrial para "${request.denominacion_input}".\n\n`;
        if (skills && skills.length > 0) {
            for (const skill of skills) {
                prompt += `--- Skill: ${skill.skill_key} ---\n${skill.prompt_template}\n\n`;
            }
        }
        prompt += '\nDatos del snapshot IP y evidencias adjuntas en el evidence_pack.';

        // Create report
        const { data: report, error: repErr } = await supabaseAdmin
            .from('dd_reports')
            .insert({
                request_id,
                snapshot_id: snapshot.id,
                report_type: 'ip_report',
                prompt_used: prompt,
                evidence_pack: evidencePack,
                status: 'pending',
            })
            .select()
            .single();

        if (repErr || !report) {
            return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
        }

        // Try n8n webhook
        const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
        let harveyResponse: Record<string, unknown> = {};
        let reportStatus = 'pending';

        if (n8nUrl) {
            try {
                const n8nResp = await fetch(`${n8nUrl}/dd-tool-ip-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        report_id: report.id,
                        request_id,
                        prompt,
                        evidence_pack: evidencePack,
                        snapshot: snapshotData,
                        skills: skills || [],
                    }),
                    signal: AbortSignal.timeout(60000),
                });

                if (n8nResp.ok) {
                    const data = await n8nResp.json();
                    harveyResponse = data.output || data;
                    reportStatus = 'done';
                }
            } catch {
                harveyResponse = {
                    status: 'queued',
                    message: 'n8n webhook not reachable. Report queued.',
                    evidence_summary: { total_sources: sources.length },
                };
            }
        } else {
            harveyResponse = {
                status: 'queued',
                message: 'n8n not configured. Evidence Pack stored for manual review.',
                evidence_summary: {
                    total_sources: sources.length,
                    marcas: marcas.length,
                    disenos: disenos.length,
                },
            };
        }

        // Update report
        await supabaseAdmin
            .from('dd_reports')
            .update({
                harvey_response: harveyResponse,
                status: reportStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', report.id);

        // Update pipeline
        await supabaseAdmin
            .from('ip_requests')
            .update({
                pipeline_step: 'report_generated',
                status: reportStatus === 'done' ? 'done' : 'running',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            report_id: report.id,
            status: reportStatus,
            evidence_sources: sources.length,
        });

    } catch (error) {
        console.error('IP report error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
