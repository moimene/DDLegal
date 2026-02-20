'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, CheckCircle2, RotateCcw, CircleX, Loader2, Bot,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDProcess, DDTask } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

type HitlDecision = 'approve' | 'correct' | 'reject';

const PRIORITY_WEIGHT: Record<DDTask['priority'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

function extractAiSummary(output: Record<string, unknown> | null): string {
    if (!output) return 'Sin salida IA disponible.';
    const maybeOutput = output.output;
    if (maybeOutput && typeof maybeOutput === 'object') {
        const summary = (maybeOutput as Record<string, unknown>).summary;
        if (typeof summary === 'string' && summary.trim().length > 0) {
            return summary;
        }
    }
    const message = output.message;
    if (typeof message === 'string' && message.trim().length > 0) {
        return message;
    }
    try {
        return JSON.stringify(output).slice(0, 260);
    } catch {
        return 'No se pudo interpretar la salida IA.';
    }
}

export default function ProjectHitlPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<DDProject | null>(null);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [processes, setProcesses] = useState<DDProcess[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const [pRes, aRes, prRes, tRes] = await Promise.all([
                supabase.from('dd_projects').select('*').eq('id', id).single(),
                supabase.from('dd_areas').select('*').order('sort_order'),
                supabase.from('dd_processes').select('*').order('sort_order'),
                supabase.from('dd_tasks').select('*').eq('project_id', id).order('updated_at', { ascending: false }),
            ]);
            setProject(pRes.data);
            setAreas(aRes.data || []);
            setProcesses(prRes.data || []);
            setTasks(tRes.data || []);
            setLoading(false);
        }
        load();
    }, [id]);

    const processById = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes]);
    const areaById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);

    const queue = useMemo(() => {
        return tasks
            .filter(t => t.status === 'review' || (t.ai_status === 'completed' && t.status !== 'completed'))
            .sort((a, b) => {
                const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            });
    }, [tasks]);

    const registerDecision = async (task: DDTask, decision: HitlDecision) => {
        setRunningTaskId(task.id);
        const note = notes[task.id]?.trim();

        const resp = await fetch('/api/hitl/decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: task.id,
                decision,
                note,
                decided_by: 'manual_reviewer',
            }),
        });

        if (resp.ok) {
            const result = await resp.json();
            if (result.task) {
                setTasks(prev => prev.map(t => (t.id === task.id ? result.task : t)));
                setNotes(prev => ({ ...prev, [task.id]: '' }));
            }
        }
        setRunningTaskId(null);
    };

    if (loading) {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="skeleton h-8 w-72" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-40 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div className="skeleton h-40 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    if (!project) {
        return <div>Proyecto no encontrado</div>;
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Volver al proyecto
                    </Link>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Revisión HITL
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {project.name} · {queue.length} tarea{queue.length !== 1 ? 's' : ''} en cola de revisión humana
                    </p>
                </div>
                <div
                    className="px-4 py-2"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-surface-subtle)',
                        color: 'var(--g-brand-3308)',
                    }}
                >
                    <p className="text-xs font-medium uppercase">Cola activa</p>
                    <p className="text-xl font-bold">{queue.length}</p>
                </div>
            </div>

            {queue.length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center py-16 border border-dashed"
                    style={{
                        borderColor: 'var(--g-border-subtle)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                    }}
                >
                    <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: 'var(--status-success)' }} />
                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        No hay tareas pendientes de revisión HITL
                    </p>
                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                        Cuando Harvey genere propuestas en revisión, aparecerán aquí.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {queue.map((task) => {
                        const process = processById.get(task.process_id);
                        const area = task.area_id ? areaById.get(task.area_id) : undefined;
                        const running = runningTaskId === task.id;
                        return (
                            <div
                                key={task.id}
                                className="p-5 border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-lg)',
                                    backgroundColor: 'var(--g-surface-card)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Bot className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {process ? `P${process.number}. ${process.name}` : 'Proceso no encontrado'}
                                            </p>
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium capitalize"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--g-surface-muted)',
                                                    color: 'var(--g-text-primary)',
                                                }}
                                            >
                                                {task.priority}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            <span>{area?.name || 'Sin área'}</span>
                                            <span>•</span>
                                            <span>Actualizado: {formatDate(task.updated_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="mt-4 p-3"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                    }}
                                >
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-brand-3308)' }}>
                                        Resumen IA
                                    </p>
                                    <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                        {extractAiSummary(task.ai_output)}
                                    </p>
                                </div>

                                <div className="mt-4">
                                    <label
                                        className="block text-xs font-medium mb-1.5"
                                        style={{ color: 'var(--g-text-primary)' }}
                                    >
                                        Comentario de revisión (opcional)
                                    </label>
                                    <textarea
                                        value={notes[task.id] || ''}
                                        onChange={(e) => setNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border resize-none"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                        }}
                                        placeholder="Motivo o instrucciones para el siguiente paso..."
                                    />
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => registerDecision(task, 'approve')}
                                        disabled={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-success)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                        Aprobar
                                    </button>

                                    <button
                                        onClick={() => registerDecision(task, 'correct')}
                                        disabled={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-warning)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                        Corregir
                                    </button>

                                    <button
                                        onClick={() => registerDecision(task, 'reject')}
                                        disabled={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-error)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleX className="h-3.5 w-3.5" />}
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
