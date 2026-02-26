'use client';

import { useEffect, useState } from 'react';
import {
    ListChecks,
    Bot,
    FileSearch,
    ArrowRight,
    AlertCircle,
    Clock,
    ChevronRight,
    Loader2,
} from 'lucide-react';

interface LawyerDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Types for API responses                                            */
/* ------------------------------------------------------------------ */

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
        hitl_required?: boolean;
        ai_status?: string;
        skill_key?: string | null;
    }>;
    task_count: number;
}

interface KanbanMetrics {
    total_tasks: number;
    by_state: Record<string, number>;
    by_area: Record<string, number>;
    stale_tasks: number;
    hitl_pending: number;
    ai_running: number;
}

/* ------------------------------------------------------------------ */
/*  Derived types                                                      */
/* ------------------------------------------------------------------ */

interface PendingTask {
    id: string;
    title: string;
    area: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    dueDate: string;
}

interface HITLItem {
    id: string;
    title: string;
    skill: string;
    confidence: number;
}

/* ------------------------------------------------------------------ */
/*  Priority config                                                    */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    critical: { label: 'Critica', bg: 'var(--g-severity-critical)', fg: 'var(--g-text-inverse)' },
    high:     { label: 'Alta',    bg: 'var(--g-severity-high)',     fg: 'var(--g-text-inverse)' },
    medium:   { label: 'Media',   bg: 'var(--g-severity-medium)',   fg: 'var(--g-text-inverse)' },
    low:      { label: 'Baja',    bg: 'var(--g-severity-low)',      fg: 'var(--g-text-inverse)' },
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

// States considered "active" / pending work
const PENDING_STATES = ['backlog', 'ready', 'in_progress', 'en_revision', 'revision_ia'];
// States considered as HITL review
const HITL_STATES = ['hitl_revision'];

function derivePendingTasks(board: KanbanBoardColumn[]): PendingTask[] {
    const tasks: PendingTask[] = [];
    for (const col of board) {
        if (PENDING_STATES.includes(col.state)) {
            for (const task of col.tasks) {
                tasks.push({
                    id: task.id,
                    title: task.title,
                    area: task.area_code,
                    priority: (task.priority as PendingTask['priority']) || 'medium',
                    dueDate: '',
                });
            }
        }
    }
    // Sort by priority: critical > high > medium > low
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
    return tasks.slice(0, 8);
}

function deriveHITLItems(board: KanbanBoardColumn[]): HITLItem[] {
    const items: HITLItem[] = [];
    for (const col of board) {
        if (HITL_STATES.includes(col.state)) {
            for (const task of col.tasks) {
                items.push({
                    id: task.id,
                    title: task.title,
                    skill: task.skill_key || 'revision_general',
                    confidence: 0.85, // Default confidence since kanban tasks don't store this
                });
            }
        }
    }
    return items.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LawyerDashboard({ projectId }: LawyerDashboardProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [hitlItems, setHitlItems] = useState<HITLItem[]>([]);
    const [docsToReview, setDocsToReview] = useState(0);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        async function loadData() {
            try {
                const [boardRes, metricsRes] = await Promise.all([
                    fetchJSON<{ success: boolean; board: KanbanBoardColumn[] }>(
                        `/api/kanban/board?project_id=${projectId}`,
                    ),
                    fetchJSON<{ success: boolean; metrics: KanbanMetrics }>(
                        `/api/kanban/metrics?project_id=${projectId}`,
                    ),
                ]);

                const board = boardRes?.board || [];
                const metrics = metricsRes?.metrics;

                // Pending tasks
                setPendingTasks(derivePendingTasks(board));

                // HITL items
                setHitlItems(deriveHITLItems(board));

                // Docs to review: use HITL pending + stale tasks as proxy
                if (metrics) {
                    setDocsToReview(metrics.hitl_pending + metrics.stale_tasks);
                }

            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [projectId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Mi Escritorio
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Vista de abogado de area{projectId ? ` — Proyecto ${projectId}` : ''}
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
                    Mi Escritorio
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Vista de abogado de area{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {error && (
                <div style={{
                    padding: 'var(--g-space-3) var(--g-space-4)',
                    backgroundColor: 'var(--g-trigger-bg)',
                    borderRadius: 'var(--g-radius-md)',
                    color: 'var(--status-warning)',
                    fontSize: 'var(--g-text-body)',
                }}>
                    Algunos datos no pudieron cargarse. Mostrando informacion parcial.
                </div>
            )}

            {/* Top KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-4)' }}>
                {/* Pending tasks count */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ListChecks style={{ width: 20, height: 20, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {pendingTasks.length}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        Tareas pendientes
                    </p>
                </div>

                {/* HITL count */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-trigger-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Bot style={{ width: 20, height: 20, color: 'var(--status-warning)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {hitlItems.length}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        HITL pendientes
                    </p>
                </div>

                {/* Docs to review */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-input-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FileSearch style={{ width: 20, height: 20, color: 'var(--status-info)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {docsToReview}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        Documentos por revisar
                    </p>
                </div>
            </div>

            {/* Quick action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    type="button"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)',
                        borderRadius: 'var(--g-radius-md)', border: 'none', cursor: 'pointer',
                        padding: 'var(--g-space-2) var(--g-space-5)', fontSize: 'var(--g-text-body)',
                        fontWeight: 500, boxShadow: 'var(--g-shadow-brand)',
                    }}
                >
                    Ir a siguiente tarea
                    <ArrowRight style={{ width: 16, height: 16 }} aria-hidden="true" />
                </button>
            </div>

            {/* Two-column layout: Tasks + HITL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)' }}>
                {/* Mi Cola de Trabajo */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <ListChecks style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--g-brand-3308)',
                        }}>
                            Mi Cola de Trabajo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {pendingTasks.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin tareas pendientes
                            </p>
                        ) : (
                            pendingTasks.map((task) => {
                                const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
                                return (
                                    <div
                                        key={task.id}
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
                                                {task.title}
                                            </p>
                                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                                {task.area}{task.dueDate ? ` · Vence: ${task.dueDate}` : ''}
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

                {/* HITL Pendientes */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Bot style={{ width: 14, height: 14, color: 'var(--status-warning)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-warning)',
                        }}>
                            HITL Pendientes
                        </span>
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                            fontSize: 'var(--g-text-caption)', fontWeight: 700,
                            backgroundColor: 'var(--status-warning)', color: 'var(--g-text-inverse)',
                        }}>
                            {hitlItems.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {hitlItems.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin revisiones HITL pendientes
                            </p>
                        ) : (
                            hitlItems.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                            <AlertCircle style={{ width: 14, height: 14, color: 'var(--status-warning)', flexShrink: 0 }} aria-hidden="true" />
                                            <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                                {item.title}
                                            </p>
                                        </div>
                                        <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px', paddingLeft: '22px' }}>
                                            Skill: {item.skill} · Confianza: {Math.round(item.confidence * 100)}%
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flexShrink: 0 }}>
                                        <Clock style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} aria-hidden="true" />
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
