'use client';

import { useState, useCallback, useRef } from 'react';
import {
    Upload, X, FileText, ChevronDown, Shield, ShieldOff, Trash2
} from 'lucide-react';

export interface UploadFile {
    file: File;
    category: string;
    isConfidential: boolean;
}

interface QueuedFile {
    id: string;
    file: File;
    category: string;
    isConfidential: boolean;
    progress: number;
}

interface UploadDropzoneProps {
    folderId: string;
    areaCode: string;
    onUpload: (files: UploadFile[]) => void;
}

const CATEGORIES = [
    { value: 'general', label: 'General' },
    { value: 'contrato', label: 'Contrato' },
    { value: 'escritura', label: 'Escritura' },
    { value: 'estatutos', label: 'Estatutos' },
    { value: 'cuentas_anuales', label: 'Cuentas Anuales' },
    { value: 'nomina', label: 'Nomina' },
    { value: 'poliza', label: 'Poliza' },
    { value: 'licencia', label: 'Licencia' },
    { value: 'sentencia', label: 'Sentencia' },
    { value: 'informe', label: 'Informe' },
    { value: 'certificado', label: 'Certificado' },
];

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateId(): string {
    return `f_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export default function UploadDropzone({ folderId, areaCode, onUpload }: UploadDropzoneProps) {
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((files: FileList | File[]) => {
        const newFiles: QueuedFile[] = Array.from(files).map((file) => ({
            id: generateId(),
            file,
            category: 'general',
            isConfidential: false,
            progress: 0,
        }));
        setQueue((prev) => [...prev, ...newFiles]);
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    }, [addFiles]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
            e.target.value = '';
        }
    }, [addFiles]);

    const removeFile = useCallback((id: string) => {
        setQueue((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const updateCategory = useCallback((id: string, category: string) => {
        setQueue((prev) =>
            prev.map((f) => (f.id === id ? { ...f, category } : f))
        );
    }, []);

    const toggleConfidential = useCallback((id: string) => {
        setQueue((prev) =>
            prev.map((f) => (f.id === id ? { ...f, isConfidential: !f.isConfidential } : f))
        );
    }, []);

    const handleUploadAll = useCallback(() => {
        if (queue.length === 0) return;
        setIsUploading(true);

        // Mock progress animation
        const totalSteps = 20;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            const pct = Math.min((step / totalSteps) * 100, 100);
            setQueue((prev) =>
                prev.map((f) => ({
                    ...f,
                    progress: Math.min(pct + Math.random() * 10, 100),
                }))
            );

            if (step >= totalSteps) {
                clearInterval(interval);
                const uploadFiles: UploadFile[] = queue.map((f) => ({
                    file: f.file,
                    category: f.category,
                    isConfidential: f.isConfidential,
                }));
                onUpload(uploadFiles);
                setQueue([]);
                setIsUploading(false);
            }
        }, 100);
    }, [queue, onUpload]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--g-space-3)',
        }}>
            {/* Drop Zone Area */}
            <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--g-space-2)',
                    padding: 'var(--g-space-6)',
                    borderRadius: 'var(--g-radius-lg)',
                    border: isDragOver
                        ? '2px dashed var(--g-brand-3308)'
                        : '2px dashed var(--g-border-default)',
                    backgroundColor: isDragOver
                        ? 'color-mix(in srgb, var(--g-brand-3308) 6%, transparent)'
                        : 'var(--g-surface-card)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    minHeight: 120,
                }}
            >
                <Upload style={{
                    width: 28,
                    height: 28,
                    color: isDragOver ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                    transition: 'color 0.2s',
                }} />
                <p style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isDragOver ? 'var(--g-brand-3308)' : 'var(--g-text-primary)',
                    margin: 0,
                    transition: 'color 0.2s',
                }}>
                    {isDragOver ? 'Soltar archivos aqui' : 'Arrastra archivos o haz click para seleccionar'}
                </p>
                <p style={{
                    fontSize: '11px',
                    color: 'var(--g-text-secondary)',
                    margin: 0,
                }}>
                    PDF, DOCX, XLSX, JPG, PNG &middot; Max 50 MB por archivo
                </p>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                />
            </div>

            {/* Folder/Area info */}
            {(folderId || areaCode) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-2)',
                    fontSize: '11px',
                    color: 'var(--g-text-secondary)',
                }}>
                    {folderId && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 8px',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'var(--g-surface-muted)',
                        }}>
                            Carpeta: {folderId}
                        </span>
                    )}
                    {areaCode && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 8px',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'var(--g-surface-muted)',
                        }}>
                            Area: {areaCode}
                        </span>
                    )}
                </div>
            )}

            {/* Queued File List */}
            {queue.length > 0 && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                }}>
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--g-text-secondary)',
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Archivos en cola ({queue.length})
                    </p>

                    {queue.map((qf) => (
                        <div
                            key={qf.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                padding: '10px 12px',
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            {/* Top row: file name + remove */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--g-space-2)',
                            }}>
                                <FileText style={{
                                    width: 14,
                                    height: 14,
                                    flexShrink: 0,
                                    color: 'var(--g-brand-3308)',
                                }} />
                                <span style={{
                                    flex: 1,
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: 'var(--g-text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {qf.file.name}
                                </span>
                                <span style={{
                                    fontSize: '10px',
                                    color: 'var(--g-text-secondary)',
                                    flexShrink: 0,
                                }}>
                                    {formatFileSize(qf.file.size)}
                                </span>
                                <button
                                    onClick={() => removeFile(qf.id)}
                                    disabled={isUploading}
                                    title="Eliminar"
                                    aria-label={`Eliminar archivo ${qf.file.name}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 20,
                                        height: 20,
                                        border: 'none',
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--g-text-secondary)',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        flexShrink: 0,
                                        opacity: isUploading ? 0.5 : 1,
                                    }}
                                >
                                    <X style={{ width: 13, height: 13 }} />
                                </button>
                            </div>

                            {/* Controls row: category + confidential toggle */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--g-space-2)',
                            }}>
                                {/* Category select */}
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <select
                                        value={qf.category}
                                        onChange={(e) => updateCategory(qf.id, e.target.value)}
                                        disabled={isUploading}
                                        style={{
                                            width: '100%',
                                            height: 28,
                                            padding: '0 24px 0 8px',
                                            fontSize: '11px',
                                            borderRadius: 'var(--g-radius-sm)',
                                            border: '1px solid var(--g-border-default)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                            appearance: 'none',
                                            cursor: isUploading ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown style={{
                                        position: 'absolute',
                                        right: 6,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: 12,
                                        height: 12,
                                        color: 'var(--g-text-secondary)',
                                        pointerEvents: 'none',
                                    }} />
                                </div>

                                {/* Confidential toggle */}
                                <button
                                    onClick={() => toggleConfidential(qf.id)}
                                    disabled={isUploading}
                                    title={qf.isConfidential ? 'Confidencial' : 'No confidencial'}
                                    aria-label={qf.isConfidential ? 'Marcar como no confidencial' : 'Marcar como confidencial'}
                                    aria-pressed={qf.isConfidential}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 10px',
                                        height: 28,
                                        borderRadius: 'var(--g-radius-sm)',
                                        border: qf.isConfidential
                                            ? '1px solid var(--status-error)'
                                            : '1px solid var(--g-border-default)',
                                        backgroundColor: qf.isConfidential
                                            ? 'color-mix(in srgb, var(--status-error) 10%, transparent)'
                                            : 'var(--g-surface-card)',
                                        color: qf.isConfidential
                                            ? 'var(--status-error)'
                                            : 'var(--g-text-secondary)',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.15s',
                                        flexShrink: 0,
                                    }}
                                >
                                    {qf.isConfidential ? (
                                        <Shield style={{ width: 12, height: 12 }} />
                                    ) : (
                                        <ShieldOff style={{ width: 12, height: 12 }} />
                                    )}
                                    {qf.isConfidential ? 'Confidencial' : 'Publico'}
                                </button>
                            </div>

                            {/* Progress bar (mock) */}
                            {isUploading && (
                                <div style={{
                                    width: '100%',
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: 'var(--g-surface-muted)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        width: `${Math.round(qf.progress)}%`,
                                        height: '100%',
                                        borderRadius: 2,
                                        backgroundColor: qf.progress >= 100 ? 'var(--status-success)' : 'var(--g-brand-3308)',
                                        transition: 'width 0.15s ease',
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Upload All Button */}
                    <button
                        onClick={handleUploadAll}
                        disabled={isUploading || queue.length === 0}
                        aria-label={isUploading ? 'Subiendo archivos' : 'Subir todos los archivos'}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--g-space-2)',
                            padding: '10px 20px',
                            borderRadius: 'var(--g-radius-md)',
                            border: 'none',
                            backgroundColor: isUploading ? 'var(--g-surface-muted)' : 'var(--g-brand-3308)',
                            color: isUploading ? 'var(--g-text-secondary)' : 'var(--g-text-inverse)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.15s',
                            marginTop: 'var(--g-space-1)',
                        }}
                    >
                        <Upload style={{ width: 15, height: 15 }} />
                        {isUploading
                            ? 'Subiendo...'
                            : `Subir Todo (${queue.length} ${queue.length === 1 ? 'archivo' : 'archivos'})`
                        }
                    </button>
                </div>
            )}
        </div>
    );
}
