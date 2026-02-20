'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    FolderKanban, FileText,
    TrendingUp, Clock, CheckCircle2, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDTask } from '@/lib/supabase';
import { STATUS_CONFIG } from '@/lib/utils';

const PROJECT_STATUS_LABEL: Record<DDProject['status'], string> = {
    draft: 'Borrador',
    active: 'Activo',
    review: 'En revisión',
    closed: 'Cerrado',
};

export default function DashboardPage() {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [pRes, aRes, tRes] = await Promise.all([
                supabase.from('dd_projects').select('*').order('created_at', { ascending: false }),
                supabase.from('dd_areas').select('*').order('sort_order'),
                supabase.from('dd_tasks').select('*').order('updated_at', { ascending: false }).limit(120),
            ]);
            setProjects(pRes.data || []);
            setAreas(aRes.data || []);
            setTasks(tRes.data || []);
            setLoading(false);
        }
        load();
    }, []);

    const activeProjects = projects.filter(p => p.status === 'active');
    const stats = [
        { label: 'Proyectos Activos', value: activeProjects.length, icon: FolderKanban, color: 'var(--g-brand-3308)' },
        { label: 'En Revisión', value: projects.filter(p => p.status === 'review').length, icon: Clock, color: 'var(--status-warning)' },
        { label: 'Completados', value: projects.filter(p => p.status === 'closed').length, icon: CheckCircle2, color: 'var(--status-success)' },
        { label: 'Áreas Cubiertas', value: areas.length, icon: TrendingUp, color: 'var(--status-info)' },
    ];
    const nextActions = tasks
        .filter(t => t.status === 'pending' || t.status === 'in_progress')
        .sort((a, b) => {
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 3);
    const blockers = tasks.filter(t => t.status === 'blocked').slice(0, 3);
    const hitlQueue = tasks.filter(
        t => t.status === 'review' || (t.ai_status === 'completed' && t.status !== 'completed')
    ).slice(0, 3);
    const projectById = new Map(projects.map(p => [p.id, p]));

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        Dashboard PMO
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)' }}>
                        Gestión integral de Due Diligence Legal
                    </p>
                </div>
                <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90"
                    style={{
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                        borderRadius: 'var(--g-radius-md)',
                        boxShadow: 'var(--g-shadow-brand)',
                    }}
                >
                    <FolderKanban className="h-4 w-4" />
                    Nuevo Proyecto DD
                </Link>
            </div>

            {/* Mi Jornada */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                    className="p-4 border"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <p className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--g-brand-3308)' }}>
                        Siguiente mejor acción
                    </p>
                    {loading ? (
                        <div className="skeleton h-16 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                    ) : nextActions.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            No hay tareas pendientes para hoy.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {nextActions.map((task) => {
                                const project = projectById.get(task.project_id);
                                return (
                                    <Link
                                        key={task.id}
                                        href={`/projects/${task.project_id}`}
                                        className="block p-2 border"
                                        style={{
                                            borderColor: 'var(--g-border-subtle)',
                                            borderRadius: 'var(--g-radius-md)',
                                        }}
                                    >
                                        <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                            {project?.name || 'Proyecto'}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            Estado: {STATUS_CONFIG[task.status]?.label} · Vence: {task.due_date || 'sin fecha'}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div
                    className="p-4 border"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <p className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--status-warning)' }}>
                        Bloqueos urgentes
                    </p>
                    {loading ? (
                        <div className="skeleton h-16 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                    ) : blockers.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Sin bloqueos activos.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {blockers.map((task) => {
                                const project = projectById.get(task.project_id);
                                return (
                                    <Link
                                        key={task.id}
                                        href={`/projects/${task.project_id}`}
                                        className="block p-2 border"
                                        style={{
                                            borderColor: 'var(--g-border-subtle)',
                                            borderRadius: 'var(--g-radius-md)',
                                        }}
                                    >
                                        <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                            {project?.name || 'Proyecto'}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            Prioridad: {task.priority} · Responsable: {task.assigned_to || 'Pendiente'}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div
                    className="p-4 border"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <p className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--status-success)' }}>
                        Cola de revisión HITL
                    </p>
                    {loading ? (
                        <div className="skeleton h-16 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                    ) : hitlQueue.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Sin revisiones pendientes.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {hitlQueue.map((task) => {
                                const project = projectById.get(task.project_id);
                                return (
                                    <Link
                                        key={task.id}
                                        href={`/projects/${task.project_id}/hitl`}
                                        className="block p-2 border"
                                        style={{
                                            borderColor: 'var(--g-border-subtle)',
                                            borderRadius: 'var(--g-radius-md)',
                                        }}
                                    >
                                        <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                            {project?.name || 'Proyecto'}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            Estado: {STATUS_CONFIG[task.status]?.label} · IA: {task.ai_status}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="flex items-center gap-4 p-5 border transition-all hover:translate-y-[-2px]"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-lg)',
                            boxShadow: 'var(--g-shadow-card)',
                        }}
                    >
                        <div
                            className="flex items-center justify-center h-12 w-12 shrink-0"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: stat.color,
                                opacity: 0.1,
                            }}
                        >
                            <stat.icon className="h-6 w-6" style={{ color: stat.color, opacity: 10 }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                {loading ? '—' : stat.value}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                {stat.label}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Projects List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                        Proyectos Recientes
                    </h2>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 text-sm font-medium"
                        style={{ color: 'var(--g-link)' }}
                    >
                        Ver todos <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton h-20 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center py-16 border border-dashed"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderColor: 'var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-lg)',
                        }}
                    >
                        <FolderKanban className="h-12 w-12 mb-4" style={{ color: 'var(--g-sec-300)' }} />
                        <p className="text-lg font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                            Sin proyectos todavía
                        </p>
                        <p className="text-sm mb-4" style={{ color: 'var(--g-text-secondary)' }}>
                            Crea tu primer proyecto de Due Diligence para empezar
                        </p>
                        <Link
                            href="/projects/new"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                            style={{
                                backgroundColor: 'var(--g-brand-3308)',
                                color: 'var(--g-text-inverse)',
                                borderRadius: 'var(--g-radius-md)',
                            }}
                        >
                            Crear Proyecto
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.slice(0, 5).map((project) => (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="flex items-center justify-between p-5 border transition-all hover:translate-y-[-1px]"
                                style={{
                                    backgroundColor: 'var(--g-surface-card)',
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-lg)',
                                    boxShadow: 'var(--g-shadow-card)',
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="h-10 w-10 flex items-center justify-center shrink-0"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-sec-100)',
                                        }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} />
                                    </div>
                                    <div>
                                        <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                            {project.name}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {project.target_company} · {project.deal_type || 'Acquisition'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: project.status === 'active' ? 'var(--g-brand-3308)'
                                                : project.status === 'review' ? 'var(--status-warning)'
                                                    : project.status === 'closed' ? 'var(--status-success)'
                                                        : 'var(--g-surface-muted)',
                                            color: project.status === 'draft' ? 'var(--g-text-primary)' : 'var(--g-text-inverse)',
                                        }}
                                    >
                                        {PROJECT_STATUS_LABEL[project.status]}
                                    </span>
                                    <ArrowRight className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Areas Grid */}
            <div>
                <h2
                    className="font-bold mb-4"
                    style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                >
                    Áreas de Revisión
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {areas.map((area) => (
                        <div
                            key={area.id}
                            className="p-4 border transition-all hover:translate-y-[-1px] cursor-pointer"
                            style={{
                                backgroundColor: 'var(--g-surface-card)',
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                boxShadow: 'var(--g-shadow-sm)',
                                borderLeft: `3px solid ${area.color}`,
                            }}
                        >
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                {area.name}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                {area.code}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
