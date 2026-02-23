'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, RefreshCw, Play, Loader2, Download, FolderOpen,
    Search, Scale, FileText, Handshake, Zap, ArrowRight,
    Layers, CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { AREA_COLORS, formatDate, useResolvedParams } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PhaseDefinition {
    phase: string;
    name: string;
    description: string;
    skills: string[];
    hitl_required: boolean;
}

interface TemplateVersion {
    id: string;
    version_number: number;
    phases: PhaseDefinition[];
    is_published: boolean;
}

interface WorkflowTemplate {
    id: string;
    template_key: string;
    name: string;
    description: string | null;
    area_codes: string[];
    category: string;
    is_active: boolean;
    created_at: string;
    latest_version: TemplateVersion;
}

interface WorkflowInstance {
    id: string;
    project_id: string;
    template_id: string;
    template_version_id: string;
    status: string;
    current_phase: string;
    phase_status: Record<string, string>;
    findings_count: number;
    red_flags_count: number;
    hitl_pending_count: number;
    initiated_by: string | null;
    created_at: string;
    updated_at: string;
    latest_report?: {
        id: string;
        version_number: number;
        created_at: string;
    } | null;
}

interface WorkflowRunResponse {
    success: boolean;
    code?: 'information_required' | 'phase_gate_failed' | 'execution_error';
    message?: string;
    error?: string;
    phase_advance?: {
        next_phase?: string | null;
    };
    information_gate?: {
        missing_inputs?: string[];
    };
    side_effects?: {
        war_room_notifications?: number;
        negotiation_actions_created?: number;
        workflow_report_created?: boolean;
        workflow_report_id?: string;
        workflow_report_version?: number;
    };
}

/* ------------------------------------------------------------------ */
/*  Phase config                                                       */
/* ------------------------------------------------------------------ */

const PHASES_ORDERED = [
    'obtencion',
    'gestion',
    'analisis',
    'valoracion',
    'informe',
    'propuesta_transaccional',
] as const;

const PHASE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    obtencion: { label: 'Obtención', icon: 'Download', color: 'var(--status-info)' },
    gestion: { label: 'Gestión', icon: 'FolderOpen', color: 'var(--status-info)' },
    analisis: { label: 'Análisis', icon: 'Search', color: 'var(--g-brand-bright)' },
    valoracion: { label: 'Valoración', icon: 'Scale', color: 'var(--status-warning)' },
    informe: { label: 'Informe', icon: 'FileText', color: 'var(--g-sec-700)' },
    propuesta_transaccional: { label: 'Propuesta', icon: 'Handshake', color: 'var(--g-brand-3308)' },
};

const PHASE_ICON_MAP: Record<string, typeof Download> = {
    Download, FolderOpen, Search, Scale, FileText, Handshake,
};

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    transversal: { label: 'Transversal', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    area: { label: 'Area', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    area_multi: { label: 'Multi-Area', bg: 'var(--g-sec-700)', fg: 'var(--g-text-inverse)' },
    synthesis: { label: 'Síntesis', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    deliverable: { label: 'Entregable', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    negotiation: { label: 'Negociación', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    transactional: { label: 'Transaccional', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    compliance: { label: 'Compliance', bg: 'var(--g-sec-700)', fg: 'var(--g-text-inverse)' },
    operational: { label: 'Operacional', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
};

/* ------------------------------------------------------------------ */
/*  Instance status config                                             */
/* ------------------------------------------------------------------ */

const INSTANCE_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    created: { label: 'Creado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    in_progress: { label: 'En progreso', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    paused: { label: 'Pausado', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    completed: { label: 'Completado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    failed: { label: 'Fallido', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    cancelled: { label: 'Cancelado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dd_session_token');
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

function getPhaseIndex(phase: string): number {
    return PHASES_ORDERED.indexOf(phase as typeof PHASES_ORDERED[number]);
}

function countSkills(template: WorkflowTemplate): number {
    if (!template.latest_version?.phases) return 0;
    const allSkills = new Set<string>();
    template.latest_version.phases.forEach(p => {
        p.skills?.forEach(s => allSkills.add(s));
    });
    return allSkills.size;
}

function hasHitl(template: WorkflowTemplate): boolean {
    if (!template.latest_version?.phases) return false;
    return template.latest_version.phases.some(p => p.hitl_required);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WorkflowsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = useResolvedParams(params);
    const router = useRouter();

    const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
    const [instances, setInstances] = useState<WorkflowInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [instantiating, setInstantiating] = useState<string | null>(null);
    const [executing, setExecuting] = useState<string | null>(null);

    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Build template name lookup from templates
    const templateNameMap = new Map<string, string>();
    templates.forEach(t => templateNameMap.set(t.id, t.name));

    /* ---------- Fetchers ---------- */

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch('/api/workflows/templates', { headers: authHeaders() });
            const data = await res.json();
            if (data.success && data.templates) {
                setTemplates(data.templates);
            }
        } catch {
            // silent
        }
    }, []);

    const fetchInstances = useCallback(async () => {
        try {
            const res = await fetch(`/api/workflows/instances?project_id=${projectId}`, {
                headers: authHeaders(),
            });
            const data = await res.json();
            if (data.success && data.instances) {
                setInstances(data.instances);
            }
        } catch {
            // silent
        }
    }, [projectId]);

    const fetchAll = useCallback(async () => {
        await Promise.all([fetchTemplates(), fetchInstances()]);
        setLoading(false);
    }, [fetchTemplates, fetchInstances]);

    useEffect(() => {
        fetchAll();
        // Auto-refresh instances every 30s
        refreshTimerRef.current = setInterval(() => {
            fetchInstances();
        }, 30000);
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [fetchAll, fetchInstances]);

    /* ---------- Actions ---------- */

    const handleInstantiate = async (template: WorkflowTemplate) => {
        setInstantiating(template.id);
        try {
            const res = await fetch('/api/workflows/instantiate', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    template_key: template.template_key,
                    project_id: projectId,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Workflow "${template.name}" instanciado correctamente`);
                fetchInstances();
            } else {
                toast.error(data.error || 'Error al instanciar workflow');
            }
        } catch {
            toast.error('Error de conexión al instanciar workflow');
        } finally {
            setInstantiating(null);
        }
    };

    const handleExecute = async (instance: WorkflowInstance) => {
        setExecuting(instance.id);
        try {
            const res = await fetch(`/api/workflows/instances/${instance.id}/run`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    input: { project_id: projectId },
                }),
            });
            const data = (await res.json()) as WorkflowRunResponse;
            if (data.success) {
                const nextPhase = data.phase_advance?.next_phase as string | null | undefined;
                const sideEffects = data.side_effects || {};
                const reportId = sideEffects.workflow_report_id;
                const reportVersion = sideEffects.workflow_report_version;
                const warRoomCount = sideEffects.war_room_notifications || 0;
                const negotiationCount = sideEffects.negotiation_actions_created || 0;

                const details: string[] = [];
                if (reportId) {
                    details.push(`Informe${reportVersion ? ` v${reportVersion}` : ''} archivado`);
                }
                if (warRoomCount > 0) {
                    details.push(`${warRoomCount} notificación(es) War Room`);
                }
                if (negotiationCount > 0) {
                    details.push(`${negotiationCount} acción(es) de negociación`);
                }

                if (nextPhase) {
                    const nextPhaseLabel = PHASE_CONFIG[nextPhase]?.label || nextPhase;
                    toast.success(`Fase ejecutada. Avanza a: ${nextPhaseLabel}`, {
                        description: details.length > 0 ? details.join(' · ') : undefined,
                        action: reportId
                            ? {
                                label: 'Ver informe',
                                onClick: () => router.push(`/reports/${reportId}`),
                            }
                            : undefined,
                    });
                } else {
                    toast.success('Fase ejecutada y workflow completado', {
                        description: details.length > 0 ? details.join(' · ') : undefined,
                        action: reportId
                            ? {
                                label: 'Ver informe',
                                onClick: () => router.push(`/reports/${reportId}`),
                            }
                            : undefined,
                    });
                }
                fetchInstances();
            } else if (data.code === 'information_required') {
                const missing = (data.information_gate?.missing_inputs || []) as string[];
                const detail = missing.length > 0 ? ` (${missing.join(', ')})` : '';
                toast.error(`Falta información para avanzar${detail}`);
            } else if (data.code === 'phase_gate_failed') {
                toast.error('La fase se ejecutó, pero no cumplió DoR/DoD para avanzar');
            } else {
                toast.error(data.error || data.message || 'Error al ejecutar workflow');
            }
        } catch {
            toast.error('Error de conexión al ejecutar workflow');
        } finally {
            setExecuting(null);
        }
    };

    /* ---------- Phase counts for flow visualization ---------- */

    const phaseCounts: Record<string, number> = {};
    PHASES_ORDERED.forEach(p => { phaseCounts[p] = 0; });
    instances.forEach(inst => {
        if (inst.current_phase && phaseCounts[inst.current_phase] !== undefined) {
            phaseCounts[inst.current_phase]++;
        }
    });

    /* ---------- Loading skeleton ---------- */

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-16 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-4)' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '220px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                <div className="skeleton h-48 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    /* ---------- Render ---------- */

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <Link
                        href={`/projects/${projectId}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        Workflows
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {templates.length} plantillas disponibles · {instances.length} instancias activas
                    </p>
                </div>
                <button
                    onClick={() => fetchAll()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        borderColor: 'var(--g-border-default)',
                        color: 'var(--g-text-secondary)',
                        backgroundColor: 'var(--g-surface-card)',
                        cursor: 'pointer',
                    }}
                >
                    <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* SECTION 3: Phase Flow Visualization                       */}
            {/* ══════════════════════════════════════════════════════════ */}
            <div
                className="g-card"
                style={{
                    padding: 'var(--g-space-5)',
                    borderRadius: 'var(--g-radius-lg)',
                }}
            >
                <h2
                    className="font-bold mb-4"
                    style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                >
                    Flujo de Fases DD
                </h2>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--g-space-2)',
                        overflowX: 'auto',
                        paddingBottom: 'var(--g-space-2)',
                    }}
                >
                    {PHASES_ORDERED.map((phase, idx) => {
                        const cfg = PHASE_CONFIG[phase];
                        const count = phaseCounts[phase] || 0;
                        const hasInstances = count > 0;
                        const Icon = PHASE_ICON_MAP[cfg.icon] || CircleDot;

                        // Determine node state: check if any instance has completed this phase
                        const completedCount = instances.filter(inst => {
                            const instPhaseIdx = getPhaseIndex(inst.current_phase);
                            const thisPhaseIdx = idx;
                            return instPhaseIdx > thisPhaseIdx || inst.status === 'completed';
                        }).length;

                        const isCompleted = completedCount > 0 && count === 0;
                        const isCurrent = hasInstances;

                        let nodeColor = 'var(--g-border-default)'; // upcoming/gray
                        let nodeBg = 'var(--g-surface-muted)';
                        let textColor = 'var(--g-text-muted)';

                        if (isCurrent) {
                            nodeColor = 'var(--status-info)';
                            nodeBg = 'rgba(59, 130, 246, 0.08)';
                            textColor = 'var(--status-info)';
                        } else if (isCompleted) {
                            nodeColor = 'var(--status-success)';
                            nodeBg = 'rgba(0, 154, 119, 0.08)';
                            textColor = 'var(--status-success)';
                        }

                        return (
                            <div
                                key={phase}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--g-space-2)',
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                {/* Phase node */}
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 'var(--g-space-1)',
                                        flex: 1,
                                        minWidth: '80px',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: 'var(--g-radius-full)',
                                            border: `2px solid ${nodeColor}`,
                                            backgroundColor: nodeBg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            transition: 'all var(--g-transition-fast)',
                                        }}
                                    >
                                        <Icon
                                            className="h-5 w-5"
                                            style={{ color: textColor }}
                                        />
                                        {count > 0 && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    top: '-4px',
                                                    right: '-4px',
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--status-info)',
                                                    color: 'var(--g-text-inverse)',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '2px solid var(--g-surface-card)',
                                                }}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 'var(--g-text-caption)',
                                            fontWeight: 600,
                                            color: textColor,
                                            textAlign: 'center',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {cfg.label}
                                    </span>
                                </div>

                                {/* Arrow connector (skip after last) */}
                                {idx < PHASES_ORDERED.length - 1 && (
                                    <ArrowRight
                                        className="h-4 w-4 shrink-0"
                                        style={{
                                            color: isCompleted || isCurrent
                                                ? 'var(--status-success)'
                                                : 'var(--g-border-default)',
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* SECTION 1: Workflow Templates Catalog                     */}
            {/* ══════════════════════════════════════════════════════════ */}
            <div>
                <h2
                    className="font-bold mb-4"
                    style={{ fontSize: 'var(--g-text-h2)', color: 'var(--g-text-primary)' }}
                >
                    Catálogo de Plantillas
                </h2>
                {templates.length === 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--g-space-12)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px dashed var(--g-border-subtle)',
                            backgroundColor: 'var(--g-surface-card)',
                        }}
                    >
                        <Layers className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-muted)' }} />
                        <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                            No hay workflows disponibles
                        </p>
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Los templates de workflow se configuran desde la administración.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 'var(--g-space-4)',
                        }}
                    >
                        {templates.map(template => {
                            const catCfg = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.operational;
                            const phaseName = template.latest_version?.phases?.[0]?.phase;
                            const phaseCfg = phaseName ? PHASE_CONFIG[phaseName] : null;
                            const skillCount = countSkills(template);
                            const hitlRequired = hasHitl(template);
                            const isInstantiating = instantiating === template.id;

                            return (
                                <div
                                    key={template.id}
                                    className="g-card"
                                    style={{
                                        padding: 'var(--g-space-4)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--g-space-3)',
                                        transition: 'box-shadow var(--g-transition-fast)',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--g-shadow-card-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.boxShadow = '';
                                    }}
                                >
                                    {/* Template name */}
                                    <div>
                                        <p
                                            style={{
                                                fontSize: 'var(--g-text-body)',
                                                fontWeight: 700,
                                                color: 'var(--g-text-primary)',
                                                lineHeight: 'var(--g-leading-tight)',
                                            }}
                                        >
                                            {template.name}
                                        </p>
                                    </div>

                                    {/* Badges row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                        {/* Category badge */}
                                        <span
                                            style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: catCfg.bg,
                                                color: catCfg.fg,
                                                letterSpacing: '0.02em',
                                            }}
                                        >
                                            {catCfg.label}
                                        </span>

                                        {/* Phase badge */}
                                        {phaseCfg && (
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--g-surface-subtle)',
                                                    color: phaseCfg.color,
                                                    border: `1px solid ${phaseCfg.color}`,
                                                }}
                                            >
                                                {phaseCfg.label}
                                            </span>
                                        )}

                                        {/* HITL badge */}
                                        {hitlRequired && (
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'hsl(270, 60%, 95%)',
                                                    color: '#8b5cf6',
                                                }}
                                            >
                                                HITL
                                            </span>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p
                                        style={{
                                            fontSize: 'var(--g-text-small)',
                                            color: 'var(--g-text-secondary)',
                                            lineHeight: 'var(--g-leading-normal)',
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            minHeight: '2.6em',
                                        }}
                                    >
                                        {template.description || 'Sin descripción disponible'}
                                    </p>

                                    {/* Meta row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginTop: 'auto' }}>
                                        {/* Skill count */}
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: 'var(--g-text-caption)',
                                                color: 'var(--g-text-muted)',
                                            }}
                                        >
                                            <Zap className="h-3 w-3" />
                                            {skillCount} skill{skillCount !== 1 ? 's' : ''}
                                        </span>

                                        {/* Area codes */}
                                        {template.area_codes && template.area_codes.length > 0 && (
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                {template.area_codes.slice(0, 3).map(code => {
                                                    const hsl = AREA_COLORS[code] || AREA_COLORS.GENERAL;
                                                    return (
                                                        <span
                                                            key={code}
                                                            style={{
                                                                fontSize: '9px',
                                                                fontWeight: 600,
                                                                padding: '1px 5px',
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: `hsla(${hsl}, 0.12)`,
                                                                color: `hsl(${hsl})`,
                                                            }}
                                                        >
                                                            {code}
                                                        </span>
                                                    );
                                                })}
                                                {template.area_codes.length > 3 && (
                                                    <span
                                                        style={{
                                                            fontSize: '9px',
                                                            fontWeight: 600,
                                                            padding: '1px 5px',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-muted)',
                                                        }}
                                                    >
                                                        +{template.area_codes.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ flex: 1 }} />

                                        {/* Version */}
                                        <span
                                            style={{
                                                fontSize: 'var(--g-text-caption)',
                                                color: 'var(--g-text-muted)',
                                            }}
                                        >
                                            v{template.latest_version?.version_number || 1}
                                        </span>
                                    </div>

                                    {/* Instanciar button */}
                                    <button
                                        onClick={() => handleInstantiate(template)}
                                        disabled={isInstantiating}
                                        className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-success)',
                                            color: 'var(--g-text-inverse)',
                                            border: 'none',
                                            cursor: isInstantiating ? 'not-allowed' : 'pointer',
                                            opacity: isInstantiating ? 0.6 : 1,
                                            transition: 'opacity var(--g-transition-fast)',
                                        }}
                                    >
                                        {isInstantiating ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Play className="h-3.5 w-3.5" />
                                        )}
                                        {isInstantiating ? 'Instanciando...' : 'Instanciar'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* SECTION 2: Active Instances                               */}
            {/* ══════════════════════════════════════════════════════════ */}
            <div>
                <h2
                    className="font-bold mb-4"
                    style={{ fontSize: 'var(--g-text-h2)', color: 'var(--g-text-primary)' }}
                >
                    Instancias Activas
                </h2>
                {instances.length === 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--g-space-12)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px dashed var(--g-border-subtle)',
                            backgroundColor: 'var(--g-surface-card)',
                        }}
                    >
                        <Layers className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-muted)' }} />
                        <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                            No hay instancias para este proyecto
                        </p>
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Instancia un workflow desde el catálogo de plantillas de arriba.
                        </p>
                    </div>
                ) : (
                    <div
                        className="g-card"
                        style={{
                            borderRadius: 'var(--g-radius-lg)',
                            overflow: 'hidden',
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 'var(--g-text-small)',
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        borderBottom: '1px solid var(--g-border-default)',
                                    }}
                                >
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Workflow
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Estado
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Fase actual
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Creado
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Informe
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'right',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            fontSize: 'var(--g-text-caption)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {instances.map(instance => {
                                    const statusCfg = INSTANCE_STATUS_CONFIG[instance.status] || INSTANCE_STATUS_CONFIG.created;
                                    const templateName = templateNameMap.get(instance.template_id) || 'Workflow';
                                    const currentPhaseIdx = getPhaseIndex(instance.current_phase);
                                    const phaseCfg = PHASE_CONFIG[instance.current_phase];
                                    const isExecuting = executing === instance.id;
                                    const canExecute = instance.status === 'in_progress' || instance.status === 'created';

                                    return (
                                        <tr
                                            key={instance.id}
                                            style={{
                                                borderBottom: '1px solid var(--g-border-subtle)',
                                                transition: 'background-color var(--g-transition-fast)',
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--g-surface-subtle)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = '';
                                            }}
                                        >
                                            {/* Template name */}
                                            <td
                                                style={{
                                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                                    fontWeight: 500,
                                                    color: 'var(--g-text-primary)',
                                                }}
                                            >
                                                {templateName}
                                            </td>

                                            {/* Status badge */}
                                            <td style={{ padding: 'var(--g-space-3) var(--g-space-4)' }}>
                                                <span
                                                    style={{
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: statusCfg.bg,
                                                        color: statusCfg.fg,
                                                    }}
                                                >
                                                    {statusCfg.label}
                                                </span>
                                            </td>

                                            {/* Phase progress */}
                                            <td style={{ padding: 'var(--g-space-3) var(--g-space-4)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                    {/* Phase dots */}
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        {PHASES_ORDERED.map((phase, idx) => {
                                                            let dotColor = 'var(--g-border-default)'; // upcoming
                                                            if (idx < currentPhaseIdx) {
                                                                dotColor = 'var(--status-success)'; // completed
                                                            } else if (idx === currentPhaseIdx) {
                                                                dotColor = 'var(--status-info)'; // current
                                                            }

                                                            // Handle completed instance
                                                            if (instance.status === 'completed') {
                                                                dotColor = 'var(--status-success)';
                                                            }

                                                            return (
                                                                <div
                                                                    key={phase}
                                                                    title={PHASE_CONFIG[phase]?.label || phase}
                                                                    style={{
                                                                        width: '8px',
                                                                        height: '8px',
                                                                        borderRadius: 'var(--g-radius-full)',
                                                                        backgroundColor: dotColor,
                                                                        transition: 'background-color var(--g-transition-fast)',
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    {/* Phase label */}
                                                    {phaseCfg && (
                                                        <span
                                                            style={{
                                                                fontSize: 'var(--g-text-caption)',
                                                                fontWeight: 500,
                                                                color: phaseCfg.color,
                                                            }}
                                                        >
                                                            {phaseCfg.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Created date */}
                                            <td
                                                style={{
                                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                                    color: 'var(--g-text-secondary)',
                                                    fontSize: 'var(--g-text-caption)',
                                                }}
                                            >
                                                {formatDate(instance.created_at)}
                                            </td>

                                            {/* Latest workflow report */}
                                            <td
                                                style={{
                                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                                    fontSize: 'var(--g-text-caption)',
                                                }}
                                            >
                                                {instance.latest_report?.id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <Link
                                                            href={`/reports/${instance.latest_report.id}`}
                                                            style={{
                                                                color: 'var(--g-link)',
                                                                fontWeight: 600,
                                                                textDecoration: 'none',
                                                            }}
                                                        >
                                                            v{instance.latest_report.version_number}
                                                        </Link>
                                                        <span style={{ color: 'var(--g-text-muted)' }}>
                                                            {formatDate(instance.latest_report.created_at)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--g-text-muted)' }}>Sin informe</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td
                                                style={{
                                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {canExecute && (
                                                    <button
                                                        onClick={() => handleExecute(instance)}
                                                        disabled={isExecuting}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-md)',
                                                            backgroundColor: 'var(--g-brand-3308)',
                                                            color: 'var(--g-text-inverse)',
                                                            border: 'none',
                                                            cursor: isExecuting ? 'not-allowed' : 'pointer',
                                                            opacity: isExecuting ? 0.6 : 1,
                                                            transition: 'opacity var(--g-transition-fast)',
                                                        }}
                                                    >
                                                        {isExecuting ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Play className="h-3 w-3" />
                                                        )}
                                                        {isExecuting ? 'Ejecutando...' : 'Ejecutar'}
                                                    </button>
                                                )}
                                                {instance.status === 'completed' && (
                                                    <span
                                                        style={{
                                                            fontSize: 'var(--g-text-caption)',
                                                            color: 'var(--status-success)',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Completado
                                                    </span>
                                                )}
                                                {instance.status === 'failed' && (
                                                    <span
                                                        style={{
                                                            fontSize: 'var(--g-text-caption)',
                                                            color: 'var(--status-error)',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Fallido
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
