'use client';

import {
    PieChart,
    ListChecks,
    Bell,
    Clock,
    CheckCircle2,
    Circle,
    AlertCircle,
    ChevronRight,
} from 'lucide-react';

interface ClientDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const OVERALL_PROGRESS = 62; // percent

const MILESTONES = [
    { id: 'ms1', label: 'Kick-off y planificacion', completed: true, date: '2026-01-15' },
    { id: 'ms2', label: 'Apertura de Data Room', completed: true, date: '2026-01-22' },
    { id: 'ms3', label: 'Revision inicial (Fase 1)', completed: true, date: '2026-02-10' },
    { id: 'ms4', label: 'Informe de Red Flags', completed: false, date: '2026-02-20' },
    { id: 'ms5', label: 'Borrador de informe final', completed: false, date: '2026-03-01' },
    { id: 'ms6', label: 'Entrega de informe final', completed: false, date: '2026-03-10' },
    { id: 'ms7', label: 'Cierre de transaccion', completed: false, date: '2026-03-15' },
];

const CLIENT_ACTIONS = [
    { id: 'a1', title: 'Proporcionar estados financieros auditados 2025', priority: 'critical' as const },
    { id: 'a2', title: 'Confirmar lista de contratos materiales', priority: 'high' as const },
    { id: 'a3', title: 'Responder Q&A #12 — Litigios pendientes', priority: 'high' as const },
];

const RECENT_UPDATES = [
    { id: 'u1', text: 'Informe de progreso semanal publicado', date: '2026-02-21', type: 'report' as const },
    { id: 'u2', text: 'Area Mercantil completada al 85%', date: '2026-02-20', type: 'progress' as const },
    { id: 'u3', text: 'Nueva pregunta Q&A enviada (#14)', date: '2026-02-19', type: 'qa' as const },
    { id: 'u4', text: 'Red flag identificado en area Fiscal', date: '2026-02-18', type: 'alert' as const },
    { id: 'u5', text: 'Documento subido: Contratos laborales', date: '2026-02-17', type: 'document' as const },
];

/* ------------------------------------------------------------------ */
/*  Priority badge config                                              */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    critical: { label: 'Urgente', bg: 'var(--g-severity-critical)', fg: 'var(--g-text-inverse)' },
    high:     { label: 'Alta',    bg: 'var(--g-severity-high)',     fg: 'var(--g-text-inverse)' },
    medium:   { label: 'Media',   bg: 'var(--g-severity-medium)',   fg: 'var(--g-text-inverse)' },
    low:      { label: 'Baja',    bg: 'var(--g-severity-low)',      fg: 'var(--g-text-inverse)' },
};

const UPDATE_ICON_COLOR: Record<string, string> = {
    report: 'var(--g-brand-3308)',
    progress: 'var(--status-success)',
    qa: 'var(--status-info)',
    alert: 'var(--status-error)',
    document: 'var(--status-warning)',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClientDashboard({ projectId }: ClientDashboardProps) {
    const completedMilestones = MILESTONES.filter(m => m.completed).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Portal del Cliente
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Estado de su Due Diligence{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {/* Top row: Progress ring + Milestones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--g-space-5)' }}>
                {/* Progreso General — large ring */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <PieChart style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--g-brand-3308)',
                        }}>
                            Progreso General
                        </span>
                    </div>

                    <div style={{
                        padding: 'var(--g-space-6) var(--g-space-5)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flex: 1, gap: 'var(--g-space-3)',
                    }}>
                        {/* Large progress ring */}
                        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                            <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle
                                    cx="80" cy="80" r="68"
                                    fill="none"
                                    stroke="var(--g-surface-muted)"
                                    strokeWidth="12"
                                />
                                <circle
                                    cx="80" cy="80" r="68"
                                    fill="none"
                                    stroke="var(--g-brand-3308)"
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 68}`}
                                    strokeDashoffset={`${2 * Math.PI * 68 * (1 - OVERALL_PROGRESS / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                />
                            </svg>
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--g-brand-3308)', lineHeight: 1 }}>
                                    {OVERALL_PROGRESS}%
                                </span>
                                <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)', marginTop: '4px' }}>
                                    completado
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hitos Completados */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <ListChecks style={{ width: 14, height: 14, color: 'var(--status-success)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-success)',
                        }}>
                            Hitos Completados
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)' }}>
                            {completedMilestones}/{MILESTONES.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {MILESTONES.map((ms) => (
                            <div
                                key={ms.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                    padding: 'var(--g-space-2) var(--g-space-3)',
                                    borderRadius: 'var(--g-radius-md)',
                                    opacity: ms.completed ? 1 : 0.6,
                                }}
                            >
                                {ms.completed ? (
                                    <CheckCircle2 style={{ width: 18, height: 18, color: 'var(--status-success)', flexShrink: 0 }} aria-hidden="true" />
                                ) : (
                                    <Circle style={{ width: 18, height: 18, color: 'var(--g-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: 'var(--g-text-body)', fontWeight: 500,
                                        color: ms.completed ? 'var(--g-text-primary)' : 'var(--g-text-secondary)',
                                        textDecoration: ms.completed ? 'line-through' : 'none',
                                    }}>
                                        {ms.label}
                                    </span>
                                </div>
                                <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-muted)', flexShrink: 0 }}>
                                    {ms.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom row: Client Actions + Recent Updates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)' }}>
                {/* Accion Requerida */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Bell style={{ width: 14, height: 14, color: 'var(--status-warning)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-warning)',
                        }}>
                            Accion Requerida
                        </span>
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                            fontSize: 'var(--g-text-caption)', fontWeight: 700,
                            backgroundColor: 'var(--status-warning)', color: 'var(--g-text-inverse)',
                        }}>
                            {CLIENT_ACTIONS.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {CLIENT_ACTIONS.map((action) => {
                            const badge = PRIORITY_BADGE[action.priority];
                            return (
                                <div
                                    key={action.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flex: 1, minWidth: 0 }}>
                                        <AlertCircle style={{ width: 16, height: 16, color: badge.bg, flexShrink: 0 }} aria-hidden="true" />
                                        <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                            {action.title}
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

                {/* Ultimas Actualizaciones */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Clock style={{ width: 14, height: 14, color: 'var(--status-info)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-info)',
                        }}>
                            Ultimas Actualizaciones
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {RECENT_UPDATES.map((update, i) => (
                            <div
                                key={update.id}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)',
                                    padding: 'var(--g-space-3)',
                                    position: 'relative',
                                }}
                            >
                                {/* Timeline dot + line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{
                                        width: '10px', height: '10px',
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: UPDATE_ICON_COLOR[update.type] || 'var(--g-text-muted)',
                                        flexShrink: 0,
                                    }} />
                                    {i < RECENT_UPDATES.length - 1 && (
                                        <div style={{
                                            width: '2px', height: '24px',
                                            backgroundColor: 'var(--g-border-subtle)',
                                            marginTop: '4px',
                                        }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                        {update.text}
                                    </p>
                                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                        {update.date}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
