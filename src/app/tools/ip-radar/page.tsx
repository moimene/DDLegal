'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Shield, Loader2, Play,
    RefreshCw, FileCheck, Search, User, Camera
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject } from '@/lib/supabase';
import { REQUEST_STATUS_CONFIG, IP_PIPELINE_STEPS, IP_STATUS_CONFIG, NIZA_CLASSES } from '@/lib/utils';

// ============================================================
// Types
// ============================================================
interface IPRequestData {
    id: string;
    denominacion_input: string;
    titular_nif: string | null;
    scope_jurisdicciones: string[];
    status: string;
    pipeline_step: string;
    titular_id: string | null;
    created_at: string;
    updated_at: string;
}

interface IPMarcaData {
    id: string;
    signo: string;
    jurisdiccion: string;
    tipo: string;
    clases_niza: number[];
    estado_legal: string;
    numero_expediente: string;
    fecha_solicitud: string | null;
    fecha_vencimiento: string | null;
    source_url: string | null;
}

interface IPSnapshotData {
    id: string;
    data: {
        titular: { nombre: string; nif: string | null; pais: string };
        marcas: IPMarcaData[];
        disenos: unknown[];
        diagnostico: {
            vencimientos_proximos: Array<{ signo: string; fecha: string; dias_restantes: number }>;
            gaps_cobertura: Array<{ jurisdiccion: string; clases_cubiertas: number[]; total_clases: number }>;
        };
        red_flags: Array<{ tipo: string; severidad: string; descripcion: string }>;
        metadata: { total_marcas: number; total_disenos: number };
    };
}

// ============================================================
// Pipeline Tracker Component
// ============================================================
function IPPipelineTracker({ currentStep, status }: { currentStep: string; status: string }) {
    const currentIdx = IP_PIPELINE_STEPS.findIndex(s => s.key === currentStep);
    const icons: Record<string, typeof Search> = {
        FileText: FileCheck, User, Search, Camera, FileCheck,
    };

    return (
        <div className="flex items-center gap-1 py-3 px-4 rounded-xl"
            style={{ background: 'var(--g-surface-muted)' }}>
            {IP_PIPELINE_STEPS.map((step, idx) => {
                const Icon = icons[step.icon] || FileCheck;
                const isActive = idx === currentIdx;
                const isDone = idx < currentIdx || status === 'done';
                const isFailed = status === 'failed' && idx === currentIdx;

                return (
                    <div key={step.key} className="flex items-center gap-1">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors"
                                style={{
                                    background: isFailed
                                        ? 'var(--status-error)'
                                        : isDone
                                            ? 'var(--g-brand-3308)'
                                            : isActive
                                                ? 'var(--status-info)'
                                                : 'var(--g-border)',
                                    color: isDone || isActive || isFailed
                                        ? 'var(--g-text-inverse)'
                                        : 'var(--g-text-secondary)',
                                }}
                            >
                                {isActive && status === 'running' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                            </div>
                            <span className="text-[10px] whitespace-nowrap" style={{
                                color: isDone || isActive ? 'var(--g-text-primary)' : 'var(--g-text-secondary)',
                                fontWeight: isActive ? 600 : 400,
                            }}>{step.label}</span>
                        </div>
                        {idx < IP_PIPELINE_STEPS.length - 1 && (
                            <div className="w-6 h-px mx-1" style={{
                                background: idx < currentIdx ? 'var(--g-brand-3308)' : 'var(--g-border)',
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================
// Marca Card Component
// ============================================================
function MarcaCard({ marca }: { marca: IPMarcaData }) {
    const statusCfg = IP_STATUS_CONFIG[marca.estado_legal] || IP_STATUS_CONFIG.solicitada;

    return (
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm truncate" style={{ color: 'var(--g-text-primary)' }}>
                            {marca.signo}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{
                            background: statusCfg.bg, color: statusCfg.fg,
                        }}>
                            {statusCfg.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                        <span>{marca.jurisdiccion === 'ES' ? 'OEPM' : marca.jurisdiccion === 'EU' ? 'EUIPO' : 'WIPO'}</span>
                        <span>{marca.tipo}</span>
                        <span>{marca.numero_expediente}</span>
                    </div>
                    {marca.clases_niza && marca.clases_niza.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {marca.clases_niza.map(c => (
                                <span key={c} className="px-1.5 py-0.5 rounded text-[10px]"
                                    style={{ background: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)' }}
                                    title={NIZA_CLASSES[c] || `Clase ${c}`}>
                                    C{c}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {marca.source_url && (
                    <a href={marca.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs underline shrink-0" style={{ color: 'var(--g-brand-3308)' }}>
                        Ver fuente
                    </a>
                )}
            </div>
            {marca.fecha_vencimiento && (
                <div className="mt-2 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                    Vencimiento: {new Date(marca.fecha_vencimiento).toLocaleDateString('es-ES')}
                </div>
            )}
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function IPRadarPage() {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [requestData, setRequestData] = useState<IPRequestData | null>(null);
    const [snapshot, setSnapshot] = useState<IPSnapshotData | null>(null);
    const [marcas, setMarcas] = useState<IPMarcaData[]>([]);
    const [pipelineRunning, setPipelineRunning] = useState(false);

    // Form state
    const [titularInput, setTitularInput] = useState('');
    const [titularNif, setTitularNif] = useState('');
    const [scopeES, setScopeES] = useState(true);
    const [scopeEU, setScopeEU] = useState(true);
    const [projectId, setProjectId] = useState('');

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load projects
    useEffect(() => {
        supabase
            .from('dd_projects')
            .select('*')
            .in('status', ['active', 'draft', 'review'])
            .order('updated_at', { ascending: false })
            .then(({ data }) => setProjects(data || []));
    }, []);

    // Cleanup polling
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const pollRequest = useCallback(async (requestId: string) => {
        try {
            const resp = await fetch(`/api/ip/requests?id=${requestId}`);
            if (!resp.ok) return;
            const data = await resp.json();

            setRequestData(data.request);

            if (['done', 'failed'].includes(data.request.status)) {
                setPipelineRunning(false);
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                }
            }
        } catch {
            // Silently handle polling errors
        }
    }, []);

    // Run the full IP pipeline
    const runPipeline = async () => {
        if (!titularInput.trim()) return;
        setLoading(true);
        setPipelineRunning(true);
        setRequestData(null);
        setSnapshot(null);
        setMarcas([]);

        try {
            const scope: string[] = [];
            if (scopeES) scope.push('ES');
            if (scopeEU) scope.push('EU');

            // Step 1: Create request
            const reqResp = await fetch('/api/ip/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    denominacion_input: titularInput,
                    titular_nif: titularNif || undefined,
                    scope_jurisdicciones: scope,
                    project_id: projectId || undefined,
                }),
            });

            if (!reqResp.ok) throw new Error('Failed to create IP request');
            const reqData = await reqResp.json();
            const requestId = reqData.request_id;

            setRequestData({
                id: requestId,
                denominacion_input: titularInput,
                titular_nif: titularNif || null,
                scope_jurisdicciones: scope,
                status: 'running',
                pipeline_step: 'created',
                titular_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            // Step 2: Resolve titular
            const resolveResp = await fetch('/api/ip/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId }),
            });

            if (!resolveResp.ok) throw new Error('Failed to resolve titular');
            const resolveData = await resolveResp.json();

            setRequestData(prev => prev ? { ...prev, pipeline_step: 'titular_resolved', titular_id: resolveData.titular_id } : prev);

            // Step 3: Search registries
            const searchResp = await fetch('/api/ip/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId, titular_id: resolveData.titular_id }),
            });

            if (!searchResp.ok) throw new Error('Failed to search registries');
            const searchData = await searchResp.json();

            setRequestData(prev => prev ? { ...prev, pipeline_step: 'registries_searched' } : prev);

            // Step 4: Build snapshot
            const snapResp = await fetch('/api/ip/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId }),
            });

            if (!snapResp.ok) throw new Error('Failed to build snapshot');
            const snapData = await snapResp.json();

            setRequestData(prev => prev ? { ...prev, pipeline_step: 'snapshot_built' } : prev);

            // Fetch the full snapshot
            const { data: fullSnap } = await supabase
                .from('ip_snapshots')
                .select('*')
                .eq('id', snapData.snapshot_id)
                .single();

            if (fullSnap) {
                setSnapshot(fullSnap as unknown as IPSnapshotData);
                const snapContent = fullSnap.data as IPSnapshotData['data'];
                setMarcas(snapContent?.marcas || []);
            }

            // Step 5: Generate report
            const reportResp = await fetch('/api/ip/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId }),
            });

            if (reportResp.ok) {
                setRequestData(prev => prev ? { ...prev, pipeline_step: 'report_generated', status: 'done' } : prev);
            }

            setPipelineRunning(false);

        } catch (error) {
            console.error('IP pipeline error:', error);
            setRequestData(prev => prev ? { ...prev, status: 'failed' } : prev);
            setPipelineRunning(false);
        } finally {
            setLoading(false);
        }
    };

    const snapshotData = snapshot?.data;

    return (
        <div className="min-h-screen" style={{ background: 'var(--g-bg)' }}>
            {/* Header */}
            <header className="border-b px-6 py-4 flex items-center gap-4"
                style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                <Link href="/tools" className="hover:opacity-70 transition-opacity">
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--g-text-secondary)' }} />
                </Link>
                <Shield className="w-6 h-6" style={{ color: 'var(--g-brand-3308)' }} />
                <div>
                    <h1 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Radar de Propiedad Industrial
                    </h1>
                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                        Investigacion on-demand de marcas y disenos ante OEPM / EUIPO
                    </p>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Form */}
                <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                    <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--g-text-primary)' }}>
                        Nueva Investigacion IP
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--g-text-secondary)' }}>
                                Nombre del titular
                            </label>
                            <input
                                id="ip-titular"
                                type="text"
                                placeholder="Denominacion social completa..."
                                value={titularInput}
                                onChange={(e) => setTitularInput(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{
                                    borderColor: 'var(--g-border)',
                                    background: 'var(--g-surface-muted)',
                                    color: 'var(--g-text-primary)',
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--g-text-secondary)' }}>
                                NIF/CIF (opcional)
                            </label>
                            <input
                                id="ip-nif"
                                type="text"
                                placeholder="B12345678"
                                value={titularNif}
                                onChange={(e) => setTitularNif(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{
                                    borderColor: 'var(--g-border)',
                                    background: 'var(--g-surface-muted)',
                                    color: 'var(--g-text-primary)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Scope checkboxes */}
                    <div className="flex items-center gap-6 mt-4">
                        <label className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>
                            Jurisdicciones:
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={scopeES} onChange={(e) => setScopeES(e.target.checked)} />
                            <span style={{ color: 'var(--g-text-primary)' }}>OEPM (ES)</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={scopeEU} onChange={(e) => setScopeEU(e.target.checked)} />
                            <span style={{ color: 'var(--g-text-primary)' }}>EUIPO (EU)</span>
                        </label>
                    </div>

                    {/* Project selector */}
                    {projects.length > 0 && (
                        <div className="mt-4">
                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--g-text-secondary)' }}>
                                Vincular a proyecto (opcional)
                            </label>
                            <select
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{
                                    borderColor: 'var(--g-border)',
                                    background: 'var(--g-surface-muted)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                <option value="">Sin proyecto</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — {p.target_company}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={runPipeline}
                        disabled={!titularInput.trim() || loading || (!scopeES && !scopeEU)}
                        className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Investigando registros...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Ejecutar
                            </>
                        )}
                    </button>
                </div>

                {/* Pipeline Tracker */}
                {requestData && (
                    <IPPipelineTracker
                        currentStep={requestData.pipeline_step}
                        status={requestData.status}
                    />
                )}

                {/* Results */}
                {snapshotData && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Marcas', value: snapshotData.metadata?.total_marcas || 0, color: 'var(--g-brand-3308)' },
                                { label: 'Disenos', value: snapshotData.metadata?.total_disenos || 0, color: 'var(--status-info)' },
                                { label: 'Red Flags', value: snapshotData.red_flags?.length || 0, color: 'var(--status-error)' },
                                { label: 'Vencimientos', value: snapshotData.diagnostico?.vencimientos_proximos?.length || 0, color: 'var(--status-warning)' },
                            ].map(stat => (
                                <div key={stat.label} className="rounded-xl border p-4 text-center"
                                    style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                                    <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                                    <div className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Red Flags */}
                        {snapshotData.red_flags && snapshotData.red_flags.length > 0 && (
                            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--status-error)' }}>
                                    Red Flags Detectados
                                </h3>
                                <div className="space-y-2">
                                    {snapshotData.red_flags.map((flag, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg"
                                            style={{ background: 'var(--g-surface-muted)' }}>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium shrink-0" style={{
                                                background: flag.severidad === 'high' ? 'var(--status-error)' : 'var(--status-warning)',
                                                color: 'var(--g-text-inverse)',
                                            }}>
                                                {flag.severidad.toUpperCase()}
                                            </span>
                                            <span className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {flag.descripcion}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Marcas Grid */}
                        {marcas.length > 0 && (
                            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--g-text-primary)' }}>
                                    Marcas Encontradas ({marcas.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {marcas.map((m, idx) => (
                                        <MarcaCard key={m.id || idx} marca={m} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Diagnostico - Vencimientos */}
                        {snapshotData.diagnostico?.vencimientos_proximos?.length > 0 && (
                            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--g-border)', background: 'var(--g-surface-card)' }}>
                                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--status-warning)' }}>
                                    Vencimientos Proximos (6 meses)
                                </h3>
                                <div className="space-y-2">
                                    {snapshotData.diagnostico.vencimientos_proximos.map((v, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg"
                                            style={{ background: 'var(--g-surface-muted)' }}>
                                            <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {v.signo}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--status-warning)' }}>
                                                {v.dias_restantes} dias — {new Date(v.fecha).toLocaleDateString('es-ES')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
