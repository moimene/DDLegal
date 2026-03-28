'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Clock, Lock, Pencil, GitCompareArrows, Plus, Loader2,
    AlertCircle, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REPORT_VISIBILITY_CONFIG, getDateTimeFormatter } from '@/lib/utils';

interface VersionItem {
    id: string;
    version_number: number;
    is_frozen: boolean;
    frozen_at: string | null;
    frozen_by: string | null;
    grounding_score: number;
    status: string;
    report_category: string | null;
    visibility: string | null;
    created_at: string;
    updated_at: string;
}

interface ReportVersionHistoryProps {
    reportId: string;
    projectId: string;
    currentVersion: number;
    onSelectVersion: (reportId: string) => void;
}

function relativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'ahora mismo';
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays === 1) return 'hace 1 dia';
    if (diffDays < 30) return `hace ${diffDays} dias`;
    if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
    return `hace ${Math.floor(diffDays / 365)} anos`;
}

function formatDateShort(dateStr: string): string {
    try {
        return getDateTimeFormatter({
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

function GroundingBar({ score }: { score: number }) {
    const color = score >= 80
        ? 'var(--status-success)'
        : score >= 60
            ? 'var(--status-warning)'
            : 'var(--status-error)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
                style={{
                    flex: 1,
                    height: '6px',
                    backgroundColor: 'var(--g-surface-muted)',
                    borderRadius: 'var(--g-radius-full)',
                    overflow: 'hidden',
                    minWidth: '60px',
                }}
            >
                <div
                    style={{
                        width: `${score}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: 'var(--g-radius-full)',
                        transition: 'width 0.3s ease',
                    }}
                />
            </div>
            <span
                style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color,
                    minWidth: '28px',
                    textAlign: 'right',
                }}
            >
                {score}
            </span>
        </div>
    );
}

export default function ReportVersionHistory({
    reportId,
    projectId,
    currentVersion,
    onSelectVersion,
}: ReportVersionHistoryProps) {
    const [versions, setVersions] = useState<VersionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creatingVersion, setCreatingVersion] = useState(false);

    const loadVersions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/reports/${reportId}/versions`);
            const data = await res.json();

            if (data.success) {
                setVersions(data.versions || []);
            } else {
                setError(data.error || 'Error al cargar versiones');
            }
        } catch {
            setError('Error de conexion al cargar versiones');
        } finally {
            setLoading(false);
        }
    }, [reportId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    const handleCreateVersion = async () => {
        setCreatingVersion(true);
        try {
            const res = await fetch(`/api/reports/${reportId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ change_notes: 'Nueva version creada desde panel de versiones' }),
            });

            const data = await res.json();
            if (data.success && data.report) {
                await loadVersions();
                onSelectVersion(data.report.id);
            }
        } catch {
            setError('Error al crear nueva version');
        } finally {
            setCreatingVersion(false);
        }
    };

    // Determinar si la version actual esta congelada para mostrar boton de nueva version
    const currentVersionData = versions.find(v => v.version_number === currentVersion);
    const canCreateNewVersion = currentVersionData?.is_frozen === true;

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--g-space-8) 0',
                }}
            >
                <Loader2
                    className="animate-spin"
                    style={{ width: '20px', height: '20px', color: 'var(--g-brand-3308)' }}
                />
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: 'var(--g-space-4)',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--g-surface-card)',
                    border: '1px solid var(--status-error)',
                }}
            >
                <AlertCircle style={{ width: '16px', height: '16px', color: 'var(--status-error)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--status-error)' }}>{error}</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock style={{ width: '16px', height: '16px', color: 'var(--g-brand-3308)' }} />
                    <span
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--g-text-primary)',
                        }}
                    >
                        Historial de versiones
                    </span>
                    <span
                        style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 8px',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--g-surface-muted)',
                            color: 'var(--g-text-secondary)',
                        }}
                    >
                        {versions.length}
                    </span>
                </div>

                {canCreateNewVersion && (
                    <button
                        onClick={handleCreateVersion}
                        disabled={creatingVersion}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                            border: 'none',
                            cursor: creatingVersion ? 'not-allowed' : 'pointer',
                            opacity: creatingVersion ? 0.6 : 1,
                            transition: 'opacity 0.15s ease',
                        }}
                    >
                        {creatingVersion ? (
                            <Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} />
                        ) : (
                            <Plus style={{ width: '12px', height: '12px' }} />
                        )}
                        Nueva version
                    </button>
                )}
            </div>

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Linea vertical del timeline */}
                <div
                    style={{
                        position: 'absolute',
                        left: '7px',
                        top: '12px',
                        bottom: '12px',
                        width: '2px',
                        backgroundColor: 'var(--g-border-default)',
                    }}
                />

                {versions.map((version, idx) => {
                    const isCurrent = version.version_number === currentVersion;
                    const isLatest = idx === versions.length - 1;
                    const dotColor = isCurrent
                        ? 'var(--g-brand-3308)'
                        : version.is_frozen
                            ? 'var(--status-error)'
                            : 'var(--g-border-default)';

                    return (
                        <div
                            key={version.id}
                            style={{
                                position: 'relative',
                                paddingBottom: idx < versions.length - 1 ? 'var(--g-space-4)' : '0',
                            }}
                        >
                            {/* Timeline dot */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '-20px',
                                    top: '6px',
                                    width: isCurrent ? '14px' : '10px',
                                    height: isCurrent ? '14px' : '10px',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: dotColor,
                                    border: isCurrent ? '3px solid var(--g-surface-card)' : 'none',
                                    boxShadow: isCurrent ? `0 0 0 2px ${dotColor}` : 'none',
                                    transform: isCurrent ? 'translate(-2px, -2px)' : 'none',
                                }}
                            />

                            {/* Version card */}
                            <button
                                onClick={() => onSelectVersion(version.id)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 14px',
                                    borderRadius: 'var(--g-radius-lg)',
                                    border: isCurrent
                                        ? '2px solid var(--g-brand-3308)'
                                        : '1px solid var(--g-border-default)',
                                    backgroundColor: isCurrent
                                        ? 'var(--g-sec-100)'
                                        : 'var(--g-surface-card)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.borderColor = 'var(--g-brand-3308)';
                                        e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.borderColor = 'var(--g-border-default)';
                                        e.currentTarget.style.backgroundColor = 'var(--g-surface-card)';
                                    }
                                }}
                            >
                                {/* Row 1: Version badge + date */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '2px 8px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: isCurrent ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                                                color: isCurrent ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                                            }}
                                        >
                                            v{version.version_number}
                                        </span>

                                        {isLatest && (
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    padding: '1px 6px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--status-success)',
                                                    color: 'var(--g-text-inverse)',
                                                }}
                                            >
                                                Ultima
                                            </span>
                                        )}
                                    </div>

                                    <span
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--g-text-muted)',
                                        }}
                                    >
                                        {relativeTime(version.created_at)}
                                    </span>
                                </div>

                                {/* Row 2: Date + frozen status */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--g-text-secondary)' }}>
                                        {formatDateShort(version.created_at)}
                                    </span>

                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: version.is_frozen ? 'var(--status-error)' : 'var(--status-success)',
                                        }}
                                    >
                                        {version.is_frozen ? (
                                            <>
                                                <Lock style={{ width: '11px', height: '11px' }} />
                                                Congelado
                                            </>
                                        ) : (
                                            <>
                                                <Pencil style={{ width: '11px', height: '11px' }} />
                                                Editable
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Row 3: Grounding score */}
                                <div style={{ marginTop: '8px' }}>
                                    <GroundingBar score={version.grounding_score || 0} />
                                </div>

                                {/* Row 4: Badges */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                    {version.visibility && (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                padding: '1px 6px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                color: REPORT_VISIBILITY_CONFIG[version.visibility]?.color || 'var(--g-text-secondary)',
                                            }}
                                        >
                                            <Eye style={{ width: '10px', height: '10px' }} />
                                            {REPORT_VISIBILITY_CONFIG[version.visibility]?.label || version.visibility}
                                        </span>
                                    )}

                                    {idx > 0 && (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                padding: '1px 6px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                color: 'var(--g-link)',
                                                cursor: 'pointer',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Navigate to compare with previous version
                                                const prevVersion = versions[idx - 1];
                                                if (prevVersion) {
                                                    window.location.href = `/reports/${version.id}?compare=${prevVersion.id}`;
                                                }
                                            }}
                                        >
                                            <GitCompareArrows style={{ width: '10px', height: '10px' }} />
                                            Comparar
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    );
                })}

                {versions.length === 0 && (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: 'var(--g-space-6) 0',
                        }}
                    >
                        <Clock
                            style={{
                                width: '24px',
                                height: '24px',
                                color: 'var(--g-text-muted)',
                                margin: '0 auto 8px',
                            }}
                        />
                        <p style={{ fontSize: '13px', color: 'var(--g-text-secondary)' }}>
                            Sin historial de versiones disponible
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
