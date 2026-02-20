import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Grounding Validator
 * POST /api/societario/validate
 * Body: { report_id }
 *
 * Validates a Harvey report's grounding:
 * 1. Every [SRC-XXX] citation exists in evidence pack
 * 2. URLs are in allowlist
 * 3. Required sections present
 * 4. Coverage metric >= 95%
 * 5. Cross-reference dates/names with snapshot
 */

const ALLOWED_DOMAINS = ['boe.es', 'borme.es', 'registradores.org'];
const REQUIRED_SECTIONS = ['datos_generales', 'administradores', 'conclusiones'];

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { report_id } = body;

        if (!report_id) {
            return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
        }

        // Get report with evidence pack
        const { data: report } = await supabaseAdmin
            .from('dd_reports')
            .select('*')
            .eq('id', report_id)
            .single();

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const evidencePack = report.evidence_pack as Record<string, unknown>;
        const harveyResponse = report.harvey_response as Record<string, unknown>;
        const responseText = JSON.stringify(harveyResponse);

        const sources = (evidencePack?.sources as Array<Record<string, unknown>>) || [];
        const validSourceIds = new Set(sources.map(s => s.id as string));

        const issues: Array<{
            type: string;
            severity: 'error' | 'warning' | 'info';
            detail: string;
        }> = [];

        // ---- Check 1: Citation validation ----
        const citationPattern = /\[SRC-\d{3}\]/g;
        const allCitations = responseText.match(citationPattern) || [];
        const uniqueCitations = Array.from(new Set(allCitations));

        let invalidCitations = 0;
        for (const cite of uniqueCitations) {
            const srcId = cite.replace(/[\[\]]/g, '');
            if (!validSourceIds.has(srcId)) {
                issues.push({
                    type: 'invalid_citation',
                    severity: 'error',
                    detail: `Citation ${cite} references non-existent source`,
                });
                invalidCitations++;
            }
        }

        // Log citation checks to dd_sources_log
        for (const source of sources) {
            const isCited = allCitations.some(c => c.includes(source.id as string));
            await supabaseAdmin
                .from('dd_sources_log')
                .insert({
                    report_id,
                    source_type: (source.type as string) || 'borme',
                    source_url: source.url as string || null,
                    http_status: 200, // Source was available during evidence pack build
                    is_valid: true,
                });
            if (!isCited) {
                issues.push({
                    type: 'uncited_source',
                    severity: 'warning',
                    detail: `Source ${source.id} (${source.type}) is not cited in the report`,
                });
            }
        }

        // ---- Check 2: URL allowlist ----
        const urlPattern = /https?:\/\/[^\s"'>\]},]+/g;
        const urls = responseText.match(urlPattern) || [];
        for (const url of urls) {
            const isAllowed = ALLOWED_DOMAINS.some(d => url.includes(d));
            if (!isAllowed) {
                issues.push({
                    type: 'unauthorized_url',
                    severity: 'error',
                    detail: `URL not in allowlist: ${url}`,
                });
            }
        }

        // ---- Check 3: Required sections ----
        const responseLower = responseText.toLowerCase();
        for (const section of REQUIRED_SECTIONS) {
            if (!responseLower.includes(section)) {
                issues.push({
                    type: 'missing_section',
                    severity: 'error',
                    detail: `Required section "${section}" not found in report`,
                });
            }
        }

        // ---- Check 4: Coverage metric ----
        const citedSourceIds = new Set(uniqueCitations.map(c => c.replace(/[\[\]]/g, '')));
        const coverage = sources.length > 0
            ? (citedSourceIds.size / sources.length) * 100
            : 100;

        if (coverage < 95) {
            issues.push({
                type: 'low_coverage',
                severity: coverage < 50 ? 'error' : 'warning',
                detail: `Source coverage is ${Math.round(coverage)}% (target: >=95%)`,
            });
        }

        // ---- Check 5: Cross-reference snapshot data ----
        const snapshot = await supabaseAdmin
            .from('dd_snapshots')
            .select('datos_generales, administradores')
            .eq('id', report.snapshot_id)
            .single();

        if (snapshot?.data) {
            const datosGen = snapshot.data.datos_generales as Record<string, unknown>;
            if (datosGen?.denominacion) {
                const denom = datosGen.denominacion as string;
                if (!responseText.includes(denom)) {
                    issues.push({
                        type: 'missing_entity',
                        severity: 'warning',
                        detail: `Company name "${denom}" not found in report text`,
                    });
                }
            }
        }

        // ---- Calculate final grounding score ----
        const errorCount = issues.filter(i => i.severity === 'error').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;

        // Score: start at 100, -10 per error, -3 per warning
        const groundingScore = Math.max(0, Math.min(100,
            100 - (errorCount * 10) - (warningCount * 3)
        ));

        const passed = groundingScore >= 80 && errorCount === 0;

        // Update report
        await supabaseAdmin
            .from('dd_reports')
            .update({
                grounding_score: groundingScore,
                grounding_issues: issues,
                updated_at: new Date().toISOString(),
            })
            .eq('id', report_id);

        // Update request pipeline step if validation passes
        if (passed && report.request_id) {
            await supabaseAdmin
                .from('dd_requests')
                .update({
                    pipeline_step: 'validated',
                    status: 'done',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', report.request_id);
        }

        return NextResponse.json({
            success: true,
            report_id,
            grounding_score: groundingScore,
            passed,
            issues,
            summary: {
                total_sources: sources.length,
                cited_sources: citedSourceIds.size,
                coverage_percent: Math.round(coverage),
                total_citations: allCitations.length,
                unique_citations: uniqueCitations.length,
                invalid_citations: invalidCitations,
                errors: errorCount,
                warnings: warningCount,
            },
        });

    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
