'use client';

import { useEffect, useState } from 'react';
import {
    PieChart,
    ListChecks,
    Bell,
    Clock,
    CheckCircle2,
    Circle,
    AlertCircle,
    ChevronRight,
    Loader2,
} from 'lucide-react';

interface ClientDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Types for API responses                                            */
/* ------------------------------------------------------------------ */

interface WarRoomProgress {
    area_code: string;
    total_tasks: number;
    completed_tasks: number;
    blocked_tasks: number;
    pct_complete: number;
}

interface WarRoomBlocker {
    id: string;
    title: string;
    area_code: string;
    state: string;
    entered_state_at: string;
    assigned_to: string | null;
}

interface WarRoomRedFlag {
    id: string;
    title: string;
    severity: string;
    area_code: string;
    status: string;
}

interface KanbanBoardColumn {
    state: string;
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
}

/* ------------------------------------------------------------------ */
/*  Derived types                                                      */
/* ------------------------------------------------------------------ */

interface MilestoneItem {
    id: string;
    label: string;
    completed: boolean;
    date: string;
}

interface ClientAction {
    id: string;
    title: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

interface RecentUpdate {
    id: string;
    text: string;
    date: string;
    type: 'report' | 'progress' | 'qa' | 'alert' | 'document';
}

/* ------------------------------------------------------------------ */
/*  Priority badge config                                              */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    critical: { label: 'Urgente', bg: 'var(--g-severity-critical)', fg: 'var(--g-text-inverse)' },
    high:     { label: 'Alta',    bg: 'var(--g-severity-high)',     fg: 'var(--g-text-inverse)' },
    medium:   { label: 'Media',   bg: 'var(--g-severity-medium)',   fg: 'var(--g-text-inverse)' },
    low:      { label: 'Baja',    bg: 'var(--g-severity-low)',      fg: 'var(--g-text-inverse)' },
};

const UPDATE_ICON_COLOR: Record<string, string> = {
    report: 'var(--g-brand-3308)',
    progress: 'var(--status-success)',
    qa: 'var(--status-info)',
    alert: 'var(--status-error)',
    document: 'var(--status-warning)',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function deriveMilestones(progress: WarRoomProgress[]): MilestoneItem[] {
    const totalTasks = progress.reduce((sum, p) => sum + p.total_tasks, 0);
    const totalCompleted = progress.reduce((sum, p) => sum + p.completed_tasks, 0);
    const overallPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    return [
        { id: 'ms1', label: 'Kick-off y planificacion', completed: overallPct > 0 || totalTasks > 0, date: '' },
        { id: 'ms2', label: 'Apertura de Data Room', completed: overallPct >= 10, date: '' },
        { id: 'ms3', label: 'Revision inicial (Fase 1)', completed: overallPct >= 30, date: '' },
        { id: 'ms4', label: 'Informe de Red Flags', completed: overallPct >= 50, date: '' },
        { id: 'ms5', label: 'Borrador de informe final', completed: overallPct >= 70, date: '' },
        { id: 'ms6', label: 'Entrega de informe final', completed: overallPct >= 90, date: '' },
        { id: 'ms7', label: 'Cierre de transaccion', completed: overallPct >= 100, date: '' },
    ];
}

function deriveClientActions(
    blockers: WarRoomBlocker[],
    redFlags: WarRoomRedFlag[],
): ClientAction[] {
    const actions: ClientAction[] = [];

    // Blockers become client actions
    for (const b of blockers.slice(0, 3)) {
        actions.push({
            id: b.id,
            title: b.title,
            priority: 'high',
        });
    }

    // Red flags become urgent actions
    for (const rf of redFlags.slice(0, 2)) {
        if (!actions.find(a => a.id === rf.id)) {
            actions.push({
                id: rf.id,
                title: rf.title,
                priority: rf.severity === 'critical' ? 'critical' : 'high',
            });
        }
    }

    return actions.slice(0, 5);
}

function deriveRecentUpdates(
    progress: WarRoomProgress[],
    redFlags: WarRoomRedFlag[],
    blockers: WarRoomBlocker[],
): RecentUpdate[] {
    const updates: RecentUpdate[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Area completion updates
    for (const p of progress) {
        if (p.pct_complete > 0) {
            updates.push({
                id: `prog-${p.area_code}`,
                text: `Area ${p.area_code} completada al ${p.pct_complete}%`,
                date: today,
                type: 'progress',
            });
        }
    }

    // Red flag updates
    for (const rf of redFlags.slice(0, 2)) {
        updates.push({
            id: `rf-${rf.id}`,
            text: `Red flag: ${rf.title}`,
            date: today,
            type: 'alert',
        });
    }

    // Blocker updates
    for (const b of blockers.slice(0, 2)) {
        updates.push({
            id: `block-${b.id}`,
            text: `Bloqueado: ${b.title}`,
            date: today,
            type: 'qa',
        });
    }

    return updates.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClientDashboard({ projectId }: ClientDashboardProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [overallProgress, setOverallProgress] = useState(0);
    const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
    const [clientActions, setClientActions] = useState<ClientAction[]>([]);
    const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        async function loadData() {
            try {
                const warRoomRes = await fetchJSON<{
                    success: boolean;
                    blockers: WarRoomBlocker[];
                    progress: WarRoomProgress[];
                    red_flags: WarRoomRedFlag[];
                }>(`/api/war-room/${projectId}`);

                const progress = warRoomRes?.progress || [];
                const blockers = warRoomRes?.blockers || [];
                const redFlags = warRoomRes?.red_flags || [];

                // Overall progress
                const totalTasks = progress.reduce((sum, p) => sum + p.total_tasks, 0);
                const totalCompleted = progress.reduce((sum, p) => sum + p.completed_tasks, 0);
                const pct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
                setOverallProgress(pct);

                // Milestones
                setMilestones(deriveMilestones(progress));

                // Client actions
                setClientActions(deriveClientActions(blockers, redFlags));

                // Recent updates
                setRecentUpdates(deriveRecentUpdates(progress, redFlags, blockers));

            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [projectId]);

    const completedMilestones = milestones.filter(m => m.completed).length;

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Portal del Cliente
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Estado de su Due Diligence{projectId ? ` — Proyecto ${projectId}` : ''}
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
                    Portal del Cliente
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Estado de su Due Diligence{projectId ? ` — Proyecto ${projectId}` : ''}
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

            {/* Top row: Progress ring + Milestones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--g-space-5)' }}>
                {/* Progreso General — large ring */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <PieChart style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--g-brand-3308)',
                        }}>
                            Progreso General
                        </span>
                    </div>

                    <div style={{
                        padding: 'var(--g-space-6) var(--g-space-5)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flex: 1, gap: 'var(--g-space-3)',
                    }}>
                        {/* Large progress ring */}
                        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                            <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle
                                    cx="80" cy="80" r="68"
                                    fill="none"
                                    stroke="var(--g-surface-muted)"
                                    strokeWidth="12"
                                />
                                <circle
                                    cx="80" cy="80" r="68"
                                    fill="none"
                                    stroke="var(--g-brand-3308)"
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 68}`}
                                    strokeDashoffset={`${2 * Math.PI * 68 * (1 - overallProgress / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                />
                            </svg>
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--g-brand-3308)', lineHeight: 1 }}>
                                    {overallProgress}%
                                </span>
                                <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)', marginTop: '4px' }}>
                                    completado
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hitos Completados */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <ListChecks style={{ width: 14, height: 14, color: 'var(--status-success)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-success)',
                        }}>
                            Hitos Completados
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                            {completedMilestones}/{milestones.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {milestones.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin datos de hitos disponibles
                            </p>
                        ) : (
                            milestones.map((ms) => (
                                <div
                                    key={ms.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        borderRadius: 'var(--g-radius-md)',
                                        opacity: ms.completed ? 1 : 0.6,
                                    }}
                                >
                                    {ms.completed ? (
                                        <CheckCircle2 style={{ width: 18, height: 18, color: 'var(--status-success)', flexShrink: 0 }} aria-hidden="true" />
                                    ) : (
                                        <Circle style={{ width: 18, height: 18, color: 'var(--g-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{
                                            fontSize: 'var(--g-text-body)', fontWeight: 500,
                                            color: ms.completed ? 'var(--g-text-primary)' : 'var(--g-text-secondary)',
                                            textDecoration: ms.completed ? 'line-through' : 'none',
                                        }}>
                                            {ms.label}
                                        </span>
                                    </div>
                                    {ms.date && (
                                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)', flexShrink: 0 }}>
                                            {ms.date}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom row: Client Actions + Recent Updates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)' }}>
                {/* Accion Requerida */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Bell style={{ width: 14, height: 14, color: 'var(--status-warning)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-warning)',
                        }}>
                            Accion Requerida
                        </span>
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                            fontSize: 'var(--g-text-caption)', fontWeight: 700,
                            backgroundColor: 'var(--status-warning)', color: 'var(--g-text-inverse)',
                        }}>
                            {clientActions.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {clientActions.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin acciones pendientes
                            </p>
                        ) : (
                            clientActions.map((action) => {
                                const badge = PRIORITY_BADGE[action.priority] || PRIORITY_BADGE.medium;
                                return (
                                    <div
                                        key={action.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flex: 1, minWidth: 0 }}>
                                            <AlertCircle style={{ width: 16, height: 16, color: badge.bg, flexShrink: 0 }} aria-hidden="true" />
                                            <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                                {action.title}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flexShrink: 0 }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                                                fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                                backgroundColor: badge.bg, color: badge.fg,
                                            }}>
                                                {badge.label}
                                            </span>
                                            <ChevronRight style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} aria-hidden="true" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Ultimas Actualizaciones */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Clock style={{ width: 14, height: 14, color: 'var(--status-info)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-info)',
                        }}>
                            Ultimas Actualizaciones
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {recentUpdates.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin actualizaciones recientes
                            </p>
                        ) : (
                            recentUpdates.map((update, i) => (
                                <div
                                    key={update.id}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-3)',
                                        position: 'relative',
                                    }}
                                >
                                    {/* Timeline dot + line */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{
                                            width: '10px', height: '10px',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: UPDATE_ICON_COLOR[update.type] || 'var(--g-text-muted)',
                                            flexShrink: 0,
                                        }} />
                                        {i < recentUpdates.length - 1 && (
                                            <div style={{
                                                width: '2px', height: '24px',
                                                backgroundColor: 'var(--g-border-subtle)',
                                                marginTop: '4px',
                                            }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                            {update.text}
                                        </p>
                                        <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                            {update.date}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
