'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, FileText, Globe, Zap, PenLine, Bot, ExternalLink } from 'lucide-react';
import type { DDEvidence } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

const SOURCE_ICONS: Record<string, typeof FileText> = {
    document: FileText,
    registry_scrape: Globe,
    api_response: Zap,
    manual_entry: PenLine,
    ai_output: Bot,
};

const SOURCE_LABELS: Record<string, string> = {
    document: 'Documento',
    registry_scrape: 'Registro público',
    api_response: 'Respuesta API',
    manual_entry: 'Entrada manual',
    ai_output: 'Salida IA',
};

interface EvidenceDrawerProps {
    open: boolean;
    onClose: () => void;
    entityType: 'project' | 'task' | 'execution' | 'contingency';
    entityId: string;
    title?: string;
}

export default function EvidenceDrawer({ open, onClose, entityType, entityId, title }: EvidenceDrawerProps) {
    const [evidence, setEvidence] = useState<DDEvidence[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchEvidence = useCallback(async () => {
        setLoading(true);
        const paramMap: Record<string, string> = {
            project: 'project_id',
            task: 'task_id',
            execution: 'execution_id',
            contingency: 'contingency_id',
        };
        const param = paramMap[entityType];
        const resp = await fetch(`/api/evidence?${param}=${entityId}`);
        if (resp.ok) {
            const data = await resp.json();
            setEvidence(data.evidence || []);
        }
        setLoading(false);
    }, [entityType, entityId]);

    useEffect(() => {
        if (open && entityId) {
            fetchEvidence();
        }
    }, [open, entityId, fetchEvidence]);

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && open) onClose();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <aside
                className="fixed right-0 top-0 h-screen z-50 flex flex-col animate-fade-in"
                style={{
                    width: 'min(440px, 90vw)',
                    backgroundColor: 'var(--g-surface-card)',
                    boxShadow: 'var(--g-shadow-modal)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={title || 'Evidencias'}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--g-border-default)' }}
                >
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            {title || 'Evidencias'}
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                            {evidence.length} registro{evidence.length !== 1 ? 's' : ''} encontrado{evidence.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 transition-colors hover:opacity-80"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            color: 'var(--g-text-secondary)',
                        }}
                        aria-label="Cerrar panel de evidencias"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton h-20 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                            ))}
                        </div>
                    ) : evidence.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-12 text-center"
                        >
                            <FileText className="h-8 w-8 mb-2" style={{ color: 'var(--g-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                No hay evidencias registradas para esta entidad.
                            </p>
                        </div>
                    ) : (
                        evidence.map((ev) => {
                            const Icon = SOURCE_ICONS[ev.source_type] || FileText;
                            return (
                                <div
                                    key={ev.id}
                                    className="p-3 border transition-all"
                                    style={{
                                        borderColor: 'var(--g-border-subtle)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="p-1.5 shrink-0"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                            }}
                                        >
                                            <Icon className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className="text-[10px] font-medium uppercase px-1.5 py-0.5"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-surface-muted)',
                                                        color: 'var(--g-text-primary)',
                                                    }}
                                                >
                                                    {SOURCE_LABELS[ev.source_type] || ev.source_type}
                                                </span>
                                                {ev.confidence_score !== null && (
                                                    <span className="text-[10px]" style={{ color: 'var(--g-text-secondary)' }}>
                                                        Confianza: {Math.round(ev.confidence_score * 100)}%
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>
                                                {ev.source_name || ev.source_reference}
                                            </p>

                                            {ev.page_range && (
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                    Páginas: {ev.page_range}
                                                </p>
                                            )}

                                            {ev.snippet && (
                                                <p
                                                    className="text-xs mt-1.5 p-2 leading-relaxed"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'var(--g-surface-card)',
                                                        color: 'var(--g-text-primary)',
                                                        borderLeft: '3px solid var(--g-brand-3308)',
                                                    }}
                                                >
                                                    {ev.snippet}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                                    {formatDate(ev.created_at)}
                                                </span>
                                                {ev.source_reference.startsWith('http') && (
                                                    <a
                                                        href={ev.source_reference}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-0.5 text-[10px] hover:underline"
                                                        style={{ color: 'var(--g-link)' }}
                                                    >
                                                        Fuente <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>
        </>
    );
}
