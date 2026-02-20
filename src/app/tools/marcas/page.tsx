'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Shield, Loader2, Play, Link2, FileText, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDToolExecution } from '@/lib/supabase';
import ExecutionStatus from '@/components/tools/execution-status';
import EvidenceBadge from '@/components/evidence/evidence-badge';
import EvidenceDrawer from '@/components/evidence/evidence-drawer';
import LinkProjectModal from '@/components/tools/link-project-modal';

interface MarcaItem {
    numero_registro?: string;
    denominacion?: string;
    tipo?: string;
    clases_niza?: number[];
    estado_legal?: string;
    titular?: string;
    fecha_solicitud?: string;
    fecha_concesion?: string;
    fecha_renovacion?: string;
    expediente?: string;
}

interface MarcasResult {
    marcas?: MarcaItem[];
    resumen?: { total?: number; activas?: number; caducadas?: number; en_tramite?: number };
    matriz_riesgo?: Array<{ clase: number; cobertura: string; riesgo: string; recomendacion: string }>;
    gaps_proteccion?: Array<{ clase: number; justificacion: string; prioridad: string }>;
    proximas_caducidad?: Array<{ marca: string; fecha_caducidad: string; accion: string }>;
    recomendaciones?: Array<{ accion: string; prioridad: string; justificacion: string }>;
}

export default function MarcasPage() {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [execution, setExecution] = useState<DDToolExecution | null>(null);
    const [result, setResult] = useState<MarcasResult | null>(null);
    const [evidenceOpen, setEvidenceOpen] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkedProject, setLinkedProject] = useState<string | null>(null);

    // Form state
    const [sociedadTarget, setSociedadTarget] = useState('');
    const [denominaciones, setDenominaciones] = useState('');
    const [clasesNiza, setClasesNiza] = useState('');
    const [projectId, setProjectId] = useState('');

    useEffect(() => {
        supabase
            .from('dd_projects')
            .select('*')
            .in('status', ['active', 'draft', 'review'])
            .order('updated_at', { ascending: false })
            .then(({ data }) => setProjects(data || []));
    }, []);

    async function handleExecute() {
        if (!sociedadTarget.trim()) return;
        setLoading(true);
        setResult(null);
        setExecution(null);
        setLinkedProject(null);

        const resp = await fetch('/api/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tool_slug: 'marcas',
                params: {
                    sociedad_target: sociedadTarget.trim(),
                    denominaciones_adicionales: denominaciones.trim()
                        ? denominaciones.split('\n').map(d => d.trim()).filter(Boolean)
                        : [],
                    clases_niza_objetivo: clasesNiza.trim()
                        ? clasesNiza.split(',').map(c => parseInt(c.trim())).filter(n => !isNaN(n))
                        : [],
                },
                project_id: projectId || undefined,
            }),
        });

        if (resp.ok) {
            const data = await resp.json();
            setExecution({
                id: data.execution_id,
                status: data.status,
                evidence_count: data.evidence_count || 0,
            } as DDToolExecution);

            const output = data.result?.output || data.result;
            if (output && typeof output === 'object') {
                setResult(output as MarcasResult);
            }

            if (projectId) {
                setLinkedProject(projectId);
            }
        }
        setLoading(false);
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <Link
                    href="/tools"
                    className="inline-flex items-center gap-1 text-sm mb-3"
                    style={{ color: 'var(--g-link)' }}
                >
                    <ArrowLeft className="h-4 w-4" /> Hub Herramientas
                </Link>
                <div className="flex items-center gap-3">
                    <div
                        className="p-2.5"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                        }}
                    >
                        <Shield className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                            Radar de Marcas
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                            Consulta OEPM/EUIPO y construye matriz de propiedad intelectual
                        </p>
                    </div>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left column — Input form */}
                <div
                    className="lg:col-span-2 border p-5"
                    style={{
                        borderColor: 'var(--g-border-subtle)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <h2 className="text-base font-bold mb-4" style={{ color: 'var(--g-text-primary)' }}>
                        Parámetros de consulta
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="marcas-target"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Sociedad / Titular *
                            </label>
                            <input
                                id="marcas-target"
                                type="text"
                                value={sociedadTarget}
                                onChange={(e) => setSociedadTarget(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                                placeholder="Nombre del titular o sociedad..."
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="marcas-denominaciones"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Denominaciones adicionales (una por línea)
                            </label>
                            <textarea
                                id="marcas-denominaciones"
                                value={denominaciones}
                                onChange={(e) => setDenominaciones(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-sm border resize-none"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                                placeholder="MarcaX&#10;ProductoY&#10;SerieZ"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="marcas-clases"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Clases de Niza objetivo (separadas por coma)
                            </label>
                            <input
                                id="marcas-clases"
                                type="text"
                                value={clasesNiza}
                                onChange={(e) => setClasesNiza(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                                placeholder="9, 35, 42"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="marcas-project"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Vincular a proyecto (opcional)
                            </label>
                            <select
                                id="marcas-project"
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                <option value="">Sin vincular</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — {p.target_company}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleExecute}
                            disabled={!sociedadTarget.trim() || loading}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-brand-3308)',
                                color: 'var(--g-text-inverse)',
                            }}
                            aria-busy={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Play className="h-4 w-4" aria-hidden="true" />
                            )}
                            {loading ? 'Consultando registros...' : 'Ejecutar Consulta OEPM'}
                        </button>
                    </div>
                </div>

                {/* Right column — Results */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Execution status bar */}
                    {execution && (
                        <div
                            className="flex items-center justify-between px-4 py-3 border"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <ExecutionStatus status={execution.status} size="md" />
                                <EvidenceBadge
                                    count={execution.evidence_count}
                                    onClick={() => setEvidenceOpen(true)}
                                    size="md"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {!linkedProject && execution.status === 'completed' && (
                                    <button
                                        onClick={() => setLinkModalOpen(true)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border transition-colors hover:opacity-80"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            color: 'var(--g-text-primary)',
                                        }}
                                    >
                                        <Link2 className="h-3 w-3" aria-hidden="true" /> Vincular a proyecto
                                    </button>
                                )}
                                {linkedProject && (
                                    <span className="text-xs font-medium" style={{ color: 'var(--status-success)' }}>
                                        ✓ Vinculado
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!execution && !loading && (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <Shield className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-muted)' }} />
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                Configura los parámetros y ejecuta la consulta
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                La matriz de marcas y riesgos PI aparecerá aquí.
                            </p>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div
                            className="flex flex-col items-center justify-center py-16 border"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: 'var(--g-brand-3308)' }} />
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                Consultando registros de propiedad intelectual...
                            </p>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            {/* Summary */}
                            {result.resumen && (
                                <div
                                    className="grid grid-cols-4 gap-3 p-4 border"
                                    style={{
                                        borderColor: 'var(--g-border-subtle)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    {[
                                        { label: 'Total', value: result.resumen.total },
                                        { label: 'Activas', value: result.resumen.activas },
                                        { label: 'Caducadas', value: result.resumen.caducadas },
                                        { label: 'En trámite', value: result.resumen.en_tramite },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="text-center">
                                            <p className="text-xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                                {value ?? '—'}
                                            </p>
                                            <p className="text-[10px] uppercase font-medium" style={{ color: 'var(--g-text-secondary)' }}>
                                                {label}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Marks table */}
                            {result.marcas && result.marcas.length > 0 && (
                                <div
                                    className="border overflow-hidden"
                                    style={{
                                        borderColor: 'var(--g-border-subtle)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    <div className="px-4 py-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--g-brand-3308)' }}>
                                            Marcas Registradas
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr style={{ backgroundColor: 'var(--g-surface-subtle)' }}>
                                                    {['Nº Registro', 'Denominación', 'Tipo', 'Clases', 'Estado', 'Titular'].map((h) => (
                                                        <th
                                                            key={h}
                                                            className="px-3 py-2 text-left font-semibold"
                                                            style={{ color: 'var(--g-text-secondary)' }}
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody
                                                className="divide-y"
                                                style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}
                                            >
                                                {result.marcas.map((m, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                            {m.numero_registro || '—'}
                                                        </td>
                                                        <td className="px-3 py-2" style={{ color: 'var(--g-text-primary)' }}>
                                                            {m.denominacion || '—'}
                                                        </td>
                                                        <td className="px-3 py-2" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {m.tipo || '—'}
                                                        </td>
                                                        <td className="px-3 py-2" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {m.clases_niza?.join(', ') || '—'}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className="px-1.5 py-0.5 text-[9px] font-medium"
                                                                style={{
                                                                    borderRadius: 'var(--g-radius-full)',
                                                                    backgroundColor: m.estado_legal === 'concedida' ? 'var(--status-success)' : 'var(--g-surface-muted)',
                                                                    color: m.estado_legal === 'concedida' ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                                                                }}
                                                            >
                                                                {m.estado_legal || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {m.titular || '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Risk matrix */}
                            {result.matriz_riesgo && result.matriz_riesgo.length > 0 && (
                                <ResultSection title="Matriz de Riesgo PI">
                                    <div className="space-y-2">
                                        {result.matriz_riesgo.map((r, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 p-2"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-subtle)',
                                                }}
                                            >
                                                <span className="font-bold text-sm" style={{ color: 'var(--g-text-primary)', minWidth: '60px' }}>
                                                    Clase {r.clase}
                                                </span>
                                                <span className="text-xs flex-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {r.cobertura}
                                                </span>
                                                <span
                                                    className="px-1.5 py-0.5 text-[9px] font-medium uppercase"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: r.riesgo === 'alto' ? 'var(--status-error)' : r.riesgo === 'medio' ? 'var(--status-warning)' : 'var(--status-success)',
                                                        color: 'var(--g-text-inverse)',
                                                    }}
                                                >
                                                    {r.riesgo}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </ResultSection>
                            )}

                            {/* Gaps */}
                            {result.gaps_proteccion && result.gaps_proteccion.length > 0 && (
                                <ResultSection title="Gaps de Protección">
                                    {result.gaps_proteccion.map((g, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--status-warning)' }} aria-hidden="true" />
                                            <div>
                                                <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    Clase {g.clase}
                                                </span>
                                                <span className="text-xs ml-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                    ({g.prioridad}) — {g.justificacion}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </ResultSection>
                            )}

                            {/* Recommendations */}
                            {result.recomendaciones && result.recomendaciones.length > 0 && (
                                <ResultSection title="Recomendaciones">
                                    <div className="space-y-2">
                                        {result.recomendaciones.map((rec, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm">
                                                <span
                                                    className="mt-0.5 shrink-0 h-4 w-4 flex items-center justify-center text-[9px] font-bold"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-brand-3308)',
                                                        color: 'var(--g-text-inverse)',
                                                    }}
                                                >
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {rec.accion}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                        Prioridad: {rec.prioridad} · {rec.justificacion}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ResultSection>
                            )}

                            {/* Queued message */}
                            {execution?.status !== 'completed' && (
                                <div
                                    className="p-4 border"
                                    style={{
                                        borderColor: 'var(--status-info)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                    }}
                                >
                                    <div className="flex items-start gap-2">
                                        <FileText className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--status-info)' }} aria-hidden="true" />
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                Ejecución en cola
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                La consulta ha sido registrada. Cuando el pipeline n8n esté configurado, procesará automáticamente esta solicitud.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Evidence Drawer */}
            {execution && (
                <EvidenceDrawer
                    open={evidenceOpen}
                    onClose={() => setEvidenceOpen(false)}
                    entityType="execution"
                    entityId={execution.id}
                    title="Evidencias — Radar de Marcas"
                />
            )}

            {/* Link Project Modal */}
            {execution && (
                <LinkProjectModal
                    open={linkModalOpen}
                    onClose={() => setLinkModalOpen(false)}
                    executionId={execution.id}
                    onLinked={(pid) => setLinkedProject(pid)}
                />
            )}
        </div>
    );
}

// ---- Helper component ----
function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div
            className="border p-4"
            style={{
                borderColor: 'var(--g-border-subtle)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
            }}
        >
            <h3
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: 'var(--g-brand-3308)' }}
            >
                {title}
            </h3>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}
