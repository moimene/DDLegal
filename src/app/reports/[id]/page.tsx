'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, FileBarChart, ChevronDown, ChevronUp,
    AlertTriangle, AlertCircle, Info, Bot, FileText,
    ExternalLink, Loader2, Lock, Eye, Shield
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDReport } from '@/lib/supabase';
import { cn, formatDate, REPORT_FAMILY_CONFIG, REPORT_CATEGORY_CONFIG, REPORT_VISIBILITY_CONFIG } from '@/lib/utils';
import { FreezeControl, ReportVersionHistory, ReportExportPanel } from '@/components/reports';

const REPORT_STATUS_CONFIG: Record<DDReport['status'], { label: string; bg: string; fg: string }> = {
    pending:    { label: 'Pendiente',   bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    generating: { label: 'Generando',   bg: 'var(--status-info)',     fg: 'var(--g-text-inverse)' },
    done:       { label: 'Completado',  bg: 'var(--status-success)',  fg: 'var(--g-text-inverse)' },
    failed:     { label: 'Fallido',     bg: 'var(--status-error)',    fg: 'var(--g-text-inverse)' },
};

function inferFamily(reportType: string): string {
    if (reportType.startsWith('pmo_')) return 'pmo';
    if (reportType.startsWith('compliance_')) return 'compliance';
    return 'transactional';
}

const ISSUE_SEVERITY_CONFIG: Record<string, { label: string; bg: string; fg: string; Icon: typeof AlertTriangle }> = {
    error:   { label: 'Error',   bg: 'var(--status-error)',   fg: 'var(--g-text-inverse)', Icon: AlertCircle },
    warning: { label: 'Warning', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)', Icon: AlertTriangle },
    info:    { label: 'Info',    bg: 'var(--status-info)',     fg: 'var(--g-text-inverse)', Icon: Info },
};

function GroundingMeter({ score }: { score: number }) {
    const color = score < 60 ? 'var(--status-error)' : score < 80 ? 'var(--status-warning)' : 'var(--status-success)';
    const label = score < 60 ? 'Bajo' : score < 80 ? 'Medio' : 'Alto';

    return (
        <div className="flex items-center gap-4">
            {/* Circular indicator */}
            <div className="relative" style={{ width: 64, height: 64 }}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke="var(--g-surface-muted)"
                        strokeWidth="6"
                    />
                    <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                        transform="rotate(-90 32 32)"
                        style={{ transition: 'stroke-dasharray var(--g-transition-smooth)' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold" style={{ color }}>{score}</span>
                </div>
            </div>
            <div>
                <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                    Grounding Score
                </p>
                <p className="text-xs" style={{ color }}>
                    {label}
                </p>
            </div>
        </div>
    );
}

function CollapsiblePanel({ title, icon: Icon, children, defaultOpen = false }: {
    title: string;
    icon: typeof FileText;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div
            className="border overflow-hidden"
            style={{
                borderColor: 'var(--g-border-default)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
            }}
        >
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-3 transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        {title}
                    </span>
                </div>
                {open ? (
                    <ChevronUp className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                )}
            </button>
            {open && (
                <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--g-border-subtle)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

function renderHarveyResponse(response: Record<string, unknown>) {
    if (!response || Object.keys(response).length === 0) {
        return (
            <p className="text-sm py-4" style={{ color: 'var(--g-text-secondary)' }}>
                Sin respuesta disponible
            </p>
        );
    }

    // Known structured keys
    const structuredKeys = ['summary', 'resumen', 'findings', 'hallazgos', 'recommendations', 'recomendaciones', 'conclusions', 'conclusiones'];
    const hasStructuredKeys = Object.keys(response).some(k => structuredKeys.includes(k.toLowerCase()));

    if (hasStructuredKeys) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }} className="pt-4">
                {Object.entries(response).map(([key, value]) => (
                    <div key={key}>
                        <h4
                            className="text-sm font-bold mb-2 capitalize"
                            style={{ color: 'var(--g-text-primary)' }}
                        >
                            {key.replace(/_/g, ' ')}
                        </h4>
                        {typeof value === 'string' ? (
                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--g-text-secondary)' }}>
                                {value}
                            </p>
                        ) : Array.isArray(value) ? (
                            <ul className="space-y-1">
                                {value.map((item, i) => (
                                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--g-text-secondary)' }}>
                                        <span style={{ color: 'var(--g-brand-3308)' }}>-</span>
                                        <span>{typeof item === 'string' ? item : JSON.stringify(item, null, 2)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <pre
                                className="text-xs overflow-x-auto p-3"
                                style={{
                                    backgroundColor: 'var(--g-surface-subtle)',
                                    borderRadius: 'var(--g-radius-md)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                {JSON.stringify(value, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // Fallback: formatted JSON
    return (
        <pre
            className="text-xs overflow-x-auto p-4 mt-4"
            style={{
                backgroundColor: 'var(--g-surface-subtle)',
                borderRadius: 'var(--g-radius-md)',
                color: 'var(--g-text-primary)',
                maxHeight: 500,
            }}
        >
            {JSON.stringify(response, null, 2)}
        </pre>
    );
}

export default function ReportViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [report, setReport] = useState<DDReport | null>(null);
    const [loading, setLoading] = useState(true);

    const loadReport = useCallback(async () => {
        const { data } = await supabase
            .from('dd_reports')
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            setReport(data as DDReport);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    // Poll for updates if pending or generating
    useEffect(() => {
        if (!report) return;
        if (report.status !== 'pending' && report.status !== 'generating') return;

        const interval = setInterval(async () => {
            const { data } = await supabase
                .from('dd_reports')
                .select('*')
                .eq('id', id)
                .single();

            if (data) {
                setReport(data as DDReport);
                if (data.status !== 'pending' && data.status !== 'generating') {
                    clearInterval(interval);
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [report, id]);

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-40 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div className="skeleton h-64 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <Link
                    href="/reports"
                    className="inline-flex items-center gap-1 text-sm"
                    style={{ color: 'var(--g-link)' }}
                >
                    <ArrowLeft className="h-4 w-4" /> Volver a informes
                </Link>
                <div className="text-center py-16">
                    <FileBarChart className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--g-sec-300)' }} />
                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Informe no encontrado</p>
                </div>
            </div>
        );
    }

    const family = inferFamily(report.report_type);
    const familyCfg = REPORT_FAMILY_CONFIG[family];
    const statusCfg = REPORT_STATUS_CONFIG[report.status];
    const isProcessing = report.status === 'pending' || report.status === 'generating';
    const evidenceSources = (report.evidence_pack as Record<string, unknown>)?.sources as Array<Record<string, unknown>> | undefined;
    const categoryCfg = report.report_category ? REPORT_CATEGORY_CONFIG[report.report_category] : null;
    const visibilityCfg = report.visibility ? REPORT_VISIBILITY_CONFIG[report.visibility] : null;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Back link */}
            <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-sm"
                style={{ color: 'var(--g-link)' }}
            >
                <ArrowLeft className="h-4 w-4" /> Volver a informes
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1
                        className="font-bold capitalize"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        {report.report_type.replace(/_/g, ' ')}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        Creado: {formatDate(report.created_at)}
                        {report.updated_at && report.updated_at !== report.created_at && (
                            <> &middot; Actualizado: {formatDate(report.updated_at)}</>
                        )}
                        {report.is_frozen && report.frozen_at && (
                            <> &middot; <span style={{ color: 'var(--status-error)' }}>Congelado: {formatDate(report.frozen_at)}</span></>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {familyCfg && (
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: familyCfg.bg,
                                color: familyCfg.fg,
                            }}
                        >
                            {familyCfg.label}
                        </span>
                    )}
                    {categoryCfg && (
                        <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: categoryCfg.bg,
                                color: categoryCfg.fg,
                            }}
                        >
                            <Shield className="h-3 w-3" />
                            {categoryCfg.label}
                        </span>
                    )}
                    {visibilityCfg && (
                        <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--g-surface-muted)',
                                color: visibilityCfg.color,
                                border: `1px solid ${visibilityCfg.color}40`,
                            }}
                        >
                            <Eye className="h-3 w-3" />
                            {visibilityCfg.label}
                        </span>
                    )}
                    {report.is_frozen && (
                        <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--status-error)',
                                color: 'var(--g-text-inverse)',
                            }}
                        >
                            <Lock className="h-3 w-3" />
                            Congelado
                        </span>
                    )}
                    {report.version_number && report.version_number > 1 && (
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--g-surface-muted)',
                                color: 'var(--g-text-secondary)',
                            }}
                        >
                            v{report.version_number}
                        </span>
                    )}
                    <span
                        className={cn(
                            'inline-flex items-center px-3 py-1 text-sm font-medium',
                            isProcessing && 'animate-pulse'
                        )}
                        style={{
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: statusCfg.bg,
                            color: statusCfg.fg,
                        }}
                    >
                        {isProcessing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                        {statusCfg.label}
                    </span>
                </div>
            </div>

            {/* Action Bar: Freeze + Export */}
            {!isProcessing && report.status === 'done' && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-3)',
                        flexWrap: 'wrap',
                    }}
                >
                    <FreezeControl
                        reportId={report.id}
                        isFrozen={report.is_frozen ?? false}
                        frozenAt={report.frozen_at ?? null}
                        frozenBy={report.frozen_by ?? null}
                        reportStatus={report.status}
                        onFreezeChange={() => loadReport()}
                    />
                    <ReportExportPanel
                        reportId={report.id}
                        reportType={report.report_type}
                        versionNumber={report.version_number ?? 1}
                    />
                </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
                <div
                    className="p-5 border animate-pulse"
                    style={{
                        backgroundColor: 'var(--g-surface-card)',
                        borderColor: 'var(--status-info)',
                        borderRadius: 'var(--g-radius-lg)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--status-info)' }} />
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                {report.status === 'pending' ? 'Informe en cola de generacion...' : 'Harvey AI esta generando el informe...'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                Esta pagina se actualiza automaticamente cada 5 segundos
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Frozen Notice */}
            {report.is_frozen && !isProcessing && (
                <div
                    className="p-4 border flex items-center gap-3"
                    style={{
                        backgroundColor: 'var(--g-surface-card)',
                        borderColor: 'var(--status-error)',
                        borderRadius: 'var(--g-radius-lg)',
                    }}
                >
                    <Lock className="h-5 w-5 shrink-0" style={{ color: 'var(--status-error)' }} />
                    <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                            Este informe esta congelado y no puede ser editado
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                            Congelado el {formatDate(report.frozen_at || '')}
                            {report.version_number && <> &middot; Version {report.version_number}</>}
                        </p>
                    </div>
                </div>
            )}

            {/* Grounding Score Section */}
            <div
                className="p-5 border"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <GroundingMeter score={report.grounding_score} />

                    {/* Grounding Issues */}
                    {report.grounding_issues && report.grounding_issues.length > 0 && (
                        <div className="flex-1" style={{ minWidth: 280 }}>
                            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--g-text-muted)' }}>
                                Problemas de Grounding ({report.grounding_issues.length})
                            </p>
                            <div className="space-y-1.5" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                {report.grounding_issues.map((issue, i) => {
                                    const severity = (issue as Record<string, unknown>).severity as string;
                                    const issueCfg = ISSUE_SEVERITY_CONFIG[severity] || ISSUE_SEVERITY_CONFIG.info;
                                    const IssueIcon = issueCfg.Icon;

                                    return (
                                        <div
                                            key={i}
                                            className="flex items-start gap-2 p-2"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                            }}
                                        >
                                            <span
                                                className="inline-flex items-center justify-center h-5 w-5 shrink-0 mt-0.5"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: issueCfg.bg,
                                                    color: issueCfg.fg,
                                                }}
                                            >
                                                <IssueIcon className="h-3 w-3" />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    {((issue as Record<string, unknown>).type as string || '').replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {(issue as Record<string, unknown>).detail as string}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {report.grounding_issues && report.grounding_issues.length === 0 && report.status === 'done' && (
                        <div className="flex-1 flex items-center gap-2" style={{ minWidth: 200 }}>
                            <Info className="h-4 w-4" style={{ color: 'var(--g-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Sin problemas de grounding detectados
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Harvey Response Section */}
            <div
                className="p-5 border"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Bot className="h-5 w-5" style={{ color: 'var(--g-brand-bright)' }} />
                    <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Respuesta Harvey AI
                    </h2>
                </div>
                {renderHarveyResponse(report.harvey_response)}
            </div>

            {/* Evidence Pack Section */}
            <CollapsiblePanel title="Evidence Pack" icon={FileText} defaultOpen={false}>
                {evidenceSources && evidenceSources.length > 0 ? (
                    <div className="overflow-x-auto mt-4">
                        <table className="w-full min-w-[600px]">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                                    {['ID', 'Tipo', 'URL', 'Fecha', 'Snippet'].map(h => (
                                        <th
                                            key={h}
                                            className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                                            style={{ color: 'var(--g-text-muted)' }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                {evidenceSources.map((src, i) => (
                                    <tr key={i}>
                                        <td className="px-3 py-2 text-xs font-mono font-medium" style={{ color: 'var(--g-brand-3308)' }}>
                                            {src.id as string || `SRC-${String(i + 1).padStart(3, '0')}`}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className="px-2 py-0.5 text-xs font-medium"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-muted)',
                                                    color: 'var(--g-text-secondary)',
                                                }}
                                            >
                                                {src.type as string}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ maxWidth: 200 }}>
                                            {src.url ? (
                                                <a
                                                    href={src.url as string}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 truncate"
                                                    style={{ color: 'var(--g-link)' }}
                                                >
                                                    <span className="truncate">{src.url as string}</span>
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                </a>
                                            ) : (
                                                <span style={{ color: 'var(--g-text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {src.date as string || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--g-text-secondary)', maxWidth: 250 }}>
                                            <span className="line-clamp-2">{src.snippet as string || '-'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm py-4" style={{ color: 'var(--g-text-secondary)' }}>
                        Sin fuentes de evidencia disponibles en este informe
                    </p>
                )}

                {/* Additional evidence pack metadata */}
                {report.evidence_pack && Object.keys(report.evidence_pack).length > 0 && (
                    <div className="mt-4">
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--g-text-muted)' }}>
                            Metadatos del Evidence Pack
                        </p>
                        <pre
                            className="text-xs overflow-x-auto p-3"
                            style={{
                                backgroundColor: 'var(--g-surface-subtle)',
                                borderRadius: 'var(--g-radius-md)',
                                color: 'var(--g-text-primary)',
                                maxHeight: 200,
                            }}
                        >
                            {JSON.stringify(
                                {
                                    evidence_pack_version: (report.evidence_pack as Record<string, unknown>).evidence_pack_version,
                                    total_sources: evidenceSources?.length || 0,
                                    metadata: (report.evidence_pack as Record<string, unknown>).metadata,
                                },
                                null,
                                2
                            )}
                        </pre>
                    </div>
                )}
            </CollapsiblePanel>

            {/* Version History */}
            <ReportVersionHistory
                reportId={report.id}
                projectId={report.request_id ?? ''}
                currentVersion={report.version_number ?? 1}
                onSelectVersion={(versionReportId) => router.push(`/reports/${versionReportId}`)}
            />

            {/* Prompt Used Section */}
            <CollapsiblePanel title="Prompt Utilizado" icon={Bot} defaultOpen={false}>
                {report.prompt_used ? (
                    <pre
                        className="text-xs whitespace-pre-wrap overflow-x-auto p-4 mt-4"
                        style={{
                            backgroundColor: 'var(--g-surface-subtle)',
                            borderRadius: 'var(--g-radius-md)',
                            color: 'var(--g-text-primary)',
                            maxHeight: 400,
                        }}
                    >
                        {report.prompt_used}
                    </pre>
                ) : (
                    <p className="text-sm py-4" style={{ color: 'var(--g-text-secondary)' }}>
                        Sin prompt registrado para este informe
                    </p>
                )}
            </CollapsiblePanel>
        </div>
    );
}
