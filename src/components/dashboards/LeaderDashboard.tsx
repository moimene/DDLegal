'use client';

import {
    Users,
    AlertTriangle,
    Gavel,
    ShieldAlert,
    ChevronRight,
} from 'lucide-react';

interface LeaderDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const TEAM_WORKLOAD = [
    { name: 'Ana Garcia', area: 'MERC', tasks: 12, capacity: 15 },
    { name: 'Carlos Ruiz', area: 'LAB', tasks: 9, capacity: 12 },
    { name: 'Maria Lopez', area: 'FISC', tasks: 14, capacity: 15 },
    { name: 'Pedro Sanchez', area: 'INM', tasks: 4, capacity: 10 },
    { name: 'Laura Torres', area: 'PI', tasks: 7, capacity: 10 },
    { name: 'Javier Diaz', area: 'LIT', tasks: 11, capacity: 12 },
];

const RED_FLAGS = {
    total: 8,
    critical: 2,
    high: 3,
    medium: 3,
};

const PENDING_DECISIONS = [
    { id: 'd1', title: 'Aprobar informe consolidado Q1 — FMC Target', area: 'GENERAL', urgency: 'critical' as const },
    { id: 'd2', title: 'Autorizar acceso VDR a contraparte', area: 'MERC', urgency: 'high' as const },
    { id: 'd3', title: 'Validar tratamiento de contingencia fiscal', area: 'FISC', urgency: 'high' as const },
    { id: 'd4', title: 'Decidir escalamiento de litigio pendiente', area: 'LIT', urgency: 'medium' as const },
];

const AT_RISK_AREAS = [
    { area: 'FISC', label: 'Fiscal', slaBreaches: 3, overdueTasks: 5 },
    { area: 'LIT', label: 'Litigios', slaBreaches: 2, overdueTasks: 3 },
    { area: 'LAB', label: 'Laboral', slaBreaches: 1, overdueTasks: 2 },
];

/* ------------------------------------------------------------------ */
/*  Severity badge config                                              */
/* ------------------------------------------------------------------ */

const SEVERITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    critical: { label: 'Critica', bg: 'var(--g-severity-critical)', fg: 'var(--g-text-inverse)' },
    high:     { label: 'Alta',    bg: 'var(--g-severity-high)',     fg: 'var(--g-text-inverse)' },
    medium:   { label: 'Media',   bg: 'var(--g-severity-medium)',   fg: 'var(--g-text-inverse)' },
    low:      { label: 'Baja',    bg: 'var(--g-severity-low)',      fg: 'var(--g-text-inverse)' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderDashboard({ projectId }: LeaderDashboardProps) {
    const maxTasks = Math.max(...TEAM_WORKLOAD.map(m => m.capacity));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Panel del CLO
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Vision estrategica del equipo{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {/* Top row: Team Workload + Red Flags */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--g-space-5)' }}>
                {/* Salud del Equipo — bar chart */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Users style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--g-brand-3308)',
                        }}>
                            Salud del Equipo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-4) var(--g-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                        {TEAM_WORKLOAD.map((member) => {
                            const pct = Math.round((member.tasks / member.capacity) * 100);
                            const barColor = pct >= 90 ? 'var(--status-error)'
                                : pct >= 70 ? 'var(--status-warning)'
                                    : 'var(--status-success)';

                            return (
                                <div key={member.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: 'var(--g-text-body)', fontWeight: 500, color: 'var(--g-text-primary)' }}>
                                            {member.name}
                                        </span>
                                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                                            {member.tasks}/{member.capacity} tareas ({pct}%)
                                        </span>
                                    </div>
                                    {/* Bar background */}
                                    <div style={{
                                        width: '100%', height: '8px', borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden',
                                    }}>
                                        {/* Bar fill */}
                                        <div style={{
                                            width: `${Math.min(pct, 100)}%`,
                                            height: '100%',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: barColor,
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Red Flags Activos */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <AlertTriangle style={{ width: 14, height: 14, color: 'var(--status-error)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-error)',
                        }}>
                            Red Flags Activos
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-5)' }}>
                        {/* Total count */}
                        <p style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 700, color: 'var(--status-error)' }}>
                            {RED_FLAGS.total}
                        </p>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)' }}>
                            flags activos
                        </p>

                        {/* Severity breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', width: '100%' }}>
                            {(['critical', 'high', 'medium'] as const).map((sev) => {
                                const badge = SEVERITY_BADGE[sev];
                                return (
                                    <div key={sev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                                            fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                            backgroundColor: badge.bg, color: badge.fg,
                                        }}>
                                            {badge.label}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: 'var(--g-text-body)', color: 'var(--g-text-primary)' }}>
                                            {RED_FLAGS[sev]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom row: Decisions + Areas at Risk */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--g-space-5)' }}>
                {/* Decisiones Pendientes */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Gavel style={{ width: 14, height: 14, color: '#7C3AED' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: '#7C3AED',
                        }}>
                            Decisiones Pendientes
                        </span>
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                            fontSize: 'var(--g-text-caption)', fontWeight: 700,
                            backgroundColor: '#7C3AED', color: 'var(--g-text-inverse)',
                        }}>
                            {PENDING_DECISIONS.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {PENDING_DECISIONS.map((item) => {
                            const badge = SEVERITY_BADGE[item.urgency];
                            return (
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
                                        <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                            {item.title}
                                        </p>
                                        <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                            Area: {item.area}
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
                        })}
                    </div>
                </div>

                {/* Areas en Riesgo */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <ShieldAlert style={{ width: 14, height: 14, color: 'var(--status-error)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-error)',
                        }}>
                            Areas en Riesgo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {AT_RISK_AREAS.map((item) => (
                            <div
                                key={item.area}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)',
                                }}
                            >
                                <div>
                                    <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                        {item.label}
                                    </p>
                                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                        {item.overdueTasks} tareas vencidas
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                                        fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                        backgroundColor: 'var(--status-error)', color: 'var(--g-text-inverse)',
                                    }}>
                                        {item.slaBreaches} SLA rotos
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
