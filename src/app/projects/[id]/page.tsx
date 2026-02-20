'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Bot, ClipboardList, AlertTriangle,
    FileText, MessageSquare, CheckCircle2,
    Loader2, ListChecks
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDProcess, DDTask, DDContingency, DDQA, DDDeliverable } from '@/lib/supabase';
import { cn, STATUS_CONFIG, SEVERITY_CONFIG, formatDate, formatCurrency } from '@/lib/utils';

const PROJECT_STATUS_CONFIG: Record<DDProject['status'], { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    active: { label: 'Activo', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    review: { label: 'En revisión', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    closed: { label: 'Cerrado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
};

const AI_STATUS_CONFIG: Record<DDTask['ai_status'], { label: string; bg: string; fg: string }> = {
    none: { label: 'No ejecutado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    running: { label: 'Ejecutando', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    completed: { label: 'Completado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
};

const DELIVERABLE_STATUS_CONFIG: Record<DDDeliverable['status'], { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    review: { label: 'En revisión', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    approved: { label: 'Aprobado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    final: { label: 'Final', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
};

function getAiSummary(output: Record<string, unknown> | null): string {
    if (!output) return 'Sin salida IA registrada todavía.';
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
        return JSON.stringify(output).slice(0, 220);
    } catch {
        return 'No se pudo procesar el detalle del resultado IA.';
    }
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<DDProject | null>(null);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [processes, setProcesses] = useState<DDProcess[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [contingencies, setContingencies] = useState<DDContingency[]>([]);
    const [qas, setQas] = useState<DDQA[]>([]);
    const [deliverables, setDeliverables] = useState<DDDeliverable[]>([]);
    const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [aiRunning, setAiRunning] = useState<string | null>(null);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const [pRes, aRes, prRes, tRes, cRes, qaRes, dRes] = await Promise.all([
                supabase.from('dd_projects').select('*').eq('id', id).single(),
                supabase.from('dd_areas').select('*').order('sort_order'),
                supabase.from('dd_processes').select('*').order('sort_order'),
                supabase.from('dd_tasks').select('*').eq('project_id', id).order('created_at'),
                supabase.from('dd_contingencies').select('*').eq('project_id', id).order('severity'),
                supabase.from('dd_qa').select('*').eq('project_id', id).order('created_at', { ascending: false }),
                supabase.from('dd_deliverables').select('*').eq('project_id', id).order('created_at', { ascending: false }),
            ]);

            const warnings: string[] = [];
            if (qaRes.error) {
                warnings.push('No se pudo cargar la pestaña Q&A (tabla dd_qa no disponible o sin permisos).');
            }
            if (dRes.error) {
                warnings.push('No se pudo cargar la pestaña Documentos (tabla dd_deliverables no disponible o sin permisos).');
            }

            setProject(pRes.data);
            setAreas(aRes.data || []);
            setProcesses(prRes.data || []);
            setTasks(tRes.data || []);
            setContingencies(cRes.data || []);
            setQas(qaRes.data || []);
            setDeliverables(dRes.data || []);
            setLoadWarnings(warnings);
            setLoading(false);
        }
        load();
    }, [id]);

    const refreshTasks = async () => {
        const { data } = await supabase.from('dd_tasks').select('*').eq('project_id', id).order('created_at');
        setTasks(data || []);
    };

    const invokeHarvey = async (processId: string) => {
        setAiRunning(processId);
        try {
            const proc = processes.find(p => p.id === processId);
            await fetch('/api/harvey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: id,
                    process_id: processId,
                    prompt: proc?.harvey_prompt,
                    target_company: project?.target_company,
                    sector: project?.target_sector,
                }),
            });
            await refreshTasks();
        } catch (err) {
            console.error('Harvey invocation error:', err);
        }
        setAiRunning(null);
    };

    const updateTaskStatus = async (taskId: string, status: DDTask['status']) => {
        setStatusUpdating(taskId);
        const { error } = await supabase
            .from('dd_tasks')
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', taskId);

        if (!error) {
            setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));
        }
        setStatusUpdating(null);
    };

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: ClipboardList },
        { id: 'tasks', label: 'Tareas', icon: CheckCircle2 },
        { id: 'contingencies', label: 'Contingencias', icon: AlertTriangle },
        { id: 'documents', label: 'Documentos', icon: FileText },
        { id: 'qa', label: 'Q&A', icon: MessageSquare },
    ];

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-40 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div className="skeleton h-64 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    if (!project) return <div>Proyecto no encontrado</div>;

    const tasksByArea = areas.map(area => ({
        area,
        tasks: tasks.filter(t => t.area_id === area.id),
        processes: processes.filter(p => p.area_id === area.id),
    }));

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const processById = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes]);
    const areaById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
    const hitlQueueCount = tasks.filter(
        t => t.status === 'review' || (t.ai_status === 'completed' && t.status !== 'completed')
    ).length;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyectos
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        {project.name}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {project.target_company} · {project.deal_type} · {project.target_sector || 'Sin sector'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/client/projects/${id}`}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-sec-100)',
                            color: 'var(--g-brand-3308)',
                        }}
                    >
                        Portal cliente
                    </Link>
                    <span
                        className="inline-flex items-center px-3 py-1 text-sm font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: PROJECT_STATUS_CONFIG[project.status].bg,
                            color: PROJECT_STATUS_CONFIG[project.status].fg,
                        }}
                    >
                        {PROJECT_STATUS_CONFIG[project.status].label}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div
                className="p-5 border"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        Progreso General
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--g-brand-3308)' }}>
                        {progressPct}% ({completedTasks}/{totalTasks})
                    </span>
                </div>
                <div className="h-2 w-full overflow-hidden" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-full)' }}>
                    <div
                        className="h-full transition-all"
                        style={{
                            width: `${progressPct}%`,
                            backgroundColor: 'var(--g-brand-3308)',
                            borderRadius: 'var(--g-radius-full)',
                            transition: 'width var(--g-transition-smooth)',
                        }}
                    />
                </div>
                <div className="grid grid-cols-5 gap-3 mt-4">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const count = tasks.filter(t => t.status === key).length;
                        return (
                            <div key={key} className="text-center">
                                <p className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>{count}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{cfg.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b" style={{ borderColor: 'var(--g-border-subtle)' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2',
                            activeTab === tab.id ? 'border-current' : 'border-transparent opacity-60 hover:opacity-80'
                        )}
                        style={{
                            color: activeTab === tab.id ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                        }}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Procesos por Área — Invocar Harvey AI
                    </h3>
                    {tasksByArea.filter(g => g.processes.length > 0).map(({ area, processes: areaProcs, tasks: areaTasks }) => (
                        <div
                            key={area.id}
                            className="border overflow-hidden"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                borderLeft: `4px solid ${area.color}`,
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--g-surface-subtle)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color || 'var(--g-border-default)' }} />
                                    <span className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                        {area.name}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                        ({areaProcs.length} procesos)
                                    </span>
                                </div>
                            </div>
                            <div className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                {areaProcs.map(proc => {
                                    const task = areaTasks.find(t => t.process_id === proc.id);
                                    const isRunning = aiRunning === proc.id;
                                    return (
                                        <div key={proc.id} className="px-5 py-3 flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    P{proc.number}. {proc.name}
                                                </p>
                                                {task && (
                                                    <span
                                                        className="inline-flex items-center mt-1 px-2 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: task.status === 'completed' ? 'var(--status-success)' : 'var(--g-surface-muted)',
                                                            color: task.status === 'completed' ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                                                        }}
                                                    >
                                                        {STATUS_CONFIG[task.status]?.label}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => invokeHarvey(proc.id)}
                                                disabled={isRunning}
                                                aria-busy={isRunning}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                                style={{
                                                    backgroundColor: 'var(--g-brand-bright)',
                                                    color: 'var(--g-text-inverse)',
                                                    borderRadius: 'var(--g-radius-md)',
                                                }}
                                            >
                                                {isRunning ? (
                                                    <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Ejecutando...</>
                                                ) : (
                                                    <><Bot className="h-3 w-3" aria-hidden="true" /> Harvey AI</>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'contingencies' && (
                <div className="space-y-4">
                    {contingencies.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <AlertTriangle className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin contingencias</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Las contingencias aparecerán cuando Harvey analice la documentación
                            </p>
                        </div>
                    ) : (
                        contingencies.map(c => (
                            <div
                                key={c.id}
                                className="p-5 border"
                                style={{
                                    backgroundColor: 'var(--g-surface-card)',
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-lg)',
                                    borderLeft: `4px solid ${SEVERITY_CONFIG[c.severity]?.color || 'var(--g-border-default)'}`,
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-medium" style={{ color: 'var(--g-text-primary)' }}>{c.title}</h4>
                                        <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>{c.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <span
                                            className="inline-flex px-2.5 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: SEVERITY_CONFIG[c.severity]?.color,
                                                color: 'var(--g-text-inverse)',
                                            }}
                                        >
                                            {SEVERITY_CONFIG[c.severity]?.label}
                                        </span>
                                        <p className="text-sm font-bold mt-2" style={{ color: 'var(--g-text-primary)' }}>
                                            {formatCurrency(c.estimated_amount)}
                                        </p>
                                    </div>
                                </div>
                                {c.recommendation && (
                                    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--g-surface-subtle)', borderRadius: 'var(--g-radius-md)' }}>
                                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-brand-3308)' }}>Recomendación:</p>
                                        <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>{c.recommendation}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            Tareas operativas
                        </h3>
                        <Link
                            href={`/projects/${id}/hitl`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-sec-100)',
                                color: 'var(--g-brand-3308)',
                            }}
                        >
                            <ListChecks className="h-3.5 w-3.5" />
                            Revisión HITL ({hitlQueueCount})
                        </Link>
                    </div>

                    {tasks.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin tareas registradas</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Invoca Harvey AI desde Resumen para crear tareas por proceso
                            </p>
                        </div>
                    ) : (
                        <div
                            className="overflow-x-auto border"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <table className="w-full min-w-[980px]">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                                        {['Proceso', 'Área', 'Estado', 'IA', 'Prioridad', 'Vencimiento', 'Última salida IA'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                                style={{ color: 'var(--g-text-muted)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                    {tasks.map((task) => {
                                        const process = processById.get(task.process_id);
                                        const area = task.area_id ? areaById.get(task.area_id) : undefined;
                                        return (
                                            <tr key={task.id}>
                                                <td className="px-4 py-3 text-sm">
                                                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {process ? `P${process.number}. ${process.name}` : 'Proceso no encontrado'}
                                                    </p>
                                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                        Creada: {formatDate(task.created_at)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: area?.color || 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-inverse)',
                                                        }}
                                                    >
                                                        {area?.name || 'Sin área'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={task.status}
                                                        disabled={statusUpdating === task.id}
                                                        aria-busy={statusUpdating === task.id}
                                                        aria-label={`Estado de tarea ${process?.name || task.id}`}
                                                        onChange={(e) => updateTaskStatus(task.id, e.target.value as DDTask['status'])}
                                                        className="h-8 px-2 text-xs border"
                                                        style={{
                                                            borderColor: 'var(--g-border-default)',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            color: 'var(--g-text-primary)',
                                                            backgroundColor: 'var(--g-surface-card)',
                                                        }}
                                                    >
                                                        {(Object.keys(STATUS_CONFIG) as DDTask['status'][]).map((status) => (
                                                            <option key={status} value={status}>
                                                                {STATUS_CONFIG[status].label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: AI_STATUS_CONFIG[task.ai_status].bg,
                                                            color: AI_STATUS_CONFIG[task.ai_status].fg,
                                                        }}
                                                    >
                                                        {AI_STATUS_CONFIG[task.ai_status].label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {task.priority}
                                                </td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {formatDate(task.due_date)}
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {getAiSummary(task.ai_output)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'documents' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Documentos y entregables
                    </h3>

                    {loadWarnings.some((w) => w.includes('Documentos')) && (
                        <div
                            className="p-3 border"
                            style={{
                                borderColor: 'var(--status-warning)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-subtle)',
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                {loadWarnings.find((w) => w.includes('Documentos'))}
                            </p>
                        </div>
                    )}

                    {deliverables.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <FileText className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin entregables todavía</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Aquí verás resúmenes, informes y documentos del proyecto
                            </p>
                        </div>
                    ) : (
                        <div
                            className="overflow-x-auto border"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <table className="w-full min-w-[780px]">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                                        {['Título', 'Tipo', 'Estado', 'Versión', 'Generado por', 'Fecha'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                                style={{ color: 'var(--g-text-muted)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                    {deliverables.map((doc) => (
                                        <tr key={doc.id}>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {doc.title}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                {doc.type}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: DELIVERABLE_STATUS_CONFIG[doc.status].bg,
                                                        color: DELIVERABLE_STATUS_CONFIG[doc.status].fg,
                                                    }}
                                                >
                                                    {DELIVERABLE_STATUS_CONFIG[doc.status].label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                v{doc.version}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                {doc.generated_by}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                {formatDate(doc.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'qa' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Q&A del proyecto
                    </h3>

                    {loadWarnings.some((w) => w.includes('Q&A')) && (
                        <div
                            className="p-3 border"
                            style={{
                                borderColor: 'var(--status-warning)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-subtle)',
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                {loadWarnings.find((w) => w.includes('Q&A'))}
                            </p>
                        </div>
                    )}

                    {qas.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <MessageSquare className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin preguntas abiertas</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Las preguntas al cliente aparecerán aquí con su estado
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {qas.map((qa) => (
                                <div
                                    key={qa.id}
                                    className="p-4 border"
                                    style={{
                                        borderColor: 'var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <span
                                            className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium capitalize"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: qa.status === 'answered' || qa.status === 'closed'
                                                    ? 'var(--status-success)'
                                                    : qa.status === 'follow_up'
                                                        ? 'var(--status-warning)'
                                                        : 'var(--g-surface-muted)',
                                                color: qa.status === 'answered' || qa.status === 'closed' || qa.status === 'follow_up'
                                                    ? 'var(--g-text-inverse)'
                                                    : 'var(--g-text-primary)',
                                            }}
                                        >
                                            {qa.status}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {formatDate(qa.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        {qa.question}
                                    </p>
                                    {qa.answer && (
                                        <div
                                            className="mt-3 p-3"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                            }}
                                        >
                                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-brand-3308)' }}>
                                                Respuesta
                                            </p>
                                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {qa.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
