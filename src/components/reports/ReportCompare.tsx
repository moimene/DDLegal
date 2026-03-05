'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    GitCompareArrows, X, Loader2, AlertCircle,
    Plus, Minus, Pencil, Lock, Unlock, ArrowRight
} from 'lucide-react';

interface ReportSummary {
    id: string;
    version_number: number;
    created_at: string;
    grounding_score: number;
    status: string;
    is_frozen: boolean;
}

interface ChangeItem {
    field: string;
    old_value: unknown;
    new_value: unknown;
    change_type: 'added' | 'removed' | 'modified';
}

interface CompareStats {
    total: number;
    added: number;
    removed: number;
    modified: number;
}

interface CompareResult {
    report_a: ReportSummary;
    report_b: ReportSummary;
    changes: ChangeItem[];
    stats: CompareStats;
    summary: string;
}

interface ReportCompareProps {
    reportIdA: string;
    reportIdB: string;
    onClose: () => void;
}

const reportCompareDateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

function formatDateShort(dateStr: string): string {
    try {
        return reportCompareDateFormatter.format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

function truncateValue(val: unknown, maxLen: number = 150): string {
    if (val === null || val === undefined) return '--';
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    if (str.length > maxLen) return str.substring(0, maxLen) + '...';
    return str;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Plus }> = {
    added: { label: 'Anadido', color: 'var(--status-success)', bg: 'var(--g-source-bg)', icon: Plus },
    removed: { label: 'Eliminado', color: 'var(--status-error)', bg: 'var(--g-priority-p0-bg)', icon: Minus },
    modified: { label: 'Modificado', color: 'var(--status-warning)', bg: 'var(--g-priority-p2-bg)', icon: Pencil },
};

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80
        ? 'var(--status-success)'
        : score >= 60
            ? 'var(--status-warning)'
            : 'var(--status-error)';

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--g-radius-full)',
                border: `3px solid ${color}`,
                fontSize: '12px',
                fontWeight: 700,
                color,
            }}
        >
            {score}
        </span>
    );
}

function VersionHeader({ report, label }: { report: ReportSummary; label: string }) {
    return (
        <div
            style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 'var(--g-radius-lg)',
                border: '1px solid var(--g-border-default)',
                backgroundColor: 'var(--g-surface-card)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                    style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--g-text-muted)',
                    }}
                >
                    {label}
                </span>
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                    }}
                >
                    v{report.version_number}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ScoreBadge score={report.grounding_score} />
                <div>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-secondary)' }}>
                        {formatDateShort(report.created_at)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {report.is_frozen ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: 'var(--status-error)' }}>
                                <Lock style={{ width: '11px', height: '11px' }} />
                                Congelado
                            </span>
                        ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: 'var(--status-success)' }}>
                                <Unlock style={{ width: '11px', height: '11px' }} />
                                Editable
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ReportCompare({
    reportIdA,
    reportIdB,
    onClose,
}: ReportCompareProps) {
    const [result, setResult] = useState<CompareResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadComparison = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/reports/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_id_a: reportIdA,
                    report_id_b: reportIdB,
                }),
            });

            const data = await res.json();

            if (data.success) {
                setResult({
                    report_a: data.report_a,
                    report_b: data.report_b,
                    changes: data.changes,
                    stats: data.stats,
                    summary: data.summary,
                });
            } else {
                setError(data.error || 'Error al comparar informes');
            }
        } catch {
            setError('Error de conexion al comparar');
        } finally {
            setLoading(false);
        }
    }, [reportIdA, reportIdB]);

    useEffect(() => {
        loadComparison();
    }, [loadComparison]);

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--g-space-8)',
                    gap: '12px',
                }}
            >
                <Loader2
                    className="animate-spin"
                    style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)' }}
                />
                <p style={{ fontSize: '13px', color: 'var(--g-text-secondary)' }}>
                    Comparando versiones...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    padding: 'var(--g-space-6)',
                }}
            >
                <AlertCircle style={{ width: '24px', height: '24px', color: 'var(--status-error)' }} />
                <p style={{ fontSize: '13px', color: 'var(--status-error)' }}>{error}</p>
                <button
                    onClick={onClose}
                    style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: 'var(--g-radius-md)',
                        border: '1px solid var(--g-border-default)',
                        backgroundColor: 'var(--g-surface-card)',
                        color: 'var(--g-text-primary)',
                        cursor: 'pointer',
                    }}
                >
                    Cerrar
                </button>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--g-space-5)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GitCompareArrows style={{ width: '18px', height: '18px', color: 'var(--g-brand-3308)' }} />
                    <span
                        style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: 'var(--g-text-primary)',
                        }}
                    >
                        Comparacion de versiones
                    </span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--g-radius-md)',
                        border: '1px solid var(--g-border-default)',
                        backgroundColor: 'var(--g-surface-card)',
                        color: 'var(--g-text-secondary)',
                        cursor: 'pointer',
                    }}
                >
                    <X style={{ width: '14px', height: '14px' }} />
                </button>
            </div>

            {/* Split view: Version A | arrow | Version B */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px' }}>
                <VersionHeader report={result.report_a} label="Version A" />
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <ArrowRight style={{ width: '20px', height: '20px', color: 'var(--g-text-muted)' }} />
                </div>
                <VersionHeader report={result.report_b} label="Version B" />
            </div>

            {/* Stats summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(['added', 'modified', 'removed'] as const).map(type => {
                    const cfg = CHANGE_TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    const count = result.stats[type];

                    return (
                        <div
                            key={type}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 14px',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: cfg.bg,
                                border: `1px solid ${cfg.color}30`,
                            }}
                        >
                            <Icon style={{ width: '16px', height: '16px', color: cfg.color, flexShrink: 0 }} />
                            <div>
                                <span
                                    style={{
                                        display: 'block',
                                        fontSize: '18px',
                                        fontWeight: 800,
                                        color: cfg.color,
                                        lineHeight: 1,
                                    }}
                                >
                                    {count}
                                </span>
                                <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>
                                    {cfg.label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div
                style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--g-surface-subtle)',
                    fontSize: '13px',
                    color: 'var(--g-text-secondary)',
                    lineHeight: 1.5,
                }}
            >
                {result.summary}
            </div>

            {/* Changes list */}
            {result.changes.length > 0 ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                    }}
                >
                    <span
                        style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--g-text-muted)',
                            marginBottom: '4px',
                        }}
                    >
                        Detalle de cambios ({result.changes.length})
                    </span>

                    {result.changes.map((change, idx) => {
                        const cfg = CHANGE_TYPE_CONFIG[change.change_type];
                        const Icon = cfg.icon;

                        return (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    borderRadius: 'var(--g-radius-md)',
                                    border: '1px solid var(--g-border-subtle)',
                                    backgroundColor: 'var(--g-surface-card)',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: cfg.bg,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon style={{ width: '12px', height: '12px', color: cfg.color }} />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: 'var(--g-text-primary)',
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {change.field}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                padding: '1px 6px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: cfg.bg,
                                                color: cfg.color,
                                            }}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {change.change_type === 'modified' && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '120px' }}>
                                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                                    Antes
                                                </span>
                                                <span
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '11px',
                                                        color: 'var(--status-error)',
                                                        fontFamily: 'monospace',
                                                        padding: '4px 6px',
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'hsla(0, 72%, 51%, 0.05)',
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {truncateValue(change.old_value)}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '120px' }}>
                                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                                    Despues
                                                </span>
                                                <span
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '11px',
                                                        color: 'var(--status-success)',
                                                        fontFamily: 'monospace',
                                                        padding: '4px 6px',
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'hsla(160, 60%, 35%, 0.05)',
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {truncateValue(change.new_value)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {change.change_type === 'added' && (
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: '11px',
                                                color: 'var(--status-success)',
                                                fontFamily: 'monospace',
                                                padding: '4px 6px',
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'hsla(160, 60%, 35%, 0.05)',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            + {truncateValue(change.new_value)}
                                        </span>
                                    )}

                                    {change.change_type === 'removed' && (
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: '11px',
                                                color: 'var(--status-error)',
                                                fontFamily: 'monospace',
                                                padding: '4px 6px',
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'hsla(0, 72%, 51%, 0.05)',
                                                wordBreak: 'break-word',
                                                textDecoration: 'line-through',
                                            }}
                                        >
                                            - {truncateValue(change.old_value)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: 'var(--g-space-8)',
                        gap: '8px',
                    }}
                >
                    <GitCompareArrows style={{ width: '28px', height: '28px', color: 'var(--g-text-muted)' }} />
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                        Sin diferencias
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-secondary)' }}>
                        Las dos versiones son identicas en contenido y configuracion
                    </p>
                </div>
            )}
        </div>
    );
}
