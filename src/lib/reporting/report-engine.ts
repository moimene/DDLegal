import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================================
// Report Template Definition
// ============================================================

export interface ReportTemplate {
    report_type: string;
    family: 'transactional' | 'pmo' | 'compliance';
    title_template: string;
    required_sections: string[];
    evidence_pack_version: string;
    grounding_required: boolean;
    harvey_skill_key?: string;
    export_formats: ('pdf' | 'json' | 'markdown' | 'html')[];
    cadencia: 'on_demand' | 'daily' | 'weekly' | 'monthly';
    audience: ('equipo' | 'cliente' | 'pm')[];
    url_allowlist?: string[];
}

// ============================================================
// Evidence Pack Builder (parametrizable)
// ============================================================

export interface EvidenceSource {
    id: string; // SRC-001, SRC-002...
    type: string; // 'borme', 'oepm', 'euipo', 'document', 'manual'
    url: string;
    date: string;
    snippet: string;
    metadata?: Record<string, unknown>;
}

export interface EvidencePack {
    evidence_pack_version: string;
    sources: EvidenceSource[];
    instructions: string;
    snapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export function buildEvidencePack(opts: {
    sources: Array<{
        type: string;
        url: string;
        date: string;
        snippet: string;
        metadata?: Record<string, unknown>;
    }>;
    snapshot?: Record<string, unknown>;
    template: ReportTemplate;
    additionalInstructions?: string[];
}): EvidencePack {
    const indexedSources: EvidenceSource[] = opts.sources.map((s, idx) => ({
        id: `SRC-${String(idx + 1).padStart(3, '0')}`,
        ...s,
    }));

    const baseInstructions = [
        'CITE every factual claim using [SRC-XXX] format.',
        'Do NOT invent or fabricate any source references.',
        `All source URLs must be from allowed domains: ${(opts.template.url_allowlist || ['boe.es', 'borme.es', 'registradores.org']).join(', ')}.`,
        `Include all required sections: ${opts.template.required_sections.join(', ')}.`,
        'Flag any inconsistencies found in the data.',
    ];

    if (opts.additionalInstructions) {
        baseInstructions.push(...opts.additionalInstructions);
    }

    return {
        evidence_pack_version: opts.template.evidence_pack_version || '1.1',
        sources: indexedSources,
        instructions: baseInstructions.join(' '),
        snapshot: opts.snapshot,
        metadata: {
            template_type: opts.template.report_type,
            generated_at: new Date().toISOString(),
            total_sources: indexedSources.length,
        },
    };
}

// ============================================================
// Grounding Validator (reusable)
// ============================================================

export interface GroundingIssue {
    type: string;
    severity: 'error' | 'warning' | 'info';
    detail: string;
}

export function validateGrounding(opts: {
    responseText: string;
    evidencePack: EvidencePack;
    requiredSections: string[];
    urlAllowlist: string[];
}): { score: number; passed: boolean; issues: GroundingIssue[] } {
    const issues: GroundingIssue[] = [];
    const { responseText, evidencePack, requiredSections, urlAllowlist } = opts;

    const validSourceIds = new Set(evidencePack.sources.map(s => s.id));

    // Check 1: Citation validation
    const citationPattern = /\[SRC-\d{3}\]/g;
    const allCitations = responseText.match(citationPattern) || [];
    const uniqueCitations = Array.from(new Set(allCitations));

    for (const cite of uniqueCitations) {
        const srcId = cite.replace(/[\[\]]/g, '');
        if (!validSourceIds.has(srcId)) {
            issues.push({
                type: 'invalid_citation',
                severity: 'error',
                detail: `Citation ${cite} references non-existent source`,
            });
        }
    }

    // Check 2: URL allowlist
    const urlPattern = /https?:\/\/[^\s"'>\]},]+/g;
    const urls = responseText.match(urlPattern) || [];
    for (const url of urls) {
        const isAllowed = urlAllowlist.some(d => url.includes(d));
        if (!isAllowed) {
            issues.push({
                type: 'unauthorized_url',
                severity: 'error',
                detail: `URL not in allowlist: ${url}`,
            });
        }
    }

    // Check 3: Required sections
    const responseLower = responseText.toLowerCase();
    for (const section of requiredSections) {
        if (!responseLower.includes(section.toLowerCase())) {
            issues.push({
                type: 'missing_section',
                severity: 'error',
                detail: `Required section "${section}" not found in report`,
            });
        }
    }

    // Check 4: Coverage metric
    const citedSourceIds = new Set(uniqueCitations.map(c => c.replace(/[\[\]]/g, '')));
    const coverage = evidencePack.sources.length > 0
        ? (citedSourceIds.size / evidencePack.sources.length) * 100
        : 100;

    if (coverage < 95) {
        issues.push({
            type: 'low_coverage',
            severity: coverage < 50 ? 'error' : 'warning',
            detail: `Source coverage is ${Math.round(coverage)}% (target: >=95%)`,
        });
    }

    // Calculate score
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, Math.min(100, 100 - (errorCount * 10) - (warningCount * 3)));
    const passed = score >= 80 && errorCount === 0;

    return { score, passed, issues };
}

// ============================================================
// Report Generator (orchestrator)
// ============================================================

export async function generateReport(opts: {
    template: ReportTemplate;
    evidencePack: EvidencePack;
    prompt: string;
    requestId?: string;
    snapshotId?: string;
    projectId?: string;
}): Promise<{
    reportId: string;
    status: string;
    groundingScore: number;
    groundingIssues: GroundingIssue[];
}> {
    const { template, evidencePack, prompt, requestId, snapshotId } = opts;

    // Create report record
    const { data: report, error: repErr } = await supabaseAdmin
        .from('dd_reports')
        .insert({
            request_id: requestId || null,
            snapshot_id: snapshotId || null,
            report_type: template.report_type,
            prompt_used: prompt,
            evidence_pack: evidencePack,
            status: 'generating',
        })
        .select()
        .single();

    if (repErr || !report) {
        throw new Error(`Failed to create report: ${repErr?.message}`);
    }

    // Call n8n webhook
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
    let harveyResponse: Record<string, unknown> = {};
    let reportStatus = 'pending';

    if (n8nUrl) {
        try {
            const webhookPath = template.harvey_skill_key
                ? `/dd-skill-${template.harvey_skill_key.replace(/\./g, '-')}`
                : '/dd-report-generate';

            const n8nResp = await fetch(`${n8nUrl}${webhookPath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_id: report.id,
                    request_id: requestId,
                    template_type: template.report_type,
                    prompt,
                    evidence_pack: evidencePack,
                }),
                signal: AbortSignal.timeout(60000),
            });

            if (n8nResp.ok) {
                const data = await n8nResp.json();
                harveyResponse = data.output || data;
                reportStatus = 'done';
            } else {
                harveyResponse = { status: 'error', message: `n8n returned ${n8nResp.status}` };
                reportStatus = 'failed';
            }
        } catch {
            harveyResponse = {
                status: 'queued',
                message: 'n8n webhook not reachable. Report queued.',
            };
            reportStatus = 'pending';
        }
    } else {
        harveyResponse = {
            status: 'queued',
            message: 'n8n not configured. Evidence Pack stored for manual review.',
            evidence_summary: {
                total_sources: evidencePack.sources.length,
                template_type: template.report_type,
            },
        };
        reportStatus = 'pending';
    }

    // Run grounding validation if needed and response available
    let groundingScore = 0;
    let groundingIssues: GroundingIssue[] = [];

    if (template.grounding_required && reportStatus === 'done') {
        const result = validateGrounding({
            responseText: JSON.stringify(harveyResponse),
            evidencePack,
            requiredSections: template.required_sections,
            urlAllowlist: template.url_allowlist || ['boe.es', 'borme.es', 'registradores.org'],
        });
        groundingScore = result.score;
        groundingIssues = result.issues;
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

    return {
        reportId: report.id,
        status: reportStatus,
        groundingScore,
        groundingIssues,
    };
}
