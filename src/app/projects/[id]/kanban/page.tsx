'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Inbox, Send, Download, CheckCircle, Search, Sparkles,
    UserCheck, FileCheck, BookCheck, AlertOctagon, Plus, X, Clock,
    AlertTriangle, Bot, RefreshCw, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { KANBAN_STATE_CONFIG, AREA_COLORS } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KanbanTask {
    id: string;
    project_id: string;
    area_code: string;
    title: string;
    description: string | null;
    state: string;
    priority: string;
    assigned_to: string | null;
    hitl_required: boolean;
    ai_status: string | null;
    entered_state_at: string;
    created_at: string;
    updated_at: string;
}

interface BoardColumn {
    state: string;
    wip_limit: number;
    tasks: KanbanTask[];
    task_count: number;
    wip_exceeded: boolean;
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
/*  Icon map                                                           */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, typeof Inbox> = {
    Inbox, Send, Download, CheckCircle, Search, Sparkles,
    UserCheck, FileCheck, BookCheck, AlertOctagon,
};

/* ------------------------------------------------------------------ */
/*  Color map (fallback since --g-status-* may not exist in tokens)    */
/* ------------------------------------------------------------------ */

const STATE_COLOR_MAP: Record<string, string> = {
    neutral: '#8c9196',
    warning: '#e6a817',
    info: '#3b82f6',
    active: '#009a77',
    ai: '#8b5cf6',
    success: '#009a77',
    critical: 'hsl(0, 72%, 51%)',
};

function getStateColor(state: string): string {
    const cfg = KANBAN_STATE_CONFIG[state];
    if (!cfg) return STATE_COLOR_MAP.neutral;
    // Extract the semantic name: var(--g-status-warning) -> warning, var(--g-severity-critical) -> critical
    const match = cfg.color.match(/--g-(?:status|severity)-(\w+)/);
    if (match) return STATE_COLOR_MAP[match[1]] || STATE_COLOR_MAP.neutral;
    return STATE_COLOR_MAP.neutral;
}

/* ------------------------------------------------------------------ */
/*  Priority config                                                    */
/* ------------------------------------------------------------------ */

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: 'Critica', color: 'hsl(0, 72%, 51%)', bg: 'hsl(0, 72%, 96%)' },
    high: { label: 'Alta', color: 'hsl(25, 95%, 53%)', bg: 'hsl(25, 95%, 96%)' },
    medium: { label: 'Media', color: 'hsl(38, 92%, 50%)', bg: 'hsl(38, 92%, 96%)' },
    low: { label: 'Baja', color: 'hsl(160, 100%, 30%)', bg: 'hsl(160, 100%, 96%)' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysInState(enteredStateAt: string): number {
    return Math.floor((Date.now() - new Date(enteredStateAt).getTime()) / (1000 * 60 * 60 * 24));
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function KanbanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params);

    const [board, setBoard] = useState<BoardColumn[]>([]);
    const [metrics, setMetrics] = useState<KanbanMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNewTask, setShowNewTask] = useState(false);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // New task form state
    const [newTitle, setNewTitle] = useState('');
    const [newArea, setNewArea] = useState('MERC');
    const [newPriority, setNewPriority] = useState('medium');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [creating, setCreating] = useState(false);

    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    /* ---------- Fetch ---------- */

    const fetchBoard = useCallback(async () => {
        try {
            const res = await fetch(`/api/kanban/board?project_id=${projectId}`, {
                headers: authHeaders(),
            });
            const data = await res.json();
            if (data.success && data.board) {
                setBoard(data.board);
            }
        } catch {
            // silent
        }
    }, [projectId]);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch(`/api/kanban/metrics?project_id=${projectId}`, {
                headers: authHeaders(),
            });
            const data = await res.json();
            if (data.success && data.metrics) {
                setMetrics(data.metrics);
            }
        } catch {
            // silent
        }
    }, [projectId]);

    const fetchAll = useCallback(async () => {
        await Promise.all([fetchBoard(), fetchMetrics()]);
        setLoading(false);
    }, [fetchBoard, fetchMetrics]);

    useEffect(() => {
        fetchAll();
        // Auto-refresh every 30 seconds
        refreshTimerRef.current = setInterval(fetchAll, 30000);
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [fetchAll]);

    /* ---------- Create task ---------- */

    const handleCreateTask = async () => {
        if (!newTitle.trim() || !newArea.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/kanban/tasks', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    project_id: projectId,
                    area_code: newArea,
                    title: newTitle.trim(),
                    description: newDescription.trim() || null,
                    priority: newPriority,
                    assigned_to: newAssignee.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Tarea creada correctamente');
                setNewTitle('');
                setNewDescription('');
                setNewAssignee('');
                setShowNewTask(false);
                fetchAll();
            } else {
                toast.error(data.error || 'Error al crear tarea');
            }
        } catch {
            toast.error('Error de conexion');
        } finally {
            setCreating(false);
        }
    };

    /* ---------- Drag & Drop ---------- */

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedTaskId(taskId);
    };

    const handleDragOver = (e: React.DragEvent, state: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(state);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, targetState: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;
        setDraggedTaskId(null);

        // Find current state of the task
        let currentState = '';
        for (const col of board) {
            if (col.tasks.find(t => t.id === taskId)) {
                currentState = col.state;
                break;
            }
        }
        if (currentState === targetState) return;

        // Optimistic update
        setBoard(prev => {
            const next = prev.map(col => {
                if (col.state === currentState) {
                    return {
                        ...col,
                        tasks: col.tasks.filter(t => t.id !== taskId),
                        task_count: col.task_count - 1,
                    };
                }
                if (col.state === targetState) {
                    const task = prev.find(c => c.state === currentState)?.tasks.find(t => t.id === taskId);
                    if (task) {
                        return {
                            ...col,
                            tasks: [...col.tasks, { ...task, state: targetState }],
                            task_count: col.task_count + 1,
                        };
                    }
                }
                return col;
            });
            return next;
        });

        try {
            const res = await fetch(`/api/kanban/tasks/${taskId}/move`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ target_state: targetState }),
            });

            if (res.status === 409) {
                const data = await res.json();
                toast.error(data.error || `Limite WIP alcanzado en ${KANBAN_STATE_CONFIG[targetState]?.label || targetState}`);
                fetchAll(); // Revert optimistic update
                return;
            }

            if (res.status === 422) {
                const data = await res.json();
                const criteriaLabels: Record<string, string> = {
                    has_description: 'Descripcion requerida',
                    has_evidence: 'Evidencia adjunta requerida',
                    has_assignment: 'Asignacion requerida',
                    has_due_date: 'Fecha limite requerida',
                    has_reviewer: 'Revisor asignado requerido',
                    ai_completed: 'Analisis IA debe completarse',
                    hitl_decided: 'Decision HITL pendiente',
                };
                const unmet = (data.unmet_criteria || []).map((c: string) => criteriaLabels[c] || c);
                toast.error(`Criterios no cumplidos:\n${unmet.join('\n')}`, { duration: 5000 });
                fetchAll(); // Revert optimistic update
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || 'Error al mover tarea');
                fetchAll();
                return;
            }

            toast.success(`Tarea movida a ${KANBAN_STATE_CONFIG[targetState]?.label || targetState}`);
            fetchMetrics();
        } catch {
            toast.error('Error de conexion');
            fetchAll();
        }
    };

    const handleDragEnd = () => {
        setDraggedTaskId(null);
        setDragOverColumn(null);
    };

    /* ---------- Loading state ---------- */

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-16 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div style={{ display: 'flex', gap: 'var(--g-space-4)', overflowX: 'auto' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ minWidth: '260px', height: '400px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    /* ---------- Render ---------- */

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
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
                        Tablero Kanban
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
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
                    <button
                        onClick={() => window.open(`/api/kanban/export?project_id=${projectId}`, '_blank')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            color: 'var(--g-text-secondary)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <Download className="h-3.5 w-3.5" /> Exportar CSV
                    </button>
                    <button
                        onClick={() => setShowNewTask(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                            cursor: 'pointer',
                            border: 'none',
                        }}
                    >
                        <Plus className="h-3.5 w-3.5" /> Nueva tarea
                    </button>
                </div>
            </div>

            {/* Metrics bar */}
            {metrics && (
                <div
                    className="g-card"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-6)',
                        padding: 'var(--g-space-3) var(--g-space-5)',
                        borderRadius: 'var(--g-radius-lg)',
                    }}
                >
                    <MetricPill
                        label="Total tareas"
                        value={metrics.total_tasks}
                        color="var(--g-text-primary)"
                    />
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <MetricPill
                        label="Estancadas (>3d)"
                        value={metrics.stale_tasks}
                        color={metrics.stale_tasks > 0 ? 'var(--status-warning)' : 'var(--g-text-secondary)'}
                        icon={<Clock className="h-3.5 w-3.5" />}
                    />
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <MetricPill
                        label="HITL pendiente"
                        value={metrics.hitl_pending}
                        color={metrics.hitl_pending > 0 ? '#8b5cf6' : 'var(--g-text-secondary)'}
                        icon={<UserCheck className="h-3.5 w-3.5" />}
                    />
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <MetricPill
                        label="IA activa"
                        value={metrics.ai_running}
                        color={metrics.ai_running > 0 ? '#8b5cf6' : 'var(--g-text-secondary)'}
                        icon={<Bot className="h-3.5 w-3.5" />}
                    />
                </div>
            )}

            {/* Board */}
            <div
                style={{
                    display: 'flex',
                    gap: 'var(--g-space-3)',
                    overflowX: 'auto',
                    paddingBottom: 'var(--g-space-4)',
                    minHeight: '500px',
                }}
            >
                {board.map(col => {
                    const cfg = KANBAN_STATE_CONFIG[col.state];
                    const label = cfg?.label || col.state;
                    const stateColor = getStateColor(col.state);
                    const IconComponent = cfg ? ICON_MAP[cfg.icon] : Inbox;
                    const isDragOver = dragOverColumn === col.state;

                    return (
                        <div
                            key={col.state}
                            onDragOver={(e) => handleDragOver(e, col.state)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.state)}
                            style={{
                                minWidth: '260px',
                                maxWidth: '300px',
                                flex: '0 0 260px',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: isDragOver ? 'var(--g-surface-subtle)' : 'var(--g-surface-muted)',
                                border: isDragOver ? `2px dashed ${stateColor}` : '2px solid transparent',
                                transition: 'background-color var(--g-transition-fast), border-color var(--g-transition-fast)',
                            }}
                        >
                            {/* Column header */}
                            <div
                                style={{
                                    padding: 'var(--g-space-3) var(--g-space-3)',
                                    borderBottom: `2px solid ${stateColor}`,
                                    borderRadius: 'var(--g-radius-lg) var(--g-radius-lg) 0 0',
                                    ...(col.wip_exceeded ? { borderColor: 'hsl(0, 72%, 51%)', backgroundColor: 'hsl(0, 72%, 97%)' } : {}),
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                        {IconComponent && (
                                            <IconComponent
                                                className="h-4 w-4"
                                                style={{ color: stateColor }}
                                            />
                                        )}
                                        <span
                                            style={{
                                                fontSize: 'var(--g-text-small)',
                                                fontWeight: 600,
                                                color: 'var(--g-text-primary)',
                                            }}
                                        >
                                            {label}
                                        </span>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 'var(--g-text-caption)',
                                            fontWeight: 600,
                                            color: col.wip_exceeded ? 'hsl(0, 72%, 51%)' : 'var(--g-text-secondary)',
                                            backgroundColor: col.wip_exceeded ? 'hsl(0, 72%, 92%)' : 'var(--g-surface-card)',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--g-radius-full)',
                                        }}
                                    >
                                        {col.task_count}{col.wip_limit > 0 ? ` / ${col.wip_limit}` : ''}
                                    </span>
                                </div>
                                {col.wip_exceeded && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            marginTop: '4px',
                                            fontSize: 'var(--g-text-caption)',
                                            color: 'hsl(0, 72%, 51%)',
                                            fontWeight: 500,
                                        }}
                                    >
                                        <AlertTriangle className="h-3 w-3" />
                                        WIP excedido
                                    </div>
                                )}
                            </div>

                            {/* Tasks */}
                            <div
                                style={{
                                    flex: 1,
                                    padding: 'var(--g-space-2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--g-space-2)',
                                    overflowY: 'auto',
                                    minHeight: '80px',
                                }}
                            >
                                {col.tasks.length === 0 && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flex: 1,
                                            color: 'var(--g-text-muted)',
                                            fontSize: 'var(--g-text-caption)',
                                            fontStyle: 'italic',
                                        }}
                                    >
                                        Sin tareas
                                    </div>
                                )}
                                {col.tasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        isDragging={draggedTaskId === task.id}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* New Task Modal */}
            {showNewTask && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                    }}
                    onClick={() => setShowNewTask(false)}
                >
                    <div
                        className="g-card animate-scale-in"
                        style={{
                            padding: 'var(--g-space-6)',
                            width: '100%',
                            maxWidth: '480px',
                            borderRadius: 'var(--g-radius-xl)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--g-space-5)' }}>
                            <h3
                                className="font-bold"
                                style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                            >
                                Nueva Tarea
                            </h3>
                            <button
                                onClick={() => setShowNewTask(false)}
                                style={{ color: 'var(--g-text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                            {/* Title */}
                            <div>
                                <label
                                    className="block text-xs font-medium mb-1"
                                    style={{ color: 'var(--g-text-primary)' }}
                                >
                                    Titulo *
                                </label>
                                <input
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Titulo de la tarea"
                                    className="w-full"
                                    style={{
                                        height: '36px',
                                        padding: '0 var(--g-space-3)',
                                        fontSize: 'var(--g-text-body)',
                                        border: '1px solid var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                                />
                            </div>
                            {/* Area + Priority row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-3)' }}>
                                <div>
                                    <label
                                        className="block text-xs font-medium mb-1"
                                        style={{ color: 'var(--g-text-primary)' }}
                                    >
                                        Area *
                                    </label>
                                    <select
                                        value={newArea}
                                        onChange={e => setNewArea(e.target.value)}
                                        className="w-full"
                                        style={{
                                            height: '36px',
                                            padding: '0 var(--g-space-3)',
                                            fontSize: 'var(--g-text-body)',
                                            border: '1px solid var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                        }}
                                    >
                                        {Object.keys(AREA_COLORS).map(code => (
                                            <option key={code} value={code}>{code}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label
                                        className="block text-xs font-medium mb-1"
                                        style={{ color: 'var(--g-text-primary)' }}
                                    >
                                        Prioridad
                                    </label>
                                    <select
                                        value={newPriority}
                                        onChange={e => setNewPriority(e.target.value)}
                                        className="w-full"
                                        style={{
                                            height: '36px',
                                            padding: '0 var(--g-space-3)',
                                            fontSize: 'var(--g-text-body)',
                                            border: '1px solid var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                        }}
                                    >
                                        {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {/* Description */}
                            <div>
                                <label
                                    className="block text-xs font-medium mb-1"
                                    style={{ color: 'var(--g-text-primary)' }}
                                >
                                    Descripcion
                                </label>
                                <textarea
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    placeholder="Descripcion opcional"
                                    rows={3}
                                    className="w-full"
                                    style={{
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        fontSize: 'var(--g-text-body)',
                                        border: '1px solid var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-card)',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                            {/* Assignee */}
                            <div>
                                <label
                                    className="block text-xs font-medium mb-1"
                                    style={{ color: 'var(--g-text-primary)' }}
                                >
                                    Asignado a
                                </label>
                                <input
                                    value={newAssignee}
                                    onChange={e => setNewAssignee(e.target.value)}
                                    placeholder="Nombre o email"
                                    className="w-full"
                                    style={{
                                        height: '36px',
                                        padding: '0 var(--g-space-3)',
                                        fontSize: 'var(--g-text-body)',
                                        border: '1px solid var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                />
                            </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-2)', marginTop: 'var(--g-space-5)' }}>
                            <button
                                onClick={() => setShowNewTask(false)}
                                className="px-4 py-2 text-sm border"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    borderColor: 'var(--g-border-default)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTask}
                                disabled={!newTitle.trim() || creating}
                                className="px-4 py-2 text-sm font-medium"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-brand-3308)',
                                    color: 'var(--g-text-inverse)',
                                    border: 'none',
                                    cursor: !newTitle.trim() || creating ? 'not-allowed' : 'pointer',
                                    opacity: !newTitle.trim() || creating ? 0.5 : 1,
                                }}
                            >
                                {creating ? 'Creando...' : 'Crear tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  MetricPill                                                         */
/* ------------------------------------------------------------------ */

function MetricPill({
    label,
    value,
    color,
    icon,
}: {
    label: string;
    value: number;
    color: string;
    icon?: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
            {icon && <span style={{ color, display: 'flex' }}>{icon}</span>}
            <div>
                <p style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color, lineHeight: 1 }}>
                    {value}
                </p>
                <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', whiteSpace: 'nowrap' }}>
                    {label}
                </p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  TaskCard                                                           */
/* ------------------------------------------------------------------ */

function TaskCard({
    task,
    isDragging,
    onDragStart,
    onDragEnd,
}: {
    task: KanbanTask;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onDragEnd: () => void;
}) {
    const days = daysInState(task.entered_state_at);
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const areaHsl = AREA_COLORS[task.area_code] || AREA_COLORS.GENERAL;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            style={{
                backgroundColor: 'var(--g-surface-card)',
                border: '1px solid var(--g-border-subtle)',
                borderRadius: 'var(--g-radius-md)',
                padding: 'var(--g-space-3)',
                cursor: 'grab',
                opacity: isDragging ? 0.4 : 1,
                transition: 'box-shadow var(--g-transition-fast), opacity var(--g-transition-fast)',
                boxShadow: isDragging ? 'var(--g-shadow-card-hover)' : 'var(--g-shadow-sm)',
            }}
            onMouseEnter={(e) => {
                if (!isDragging) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--g-shadow-card-hover)';
            }}
            onMouseLeave={(e) => {
                if (!isDragging) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--g-shadow-sm)';
            }}
        >
            {/* Top row: priority dot + title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)' }}>
                <GripVertical
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--g-text-muted)', marginTop: '2px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                        style={{
                            fontSize: 'var(--g-text-small)',
                            fontWeight: 500,
                            color: 'var(--g-text-primary)',
                            lineHeight: 'var(--g-leading-tight)',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}
                    >
                        {task.title}
                    </p>
                </div>
            </div>

            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'var(--g-space-2)', flexWrap: 'wrap' }}>
                {/* Area badge */}
                <span
                    style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: `hsla(${areaHsl}, 0.12)`,
                        color: `hsl(${areaHsl})`,
                        letterSpacing: '0.02em',
                    }}
                >
                    {task.area_code}
                </span>
                {/* Priority badge */}
                <span
                    style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: priority.bg,
                        color: priority.color,
                    }}
                >
                    {priority.label}
                </span>
                {/* HITL badge */}
                {task.hitl_required && (
                    <span
                        style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'hsl(270, 60%, 95%)',
                            color: '#8b5cf6',
                        }}
                    >
                        HITL
                    </span>
                )}
                {/* AI status badge */}
                {task.ai_status === 'running' && (
                    <span
                        style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'hsl(270, 60%, 95%)',
                            color: '#8b5cf6',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                        }}
                    >
                        <Sparkles className="h-2.5 w-2.5" /> IA
                    </span>
                )}
            </div>

            {/* Bottom row: assignee + aging */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--g-space-2)' }}>
                <span
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        color: 'var(--g-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px',
                    }}
                >
                    {task.assigned_to || 'Sin asignar'}
                </span>
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: 'var(--g-text-caption)',
                        color: days > 7
                            ? 'hsl(0, 72%, 51%)'
                            : days > 3
                                ? 'var(--status-warning)'
                                : 'var(--g-text-muted)',
                        fontWeight: days > 3 ? 600 : 400,
                    }}
                    title={days > 7 ? `Critica: ${days} dias en este estado` : days > 5 ? 'Estancada' : undefined}
                >
                    {days > 7 && (
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: 'hsl(0, 72%, 51%)',
                                display: 'inline-block',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                        />
                    )}
                    {days > 5 && days <= 7 && (
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--status-warning)',
                                display: 'inline-block',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                        />
                    )}
                    {days > 3 && days <= 5 && (
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--status-warning)',
                                display: 'inline-block',
                            }}
                        />
                    )}
                    {days > 7
                        ? `Critica: ${days}d`
                        : days > 5
                            ? `Estancada ${days}d`
                            : `${days}d`}
                </span>
            </div>
        </div>
    );
}
