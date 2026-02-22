'use client';

import { useEffect, useState } from 'react';
import {
    Milestone,
    Gauge,
    Users,
    OctagonAlert,
    ChevronRight,
    CheckCircle2,
    Circle,
    Loader2,
} from 'lucide-react';

interface PMODashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Types for API responses                                            */
/* ------------------------------------------------------------------ */

interface WarRoomBlocker {
    id: string;
    title: string;
    area_code: string;
    state: string;
    entered_state_at: string;
    assigned_to: string | null;
}

interface WarRoomProgress {
    area_code: string;
    total_tasks: number;
    completed_tasks: number;
    blocked_tasks: number;
    pct_complete: number;
}

interface KanbanMetrics {
    total_tasks: number;
    by_state: Record<string, number>;
    by_area: Record<string, number>;
    stale_tasks: number;
    stale_details: Array<{
        state: string;
        area_code: string;
        days_in_state: number;
        hitl_required: boolean;
        ai_status: string;
    }>;
    hitl_pending: number;
    ai_running: number;
}

interface KanbanBoardColumn {
    state: string;
    wip_limit: number;
    tasks: Array<{
        id: string;
        title: string;
        area_code: string;
        assigned_to: string | null;
        state: string;
        priority: string;
        entered_state_at: string;
    }>;
    task_count: number;
    wip_exceeded: boolean;
}

/* ------------------------------------------------------------------ */
/*  Fallback data (used when APIs fail)                                */
/* ------------------------------------------------------------------ */

const FALLBACK_MILESTONES = [
    { id: 'm1', label: 'Kick-off', date: '', completed: false },
    { id: 'm2', label: 'Data Room abierto', date: '', completed: false },
    { id: 'm3', label: 'Revision Fase 1', date: '', completed: false },
    { id: 'm4', label: 'Red Flag Report', date: '', completed: false },
    { id: 'm5', label: 'Informe Final', date: '', completed: false },
    { id: 'm6', label: 'Cierre', date: '', completed: false },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getSLAColor(pct: number): string {
    if (pct >= 90) return 'var(--status-success)';
    if (pct >= 70) return 'var(--status-warning)';
    return 'var(--status-error)';
}

function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_session_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Milestone derivation from progress data                            */
/* ------------------------------------------------------------------ */

interface TimelineMilestone {
    id: string;
    label: string;
    date: string;
    completed: boolean;
}

function deriveMilestones(
    progress: WarRoomProgress[],
    totalTasks: number,
    byState: Record<string, number>,
): TimelineMilestone[] {
    const totalCompleted = progress.reduce((sum, p) => sum + p.completed_tasks, 0);
    const overallPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Derive milestones from overall progress levels
    return [
        { id: 'm1', label: 'Kick-off', date: '', completed: overallPct > 0 || totalTasks > 0 },
        { id: 'm2', label: 'Data Room abierto', date: '', completed: overallPct >= 10 },
        { id: 'm3', label: 'Revision Fase 1', date: '', completed: overallPct >= 30 },
        { id: 'm4', label: 'Red Flag Report', date: '', completed: overallPct >= 50 },
        { id: 'm5', label: 'Informe Final', date: '', completed: overallPct >= 80 },
        { id: 'm6', label: 'Cierre', date: '', completed: overallPct >= 100 },
    ];
}

/* ------------------------------------------------------------------ */
/*  Team capacity derivation from board data                           */
/* ------------------------------------------------------------------ */

interface TeamMember {
    name: string;
    role: string;
    assigned: number;
    completed: number;
}

function deriveTeamCapacity(
    board: KanbanBoardColumn[],
    progress: WarRoomProgress[],
): TeamMember[] {
    // Group by area_code from board tasks
    const byArea: Record<string, { assigned: number; completed: number }> = {};
    for (const col of board) {
        for (const task of col.tasks) {
            const key = task.area_code || 'GENERAL';
            if (!byArea[key]) byArea[key] = { assigned: 0, completed: 0 };
            byArea[key].assigned++;
            if (['conclusion', 'integrado_en_informe'].includes(task.state)) {
                byArea[key].completed++;
            }
        }
    }

    // Merge with progress data from war-room
    for (const p of progress) {
        if (!byArea[p.area_code]) {
            byArea[p.area_code] = { assigned: p.total_tasks, completed: p.completed_tasks };
        }
    }

    return Object.entries(byArea)
        .map(([code, stats]) => ({
            name: `Area ${code}`,
            role: code,
            assigned: stats.assigned || 1,
            completed: stats.completed,
        }))
        .sort((a, b) => b.assigned - a.assigned)
        .slice(0, 8);
}

/* ------------------------------------------------------------------ */
/*  Blocker derivation                                                 */
/* ------------------------------------------------------------------ */

interface ActiveBlocker {
    id: string;
    title: string;
    area: string;
    daysPending: number;
}

function deriveBlockers(blockers: WarRoomBlocker[]): ActiveBlocker[] {
    const now = Date.now();
    return blockers.map((b) => ({
        id: b.id,
        title: b.title,
        area: b.area_code,
        daysPending: Math.max(1, Math.floor((now - new Date(b.entered_state_at).getTime()) / (1000 * 60 * 60 * 24))),
    }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PMODashboard({ projectId }: PMODashboardProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [milestones, setMilestones] = useState<TimelineMilestone[]>(FALLBACK_MILESTONES);
    const [slaCompliance, setSlaCompliance] = useState(0);
    const [teamCapacity, setTeamCapacity] = useState<TeamMember[]>([]);
    const [activeBlockers, setActiveBlockers] = useState<ActiveBlocker[]>([]);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        async function loadData() {
            try {
                const [metricsRes, boardRes, warRoomRes] = await Promise.all([
                    fetchJSON<{ success: boolean; metrics: KanbanMetrics }>(
                        `/api/kanban/metrics?project_id=${projectId}`,
                    ),
                    fetchJSON<{ success: boolean; board: KanbanBoardColumn[] }>(
                        `/api/kanban/board?project_id=${projectId}`,
                    ),
                    fetchJSON<{
                        success: boolean;
                        blockers: WarRoomBlocker[];
                        progress: WarRoomProgress[];
                        decisions: unknown[];
                    }>(`/api/war-room/${projectId}`),
                ]);

                const metrics = metricsRes?.metrics;
                const board = boardRes?.board || [];
                const warRoom = warRoomRes;

                // SLA Compliance: completed / total tasks
                if (metrics && metrics.total_tasks > 0) {
                    const completed = (metrics.by_state['conclusion'] || 0) + (metrics.by_state['integrado_en_informe'] || 0);
                    const pct = Math.round((completed / metrics.total_tasks) * 100);
                    setSlaCompliance(pct);
                }

                // Team capacity
                const progress = warRoom?.progress || [];
                const capacity = deriveTeamCapacity(board, progress);
                if (capacity.length > 0) {
                    setTeamCapacity(capacity);
                }

                // Milestones
                const derivedMilestones = deriveMilestones(
                    progress,
                    metrics?.total_tasks || 0,
                    metrics?.by_state || {},
                );
                setMilestones(derivedMilestones);

                // Blockers
                const blockers = warRoom?.blockers || [];
                setActiveBlockers(deriveBlockers(blockers));

            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [projectId]);

    const completedMilestones = milestones.filter(m => m.completed).length;
    const progressPct = Math.round((completedMilestones / milestones.length) * 100);
    const slaColor = getSLAColor(slaCompliance);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Panel PMO
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Gestion operativa de la transaccion{projectId ? ` — Proyecto ${projectId}` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--g-space-12)' }}>
                    <Loader2 style={{ width: 32, height: 32, color: 'var(--g-brand-3308)', animation: 'spin 1s linear infinite' }} />
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Panel PMO
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Gestion operativa de la transaccion{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {error && (
                <div style={{
                    padding: 'var(--g-space-3) var(--g-space-4)',
                    backgroundColor: '#fef9ee',
                    borderRadius: 'var(--g-radius-md)',
                    color: 'var(--status-warning)',
                    fontSize: 'var(--g-text-body)',
                }}>
                    Algunos datos no pudieron cargarse. Mostrando informacion parcial.
                </div>
            )}

            {/* Timeline del Proyecto */}
            <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}>
                    <Milestone style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    <span style={{
                        fontWeight: 700, fontSize: 'var(--g-text-caption)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: 'var(--g-brand-3308)',
                    }}>
                        Timeline del Proyecto
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                        {completedMilestones}/{milestones.length} hitos ({progressPct}%)
                    </span>
                </div>

                <div style={{ padding: 'var(--g-space-5)' }}>
                    {/* Progress bar */}
                    <div style={{
                        width: '100%', height: '10px', borderRadius: 'var(--g-radius-full)',
                        backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden',
                        marginBottom: 'var(--g-space-4)',
                    }}>
                        <div style={{
                            width: `${progressPct}%`, height: '100%',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--g-brand-3308)',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>

                    {/* Milestone dots */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        position: 'relative',
                    }}>
                        {milestones.map((ms) => (
                            <div key={ms.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                {ms.completed ? (
                                    <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                ) : (
                                    <Circle style={{ width: 20, height: 20, color: 'var(--g-text-muted)' }} aria-hidden="true" />
                                )}
                                <span style={{
                                    fontSize: 'var(--g-text-caption)',
                                    fontWeight: ms.completed ? 600 : 400,
                                    color: ms.completed ? 'var(--g-text-primary)' : 'var(--g-text-muted)',
                                    marginTop: '6px', textAlign: 'center',
                                }}>
                                    {ms.label}
                                </span>
                                {ms.date && (
                                    <span style={{
                                        fontSize: '11px', color: 'var(--g-text-muted)', marginTop: '2px',
                                    }}>
                                        {ms.date}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Second row: SLA + Capacity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--g-space-5)' }}>
                {/* SLA Compliance */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Gauge style={{ width: 14, height: 14, color: slaColor }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: slaColor,
                        }}>
                            SLA Compliance
                        </span>
                    </div>

                    <div style={{
                        padding: 'var(--g-space-6) var(--g-space-5)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-4)',
                        flex: 1, justifyContent: 'center',
                    }}>
                        {/* Ring / circular gauge via CSS */}
                        <div style={{
                            position: 'relative', width: '120px', height: '120px',
                        }}>
                            {/* Background ring */}
                            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    stroke="var(--g-surface-muted)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    stroke={slaColor}
                                    strokeWidth="10"
                                    strokeDasharray={`${2 * Math.PI * 52}`}
                                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - slaCompliance / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                />
                            </svg>
                            {/* Center text */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: slaColor }}>
                                    {slaCompliance}%
                                </span>
                            </div>
                        </div>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', textAlign: 'center' }}>
                            {slaCompliance >= 90 ? 'Dentro de objetivo' : slaCompliance >= 70 ? 'Requiere atencion' : 'Fuera de objetivo'}
                        </p>
                    </div>
                </div>

                {/* Capacidad del Equipo */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Users style={{ width: 14, height: 14, color: 'var(--status-info)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-info)',
                        }}>
                            Capacidad del Equipo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-4) var(--g-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                        {teamCapacity.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin datos de equipo disponibles
                            </p>
                        ) : (
                            teamCapacity.map((person) => {
                                const utilization = person.assigned > 0 ? Math.round((person.completed / person.assigned) * 100) : 0;
                                const barColor = utilization >= 80 ? 'var(--status-success)'
                                    : utilization >= 50 ? 'var(--status-warning)'
                                        : 'var(--status-error)';

                                return (
                                    <div key={person.name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: 'var(--g-text-body)', fontWeight: 500, color: 'var(--g-text-primary)' }}>
                                                {person.name}
                                            </span>
                                            <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                                                {person.completed}/{person.assigned} completadas · {person.role}
                                            </span>
                                        </div>
                                        <div style={{
                                            width: '100%', height: '6px', borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                width: `${Math.min(utilization, 100)}%`, height: '100%',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: barColor,
                                                transition: 'width 0.4s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Bloqueos Activos */}
            <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}>
                    <OctagonAlert style={{ width: 14, height: 14, color: 'var(--status-error)' }} aria-hidden="true" />
                    <span style={{
                        fontWeight: 700, fontSize: 'var(--g-text-caption)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: 'var(--status-error)',
                    }}>
                        Bloqueos Activos
                    </span>
                    <span style={{
                        marginLeft: 'auto',
                        padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                        fontSize: 'var(--g-text-caption)', fontWeight: 700,
                        backgroundColor: 'var(--status-error)', color: 'var(--g-text-inverse)',
                    }}>
                        {activeBlockers.length}
                    </span>
                </div>

                <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {activeBlockers.length === 0 ? (
                        <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                            Sin bloqueos activos
                        </p>
                    ) : (
                        activeBlockers.map((blocker) => (
                            <div
                                key={blocker.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                        {blocker.title}
                                    </p>
                                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                        Area: {blocker.area} · {blocker.daysPending} dias pendiente
                                    </p>
                                </div>
                                <ChevronRight style={{ width: 14, height: 14, color: 'var(--g-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
