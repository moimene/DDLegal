import { getCachedDateTimeFormat } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * POST /api/reports/export
 * Body: { report_id, format: 'markdown' | 'json' | 'html' | 'csv', options?: { include_evidence?, include_metadata?, include_confidentiality? } }
 *
 * Exporta un informe en el formato solicitado.
 */

interface ExportOptions {
    include_evidence: boolean;
    include_metadata: boolean;
    include_confidentiality: boolean;
}

interface EvidenceSourceItem {
    id?: string;
    type?: string;
    url?: string;
    date?: string;
    snippet?: string;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDateEs(dateStr: string): string {
    if (!dateStr) return '--';
    try {
        return getCachedDateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

function extractSections(harveyResponse: Record<string, unknown>): Array<{ key: string; title: string; content: string }> {
    const sections: Array<{ key: string; title: string; content: string }> = [];

    for (const [key, value] of Object.entries(harveyResponse)) {
        const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let content: string;

        if (typeof value === 'string') {
            content = value;
        } else if (Array.isArray(value)) {
            content = value.map(item =>
                typeof item === 'string' ? item : JSON.stringify(item, null, 2)
            ).join('\n');
        } else if (value !== null && typeof value === 'object') {
            content = JSON.stringify(value, null, 2);
        } else {
            content = String(value);
        }

        sections.push({ key, title, content });
    }

    return sections;
}

function exportMarkdown(
    report: Record<string, unknown>,
    options: ExportOptions
): string {
    const lines: string[] = [];
    const reportType = (report.report_type as string || 'informe').replace(/_/g, ' ');

    // Cabecera de metadatos
    if (options.include_metadata) {
        lines.push(`# ${reportType.toUpperCase()}`);
        lines.push('');
        lines.push('| Campo | Valor |');
        lines.push('|-------|-------|');
        lines.push(`| Tipo | ${reportType} |`);
        lines.push(`| Fecha | ${formatDateEs(report.created_at as string)} |`);
        lines.push(`| Version | ${report.version_number || 1} |`);
        lines.push(`| Estado | ${report.status} |`);
        lines.push(`| Grounding Score | ${report.grounding_score || 0}/100 |`);
        if (report.report_category) {
            lines.push(`| Categoria | ${report.report_category} |`);
        }
        if (report.visibility) {
            lines.push(`| Visibilidad | ${report.visibility} |`);
        }
        if (report.is_frozen) {
            lines.push(`| Congelado | Si (${formatDateEs(report.frozen_at as string)}) |`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
    }

    // Secciones del contenido
    const harveyResponse = report.harvey_response as Record<string, unknown>;
    if (harveyResponse && Object.keys(harveyResponse).length > 0) {
        const sections = extractSections(harveyResponse);
        for (const section of sections) {
            lines.push(`## ${section.title}`);
            lines.push('');
            if (Array.isArray(harveyResponse[section.key])) {
                const items = harveyResponse[section.key] as unknown[];
                for (const item of items) {
                    lines.push(`- ${typeof item === 'string' ? item : JSON.stringify(item)}`);
                }
            } else {
                lines.push(section.content);
            }
            lines.push('');
        }
    }

    // Evidence Pack
    if (options.include_evidence) {
        const evidencePack = report.evidence_pack as Record<string, unknown>;
        const sources = (evidencePack?.sources || []) as EvidenceSourceItem[];
        if (sources.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push('## Apendice: Evidence Pack');
            lines.push('');
            lines.push('| # | Tipo | URL | Fecha | Extracto |');
            lines.push('|---|------|-----|-------|----------|');
            for (const src of sources) {
                const srcId = src.id || '--';
                const srcType = src.type || '--';
                const srcUrl = src.url ? `[Enlace](${src.url})` : '--';
                const srcDate = src.date || '--';
                const srcSnippet = (src.snippet || '--').replace(/\|/g, '\\|').substring(0, 80);
                lines.push(`| ${srcId} | ${srcType} | ${srcUrl} | ${srcDate} | ${srcSnippet} |`);
            }
            lines.push('');
        }
    }

    // Aviso de confidencialidad
    if (options.include_confidentiality) {
        lines.push('---');
        lines.push('');
        lines.push('> **CONFIDENCIAL** — Este documento contiene informacion privilegiada y confidencial.');
        lines.push('> Su distribucion esta restringida a las partes autorizadas en el marco del proceso de due diligence.');
        lines.push('> Queda prohibida su reproduccion, distribucion o divulgacion sin autorizacion previa por escrito.');
        lines.push('');
    }

    return lines.join('\n');
}

function exportJson(
    report: Record<string, unknown>,
    options: ExportOptions
): string {
    const output: Record<string, unknown> = {
        report_id: report.id,
        report_type: report.report_type,
        status: report.status,
        version_number: report.version_number || 1,
        grounding_score: report.grounding_score || 0,
        is_frozen: report.is_frozen || false,
        created_at: report.created_at,
        updated_at: report.updated_at,
    };

    if (options.include_metadata) {
        output.metadata = {
            report_category: report.report_category,
            visibility: report.visibility,
            frozen_at: report.frozen_at,
            frozen_by: report.frozen_by,
            grounding_issues: report.grounding_issues,
        };
    }

    output.content = report.harvey_response;

    if (options.include_evidence) {
        output.evidence_pack = report.evidence_pack;
    }

    if (options.include_confidentiality) {
        output.confidentiality_notice = 'Este documento contiene informacion privilegiada y confidencial. Su distribucion esta restringida a las partes autorizadas.';
    }

    return JSON.stringify(output, null, 2);
}

function exportHtml(
    report: Record<string, unknown>,
    options: ExportOptions
): string {
    const reportType = (report.report_type as string || 'informe').replace(/_/g, ' ');
    const groundingScore = (report.grounding_score as number) || 0;
    const scoreColor = groundingScore >= 80 ? '#16a34a' : groundingScore >= 60 ? '#ca8a04' : '#dc2626';

    const lines: string[] = [];
    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="es">');
    lines.push('<head>');
    lines.push('<meta charset="UTF-8">');
    lines.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push(`<title>${escapeHtml(reportType)} - DD Legal PMO</title>`);
    lines.push('<style>');
    lines.push(`
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1a1a1a;
            line-height: 1.6;
            background: #fff;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            border-bottom: 3px solid #1e3a5f;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header-logo {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a5f;
            letter-spacing: -0.5px;
        }
        .header-subtitle {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
        }
        .report-title {
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
            margin-top: 16px;
            text-transform: capitalize;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
        }
        .meta-table td {
            padding: 8px 12px;
            border: 1px solid #e5e7eb;
        }
        .meta-table td:first-child {
            font-weight: 600;
            width: 180px;
            background: #f9fafb;
            color: #374151;
        }
        .score-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            color: #fff;
        }
        .frozen-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 12px;
            background: #dc2626;
            color: #fff;
        }
        h2 {
            font-size: 17px;
            font-weight: 700;
            color: #1e3a5f;
            margin: 28px 0 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
        }
        .section-content {
            font-size: 14px;
            color: #374151;
            white-space: pre-wrap;
            margin-bottom: 16px;
        }
        .section-content ul {
            padding-left: 20px;
            margin: 8px 0;
        }
        .section-content li {
            margin-bottom: 4px;
        }
        .evidence-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 12px;
        }
        .evidence-table th {
            background: #f3f4f6;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border: 1px solid #e5e7eb;
        }
        .evidence-table td {
            padding: 6px 10px;
            border: 1px solid #e5e7eb;
            vertical-align: top;
        }
        .evidence-table a {
            color: #2563eb;
            text-decoration: none;
        }
        .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 2px solid #1e3a5f;
            font-size: 11px;
            color: #6b7280;
        }
        .confidentiality {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px 16px;
            font-size: 12px;
            color: #92400e;
            margin-top: 20px;
        }
        pre {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px;
            overflow-x: auto;
            font-size: 12px;
        }
    `);
    lines.push('</style>');
    lines.push('</head>');
    lines.push('<body>');

    // Header con logo placeholder
    lines.push('<div class="header">');
    lines.push('<div class="header-logo">DD Legal PMO</div>');
    lines.push('<div class="header-subtitle">Due Diligence Legal &mdash; Project Management Office</div>');
    lines.push(`<div class="report-title">${escapeHtml(reportType)}</div>`);
    lines.push('</div>');

    // Tabla de metadatos
    if (options.include_metadata) {
        lines.push('<table class="meta-table">');
        lines.push(`<tr><td>Tipo de informe</td><td>${escapeHtml(reportType)}</td></tr>`);
        lines.push(`<tr><td>Fecha de creacion</td><td>${formatDateEs(report.created_at as string)}</td></tr>`);
        lines.push(`<tr><td>Version</td><td>v${report.version_number || 1}</td></tr>`);
        lines.push(`<tr><td>Estado</td><td>${escapeHtml(String(report.status))}</td></tr>`);
        lines.push(`<tr><td>Grounding Score</td><td><span class="score-badge" style="background:${scoreColor}">${groundingScore}/100</span></td></tr>`);
        if (report.report_category) {
            lines.push(`<tr><td>Categoria</td><td>${escapeHtml(String(report.report_category))}</td></tr>`);
        }
        if (report.visibility) {
            lines.push(`<tr><td>Visibilidad</td><td>${escapeHtml(String(report.visibility))}</td></tr>`);
        }
        if (report.is_frozen) {
            lines.push(`<tr><td>Congelado</td><td><span class="frozen-badge">Congelado</span> ${formatDateEs(report.frozen_at as string)}</td></tr>`);
        }
        lines.push('</table>');
    }

    // Secciones del contenido
    const harveyResponse = report.harvey_response as Record<string, unknown>;
    if (harveyResponse && Object.keys(harveyResponse).length > 0) {
        const sections = extractSections(harveyResponse);
        for (const section of sections) {
            lines.push(`<h2>${escapeHtml(section.title)}</h2>`);
            if (Array.isArray(harveyResponse[section.key])) {
                lines.push('<div class="section-content"><ul>');
                const items = harveyResponse[section.key] as unknown[];
                for (const item of items) {
                    const text = typeof item === 'string' ? item : JSON.stringify(item);
                    lines.push(`<li>${escapeHtml(text)}</li>`);
                }
                lines.push('</ul></div>');
            } else if (typeof harveyResponse[section.key] === 'object' && harveyResponse[section.key] !== null) {
                lines.push(`<pre>${escapeHtml(JSON.stringify(harveyResponse[section.key], null, 2))}</pre>`);
            } else {
                lines.push(`<div class="section-content">${escapeHtml(section.content)}</div>`);
            }
        }
    }

    // Evidence Pack
    if (options.include_evidence) {
        const evidencePack = report.evidence_pack as Record<string, unknown>;
        const sources = (evidencePack?.sources || []) as EvidenceSourceItem[];
        if (sources.length > 0) {
            lines.push('<div class="page-break"></div>');
            lines.push('<h2>Apendice: Evidence Pack</h2>');
            lines.push(`<p style="font-size:13px;color:#6b7280;margin-bottom:12px">${sources.length} fuentes indexadas</p>`);
            lines.push('<table class="evidence-table">');
            lines.push('<thead><tr><th>#</th><th>Tipo</th><th>URL</th><th>Fecha</th><th>Extracto</th></tr></thead>');
            lines.push('<tbody>');
            for (const src of sources) {
                const srcId = escapeHtml(src.id || '--');
                const srcType = escapeHtml(src.type || '--');
                const srcUrl = src.url
                    ? `<a href="${escapeHtml(src.url)}" target="_blank">${escapeHtml(src.url.substring(0, 50))}...</a>`
                    : '--';
                const srcDate = escapeHtml(src.date || '--');
                const srcSnippet = escapeHtml((src.snippet || '--').substring(0, 100));
                lines.push(`<tr><td>${srcId}</td><td>${srcType}</td><td>${srcUrl}</td><td>${srcDate}</td><td>${srcSnippet}</td></tr>`);
            }
            lines.push('</tbody></table>');
        }
    }

    // Footer
    lines.push('<div class="footer">');
    lines.push(`<p>Generado por DD Legal PMO &mdash; ${formatDateEs(new Date().toISOString())}</p>`);

    if (options.include_confidentiality) {
        lines.push('<div class="confidentiality">');
        lines.push('<strong>CONFIDENCIAL</strong> &mdash; Este documento contiene informacion privilegiada y confidencial. ');
        lines.push('Su distribucion esta restringida a las partes autorizadas en el marco del proceso de due diligence. ');
        lines.push('Queda prohibida su reproduccion, distribucion o divulgacion sin autorizacion previa por escrito.');
        lines.push('</div>');
    }

    lines.push('</div>');
    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
}

function exportCsv(
    report: Record<string, unknown>,
    _options: ExportOptions
): string {
    const rows: string[][] = [];

    // Cabecera con metadatos
    rows.push(['Campo', 'Valor']);
    rows.push(['report_id', String(report.id)]);
    rows.push(['report_type', String(report.report_type)]);
    rows.push(['version', String(report.version_number || 1)]);
    rows.push(['status', String(report.status)]);
    rows.push(['grounding_score', String(report.grounding_score || 0)]);
    rows.push(['created_at', String(report.created_at)]);
    rows.push(['is_frozen', String(report.is_frozen || false)]);
    rows.push(['']);

    // Extraer datos tabulares del harvey_response
    const harveyResponse = report.harvey_response as Record<string, unknown>;
    if (harveyResponse) {
        for (const [key, value] of Object.entries(harveyResponse)) {
            if (Array.isArray(value)) {
                rows.push([`--- ${key.toUpperCase()} ---`]);
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        const objItem = item as Record<string, unknown>;
                        const keys = Object.keys(objItem);
                        if (rows.length === 0 || rows[rows.length - 1][0]?.startsWith('---')) {
                            rows.push(keys);
                        }
                        rows.push(keys.map(k => String(objItem[k] ?? '')));
                    } else {
                        rows.push([String(item)]);
                    }
                }
                rows.push(['']);
            } else if (typeof value === 'string') {
                rows.push([key, value.substring(0, 500)]);
            }
        }
    }

    // Evidence sources
    const evidencePack = report.evidence_pack as Record<string, unknown>;
    const sources = (evidencePack?.sources || []) as EvidenceSourceItem[];
    if (sources.length > 0) {
        rows.push(['--- EVIDENCE SOURCES ---']);
        rows.push(['ID', 'Tipo', 'URL', 'Fecha', 'Snippet']);
        for (const src of sources) {
            rows.push([
                src.id || '',
                src.type || '',
                src.url || '',
                src.date || '',
                (src.snippet || '').substring(0, 200),
            ]);
        }
    }

    // Escapar CSV
    return rows.map(row =>
        row.map(cell => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',')
    ).join('\n');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { report_id, format, options: userOptions, project_id } = body as {
            report_id: string;
            format: 'markdown' | 'json' | 'html' | 'csv';
            options?: Partial<ExportOptions>;
            project_id?: string;
        };

        // Permission check — require can_view_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_reports');
            if (!authorized) return authError!;
        }

        if (!report_id) {
            return NextResponse.json({ error: 'report_id es requerido' }, { status: 400 });
        }

        const validFormats = ['markdown', 'json', 'html', 'csv'];
        if (!format || !validFormats.includes(format)) {
            return NextResponse.json(
                { error: `Formato invalido. Formatos disponibles: ${validFormats.join(', ')}` },
                { status: 400 }
            );
        }

        // Obtener informe
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('dd_reports')
            .select('*')
            .eq('id', report_id)
            .single();

        if (fetchError || !report) {
            return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        }

        const options: ExportOptions = {
            include_evidence: userOptions?.include_evidence !== false,
            include_metadata: userOptions?.include_metadata !== false,
            include_confidentiality: userOptions?.include_confidentiality !== false,
        };

        const reportType = (report.report_type as string || 'informe').replace(/_/g, '-');
        const version = report.version_number || 1;
        const dateStr = new Date().toISOString().split('T')[0];

        let content: string;
        let filename: string;
        let contentType: string;

        switch (format) {
            case 'markdown':
                content = exportMarkdown(report, options);
                filename = `${reportType}_v${version}_${dateStr}.md`;
                contentType = 'text/markdown; charset=utf-8';
                break;

            case 'json':
                content = exportJson(report, options);
                filename = `${reportType}_v${version}_${dateStr}.json`;
                contentType = 'application/json; charset=utf-8';
                break;

            case 'html':
                content = exportHtml(report, options);
                filename = `${reportType}_v${version}_${dateStr}.html`;
                contentType = 'text/html; charset=utf-8';
                break;

            case 'csv':
                content = exportCsv(report, options);
                filename = `${reportType}_v${version}_${dateStr}.csv`;
                contentType = 'text/csv; charset=utf-8';
                break;

            default:
                return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            content,
            filename,
            content_type: contentType,
            format,
            report_id,
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Error interno al exportar el informe' },
            { status: 500 }
        );
    }
}
