'use client';

import { useState } from 'react';
import { FileText, Code, Globe, Table, Loader2, Download, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ReportExportPanelProps {
    reportId: string;
    reportType: string;
    versionNumber: number;
}

interface ExportFormat {
    key: 'markdown' | 'json' | 'html' | 'csv';
    label: string;
    icon: typeof FileText;
    description: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
    { key: 'markdown', label: 'Markdown', icon: FileText, description: 'Texto estructurado con tablas y citas' },
    { key: 'json', label: 'JSON', icon: Code, description: 'Datos estructurados para integraciones' },
    { key: 'html', label: 'HTML', icon: Globe, description: 'Documento HTML listo para imprimir' },
    { key: 'csv', label: 'CSV', icon: Table, description: 'Datos tabulares para hojas de calculo' },
];

export default function ReportExportPanel({
    reportId,
    reportType,
    versionNumber,
}: ReportExportPanelProps) {
    const [exporting, setExporting] = useState<string | null>(null);
    const [lastExported, setLastExported] = useState<string | null>(null);

    // Opciones de exportacion
    const [includeEvidence, setIncludeEvidence] = useState(true);
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [includeConfidentiality, setIncludeConfidentiality] = useState(true);

    const handleExport = async (format: ExportFormat['key']) => {
        setExporting(format);

        try {
            const res = await fetch('/api/reports/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_id: reportId,
                    format,
                    options: {
                        include_evidence: includeEvidence,
                        include_metadata: includeMetadata,
                        include_confidentiality: includeConfidentiality,
                    },
                }),
            });

            const data = await res.json();

            if (!data.success) {
                toast.error(data.error || 'Error al exportar');
                return;
            }

            // Crear blob y descargar
            const blob = new Blob([data.content], { type: data.content_type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setLastExported(format);
            toast.success(`Exportado como ${format.toUpperCase()}`, {
                description: data.filename,
            });

            // Resetear indicador despues de 3 segundos
            setTimeout(() => setLastExported(null), 3000);
        } catch {
            toast.error('Error de conexion al exportar');
        } finally {
            setExporting(null);
        }
    };

    // Calcular preview del filename
    const dateStr = new Date().toISOString().split('T')[0];
    const typeSlug = reportType.replace(/_/g, '-');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download style={{ width: '16px', height: '16px', color: 'var(--g-brand-3308)' }} />
                <span
                    style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--g-text-primary)',
                    }}
                >
                    Exportar informe
                </span>
            </div>

            {/* Format buttons */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                }}
            >
                {EXPORT_FORMATS.map(fmt => {
                    const Icon = fmt.icon;
                    const isExporting = exporting === fmt.key;
                    const justExported = lastExported === fmt.key;

                    return (
                        <button
                            key={fmt.key}
                            onClick={() => handleExport(fmt.key)}
                            disabled={exporting !== null}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '14px 8px',
                                borderRadius: 'var(--g-radius-lg)',
                                border: justExported
                                    ? '2px solid var(--status-success)'
                                    : '1px solid var(--g-border-default)',
                                backgroundColor: justExported
                                    ? 'var(--g-surface-subtle)'
                                    : 'var(--g-surface-card)',
                                cursor: exporting !== null ? 'not-allowed' : 'pointer',
                                opacity: exporting !== null && !isExporting ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!exporting) {
                                    e.currentTarget.style.borderColor = 'var(--g-brand-3308)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!justExported) {
                                    e.currentTarget.style.borderColor = 'var(--g-border-default)';
                                }
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {isExporting ? (
                                <Loader2
                                    className="animate-spin"
                                    style={{ width: '20px', height: '20px', color: 'var(--g-brand-3308)' }}
                                />
                            ) : justExported ? (
                                <Check
                                    style={{ width: '20px', height: '20px', color: 'var(--status-success)' }}
                                />
                            ) : (
                                <Icon
                                    style={{ width: '20px', height: '20px', color: 'var(--g-brand-3308)' }}
                                />
                            )}

                            <span
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: justExported ? 'var(--status-success)' : 'var(--g-text-primary)',
                                }}
                            >
                                {fmt.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filename preview */}
            <div
                style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--g-surface-subtle)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: 'var(--g-text-secondary)',
                }}
            >
                {typeSlug}_v{versionNumber}_{dateStr}.[ext]
            </div>

            {/* Export options */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: 'var(--g-radius-lg)',
                    border: '1px solid var(--g-border-subtle)',
                    backgroundColor: 'var(--g-surface-card)',
                }}
            >
                <span
                    style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--g-text-muted)',
                    }}
                >
                    Opciones
                </span>

                <ToggleOption
                    label="Incluir evidence pack"
                    description="Apendice con fuentes y citas"
                    checked={includeEvidence}
                    onChange={setIncludeEvidence}
                />

                <ToggleOption
                    label="Incluir cabecera de metadatos"
                    description="Tipo, version, fecha, scoring"
                    checked={includeMetadata}
                    onChange={setIncludeMetadata}
                />

                <ToggleOption
                    label="Incluir aviso de confidencialidad"
                    description="Pie de documento con aviso legal"
                    checked={includeConfidentiality}
                    onChange={setIncludeConfidentiality}
                />
            </div>
        </div>
    );
}

function ToggleOption({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
            }}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                style={{
                    width: '34px',
                    height: '18px',
                    borderRadius: 'var(--g-radius-full)',
                    backgroundColor: checked ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                    position: 'relative',
                    transition: 'background-color 0.15s ease',
                    flexShrink: 0,
                    marginTop: '2px',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '2px',
                        left: checked ? '18px' : '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: 'var(--g-surface-card)',
                        transition: 'left 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                />
            </button>
            <div>
                <span
                    style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--g-text-primary)',
                        display: 'block',
                    }}
                >
                    {label}
                </span>
                <span
                    style={{
                        fontSize: '11px',
                        color: 'var(--g-text-muted)',
                        display: 'block',
                        marginTop: '1px',
                    }}
                >
                    {description}
                </span>
            </div>
        </label>
    );
}
