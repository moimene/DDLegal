'use client';

import {
    FileText, Shield, Download, Link2, Archive, CheckCircle2,
    Clock, Tag, Hash, Lock, Info, ChevronRight, X
} from 'lucide-react';
import type { VDRDocument, VDRDocumentVersion } from '@/lib/supabase';

interface DocumentPreviewProps {
    document: VDRDocument | null;
    versions: VDRDocumentVersion[];
    onAction: (action: string, docId: string) => void;
}

const VDR_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    staged: { label: 'Preparado', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    uploaded: { label: 'Subido', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    processing: { label: 'Procesando', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    indexed: { label: 'Indexado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    superseded: { label: 'Superado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    archived: { label: 'Archivado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
};

const CATEGORIES: Record<string, string> = {
    general: 'General',
    contrato: 'Contrato',
    escritura: 'Escritura',
    estatutos: 'Estatutos',
    cuentas_anuales: 'Cuentas Anuales',
    nomina: 'Nomina',
    poliza: 'Poliza',
    licencia: 'Licencia',
    sentencia: 'Sentencia',
    informe: 'Informe',
    certificado: 'Certificado',
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const docDateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

function formatDate(d: string): string {
    return docDateFormatter.format(new Date(d));
}

const docDateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function formatDateTime(d: string): string {
    return docDateTimeFormatter.format(new Date(d));
}

export default function DocumentPreview({ document: doc, versions, onAction }: DocumentPreviewProps) {
    if (!doc) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 300,
                textAlign: 'center',
                padding: 'var(--g-space-6)',
            }}>
                <FileText style={{
                    width: 40,
                    height: 40,
                    marginBottom: 'var(--g-space-3)',
                    color: 'var(--g-text-secondary)',
                    opacity: 0.3,
                }} />
                <p style={{ fontSize: '13px', color: 'var(--g-text-secondary)' }}>
                    Selecciona un documento para ver su detalle
                </p>
            </div>
        );
    }

    const status = VDR_STATUS[doc.status] || VDR_STATUS.draft;
    const latestVersion = versions.length > 0 ? versions[0] : null;

    const actions = [
        { key: 'download', icon: Download, label: 'Descargar', color: 'var(--g-brand-3308)' },
        { key: 'share', icon: Link2, label: 'Compartir Enlace', color: 'var(--g-text-primary)' },
        { key: 'archive', icon: Archive, label: 'Archivar', color: 'var(--g-text-secondary)' },
        { key: 'approve', icon: CheckCircle2, label: 'Aprobar', color: 'var(--status-success)' },
    ];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--g-space-4)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                    <FileText style={{ width: 18, height: 18, color: 'var(--g-brand-3308)', flexShrink: 0 }} />
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--g-text-primary)',
                        lineHeight: '1.3',
                    }}>
                        {doc.name}
                    </span>
                </div>
            </div>

            {/* Description */}
            {doc.description && (
                <p style={{
                    fontSize: '12px',
                    color: 'var(--g-text-secondary)',
                    lineHeight: '1.5',
                    margin: 0,
                }}>
                    {doc.description}
                </p>
            )}

            {/* Status + Confidentiality Row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--g-space-2)',
                flexWrap: 'wrap',
            }}>
                {/* Status badge */}
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: 'var(--g-radius-sm)',
                    backgroundColor: status.bg,
                    color: status.fg,
                    fontSize: '11px',
                    fontWeight: 600,
                }}>
                    {status.label}
                </span>

                {/* Confidential shield */}
                {doc.is_confidential && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: 'var(--status-error)',
                        color: 'var(--g-text-inverse)',
                        fontSize: '11px',
                        fontWeight: 600,
                    }}>
                        <Shield style={{ width: 11, height: 11 }} />
                        Confidencial
                    </span>
                )}

                {/* Approved badge */}
                {doc.approved_at && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: 'var(--status-success)',
                        color: 'var(--g-text-inverse)',
                        fontSize: '11px',
                        fontWeight: 600,
                    }}>
                        <CheckCircle2 style={{ width: 11, height: 11 }} />
                        Aprobado
                    </span>
                )}
            </div>

            {/* Category & Area */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--g-space-3)',
            }}>
                <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--g-text-secondary)', marginBottom: 2 }}>
                        Categoria
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-primary)', margin: 0 }}>
                        {CATEGORIES[doc.category] || doc.category}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--g-text-secondary)', marginBottom: 2 }}>
                        Area
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-primary)', margin: 0 }}>
                        {doc.area_code || 'General'}
                    </p>
                </div>
            </div>

            {/* Tags */}
            {doc.tags && doc.tags.length > 0 && (
                <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--g-text-secondary)', marginBottom: 6 }}>
                        Etiquetas
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {doc.tags.map((tag, i) => (
                            <span
                                key={i}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--g-radius-sm)',
                                    backgroundColor: 'var(--g-surface-muted)',
                                    color: 'var(--g-text-secondary)',
                                    fontSize: '11px',
                                }}
                            >
                                <Tag style={{ width: 10, height: 10 }} />
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Metadata Section */}
            {latestVersion && (
                <div style={{
                    borderTop: '1px solid var(--g-border-default)',
                    paddingTop: 'var(--g-space-3)',
                }}>
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--g-text-secondary)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <Info style={{ width: 11, height: 11 }} />
                        Metadatos
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                    }}>
                        <div>
                            <p style={{ fontSize: '10px', color: 'var(--g-text-secondary)', marginBottom: 1 }}>Tipo archivo</p>
                            <p style={{ fontSize: '12px', color: 'var(--g-text-primary)', margin: 0, fontFamily: 'monospace' }}>
                                {latestVersion.file_type.toUpperCase()}
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', color: 'var(--g-text-secondary)', marginBottom: 1 }}>Tamano</p>
                            <p style={{ fontSize: '12px', color: 'var(--g-text-primary)', margin: 0 }}>
                                {formatFileSize(latestVersion.file_size_bytes)}
                            </p>
                        </div>
                        {latestVersion.checksum_sha256 && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontSize: '10px', color: 'var(--g-text-secondary)', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Lock style={{ width: 9, height: 9 }} />
                                    SHA-256
                                </p>
                                <p style={{
                                    fontSize: '10px',
                                    color: 'var(--g-text-primary)',
                                    margin: 0,
                                    fontFamily: 'monospace',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {latestVersion.checksum_sha256.substring(0, 24)}...
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Version History Timeline */}
            <div style={{
                borderTop: '1px solid var(--g-border-default)',
                paddingTop: 'var(--g-space-3)',
            }}>
                <p style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--g-text-secondary)',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                }}>
                    <Clock style={{ width: 11, height: 11 }} />
                    Historial de Versiones ({versions.length})
                </p>

                {versions.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--g-text-secondary)', margin: 0 }}>
                        Sin versiones registradas.
                    </p>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        paddingLeft: 16,
                    }}>
                        {/* Vertical timeline line */}
                        <div style={{
                            position: 'absolute',
                            top: 6,
                            left: 5,
                            bottom: 6,
                            width: 2,
                            backgroundColor: 'var(--g-border-default)',
                            borderRadius: 1,
                        }} />

                        {versions.map((v, idx) => (
                            <div
                                key={v.id}
                                style={{
                                    position: 'relative',
                                    paddingBottom: idx < versions.length - 1 ? 12 : 0,
                                }}
                            >
                                {/* Timeline dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: -14,
                                    top: 4,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: idx === 0 ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                                    border: idx === 0 ? '2px solid var(--g-brand-3308)' : '2px solid var(--g-border-default)',
                                }} />

                                <div style={{
                                    padding: '6px 10px',
                                    borderRadius: 'var(--g-radius-sm)',
                                    border: '1px solid var(--g-border-default)',
                                    backgroundColor: idx === 0 ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 2,
                                    }}>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: 'var(--g-brand-3308)',
                                        }}>
                                            v{v.version_number}
                                        </span>
                                        {v.checksum_sha256 && (
                                            <CheckCircle2 style={{
                                                width: 12,
                                                height: 12,
                                                color: 'var(--status-success)',
                                            }} />
                                        )}
                                    </div>
                                    <p style={{
                                        fontSize: '11px',
                                        color: 'var(--g-text-primary)',
                                        margin: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {v.original_filename}
                                    </p>
                                    <p style={{
                                        fontSize: '10px',
                                        color: 'var(--g-text-secondary)',
                                        margin: '2px 0 0',
                                    }}>
                                        {formatFileSize(v.file_size_bytes)} &middot; {v.file_type} &middot; {formatDateTime(v.created_at)}
                                    </p>
                                    {v.change_notes && (
                                        <p style={{
                                            fontSize: '10px',
                                            color: 'var(--g-text-secondary)',
                                            margin: '4px 0 0',
                                            fontStyle: 'italic',
                                        }}>
                                            {v.change_notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div style={{
                borderTop: '1px solid var(--g-border-default)',
                paddingTop: 'var(--g-space-3)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
            }}>
                {actions.map((action) => (
                    <button
                        key={action.key}
                        onClick={() => onAction(action.key, doc.id)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            borderRadius: 'var(--g-radius-md)',
                            border: action.key === 'download'
                                ? 'none'
                                : '1px solid var(--g-border-default)',
                            backgroundColor: action.key === 'download'
                                ? 'var(--g-brand-3308)'
                                : 'var(--g-surface-card)',
                            color: action.key === 'download'
                                ? 'var(--g-text-inverse)'
                                : action.color,
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.15s',
                        }}
                    >
                        <action.icon style={{ width: 13, height: 13 }} />
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
