'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Loader2, ShieldAlert, FileSearch,
    MessageSquare, Scale, CalendarClock, AlertTriangle,
    CheckCircle2, Clock, TrendingUp
} from 'lucide-react';
import { formatDate, formatCurrency, AREA_COLORS, SEVERITY_CONFIG, NEGOTIATION_STATUS_CONFIG } from '@/lib/utils';

// ── Types from the cockpit API response ──────────────────────

interface CockpitProject {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'review' | 'closed';
    review_depth: 'light' | 'standard' | 'enhanced';
    deal_type: string;
    target_company: string;
}

interface AreaStatus {
    area_id: string;
    code: string;
    name: string;
    color: string | null;
    icon: string | null;
    total_tasks: number;
    by_status: Record<string, number>;
    completion_pct: number;
}

interface VDR {
    total: number;
    expected: number;
    coverage: number;
}

interface RedFlag {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    probability: string;
    estimated_amount: number | null;
    amount_currency: string;
    status: string;
    recommendation: string | null;
    area_id: string | null;
    area_code: string | null;
}

interface QAPulse {
    total: number;
    by_status: Record<string, number>;
    sla_breaches: number;
}

interface ContingencySummary {
    total: number;
    by_severity: Record<string, number>;
    total_impact: number;
    negotiation: Record<string, number>;
}

interface TimelineItem {
    task_id: string;
    title: string;
    area_id: string | null;
    area_code: string | null;
    status: string;
    due_date: string;
}

interface CockpitData {
    project: CockpitProject;
    areas: AreaStatus[];
    vdr: VDR;
    red_flags: RedFlag[];
    qa_pulse: QAPulse;
    contingencies: ContingencySummary;
    timeline: TimelineItem[];
}

// ── Config maps ──────────────────────────────────────────────

const PROJECT_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    active: { label: 'Activo', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    review: { label: 'En revision', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    closed: { label: 'Cerrado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
};

const REVIEW_DEPTH_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    light: { label: 'Light', bg: '#10B981', fg: '#fff' },
    standard: { label: 'Standard', bg: '#3B82F6', fg: '#fff' },
    enhanced: { label: 'Enhanced', bg: '#EF4444', fg: '#fff' },
};

const QA_STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    pending_response: 'Pendiente',
    answered: 'Respondida',
    follow_up: 'Seguimiento',
    escalated: 'Escalada',
    closed: 'Cerrada',
};

// ── Helpers ──────────────────────────────────────────────────

function getAreaColor(code: string): string {
    return AREA_COLORS[code] || AREA_COLORS.GENERAL;
}

function getDaysRemaining(dueDate: string): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number): string {
    if (days < 0) return 'var(--status-error)';
    if (days <= 3) return 'var(--status-warning)';
    return 'var(--status-success)';
}

function formatPct(value: number): string {
    return `${Math.round(value * 100)}%`;
}

// ── Component ────────────────────────────────────────────────

export default function DealCockpitPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [data, setData] = useState<CockpitData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCockpit() {
            try {
                const res = await fetch(`/api/projects/${id}/cockpit`);
                const json = await res.json();
                if (json.success) {
                    setData(json.cockpit);
                } else {
                    setError(json.error || 'Error al cargar el cockpit');
                }
            } catch (err) {
                console.error('Cockpit fetch error:', err);
                setError('Error de conexion');
            } finally {
                setLoading(false);
            }
        }
        fetchCockpit();
    }, [id]);

    // ── Loading state ────────────────────────────────────────
    if (loading) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 'var(--g-space-4)' }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>Cargando Deal Cockpit...</p>
            </div>
        );
    }

    // ── Error state ──────────────────────────────────────────
    if (error || !data) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 'var(--g-space-4)' }}>
                <AlertTriangle className="h-8 w-8" style={{ color: 'var(--status-error)' }} />
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>{error || 'No se encontraron datos.'}</p>
                <Link href={`/projects/${id}`} className="text-sm" style={{ color: 'var(--g-link)' }}>Volver al proyecto</Link>
            </div>
        );
    }

    const { project, areas, vdr, red_flags, qa_pulse, contingencies, timeline } = data;
    const pStatus = PROJECT_STATUS_CONFIG[project.status] || PROJECT_STATUS_CONFIG.draft;
    const rdBadge = REVIEW_DEPTH_BADGE[project.review_depth] || REVIEW_DEPTH_BADGE.standard;

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>

            {/* ============================================================ */}
            {/* HEADER */}
            {/* ============================================================ */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Deal Cockpit
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {project.name} &mdash; {project.target_company}
                    </p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                    <span
                        className="px-2 py-0.5 text-xs font-medium"
                        style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: pStatus.bg, color: pStatus.fg }}
                    >
                        {pStatus.label}
                    </span>
                    <span
                        className="px-2 py-0.5 text-xs font-medium"
                        style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: rdBadge.bg, color: rdBadge.fg }}
                    >
                        {rdBadge.label}
                    </span>
                </div>
            </div>

            {/* ============================================================ */}
            {/* PANELS GRID */}
            {/* ============================================================ */}
            <div className="grid grid-cols-12 gap-5">

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 1: Estado por Area (col-span-8) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-8">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Estado por Area
                            </h2>
                            <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                                {areas.length} areas activas
                            </span>
                        </div>
                        {areas.length === 0 ? (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--g-text-secondary)' }}>
                                Sin areas con tareas asignadas.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {areas.map((area) => {
                                    const aColor = getAreaColor(area.code);
                                    const completed = area.by_status['completed'] || 0;
                                    const inProgress = area.by_status['in_progress'] || 0;
                                    const pending = area.total_tasks - completed - inProgress;
                                    return (
                                        <div
                                            key={area.area_id}
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                border: '1px solid var(--g-border-default)',
                                                borderLeft: `3px solid hsla(${aColor}, 1)`,
                                                padding: 'var(--g-space-3)',
                                                backgroundColor: 'var(--g-surface-card)',
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span
                                                    className="text-xs font-bold px-1.5 py-0.5"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: `hsla(${aColor}, 0.12)`,
                                                        color: `hsla(${aColor}, 1)`,
                                                    }}
                                                >
                                                    {area.code}
                                                </span>
                                                <span className="text-xs font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                                    {area.completion_pct}%
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium mb-2 truncate" style={{ color: 'var(--g-text-primary)' }}>
                                                {area.name}
                                            </p>
                                            {/* Progress bar */}
                                            <div
                                                className="w-full h-1.5 mb-2"
                                                style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)' }}
                                            >
                                                <div
                                                    className="h-full transition-all"
                                                    style={{
                                                        width: `${area.completion_pct}%`,
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: `hsla(${aColor}, 1)`,
                                                    }}
                                                />
                                            </div>
                                            {/* Status counts */}
                                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                <span className="inline-flex items-center gap-0.5">
                                                    <span className="inline-block h-1.5 w-1.5" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--status-success)' }} />
                                                    {completed}
                                                </span>
                                                <span className="inline-flex items-center gap-0.5">
                                                    <span className="inline-block h-1.5 w-1.5" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--status-info)' }} />
                                                    {inProgress}
                                                </span>
                                                <span className="inline-flex items-center gap-0.5">
                                                    <span className="inline-block h-1.5 w-1.5" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-border-default)' }} />
                                                    {pending > 0 ? pending : 0}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 2: Cobertura VDR (col-span-4) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-4">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <FileSearch className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Cobertura VDR
                            </h2>
                        </div>
                        {/* Large percentage */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <p
                                className="font-bold"
                                style={{
                                    fontSize: '3rem',
                                    lineHeight: 1,
                                    color: vdr.coverage >= 0.8 ? 'var(--status-success)' : vdr.coverage >= 0.5 ? 'var(--status-warning)' : 'var(--status-error)',
                                }}
                            >
                                {formatPct(vdr.coverage)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                cobertura documental
                            </p>
                            {/* Progress bar */}
                            <div
                                className="w-full h-2 mt-4"
                                style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)', maxWidth: '200px' }}
                            >
                                <div
                                    className="h-full transition-all"
                                    style={{
                                        width: `${Math.min(vdr.coverage * 100, 100)}%`,
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: vdr.coverage >= 0.8 ? 'var(--status-success)' : vdr.coverage >= 0.5 ? 'var(--status-warning)' : 'var(--status-error)',
                                    }}
                                />
                            </div>
                        </div>
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--g-border-default)' }}>
                            <div className="text-center">
                                <p className="text-lg font-bold" style={{ color: 'var(--status-success)' }}>{vdr.total}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Subidos</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>{vdr.expected}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Esperados</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold" style={{ color: vdr.expected - vdr.total > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                                    {Math.max(vdr.expected - vdr.total, 0)}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Gaps</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 3: Red Flags (col-span-6) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="h-4 w-4" style={{ color: 'var(--g-severity-critical)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Red Flags
                            </h2>
                            <span className="text-xs ml-auto px-1.5 py-0.5 font-medium" style={{
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: red_flags.length > 0 ? 'var(--g-severity-critical)' : 'var(--status-success)',
                                color: '#fff',
                            }}>
                                {red_flags.length}
                            </span>
                        </div>
                        {red_flags.length === 0 ? (
                            <div className="flex flex-col items-center py-6">
                                <CheckCircle2 className="h-8 w-8 mb-2" style={{ color: 'var(--status-success)', opacity: 0.5 }} />
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                    No hay contingencias criticas o altas identificadas.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                                {red_flags.map((flag) => {
                                    const sevConfig = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG];
                                    return (
                                        <div
                                            key={flag.id}
                                            className="flex items-start gap-3 p-2.5"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                borderLeft: `3px solid ${sevConfig?.color || 'var(--g-border-default)'}`,
                                            }}
                                        >
                                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: sevConfig?.color || 'var(--g-text-secondary)' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>
                                                    {flag.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span
                                                        className="px-1.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: sevConfig?.color || 'var(--g-surface-muted)',
                                                            color: '#fff',
                                                        }}
                                                    >
                                                        {sevConfig?.label || flag.severity}
                                                    </span>
                                                    {flag.area_code && (
                                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {flag.area_code}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {flag.estimated_amount != null && flag.estimated_amount > 0 && (
                                                <span className="text-xs font-bold shrink-0" style={{ color: 'var(--g-text-primary)' }}>
                                                    {formatCurrency(flag.estimated_amount, flag.amount_currency || 'EUR')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 4: Q&A Pulse (col-span-6) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Q&A Pulse
                            </h2>
                            <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                                {qa_pulse.total} hilos
                            </span>
                        </div>

                        {/* Summary stats row */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-2" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>{qa_pulse.total}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Total</p>
                            </div>
                            <div className="text-center p-2" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-lg font-bold" style={{ color: 'var(--status-success)' }}>
                                    {qa_pulse.by_status['answered'] || 0}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Respondidas</p>
                            </div>
                            <div className="text-center p-2" style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: qa_pulse.sla_breaches > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--g-surface-muted)',
                            }}>
                                <p className="text-lg font-bold" style={{ color: qa_pulse.sla_breaches > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                                    {qa_pulse.sla_breaches}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>SLA rotos</p>
                            </div>
                        </div>

                        {/* Status distribution bar */}
                        {qa_pulse.total > 0 && (
                            <>
                                <div className="flex w-full h-3 overflow-hidden" style={{ borderRadius: 'var(--g-radius-full)' }}>
                                    {Object.entries(qa_pulse.by_status).map(([status, count]) => {
                                        const pct = (count / qa_pulse.total) * 100;
                                        if (pct === 0) return null;
                                        const colorMap: Record<string, string> = {
                                            answered: 'var(--status-success)',
                                            closed: 'var(--g-surface-muted)',
                                            escalated: 'var(--status-error)',
                                            pending_response: 'var(--status-warning)',
                                            sent: 'var(--status-info)',
                                            draft: 'var(--g-border-default)',
                                            follow_up: 'var(--status-info)',
                                        };
                                        return (
                                            <div
                                                key={status}
                                                title={`${QA_STATUS_LABELS[status] || status}: ${count}`}
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: colorMap[status] || 'var(--g-border-default)',
                                                    minWidth: '4px',
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                                {/* Legend */}
                                <div className="flex flex-wrap items-center gap-3 mt-3">
                                    {Object.entries(qa_pulse.by_status).map(([status, count]) => {
                                        if (count === 0) return null;
                                        const colorMap: Record<string, string> = {
                                            answered: 'var(--status-success)',
                                            closed: 'var(--g-text-secondary)',
                                            escalated: 'var(--status-error)',
                                            pending_response: 'var(--status-warning)',
                                            sent: 'var(--status-info)',
                                            draft: 'var(--g-text-secondary)',
                                            follow_up: 'var(--status-info)',
                                        };
                                        return (
                                            <span key={status} className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                <span
                                                    className="inline-block h-2 w-2"
                                                    style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: colorMap[status] || 'var(--g-border-default)' }}
                                                />
                                                {QA_STATUS_LABELS[status] || status} ({count})
                                            </span>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        {qa_pulse.total === 0 && (
                            <p className="text-xs text-center py-4" style={{ color: 'var(--g-text-secondary)' }}>
                                No hay hilos Q&A registrados.
                            </p>
                        )}
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 5: Contingencias & Negociacion (col-span-6) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Scale className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Contingencias & Negociacion
                            </h2>
                        </div>

                        {/* Total + Impact row */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>{contingencies.total}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Contingencias totales</p>
                            </div>
                            <div className="p-3" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{ color: contingencies.total_impact > 0 ? 'var(--status-error)' : 'var(--g-text-primary)' }}>
                                    {formatCurrency(contingencies.total_impact)}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Impacto estimado</p>
                            </div>
                        </div>

                        {/* By severity */}
                        <div className="mb-4">
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--g-text-secondary)' }}>Por severidad</p>
                            <div className="flex items-center gap-2">
                                {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                                    const count = contingencies.by_severity[sev] || 0;
                                    const sevCfg = SEVERITY_CONFIG[sev];
                                    return (
                                        <span
                                            key={sev}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: count > 0 ? sevCfg.color : 'var(--g-surface-muted)',
                                                color: count > 0 ? '#fff' : 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {sevCfg.label}: {count}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Negotiation breakdown */}
                        <div>
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--g-text-secondary)' }}>Estado de negociacion</p>
                            <div className="flex flex-wrap items-center gap-2">
                                {(['open', 'proposed', 'agreed', 'rejected', 'deferred'] as const).map((ns) => {
                                    const count = contingencies.negotiation[ns] || 0;
                                    const nsCfg = NEGOTIATION_STATUS_CONFIG[ns];
                                    return (
                                        <span
                                            key={ns}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: count > 0 ? nsCfg.bg : 'var(--g-surface-muted)',
                                                color: count > 0 ? nsCfg.fg : 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {nsCfg.label}: {count}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* PANEL 6: Timeline / Upcoming Deadlines (col-span-6) */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <CalendarClock className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Timeline
                            </h2>
                            <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                                Proximos vencimientos
                            </span>
                        </div>

                        {timeline.length === 0 ? (
                            <div className="flex flex-col items-center py-6">
                                <Clock className="h-8 w-8 mb-2" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                    No hay tareas con fecha limite pendiente.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
                                {timeline.map((item) => {
                                    const days = getDaysRemaining(item.due_date);
                                    const urgencyColor = getUrgencyColor(days);
                                    const aColor = item.area_code ? getAreaColor(item.area_code) : getAreaColor('GENERAL');
                                    return (
                                        <div
                                            key={item.task_id}
                                            className="flex items-center gap-3 p-2.5"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                borderLeft: `3px solid ${urgencyColor}`,
                                            }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>
                                                    {item.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {item.area_code && (
                                                        <span
                                                            className="text-xs px-1 py-0.5 font-medium"
                                                            style={{
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: `hsla(${aColor}, 0.12)`,
                                                                color: `hsla(${aColor}, 1)`,
                                                            }}
                                                        >
                                                            {item.area_code}
                                                        </span>
                                                    )}
                                                    <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                        {formatDate(item.due_date)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span
                                                    className="text-xs font-bold"
                                                    style={{ color: urgencyColor }}
                                                >
                                                    {days < 0
                                                        ? `${Math.abs(days)}d atrasado`
                                                        : days === 0
                                                            ? 'Hoy'
                                                            : `${days}d`
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
