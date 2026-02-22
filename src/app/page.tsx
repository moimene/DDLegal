'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    FolderKanban, AlertTriangle, Bot, ArrowRight,
    LayoutDashboard, Eye, Target, Workflow, Clock,
    CheckCircle2, ShieldAlert, ListChecks, Swords,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { LawyerDashboard, LeaderDashboard, PMODashboard, ClientDashboard } from '@/components/dashboards';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectMetrics {
    total_tasks: number;
    pending_tasks: number;
    blocked_tasks: number;
    completed_tasks: number;
    completion_pct: number;
}

interface ProjectSummary {
    id: string;
    name: string;
    target_company: string;
    deal_type: string;
    status: 'draft' | 'active' | 'review' | 'closed';
    deadline: string | null;
    user_role: string;
    metrics: ProjectMetrics;
    risk_score: number | null;
    risk_recommendation: string | null;
    active_workflows: number;
}

interface MyTask {
    id: string;
    title: string;
    project_id: string;
    project_name: string;
    area_code: string;
    state: string;
    priority: string;
    entered_state_at: string;
}

interface Alert {
    type: string;
    project_id: string;
    project_name: string;
    title: string;
    detail: string;
    severity: string;
}

interface AggregateData {
    kpis: {
        total_projects: number;
        active_projects: number;
        my_pending_tasks: number;
        total_blockers: number;
        hitl_pending: number;
    };
    projects: ProjectSummary[];
    my_tasks: MyTask[];
    alerts: Alert[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<string, string> = {
    draft: 'Borrador', active: 'Activo', review: 'En revisión', closed: 'Cerrado',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    active: { bg: 'var(--g-surface-subtle)', color: 'var(--g-brand-3308)' },
    review: { bg: '#fef9ee', color: 'var(--status-warning)' },
    closed: { bg: 'var(--g-surface-subtle)', color: 'var(--status-success)' },
    draft: { bg: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)' },
};

const RISK_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    go: { bg: '#ecfdf5', color: '#059669', label: 'Go' },
    conditional_go: { bg: '#fef9ee', color: '#d97706', label: 'Condicional' },
    no_go: { bg: '#fef2f2', color: '#dc2626', label: 'No Go' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    critical: { label: 'Crítica', color: '#dc2626' },
    high: { label: 'Alta', color: '#ea580c' },
    medium: { label: 'Media', color: '#d97706' },
    low: { label: 'Baja', color: '#65a30d' },
};

const ROLE_LABELS: Record<string, string> = {
    clo: 'CLO', pm_transaccion: 'PM', abogado_area: 'Abogado',
    deal_sponsor: 'Sponsor', target_liaison: 'Target', stakeholder_negocio: 'Stakeholder',
    cliente_externo: 'Cliente',
};

/* ------------------------------------------------------------------ */
/*  Role Dashboard (preserved)                                         */
/* ------------------------------------------------------------------ */

function RoleDashboard({ role, projectId }: { role: string; projectId?: string }) {
    switch (role) {
        case 'abogado_area': return <LawyerDashboard projectId={projectId} />;
        case 'clo': case 'deal_sponsor': return <LeaderDashboard projectId={projectId} />;
        case 'pm_transaccion': return <PMODashboard projectId={projectId} />;
        case 'cliente_externo': case 'stakeholder_negocio': return <ClientDashboard projectId={projectId} />;
        default: return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysAgo(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
    const { primaryRole, roles } = useUser();
    const [data, setData] = useState<AggregateData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dashboardView, setDashboardView] = useState<'role' | 'general'>('general');

    const firstProjectId = roles.length > 0 ? roles[0].project_id : undefined;
    const hasRoleDashboard = primaryRole != null &&
        ['abogado_area', 'clo', 'deal_sponsor', 'pm_transaccion', 'cliente_externo', 'stakeholder_negocio'].includes(primaryRole);

    useEffect(() => {
        async function load() {
            const token = localStorage.getItem('dd_session_token');
            if (!token) { setLoading(false); return; }

            try {
                const res = await fetch('/api/dashboard/aggregate', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.success) setData(json);
                }
            } catch { /* silent */ }
            setLoading(false);
        }
        load();
    }, []);

    const kpis = data?.kpis;
    const projects = data?.projects || [];
    const myTasks = data?.my_tasks || [];
    const alerts = data?.alerts || [];

    // -------------------------------------------------------------------
    // Role-specific dashboard view
    // -------------------------------------------------------------------
    if (hasRoleDashboard && dashboardView === 'role' && primaryRole) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
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
                            backgroundColor: 'var(--g-surface-subtle)', color: 'var(--g-text-primary)',
                            borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-2) var(--g-space-4)', fontSize: 'var(--g-text-body)', cursor: 'pointer',
                        }}
                    >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Centro de Mando
                    </button>
                </div>
                <RoleDashboard role={primaryRole} projectId={firstProjectId} />
            </div>
        );
    }

    // -------------------------------------------------------------------
    // Centro de Mando (main aggregated dashboard)
    // -------------------------------------------------------------------
    const kpiCards = [
        { label: 'Proyectos Activos', value: kpis?.active_projects ?? 0, icon: FolderKanban, color: 'var(--g-brand-3308)', bg: 'var(--g-surface-subtle)' },
        { label: 'Mis Tareas Pendientes', value: kpis?.my_pending_tasks ?? 0, icon: ListChecks, color: 'var(--status-warning)', bg: '#fef9ee' },
        { label: 'Bloqueos Activos', value: kpis?.total_blockers ?? 0, icon: ShieldAlert, color: 'var(--status-error)', bg: '#fef2f2' },
        { label: 'HITL Pendientes', value: kpis?.hitl_pending ?? 0, icon: Bot, color: 'var(--status-success)', bg: 'var(--g-surface-subtle)' },
    ];

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}>
            {/* S1: Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Centro de Mando
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Due Diligence Legal — Visión agregada de todos tus proyectos
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {hasRoleDashboard && (
                        <button
                            onClick={() => setDashboardView('role')}
                            className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-90"
                            style={{
                                backgroundColor: 'var(--g-surface-subtle)', color: 'var(--g-text-primary)',
                                borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-default)',
                                padding: 'var(--g-space-2) var(--g-space-4)', fontSize: 'var(--g-text-body)', cursor: 'pointer',
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
                            backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)',
                            borderRadius: 'var(--g-radius-md)', boxShadow: 'var(--g-shadow-brand)',
                            padding: 'var(--g-space-2) var(--g-space-5)', fontSize: 'var(--g-text-body)',
                        }}
                    >
                        <FolderKanban className="h-4 w-4" aria-hidden="true" />
                        Nuevo Proyecto DD
                    </Link>
                </div>
            </div>

            {/* S2: Cross-project KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--g-space-4)' }}>
                {kpiCards.map((stat) => (
                    <div key={stat.label} className="g-card-interactive" style={{ padding: 'var(--g-space-5)' }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--g-space-4)' }}>
                            <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)', backgroundColor: stat.bg }}>
                                <stat.icon className="h-5 w-5" style={{ color: stat.color }} aria-hidden="true" />
                            </div>
                        </div>
                        <p className="font-bold" style={{ fontSize: '1.75rem', lineHeight: '1', color: 'var(--g-text-primary)' }}>
                            {loading ? '—' : stat.value}
                        </p>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                            {stat.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* S3: Project Cards Grid */}
            <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--g-space-4)' }}>
                    <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                        Mis Proyectos
                    </h2>
                    <Link href="/projects" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--g-link)', fontSize: 'var(--g-text-body)' }}>
                        Ver todos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--g-space-4)' }}>
                        {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '200px', borderRadius: 'var(--g-radius-lg)' }} />)}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="g-card flex flex-col items-center justify-center" style={{ padding: 'var(--g-space-12) var(--g-space-6)' }}>
                        <FolderKanban className="h-10 w-10" style={{ color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-4)' }} />
                        <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body-lg)' }}>Sin proyectos todavía</p>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '4px', marginBottom: 'var(--g-space-5)' }}>
                            Crea tu primer proyecto de Due Diligence para empezar
                        </p>
                        <Link href="/projects/new" className="inline-flex items-center gap-2 font-medium" style={{ backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)', borderRadius: 'var(--g-radius-md)', padding: 'var(--g-space-2) var(--g-space-5)', fontSize: 'var(--g-text-body)' }}>
                            Crear Proyecto
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--g-space-4)' }}>
                        {projects.map((p) => (
                            <ProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                )}
            </div>

            {/* S4: My Pending Actions */}
            {myTasks.length > 0 && (
                <div>
                    <SectionHeader icon={<ListChecks className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />} title="Mis Acciones Pendientes" />
                    <div className="g-card" style={{ overflow: 'hidden' }}>
                        {myTasks.slice(0, 8).map((task, i) => (
                            <Link
                                key={task.id}
                                href={`/projects/${task.project_id}/kanban`}
                                className="flex items-center gap-4 transition-colors"
                                style={{
                                    padding: 'var(--g-space-3) var(--g-space-5)',
                                    borderBottom: i < Math.min(myTasks.length, 8) - 1 ? '1px solid var(--g-border-subtle)' : 'none',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-hover)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                        {task.title}
                                    </p>
                                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                        {task.area_code} · {task.state}
                                    </p>
                                </div>
                                <span
                                    className="shrink-0 font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)', padding: '2px 8px',
                                        fontSize: 'var(--g-text-caption)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        color: 'var(--g-brand-3308)',
                                    }}
                                >
                                    {task.project_name}
                                </span>
                                {PRIORITY_CONFIG[task.priority] && (
                                    <span
                                        className="shrink-0"
                                        style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            backgroundColor: PRIORITY_CONFIG[task.priority].color,
                                        }}
                                        title={PRIORITY_CONFIG[task.priority].label}
                                    />
                                )}
                                <span style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-caption)', whiteSpace: 'nowrap' }}>
                                    {daysAgo(task.entered_state_at)}d
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* S5: Alerts — blockers + stale tasks */}
            {alerts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--g-space-4)' }}>
                    {/* Blockers */}
                    <AlertPanel
                        title="Bloqueos Urgentes"
                        titleColor="var(--status-error)"
                        icon={<AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--status-error)' }} />}
                        items={alerts.filter(a => a.type === 'blocker')}
                    />
                    {/* Stale Tasks */}
                    <AlertPanel
                        title="Tareas Estancadas"
                        titleColor="var(--status-warning)"
                        icon={<Clock className="h-3.5 w-3.5" style={{ color: 'var(--status-warning)' }} />}
                        items={alerts.filter(a => a.type === 'stale_task')}
                    />
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--g-space-3)' }}>
            {icon}
            <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>{title}</h2>
        </div>
    );
}

function ProjectCard({ project: p }: { project: ProjectSummary }) {
    const risk = p.risk_recommendation ? RISK_COLORS[p.risk_recommendation] : null;
    const statusStyle = STATUS_COLOR[p.status] || STATUS_COLOR.draft;

    return (
        <Link
            href={`/projects/${p.id}`}
            className="g-card-interactive block transition-all"
            style={{ padding: 'var(--g-space-5)' }}
        >
            {/* Top row: name + badges */}
            <div className="flex items-start justify-between" style={{ marginBottom: 'var(--g-space-3)' }}>
                <div className="flex-1 min-w-0" style={{ marginRight: 'var(--g-space-3)' }}>
                    <p className="font-bold truncate" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body-lg)' }}>
                        {p.name}
                    </p>
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                        {p.target_company} · {p.deal_type || 'Acquisition'}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium" style={{ borderRadius: 'var(--g-radius-full)', padding: '2px 8px', fontSize: 'var(--g-text-caption)', backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                        {STATUS_LABEL[p.status] || p.status}
                    </span>
                    <span style={{ borderRadius: 'var(--g-radius-full)', padding: '2px 8px', fontSize: 'var(--g-text-caption)', backgroundColor: 'rgba(27,67,50,0.08)', color: 'var(--g-brand-3308)' }}>
                        {ROLE_LABELS[p.user_role] || p.user_role}
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 'var(--g-space-3)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>Progreso</span>
                    <span className="font-medium" style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-primary)' }}>{p.metrics.completion_pct}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.metrics.completion_pct}%`, borderRadius: '3px', backgroundColor: 'var(--g-brand-bright)', transition: 'width 0.5s ease' }} />
                </div>
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-4 flex-wrap" style={{ marginBottom: 'var(--g-space-3)' }}>
                <MetricPill icon={<ListChecks className="h-3 w-3" />} label={`${p.metrics.total_tasks} tareas`} />
                {p.metrics.blocked_tasks > 0 && (
                    <MetricPill icon={<AlertTriangle className="h-3 w-3" />} label={`${p.metrics.blocked_tasks} bloqueados`} color="var(--status-error)" />
                )}
                {p.active_workflows > 0 && (
                    <MetricPill icon={<Workflow className="h-3 w-3" />} label={`${p.active_workflows} workflows`} />
                )}
                {p.risk_score != null && (
                    <MetricPill icon={<Target className="h-3 w-3" />} label={`Score: ${p.risk_score}`} />
                )}
            </div>

            {/* Bottom row: risk chip + deadline + enter */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {risk && (
                        <span className="font-medium" style={{ borderRadius: 'var(--g-radius-full)', padding: '2px 10px', fontSize: 'var(--g-text-caption)', backgroundColor: risk.bg, color: risk.color }}>
                            {risk.label}
                        </span>
                    )}
                    {p.deadline && (
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            Vence: {new Date(p.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
                <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--g-link)', fontSize: 'var(--g-text-body)' }}>
                    Entrar <ArrowRight className="h-3.5 w-3.5" />
                </span>
            </div>
        </Link>
    );
}

function MetricPill({ icon, label, color }: { icon: React.ReactNode; label: string; color?: string }) {
    return (
        <span className="inline-flex items-center gap-1" style={{ fontSize: 'var(--g-text-caption)', color: color || 'var(--g-text-secondary)' }}>
            {icon} {label}
        </span>
    );
}

function AlertPanel({ title, titleColor, icon, items }: { title: string; titleColor: string; icon: React.ReactNode; items: Alert[] }) {
    return (
        <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center gap-2" style={{ padding: 'var(--g-space-4) var(--g-space-5)', borderBottom: '1px solid var(--g-border-subtle)' }}>
                {icon}
                <span className="font-bold" style={{ fontSize: 'var(--g-text-caption)', textTransform: 'uppercase', letterSpacing: '0.04em', color: titleColor }}>
                    {title}
                </span>
                {items.length > 0 && (
                    <span className="font-medium" style={{ fontSize: 'var(--g-text-caption)', backgroundColor: titleColor, color: 'white', borderRadius: 'var(--g-radius-full)', padding: '1px 6px', marginLeft: '4px' }}>
                        {items.length}
                    </span>
                )}
            </div>
            <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', flex: 1 }}>
                {items.length === 0 ? (
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-2)' }}>
                        Sin incidencias.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {items.slice(0, 5).map((alert, i) => (
                            <Link
                                key={`${alert.project_id}-${i}`}
                                href={`/projects/${alert.project_id}/kanban`}
                                className="block transition-colors"
                                style={{ padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <p className="font-medium" style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                                    {alert.title}
                                </p>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                    {alert.project_name} · {alert.detail}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
