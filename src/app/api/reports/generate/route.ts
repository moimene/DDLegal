import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildEvidencePack, generateReport } from '@/lib/reporting/report-engine';
import { getTemplate, getAllTemplateTypes, REPORT_TEMPLATES } from '@/lib/reporting/templates';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Generic Report Generator
 * GET  /api/reports/generate?list=true  — list all templates
 * POST /api/reports/generate
 * Body: { template_type, request_id?, project_id?, params: {} }
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const list = searchParams.get('list');

    if (list) {
        const templates = getAllTemplateTypes().map(key => ({
            ...REPORT_TEMPLATES[key],
            key,
        }));

        return NextResponse.json({
            success: true,
            count: templates.length,
            templates,
        });
    }

    return NextResponse.json({ error: 'Use ?list=true to list templates' }, { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { template_type, request_id, project_id, params } = body;

        if (!template_type) {
            return NextResponse.json({ error: 'template_type is required' }, { status: 400 });
        }

        const template = getTemplate(template_type);
        if (!template) {
            return NextResponse.json(
                { error: `Unknown template: ${template_type}. Use GET ?list=true for available templates.` },
                { status: 400 }
            );
        }

        // Permission check — require can_view_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_reports');
            if (!authorized) return authError!;
        }

        // Build sources based on template type
        const sources: Array<{
            type: string;
            url: string;
            date: string;
            snippet: string;
            metadata?: Record<string, unknown>;
        }> = [];

        let snapshot: Record<string, unknown> | undefined;

        // If request_id provided, load related data
        if (request_id) {
            // Try DD snapshot (societario)
            const { data: ddSnapshot } = await supabaseAdmin
                .from('dd_snapshots')
                .select('*')
                .eq('request_id', request_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (ddSnapshot) {
                snapshot = ddSnapshot as Record<string, unknown>;

                // Add BORME announcements as sources
                const { data: announcements } = await supabaseAdmin
                    .from('borme_announcements')
                    .select('*')
                    .eq('sociedad_id', ddSnapshot.sociedad_id)
                    .order('borme_date', { ascending: false })
                    .limit(50);

                for (const ann of (announcements || [])) {
                    sources.push({
                        type: 'borme',
                        url: ann.source_url || `https://boe.es/borme/dias/${ann.borme_date}`,
                        date: ann.borme_date,
                        snippet: ann.raw_text || `${ann.tipo_acto} — ${ann.borme_date}`,
                    });
                }
            }

            // Try IP snapshot
            const { data: ipSnapshot } = await supabaseAdmin
                .from('ip_snapshots')
                .select('*')
                .eq('ip_request_id', request_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (ipSnapshot) {
                snapshot = ipSnapshot.data as Record<string, unknown>;
            }
        }

        // If project_id provided, load project-level data
        if (project_id && sources.length === 0) {
            const { data: snapshots } = await supabaseAdmin
                .from('dd_snapshots')
                .select('red_flags, datos_generales, sociedad_id')
                .eq('request_id', project_id);

            if (snapshots) {
                snapshot = { project_snapshots: snapshots };
            }
        }

        // Build Evidence Pack
        const evidencePack = buildEvidencePack({
            sources,
            snapshot,
            template,
            additionalInstructions: params?.extra_instructions ? [params.extra_instructions] : undefined,
        });

        // Get skill prompt if applicable
        let prompt = `Genera un informe de tipo "${template.report_type}" con titulo "${template.title_template}".\n\n`;

        if (template.harvey_skill_key) {
            const { data: skill } = await supabaseAdmin
                .from('dd_skills_catalog')
                .select('prompt_template')
                .eq('skill_key', template.harvey_skill_key)
                .eq('is_active', true)
                .single();

            if (skill) {
                prompt += `--- Skill Instructions ---\n${skill.prompt_template}\n\n`;
            }
        }

        prompt += 'Datos y evidencias adjuntas en el evidence_pack.';

        // Generate report
        const result = await generateReport({
            template,
            evidencePack,
            prompt,
            requestId: request_id,
            snapshotId: snapshot?.id as string,
            projectId: project_id,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });

    } catch (error) {
        console.error('Report generation error:', error);
        return NextResponse.json(
            { error: 'Internal server error during report generation' },
            { status: 500 }
        );
    }
}
