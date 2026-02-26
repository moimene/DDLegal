'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, CheckCircle2, RotateCcw, CircleX, Loader2, Bot,
    FileSearch, X, SlidersHorizontal, Filter, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDProcess, DDTask, DDEvidence } from '@/lib/supabase';
import { formatDate, useResolvedParams } from '@/lib/utils';

type HitlDecision = 'approve' | 'correct' | 'reject';
type QuickDecision = 'approved' | 'rejected' | 'needs_evidence';
type SortField = 'severity' | 'deadline' | 'confidence';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_evidence';

const SEVERITY_WEIGHT: Record<DDTask['priority'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

const CONFIDENCE_THRESHOLDS = [
    { label: 'Todos', value: 0 },
    { label: '> 50%', value: 50 },
    { label: '> 70%', value: 70 },
    { label: '> 90%', value: 90 },
];

function extractConfidence(output: Record<string, unknown> | null): number {
    if (!output) return 0;
    const maybeOutput = output.output as Record<string, unknown> | undefined;
    const score = maybeOutput?.confidence_score ?? maybeOutput?.confidence ?? output.confidence_score ?? output.confidence ?? output.grounding_score ?? 0;
    return typeof score === 'number' ? score : 0;
}

function extractGroundingScore(output: Record<string, unknown> | null): number {
    if (!output) return 0;
    const maybeOutput = output.output as Record<string, unknown> | undefined;
    const score = maybeOutput?.grounding_score ?? output.grounding_score ?? 0;
    return typeof score === 'number' ? score : 0;
}

function extractEvidenceSources(output: Record<string, unknown> | null): string[] {
    if (!output) return [];
    const maybeOutput = output.output as Record<string, unknown> | undefined;
    const sources = maybeOutput?.evidence_sources ?? maybeOutput?.sources ?? output.evidence_sources ?? output.sources;
    if (Array.isArray(sources)) return sources.map(s => typeof s === 'string' ? s : JSON.stringify(s));
    return [];
}

function extractSnippets(output: Record<string, unknown> | null): string[] {
    if (!output) return [];
    const maybeOutput = output.output as Record<string, unknown> | undefined;
    const snippets = maybeOutput?.snippets ?? maybeOutput?.document_snippets ?? output.snippets ?? output.document_snippets;
    if (Array.isArray(snippets)) return snippets.map(s => typeof s === 'string' ? s : JSON.stringify(s));
    return [];
}

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
    const { id } = useResolvedParams(params);
    const [project, setProject] = useState<DDProject | null>(null);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [processes, setProcesses] = useState<DDProcess[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

    // Sort & filter state
    const [sortField, setSortField] = useState<SortField>('severity');
    const [filterAreaCode, setFilterAreaCode] = useState<string>('all');
    const [filterConfidence, setFilterConfidence] = useState<number>(0);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    // Evidence drawer
    const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
    const [drawerEvidence, setDrawerEvidence] = useState<DDEvidence[]>([]);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Quick-decision running state (separate from legacy running)
    const [quickRunningId, setQuickRunningId] = useState<string | null>(null);

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

    // Unique area codes for filter dropdown
    const areaOptions = useMemo(() => {
        const codes = new Set<string>();
        tasks.forEach(t => {
            if (t.area_id) {
                const a = areaById.get(t.area_id);
                if (a) codes.add(a.code);
            }
        });
        return Array.from(codes).sort();
    }, [tasks, areaById]);

    // Quick decision handler — calls PATCH to /api/hitl/decision
    const quickDecisionCb = useCallback(async (task: DDTask, decision: QuickDecision) => {
        setQuickRunningId(task.id);
        try {
            const resp = await fetch('/api/hitl/decision', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    decision,
                    decided_by: 'manual_reviewer',
                }),
            });
            if (resp.ok) {
                const result = await resp.json();
                if (result.task) {
                    setTasks(prev => prev.map(t => (t.id === task.id ? result.task : t)));
                }
                const labels: Record<QuickDecision, string> = {
                    approved: 'Aprobado',
                    rejected: 'Rechazado',
                    needs_evidence: 'Evidencia solicitada',
                };
                toast.success(labels[decision]);
            } else {
                const err = await resp.json().catch(() => ({ error: 'Error desconocido' }));
                toast.error(err.error || 'Error al registrar decisión');
            }
        } catch {
            toast.error('Error de red al enviar decisión');
        }
        setQuickRunningId(null);
    }, []);

    // Open evidence drawer
    const openEvidenceDrawer = useCallback(async (task: DDTask) => {
        setDrawerTaskId(task.id);
        setDrawerLoading(true);
        setDrawerEvidence([]);
        try {
            const resp = await fetch(`/api/evidence?task_id=${task.id}`);
            if (resp.ok) {
                const result = await resp.json();
                setDrawerEvidence(result.evidence || []);
            }
        } catch {
            // silent — we still show ai_output data
        }
        setDrawerLoading(false);
    }, []);

    const queue = useMemo(() => {
        let filtered = tasks
            .filter(t => t.status === 'review' || (t.ai_status === 'completed' && t.status !== 'completed'));

        // Apply area filter
        if (filterAreaCode !== 'all') {
            filtered = filtered.filter(t => {
                if (!t.area_id) return false;
                const a = areaById.get(t.area_id);
                return a?.code === filterAreaCode;
            });
        }

        // Apply confidence filter
        if (filterConfidence > 0) {
            filtered = filtered.filter(t => extractConfidence(t.ai_output) > filterConfidence);
        }

        // Apply status filter
        if (filterStatus !== 'all') {
            const statusMap: Record<FilterStatus, string[]> = {
                all: [],
                pending: ['review', 'in_progress'],
                approved: ['completed'],
                rejected: ['blocked'],
                needs_evidence: ['review'],
            };
            const allowed = statusMap[filterStatus];
            if (allowed.length > 0) {
                filtered = filtered.filter(t => allowed.includes(t.status));
            }
        }

        // Sort
        return filtered.sort((a, b) => {
            switch (sortField) {
                case 'severity': {
                    const diff = SEVERITY_WEIGHT[b.priority] - SEVERITY_WEIGHT[a.priority];
                    if (diff !== 0) return diff;
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                }
                case 'deadline': {
                    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
                    return aDate - bDate; // nearest first
                }
                case 'confidence': {
                    return extractConfidence(a.ai_output) - extractConfidence(b.ai_output); // lowest first
                }
                default:
                    return 0;
            }
        });
    }, [tasks, sortField, filterAreaCode, filterConfidence, filterStatus, areaById]);

    const [selectedIdx, setSelectedIdx] = useState(0);

    const registerDecisionCb = useCallback(async (task: DDTask, decision: HitlDecision) => {
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
    }, [notes]);

    // Keyboard shortcuts: A=approve, C=correct, R=reject, E=scroll to evidence
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (queue.length === 0 || runningTaskId) return;

            const current = queue[selectedIdx];
            if (!current) return;

            switch (e.key.toLowerCase()) {
                case 'a':
                    e.preventDefault();
                    registerDecisionCb(current, 'approve');
                    break;
                case 'c':
                    e.preventDefault();
                    registerDecisionCb(current, 'correct');
                    break;
                case 'r':
                    e.preventDefault();
                    registerDecisionCb(current, 'reject');
                    break;
                case 'e': {
                    e.preventDefault();
                    const el = document.getElementById(`hitl-evidence-${current.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
                case 'arrowdown':
                    e.preventDefault();
                    setSelectedIdx(i => Math.min(i + 1, queue.length - 1));
                    break;
                case 'arrowup':
                    e.preventDefault();
                    setSelectedIdx(i => Math.max(i - 1, 0));
                    break;
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [queue, selectedIdx, runningTaskId, registerDecisionCb]);

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
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
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Volver al proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
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

            {/* ── Sort Controls ── */}
            <div
                className="g-card"
                style={{
                    padding: 'var(--g-space-3) var(--g-space-4)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--g-space-3)',
                    borderRadius: 'var(--g-radius-lg)',
                    backgroundColor: 'var(--g-surface-card)',
                    border: '1px solid var(--g-border-subtle)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                    <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Ordenar:</span>
                </div>
                {([
                    { field: 'severity' as SortField, label: 'Severidad' },
                    { field: 'deadline' as SortField, label: 'Fecha límite' },
                    { field: 'confidence' as SortField, label: 'Confianza' },
                ]).map(opt => (
                    <button
                        key={opt.field}
                        onClick={() => setSortField(opt.field)}
                        className="text-xs font-medium"
                        style={{
                            padding: 'var(--g-space-1) var(--g-space-3)',
                            borderRadius: 'var(--g-radius-full)',
                            border: '1px solid',
                            borderColor: sortField === opt.field ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                            backgroundColor: sortField === opt.field ? 'var(--g-brand-3308)' : 'transparent',
                            color: sortField === opt.field ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}

                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--g-border-subtle)', margin: '0 var(--g-space-1)' }} />

                {/* ── Filters ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                    <Filter className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Filtrar:</span>
                </div>

                {/* Area filter */}
                <div style={{ position: 'relative' }}>
                    <select
                        value={filterAreaCode}
                        onChange={e => setFilterAreaCode(e.target.value)}
                        className="text-xs"
                        style={{
                            padding: 'var(--g-space-1) var(--g-space-3)',
                            paddingRight: 'var(--g-space-6)',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                            cursor: 'pointer',
                            appearance: 'none',
                        }}
                    >
                        <option value="all">Todas las áreas</option>
                        {areaOptions.map(code => (
                            <option key={code} value={code}>{code}</option>
                        ))}
                    </select>
                    <ChevronDown
                        className="h-3 w-3"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: 'var(--g-text-secondary)',
                        }}
                    />
                </div>

                {/* Confidence filter */}
                <div style={{ position: 'relative' }}>
                    <select
                        value={filterConfidence}
                        onChange={e => setFilterConfidence(Number(e.target.value))}
                        className="text-xs"
                        style={{
                            padding: 'var(--g-space-1) var(--g-space-3)',
                            paddingRight: 'var(--g-space-6)',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                            cursor: 'pointer',
                            appearance: 'none',
                        }}
                    >
                        {CONFIDENCE_THRESHOLDS.map(t => (
                            <option key={t.value} value={t.value}>Confianza: {t.label}</option>
                        ))}
                    </select>
                    <ChevronDown
                        className="h-3 w-3"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: 'var(--g-text-secondary)',
                        }}
                    />
                </div>

                {/* Status filter */}
                <div style={{ position: 'relative' }}>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                        className="text-xs"
                        style={{
                            padding: 'var(--g-space-1) var(--g-space-3)',
                            paddingRight: 'var(--g-space-6)',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                            cursor: 'pointer',
                            appearance: 'none',
                        }}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                        <option value="needs_evidence">Necesita evidencia</option>
                    </select>
                    <ChevronDown
                        className="h-3 w-3"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: 'var(--g-text-secondary)',
                        }}
                    />
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
                                className="p-5 border transition-all"
                                style={{
                                    borderColor: queue[selectedIdx]?.id === task.id ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-lg)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    boxShadow: queue[selectedIdx]?.id === task.id ? 'var(--g-shadow-card-hover)' : 'var(--g-shadow-card)',
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
                                    id={`hitl-evidence-${task.id}`}
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
                                        htmlFor={`hitl-note-${task.id}`}
                                        className="block text-xs font-medium mb-1.5"
                                        style={{ color: 'var(--g-text-primary)' }}
                                    >
                                        Comentario de revisión (opcional)
                                    </label>
                                    <textarea
                                        id={`hitl-note-${task.id}`}
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
                                        onClick={() => registerDecisionCb(task, 'approve')}
                                        disabled={running}
                                        aria-busy={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-success)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                        title="Aprobar (A)"
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                        Aprobar
                                    </button>

                                    <button
                                        onClick={() => registerDecisionCb(task, 'correct')}
                                        disabled={running}
                                        aria-busy={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-warning)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                        title="Corregir (C)"
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                                        Corregir
                                    </button>

                                    <button
                                        onClick={() => registerDecisionCb(task, 'reject')}
                                        disabled={running}
                                        aria-busy={running}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--status-error)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                        title="Rechazar (R)"
                                    >
                                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CircleX className="h-3.5 w-3.5" aria-hidden="true" />}
                                        Rechazar
                                    </button>

                                    <span className="text-xs ml-2" style={{ color: 'var(--g-text-secondary)' }}>
                                        Atajos: A aprobar · C corregir · R rechazar · E evidencia
                                    </span>
                                </div>

                                {/* ── Quick Action Buttons (PATCH) ── */}
                                <div
                                    style={{
                                        marginTop: 'var(--g-space-3)',
                                        paddingTop: 'var(--g-space-3)',
                                        borderTop: '1px solid var(--g-border-subtle)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        gap: 'var(--g-space-2)',
                                    }}
                                >
                                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)', marginRight: 'var(--g-space-1)' }}>
                                        Acción rápida:
                                    </span>
                                    <button
                                        onClick={() => quickDecisionCb(task, 'approved')}
                                        disabled={quickRunningId === task.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            padding: 'var(--g-space-1) var(--g-space-3)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1.5px solid var(--status-success)',
                                            backgroundColor: 'transparent',
                                            color: 'var(--status-success)',
                                            cursor: 'pointer',
                                            transition: 'all 150ms ease',
                                        }}
                                        title="Aprobar (PATCH)"
                                    >
                                        {quickRunningId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => quickDecisionCb(task, 'rejected')}
                                        disabled={quickRunningId === task.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            padding: 'var(--g-space-1) var(--g-space-3)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1.5px solid var(--status-error)',
                                            backgroundColor: 'transparent',
                                            color: 'var(--status-error)',
                                            cursor: 'pointer',
                                            transition: 'all 150ms ease',
                                        }}
                                        title="Rechazar (PATCH)"
                                    >
                                        {quickRunningId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleX className="h-3.5 w-3.5" />}
                                        Rechazar
                                    </button>
                                    <button
                                        onClick={() => quickDecisionCb(task, 'needs_evidence')}
                                        disabled={quickRunningId === task.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{
                                            padding: 'var(--g-space-1) var(--g-space-3)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1.5px solid var(--status-warning)',
                                            backgroundColor: 'transparent',
                                            color: 'var(--status-warning)',
                                            cursor: 'pointer',
                                            transition: 'all 150ms ease',
                                        }}
                                        title="Solicitar evidencia (PATCH)"
                                    >
                                        {quickRunningId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                                        Solicitar evidencia
                                    </button>

                                    <div style={{ flex: 1 }} />

                                    <button
                                        onClick={() => openEvidenceDrawer(task)}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                                        style={{
                                            padding: 'var(--g-space-1) var(--g-space-3)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1px solid var(--g-border-default)',
                                            backgroundColor: 'var(--g-surface-subtle)',
                                            color: 'var(--g-text-primary)',
                                            cursor: 'pointer',
                                            transition: 'all 150ms ease',
                                        }}
                                        title="Ver evidencia del ítem"
                                    >
                                        <FileSearch className="h-3.5 w-3.5" style={{ color: 'var(--g-brand-3308)' }} />
                                        Ver evidencia
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Evidence Drawer (slide-out panel) ── */}
            {drawerTaskId && (() => {
                const drawerTask = tasks.find(t => t.id === drawerTaskId);
                const groundingScore = drawerTask ? extractGroundingScore(drawerTask.ai_output) : 0;
                const evidenceSources = drawerTask ? extractEvidenceSources(drawerTask.ai_output) : [];
                const snippets = drawerTask ? extractSnippets(drawerTask.ai_output) : [];

                return (
                    <>
                        {/* Backdrop */}
                        <div
                            onClick={() => setDrawerTaskId(null)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                backgroundColor: 'var(--g-overlay-light)',
                                zIndex: 998,
                                transition: 'opacity 200ms ease',
                            }}
                        />
                        {/* Panel */}
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: '340px',
                                maxWidth: '90vw',
                                zIndex: 999,
                                backgroundColor: 'var(--g-surface-card)',
                                borderLeft: '1px solid var(--g-border-default)',
                                boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                animation: 'drawerSlideIn 200ms ease',
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--g-space-4)',
                                    borderBottom: '1px solid var(--g-border-subtle)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                    <FileSearch className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>Evidencia</span>
                                </div>
                                <button
                                    onClick={() => setDrawerTaskId(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: '1px solid var(--g-border-default)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--g-text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 150ms ease',
                                    }}
                                    title="Cerrar"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                {drawerLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--g-space-8)' }}>
                                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
                                    </div>
                                ) : (
                                    <>
                                        {/* Grounding Score */}
                                        <div
                                            className="g-card"
                                            style={{
                                                padding: 'var(--g-space-3)',
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                            }}
                                        >
                                            <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)', marginBottom: 'var(--g-space-1)' }}>
                                                Grounding Score
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        height: '8px',
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-surface-muted)',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: `${Math.min(groundingScore, 100)}%`,
                                                            height: '100%',
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: groundingScore >= 70 ? 'var(--status-success)' : groundingScore >= 40 ? 'var(--status-warning)' : 'var(--status-error)',
                                                            transition: 'width 300ms ease',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-bold" style={{ color: 'var(--g-text-primary)', minWidth: '36px', textAlign: 'right' }}>
                                                    {groundingScore}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Evidence Sources from ai_output */}
                                        {evidenceSources.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)', marginBottom: 'var(--g-space-2)' }}>
                                                    Fuentes de evidencia
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                                                    {evidenceSources.map((src, i) => (
                                                        <div
                                                            key={i}
                                                            className="text-xs"
                                                            style={{
                                                                padding: 'var(--g-space-2)',
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: 'var(--g-surface-subtle)',
                                                                color: 'var(--g-text-primary)',
                                                                wordBreak: 'break-word',
                                                            }}
                                                        >
                                                            {src}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Document Snippets from ai_output */}
                                        {snippets.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)', marginBottom: 'var(--g-space-2)' }}>
                                                    Fragmentos de documentos
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                                                    {snippets.map((snip, i) => (
                                                        <div
                                                            key={i}
                                                            className="text-xs"
                                                            style={{
                                                                padding: 'var(--g-space-2) var(--g-space-3)',
                                                                borderRadius: 'var(--g-radius-md)',
                                                                backgroundColor: 'var(--g-surface-subtle)',
                                                                borderLeft: '3px solid var(--g-brand-3308)',
                                                                color: 'var(--g-text-primary)',
                                                                fontStyle: 'italic',
                                                                wordBreak: 'break-word',
                                                            }}
                                                        >
                                                            {snip}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Evidence from API (dd_evidence table) */}
                                        {drawerEvidence.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)', marginBottom: 'var(--g-space-2)' }}>
                                                    Evidencia registrada ({drawerEvidence.length})
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                                                    {drawerEvidence.map(ev => (
                                                        <div
                                                            key={ev.id}
                                                            className="g-card"
                                                            style={{
                                                                padding: 'var(--g-space-2) var(--g-space-3)',
                                                                borderRadius: 'var(--g-radius-md)',
                                                                border: '1px solid var(--g-border-subtle)',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--g-space-1)' }}>
                                                                <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                                    {ev.source_name || ev.source_reference}
                                                                </span>
                                                                {ev.confidence_score !== null && (
                                                                    <span
                                                                        className="text-xs font-medium"
                                                                        style={{
                                                                            padding: '1px 6px',
                                                                            borderRadius: 'var(--g-radius-full)',
                                                                            backgroundColor: ev.confidence_score >= 70 ? 'var(--status-success)' : ev.confidence_score >= 40 ? 'var(--status-warning)' : 'var(--status-error)',
                                                                            color: 'var(--g-text-inverse)',
                                                                        }}
                                                                    >
                                                                        {ev.confidence_score}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                                {ev.source_type}{ev.page_range ? ` · pp. ${ev.page_range}` : ''}
                                                            </div>
                                                            {ev.snippet && (
                                                                <p
                                                                    className="text-xs"
                                                                    style={{
                                                                        marginTop: 'var(--g-space-1)',
                                                                        color: 'var(--g-text-primary)',
                                                                        fontStyle: 'italic',
                                                                        wordBreak: 'break-word',
                                                                    }}
                                                                >
                                                                    {ev.snippet}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Empty state */}
                                        {evidenceSources.length === 0 && snippets.length === 0 && drawerEvidence.length === 0 && groundingScore === 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--g-space-8) 0', gap: 'var(--g-space-2)' }}>
                                                <FileSearch className="h-8 w-8" style={{ color: 'var(--g-text-secondary)', opacity: 0.5 }} />
                                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    No hay evidencia disponible para esta tarea.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                );
            })()}
        </div>
    );
}
