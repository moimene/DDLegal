'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Loader2, Play, Link2,
    RefreshCw, FileCheck, ShieldCheck, Download
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
    DDProject, DDRequest, DDSnapshot, DDReport, SociedadCandidate
} from '@/lib/supabase';
import { REQUEST_STATUS_CONFIG } from '@/lib/utils';
import EvidenceDrawer from '@/components/evidence/evidence-drawer';
import LinkProjectModal from '@/components/tools/link-project-modal';
import PipelineTracker from '@/components/societario/pipeline-tracker';
import CandidateResolver from '@/components/societario/candidate-resolver';
import SnapshotViewer from '@/components/societario/snapshot-viewer';

export default function SocietarioPage() {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [requestData, setRequestData] = useState<DDRequest | null>(null);
    const [snapshot, setSnapshot] = useState<DDSnapshot | null>(null);
    const [report, setReport] = useState<DDReport | null>(null);
    const [candidates, setCandidates] = useState<SociedadCandidate[]>([]);
    const [evidenceOpen, setEvidenceOpen] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkedProject, setLinkedProject] = useState<string | null>(null);
    const [pipelineRunning, setPipelineRunning] = useState(false);

    // Form state
    const [sociedadTarget, setSociedadTarget] = useState('');
    const [nifCif, setNifCif] = useState('');
    const [periodo, setPeriodo] = useState('5');
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

    // Polling for request status
    const pollRequest = useCallback(async (requestId: string) => {
        try {
            const resp = await fetch(`/api/societario/request?id=${requestId}`);
            if (!resp.ok) return;
            const data = await resp.json();

            setRequestData(data.request);
            if (data.snapshot) setSnapshot(data.snapshot);
            if (data.report) setReport(data.report);
            if (data.candidates) setCandidates(data.candidates);

            // Stop polling when done or needs_review
            if (['done', 'failed', 'needs_review'].includes(data.request.status)) {
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

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    async function runPipeline() {
        if (!sociedadTarget.trim()) return;
        setLoading(true);
        setPipelineRunning(true);
        setRequestData(null);
        setSnapshot(null);
        setReport(null);
        setCandidates([]);
        setLinkedProject(null);

        try {
            // Step 1: Create request
            const reqResp = await fetch('/api/societario/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sociedad_target: sociedadTarget.trim(),
                    nif_hint: nifCif.trim() || undefined,
                    periodo_anios: parseInt(periodo),
                    project_id: projectId || undefined,
                }),
            });

            if (!reqResp.ok) {
                setLoading(false);
                setPipelineRunning(false);
                return;
            }

            const reqData = await reqResp.json();
            const requestId = reqData.request_id;

            // Fetch initial state
            await pollRequest(requestId);

            // Step 2: Identity resolution
            const resolveResp = await fetch('/api/societario/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId }),
            });

            if (resolveResp.ok) {
                const resolveData = await resolveResp.json();

                if (resolveData.status === 'needs_review') {
                    // Pause pipeline — needs human input
                    await pollRequest(requestId);
                    setLoading(false);
                    return;
                }

                // Step 3: BORME ingestion
                if (resolveData.sociedad_id) {
                    const dateFrom = new Date();
                    dateFrom.setFullYear(dateFrom.getFullYear() - parseInt(periodo));

                    await fetch('/api/societario/borme/ingest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sociedad_id: resolveData.sociedad_id,
                            date_from: dateFrom.toISOString().split('T')[0],
                            date_to: new Date().toISOString().split('T')[0],
                        }),
                    });

                    // Step 4: Build snapshot
                    await fetch('/api/societario/snapshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ request_id: requestId }),
                    });

                    // Step 5: Generate report
                    await fetch('/api/societario/report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ request_id: requestId }),
                    });
                }
            }

            // Final poll
            await pollRequest(requestId);

            if (projectId) setLinkedProject(projectId);
        } catch (error) {
            console.error('Pipeline error:', error);
            setPipelineRunning(false);
        }

        setLoading(false);
    }

    // After candidate resolved, continue pipeline
    async function handleCandidateResolved(sociedadId: string) {
        if (!requestData) return;
        setLoading(true);
        setPipelineRunning(true);

        try {
            // Continue from BORME ingestion
            const dateFrom = new Date();
            dateFrom.setFullYear(dateFrom.getFullYear() - parseInt(periodo));

            await fetch('/api/societario/borme/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sociedad_id: sociedadId,
                    date_from: dateFrom.toISOString().split('T')[0],
                    date_to: new Date().toISOString().split('T')[0],
                }),
            });

            await fetch('/api/societario/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestData.id }),
            });

            await fetch('/api/societario/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestData.id }),
            });

            await pollRequest(requestData.id);
        } catch (error) {
            console.error('Pipeline continuation error:', error);
        }

        setLoading(false);
        setPipelineRunning(false);
    }

    const statusConfig = requestData ? REQUEST_STATUS_CONFIG[requestData.status] : null;

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
                        <Building2 className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                            Due Diligence Societaria
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                            Pipeline completo: BORME → Resolución → Snapshot → Informe Harvey con grounding
                        </p>
                    </div>
                </div>
            </div>

            {/* Pipeline Tracker */}
            {requestData && (
                <PipelineTracker
                    currentStep={requestData.pipeline_step}
                    status={requestData.status}
                />
            )}

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
                            <label htmlFor="soc-target" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                Sociedad target *
                            </label>
                            <input
                                id="soc-target"
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
                                placeholder="Denominación social completa..."
                            />
                        </div>

                        <div>
                            <label htmlFor="soc-nif" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                NIF/CIF (opcional)
                            </label>
                            <input
                                id="soc-nif"
                                type="text"
                                value={nifCif}
                                onChange={(e) => setNifCif(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                                placeholder="B12345678"
                            />
                        </div>

                        <div>
                            <label htmlFor="soc-periodo" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                Período de análisis
                            </label>
                            <select
                                id="soc-periodo"
                                value={periodo}
                                onChange={(e) => setPeriodo(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                <option value="3">Últimos 3 años</option>
                                <option value="5">Últimos 5 años</option>
                                <option value="10">Últimos 10 años</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="soc-project" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                Vincular a proyecto (opcional)
                            </label>
                            <select
                                id="soc-project"
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
                            onClick={runPipeline}
                            disabled={!sociedadTarget.trim() || loading}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-brand-3308)',
                                color: 'var(--g-text-inverse)',
                                border: 'none',
                                cursor: !sociedadTarget.trim() || loading ? 'default' : 'pointer',
                            }}
                            aria-busy={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Play className="h-4 w-4" aria-hidden="true" />
                            )}
                            {loading ? 'Ejecutando pipeline...' : 'Ejecutar DD Societaria'}
                        </button>
                    </div>

                    {/* Status badge */}
                    {requestData && statusConfig && (
                        <div className="mt-4 flex items-center gap-2">
                            <span
                                className="px-2 py-1 text-xs font-medium"
                                style={{
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: statusConfig.bg,
                                    color: statusConfig.fg,
                                }}
                            >
                                {statusConfig.label}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                Paso: {requestData.pipeline_step}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right column — Results */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Empty state */}
                    {!requestData && !loading && (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <Building2 className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-muted)' }} />
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                Configura los parámetros y ejecuta el pipeline
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                BORME → Resolución → Snapshot → Informe con grounding
                            </p>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && !requestData && (
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
                                Iniciando pipeline de DD Societaria...
                            </p>
                        </div>
                    )}

                    {/* Candidate Resolver */}
                    {requestData?.status === 'needs_review' && candidates.length > 0 && (
                        <CandidateResolver
                            candidates={candidates}
                            requestId={requestData.id}
                            onResolved={handleCandidateResolved}
                        />
                    )}

                    {/* Snapshot Viewer */}
                    {snapshot && (
                        <SnapshotViewer snapshot={snapshot} />
                    )}

                    {/* Report Section */}
                    {report && (
                        <div
                            className="border"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                                boxShadow: 'var(--g-shadow-card)',
                            }}
                        >
                            <div className="p-4 border-b" style={{ borderColor: 'var(--g-border-subtle)' }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileCheck className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                        <h3 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                            Informe Harvey AI
                                        </h3>
                                        <span
                                            className="px-2 py-0.5 text-[10px] font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: report.status === 'done'
                                                    ? 'hsla(120, 60%, 40%, 0.1)'
                                                    : report.status === 'failed'
                                                        ? 'hsla(0, 84%, 60%, 0.1)'
                                                        : 'var(--g-surface-muted)',
                                                color: report.status === 'done'
                                                    ? 'var(--status-success)'
                                                    : report.status === 'failed'
                                                        ? 'var(--status-error)'
                                                        : 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {report.status === 'done' ? 'Completado' :
                                             report.status === 'generating' ? 'Generando...' :
                                             report.status === 'failed' ? 'Fallido' : 'Pendiente'}
                                        </span>
                                    </div>

                                    {/* Grounding score */}
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck
                                            className="h-4 w-4"
                                            style={{
                                                color: report.grounding_score >= 80
                                                    ? 'var(--status-success)'
                                                    : report.grounding_score >= 50
                                                        ? 'var(--status-warning)'
                                                        : 'var(--status-error)',
                                            }}
                                            aria-hidden="true"
                                        />
                                        <span
                                            className="text-sm font-bold"
                                            style={{
                                                color: report.grounding_score >= 80
                                                    ? 'var(--status-success)'
                                                    : report.grounding_score >= 50
                                                        ? 'var(--status-warning)'
                                                        : 'var(--status-error)',
                                            }}
                                        >
                                            {report.grounding_score}%
                                        </span>
                                        <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                            grounding
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4">
                                {report.status === 'pending' && (
                                    <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                        <RefreshCw className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--status-info)' }} />
                                        <div>
                                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                Informe en cola
                                            </p>
                                            <p className="text-xs mt-0.5">
                                                El Evidence Pack v1.1 ha sido preparado con {
                                                    ((report.evidence_pack as Record<string, unknown>)?.sources as unknown[])?.length || 0
                                                } fuentes. El informe se generará cuando Harvey AI esté disponible.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {report.status === 'done' && report.harvey_response && (
                                    <div className="space-y-3">
                                        <pre
                                            className="text-xs p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                                color: 'var(--g-text-primary)',
                                                maxHeight: '300px',
                                                border: '1px solid var(--g-border-subtle)',
                                            }}
                                        >
                                            {JSON.stringify(report.harvey_response, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Grounding issues */}
                                {report.grounding_issues && report.grounding_issues.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--g-text-muted)' }}>
                                            Problemas de Grounding ({report.grounding_issues.length})
                                        </p>
                                        <div className="space-y-1">
                                            {report.grounding_issues.slice(0, 5).map((issue, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                    <span
                                                        className="w-1.5 h-1.5 shrink-0"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: (issue as Record<string, unknown>).severity === 'error'
                                                                ? 'var(--status-error)'
                                                                : 'var(--status-warning)',
                                                        }}
                                                    />
                                                    <span style={{ color: 'var(--g-text-secondary)' }}>
                                                        {(issue as Record<string, unknown>).detail as string || (issue as Record<string, unknown>).message as string}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    {requestData && requestData.status === 'done' && (
                        <div
                            className="flex items-center justify-between px-4 py-3 border"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                {report && (
                                    <button
                                        onClick={() => setEvidenceOpen(true)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border transition-colors hover:opacity-80"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            color: 'var(--g-text-primary)',
                                            backgroundColor: 'transparent',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Download className="h-3 w-3" aria-hidden="true" />
                                        Evidence Pack
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {!linkedProject && (
                                    <button
                                        onClick={() => setLinkModalOpen(true)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border transition-colors hover:opacity-80"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            color: 'var(--g-text-primary)',
                                            backgroundColor: 'transparent',
                                            cursor: 'pointer',
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

                    {/* Re-execute for failed */}
                    {requestData && requestData.status === 'failed' && (
                        <div
                            className="p-4 border"
                            style={{
                                borderColor: 'var(--status-error)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'hsla(0, 72%, 51%, 0.02)',
                            }}
                        >
                            <p className="text-sm font-medium" style={{ color: 'var(--status-error)' }}>
                                Pipeline fallido
                            </p>
                            {requestData.error_log && (
                                <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                    {requestData.error_log}
                                </p>
                            )}
                            <button
                                onClick={() => {
                                    setRequestData(null);
                                    setSnapshot(null);
                                    setReport(null);
                                    runPipeline();
                                }}
                                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-brand-3308)',
                                    color: 'var(--g-text-inverse)',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                Re-ejecutar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Evidence Drawer */}
            {requestData?.tool_execution_id && (
                <EvidenceDrawer
                    open={evidenceOpen}
                    onClose={() => setEvidenceOpen(false)}
                    entityType="execution"
                    entityId={requestData.tool_execution_id}
                    title="Evidencias — DD Societaria"
                />
            )}

            {/* Link Project Modal */}
            {requestData?.tool_execution_id && (
                <LinkProjectModal
                    open={linkModalOpen}
                    onClose={() => setLinkModalOpen(false)}
                    executionId={requestData.tool_execution_id}
                    onLinked={(pid) => setLinkedProject(pid)}
                />
            )}
        </div>
    );
}
