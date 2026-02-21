'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    FolderKanban, FileText,
    TrendingUp, Clock, CheckCircle2, ArrowRight, AlertTriangle, Bot,
    LayoutDashboard, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDTask } from '@/lib/supabase';
import { STATUS_CONFIG } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { LawyerDashboard, LeaderDashboard, PMODashboard, ClientDashboard } from '@/components/dashboards';

const PROJECT_STATUS_LABEL: Record<DDProject['status'], string> = {
    draft: 'Borrador',
    active: 'Activo',
    review: 'En revisión',
    closed: 'Cerrado',
};

const ROLE_LABELS: Record<string, string> = {
    clo: 'CLO',
    pm_transaccion: 'PM Transaccion',
    abogado_area: 'Abogado de Area',
    deal_sponsor: 'Deal Sponsor',
    target_liaison: 'Contacto Target',
    stakeholder_negocio: 'Stakeholder',
    cliente_externo: 'Cliente',
};

/** Returns the role-specific dashboard component, or null for generic */
function RoleDashboard({ role, projectId }: { role: string; projectId?: string }) {
    switch (role) {
        case 'abogado_area':
            return <LawyerDashboard projectId={projectId} />;
        case 'clo':
        case 'deal_sponsor':
            return <LeaderDashboard projectId={projectId} />;
        case 'pm_transaccion':
            return <PMODashboard projectId={projectId} />;
        case 'cliente_externo':
        case 'stakeholder_negocio':
            return <ClientDashboard projectId={projectId} />;
        default:
            return null;
    }
}

export default function DashboardPage() {
    const { primaryRole, roles } = useUser();
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [dashboardView, setDashboardView] = useState<'role' | 'general'>(
        // Default to role view when a role-specific dashboard exists
        'role',
    );

    // Determine the first project id from roles for the role dashboard
    const firstProjectId = roles.length > 0 ? roles[0].project_id : undefined;

    // Does the current role have a specialized dashboard?
    const hasRoleDashboard = primaryRole != null && ['abogado_area', 'clo', 'deal_sponsor', 'pm_transaccion', 'cliente_externo', 'stakeholder_negocio'].includes(primaryRole);

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
        { label: 'Liquidaciones pendientes', value: activeProjects.length, icon: FolderKanban, color: 'var(--g-brand-3308)', bg: 'var(--g-surface-subtle)' },
        { label: 'En Revisión', value: projects.filter(p => p.status === 'review').length, icon: Clock, color: 'var(--status-warning)', bg: '#fef9ee' },
        { label: 'Completados', value: projects.filter(p => p.status === 'closed').length, icon: CheckCircle2, color: 'var(--status-success)', bg: 'var(--g-surface-subtle)' },
        { label: 'Áreas Cubiertas', value: areas.length, icon: TrendingUp, color: 'var(--status-info)', bg: '#eef4ff' },
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

    // -------------------------------------------------------------------
    // Role-specific dashboard view
    // -------------------------------------------------------------------
    if (hasRoleDashboard && dashboardView === 'role' && primaryRole) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                {/* Role dashboard header with toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                            Dashboard — {ROLE_LABELS[primaryRole] || primaryRole}
                        </h1>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                            Vista contextual para tu rol en el proyecto
                        </p>
                    </div>
                    <button
                        onClick={() => setDashboardView('general')}
                        className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-90"
                        style={{
                            backgroundColor: 'var(--g-surface-subtle)',
                            color: 'var(--g-text-primary)',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-2) var(--g-space-4)',
                            fontSize: 'var(--g-text-body)',
                            cursor: 'pointer',
                        }}
                    >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Vista General
                    </button>
                </div>
                <RoleDashboard role={primaryRole} projectId={firstProjectId} />
            </div>
        );
    }

    // -------------------------------------------------------------------
    // General dashboard (default or fallback)
    // -------------------------------------------------------------------
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Dashboard
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Gestión integral de Due Diligence Legal
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {hasRoleDashboard && (
                        <button
                            onClick={() => setDashboardView('role')}
                            className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-90"
                            style={{
                                backgroundColor: 'var(--g-surface-subtle)',
                                color: 'var(--g-text-primary)',
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                padding: 'var(--g-space-2) var(--g-space-4)',
                                fontSize: 'var(--g-text-body)',
                                cursor: 'pointer',
                            }}
                        >
                            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                            Mi Dashboard
                        </button>
                    )}
                    <Link
                        href="/projects/new"
                        className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-90"
                        style={{
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                            borderRadius: 'var(--g-radius-md)',
                            boxShadow: 'var(--g-shadow-brand)',
                            padding: 'var(--g-space-2) var(--g-space-5)',
                            fontSize: 'var(--g-text-body)',
                        }}
                    >
                        <FolderKanban className="h-4 w-4" aria-hidden="true" />
                        Nuevo Proyecto DD
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--g-space-4)' }}>
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="g-card-interactive"
                        style={{ padding: 'var(--g-space-5)' }}
                    >
                        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--g-space-4)' }}>
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: stat.bg,
                                }}
                            >
                                <stat.icon className="h-5 w-5" style={{ color: stat.color }} aria-hidden="true" />
                            </div>
                        </div>
                        <p
                            className="font-bold"
                            style={{
                                fontSize: '1.75rem',
                                lineHeight: '1',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            {loading ? '—' : stat.value}
                        </p>
                        <p style={{
                            color: 'var(--g-text-secondary)',
                            fontSize: 'var(--g-text-body)',
                            marginTop: 'var(--g-space-1)',
                        }}>
                            {stat.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Action Panels — 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--g-space-4)' }}>
                {/* Siguiente mejor acción */}
                <ActionPanel
                    title="Siguiente mejor acción"
                    titleColor="var(--g-brand-3308)"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />}
                    loading={loading}
                    empty={nextActions.length === 0}
                    emptyText="No hay tareas pendientes para hoy."
                >
                    {nextActions.map((task) => {
                        const project = projectById.get(task.project_id);
                        return (
                            <Link
                                key={task.id}
                                href={`/projects/${task.project_id}`}
                                className="block transition-colors"
                                style={{
                                    padding: 'var(--g-space-3)',
                                    borderRadius: 'var(--g-radius-md)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                    {project?.name || 'Proyecto'}
                                </p>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                    {STATUS_CONFIG[task.status]?.label} · Vence: {task.due_date || 'sin fecha'}
                                </p>
                            </Link>
                        );
                    })}
                </ActionPanel>

                {/* Bloqueos urgentes */}
                <ActionPanel
                    title="Bloqueos urgentes"
                    titleColor="var(--status-error)"
                    icon={<AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--status-error)' }} aria-hidden="true" />}
                    loading={loading}
                    empty={blockers.length === 0}
                    emptyText="Sin bloqueos activos."
                >
                    {blockers.map((task) => {
                        const project = projectById.get(task.project_id);
                        return (
                            <Link
                                key={task.id}
                                href={`/projects/${task.project_id}`}
                                className="block transition-colors"
                                style={{
                                    padding: 'var(--g-space-3)',
                                    borderRadius: 'var(--g-radius-md)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                    {project?.name || 'Proyecto'}
                                </p>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                    Prioridad: {task.priority} · {task.assigned_to || 'Sin asignar'}
                                </p>
                            </Link>
                        );
                    })}
                </ActionPanel>

                {/* Cola HITL */}
                <ActionPanel
                    title="Cola de revisión HITL"
                    titleColor="var(--status-success)"
                    icon={<Bot className="h-3.5 w-3.5" style={{ color: 'var(--status-success)' }} aria-hidden="true" />}
                    loading={loading}
                    empty={hitlQueue.length === 0}
                    emptyText="Sin revisiones pendientes."
                >
                    {hitlQueue.map((task) => {
                        const project = projectById.get(task.project_id);
                        return (
                            <Link
                                key={task.id}
                                href={`/projects/${task.project_id}/hitl`}
                                className="block transition-colors"
                                style={{
                                    padding: 'var(--g-space-3)',
                                    borderRadius: 'var(--g-radius-md)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                    {project?.name || 'Proyecto'}
                                </p>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                    {STATUS_CONFIG[task.status]?.label} · IA: {task.ai_status}
                                </p>
                            </Link>
                        );
                    })}
                </ActionPanel>
            </div>

            {/* Two-column bottom section */}
            <div className="grid grid-cols-1 lg:grid-cols-5" style={{ gap: 'var(--g-space-5)' }}>
                {/* Projects List — wider */}
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between" style={{ marginBottom: 'var(--g-space-4)' }}>
                        <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                            Proyectos Recientes
                        </h2>
                        <Link
                            href="/projects"
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: 'var(--g-link)', fontSize: 'var(--g-text-body)' }}
                        >
                            Ver todos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton" style={{ height: '64px', borderRadius: 'var(--g-radius-lg)' }} />
                            ))}
                        </div>
                    ) : projects.length === 0 ? (
                        <div
                            className="g-card flex flex-col items-center justify-center"
                            style={{ padding: 'var(--g-space-12) var(--g-space-6)' }}
                        >
                            <FolderKanban className="h-10 w-10" style={{ color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-4)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body-lg)' }}>
                                Sin proyectos todavía
                            </p>
                            <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '4px', marginBottom: 'var(--g-space-5)' }}>
                                Crea tu primer proyecto de Due Diligence para empezar
                            </p>
                            <Link
                                href="/projects/new"
                                className="inline-flex items-center gap-2 font-medium"
                                style={{
                                    backgroundColor: 'var(--g-brand-3308)',
                                    color: 'var(--g-text-inverse)',
                                    borderRadius: 'var(--g-radius-md)',
                                    padding: 'var(--g-space-2) var(--g-space-5)',
                                    fontSize: 'var(--g-text-body)',
                                }}
                            >
                                Crear Proyecto
                            </Link>
                        </div>
                    ) : (
                        <div className="g-card" style={{ overflow: 'hidden' }}>
                            {projects.slice(0, 5).map((project, i) => (
                                <Link
                                    key={project.id}
                                    href={`/projects/${project.id}`}
                                    className="flex items-center justify-between transition-colors"
                                    style={{
                                        padding: 'var(--g-space-4) var(--g-space-5)',
                                        borderBottom: i < Math.min(projects.length, 5) - 1 ? '1px solid var(--g-border-subtle)' : 'none',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-hover)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex items-center justify-center shrink-0"
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                            }}
                                        >
                                            <FileText className="h-[18px] w-[18px]" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                        </div>
                                        <div>
                                            <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                                {project.name}
                                            </p>
                                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)' }}>
                                                {project.target_company} · {project.deal_type || 'Acquisition'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                padding: '3px 10px',
                                                fontSize: 'var(--g-text-caption)',
                                                backgroundColor: project.status === 'active' ? 'var(--g-surface-subtle)'
                                                    : project.status === 'review' ? '#fef9ee'
                                                        : project.status === 'closed' ? 'var(--g-surface-subtle)'
                                                            : 'var(--g-surface-muted)',
                                                color: project.status === 'active' ? 'var(--g-brand-3308)'
                                                    : project.status === 'review' ? 'var(--status-warning)'
                                                        : project.status === 'closed' ? 'var(--status-success)'
                                                            : 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {PROJECT_STATUS_LABEL[project.status]}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Areas Grid — narrower right column */}
                <div className="lg:col-span-2">
                    <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-4)' }}>
                        Áreas de Revisión
                    </h2>
                    <div className="g-card" style={{ overflow: 'hidden' }}>
                        {areas.length === 0 && !loading ? (
                            <div className="flex flex-col items-center justify-center" style={{ padding: 'var(--g-space-10)' }}>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)' }}>Sin áreas configuradas</p>
                            </div>
                        ) : (
                            areas.map((area, i) => (
                                <div
                                    key={area.id}
                                    className="flex items-center gap-3"
                                    style={{
                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                        borderBottom: i < areas.length - 1 ? '1px solid var(--g-border-subtle)' : 'none',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: area.color || 'var(--g-text-muted)',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                            {area.name}
                                        </p>
                                    </div>
                                    <span style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-caption)' }}>
                                        {area.code}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---- Reusable ActionPanel ---- */
function ActionPanel({
    title,
    titleColor,
    icon,
    loading,
    empty,
    emptyText,
    children,
}: {
    title: string;
    titleColor: string;
    icon: React.ReactNode;
    loading: boolean;
    empty: boolean;
    emptyText: string;
    children: React.ReactNode;
}) {
    return (
        <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Card header */}
            <div
                className="flex items-center gap-2"
                style={{
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}
            >
                {icon}
                <span
                    className="font-bold"
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: titleColor,
                    }}
                >
                    {title}
                </span>
            </div>
            {/* Card body */}
            <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', flex: 1 }}>
                {loading ? (
                    <div className="skeleton" style={{ height: '48px' }} />
                ) : empty ? (
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-2)' }}>
                        {emptyText}
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
