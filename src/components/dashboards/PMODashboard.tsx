'use client';

import {
    Milestone,
    Gauge,
    Users,
    OctagonAlert,
    ChevronRight,
    CheckCircle2,
    Circle,
} from 'lucide-react';

interface PMODashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const TIMELINE_MILESTONES = [
    { id: 'm1', label: 'Kick-off', date: '2026-01-15', completed: true },
    { id: 'm2', label: 'Data Room abierto', date: '2026-01-22', completed: true },
    { id: 'm3', label: 'Revision Fase 1', date: '2026-02-10', completed: true },
    { id: 'm4', label: 'Red Flag Report', date: '2026-02-20', completed: false },
    { id: 'm5', label: 'Informe Final', date: '2026-03-05', completed: false },
    { id: 'm6', label: 'Cierre', date: '2026-03-15', completed: false },
];

const SLA_COMPLIANCE = 84; // percent

const TEAM_CAPACITY = [
    { name: 'Ana Garcia', role: 'MERC', assigned: 12, completed: 8 },
    { name: 'Carlos Ruiz', role: 'LAB', assigned: 9, completed: 7 },
    { name: 'Maria Lopez', role: 'FISC', assigned: 14, completed: 10 },
    { name: 'Pedro Sanchez', role: 'INM', assigned: 4, completed: 4 },
    { name: 'Laura Torres', role: 'PI', assigned: 7, completed: 3 },
];

const ACTIVE_BLOCKERS = [
    { id: 'b1', title: 'Falta respuesta de Target sobre contratos de alquiler', area: 'INM', daysPending: 5 },
    { id: 'b2', title: 'Documentacion fiscal incompleta para 2024', area: 'FISC', daysPending: 3 },
    { id: 'b3', title: 'Pendiente confirmacion de lista de litigios activos', area: 'LIT', daysPending: 7 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getSLAColor(pct: number): string {
    if (pct >= 90) return 'var(--status-success)';
    if (pct >= 70) return 'var(--status-warning)';
    return 'var(--status-error)';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PMODashboard({ projectId }: PMODashboardProps) {
    const completedMilestones = TIMELINE_MILESTONES.filter(m => m.completed).length;
    const progressPct = Math.round((completedMilestones / TIMELINE_MILESTONES.length) * 100);
    const slaColor = getSLAColor(SLA_COMPLIANCE);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Panel PMO
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Gestion operativa de la transaccion{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {/* Timeline del Proyecto */}
            <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}>
                    <Milestone style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    <span style={{
                        fontWeight: 700, fontSize: 'var(--g-text-caption)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: 'var(--g-brand-3308)',
                    }}>
                        Timeline del Proyecto
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                        {completedMilestones}/{TIMELINE_MILESTONES.length} hitos ({progressPct}%)
                    </span>
                </div>

                <div style={{ padding: 'var(--g-space-5)' }}>
                    {/* Progress bar */}
                    <div style={{
                        width: '100%', height: '10px', borderRadius: 'var(--g-radius-full)',
                        backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden',
                        marginBottom: 'var(--g-space-4)',
                    }}>
                        <div style={{
                            width: `${progressPct}%`, height: '100%',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--g-brand-3308)',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>

                    {/* Milestone dots */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        position: 'relative',
                    }}>
                        {TIMELINE_MILESTONES.map((ms, i) => (
                            <div key={ms.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                {ms.completed ? (
                                    <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                ) : (
                                    <Circle style={{ width: 20, height: 20, color: 'var(--g-text-muted)' }} aria-hidden="true" />
                                )}
                                <span style={{
                                    fontSize: 'var(--g-text-caption)',
                                    fontWeight: ms.completed ? 600 : 400,
                                    color: ms.completed ? 'var(--g-text-primary)' : 'var(--g-text-muted)',
                                    marginTop: '6px', textAlign: 'center',
                                }}>
                                    {ms.label}
                                </span>
                                <span style={{
                                    fontSize: '11px', color: 'var(--g-text-muted)', marginTop: '2px',
                                }}>
                                    {ms.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Second row: SLA + Capacity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--g-space-5)' }}>
                {/* SLA Compliance */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Gauge style={{ width: 14, height: 14, color: slaColor }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: slaColor,
                        }}>
                            SLA Compliance
                        </span>
                    </div>

                    <div style={{
                        padding: 'var(--g-space-6) var(--g-space-5)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-4)',
                        flex: 1, justifyContent: 'center',
                    }}>
                        {/* Ring / circular gauge via CSS */}
                        <div style={{
                            position: 'relative', width: '120px', height: '120px',
                        }}>
                            {/* Background ring */}
                            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    stroke="var(--g-surface-muted)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    stroke={slaColor}
                                    strokeWidth="10"
                                    strokeDasharray={`${2 * Math.PI * 52}`}
                                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - SLA_COMPLIANCE / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                />
                            </svg>
                            {/* Center text */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: slaColor }}>
                                    {SLA_COMPLIANCE}%
                                </span>
                            </div>
                        </div>
                        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', textAlign: 'center' }}>
                            {SLA_COMPLIANCE >= 90 ? 'Dentro de objetivo' : SLA_COMPLIANCE >= 70 ? 'Requiere atencion' : 'Fuera de objetivo'}
                        </p>
                    </div>
                </div>

                {/* Capacidad del Equipo */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Users style={{ width: 14, height: 14, color: 'var(--status-info)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-info)',
                        }}>
                            Capacidad del Equipo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-4) var(--g-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                        {TEAM_CAPACITY.map((person) => {
                            const utilization = Math.round((person.completed / person.assigned) * 100);
                            const barColor = utilization >= 80 ? 'var(--status-success)'
                                : utilization >= 50 ? 'var(--status-warning)'
                                    : 'var(--status-error)';

                            return (
                                <div key={person.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: 'var(--g-text-body)', fontWeight: 500, color: 'var(--g-text-primary)' }}>
                                            {person.name}
                                        </span>
                                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                                            {person.completed}/{person.assigned} completadas · {person.role}
                                        </span>
                                    </div>
                                    <div style={{
                                        width: '100%', height: '6px', borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${Math.min(utilization, 100)}%`, height: '100%',
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
            </div>

            {/* Bloqueos Activos */}
            <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}>
                    <OctagonAlert style={{ width: 14, height: 14, color: 'var(--status-error)' }} aria-hidden="true" />
                    <span style={{
                        fontWeight: 700, fontSize: 'var(--g-text-caption)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: 'var(--status-error)',
                    }}>
                        Bloqueos Activos
                    </span>
                    <span style={{
                        marginLeft: 'auto',
                        padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                        fontSize: 'var(--g-text-caption)', fontWeight: 700,
                        backgroundColor: 'var(--status-error)', color: 'var(--g-text-inverse)',
                    }}>
                        {ACTIVE_BLOCKERS.length}
                    </span>
                </div>

                <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {ACTIVE_BLOCKERS.map((blocker) => (
                        <div
                            key={blocker.id}
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
                                    {blocker.title}
                                </p>
                                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                    Area: {blocker.area} · {blocker.daysPending} dias pendiente
                                </p>
                            </div>
                            <ChevronRight style={{ width: 14, height: 14, color: 'var(--g-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
