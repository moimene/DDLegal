'use client';

import {
    ListChecks,
    Bot,
    FileSearch,
    ArrowRight,
    AlertCircle,
    Clock,
    ChevronRight,
} from 'lucide-react';

interface LawyerDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const PENDING_TASKS = [
    { id: 't1', title: 'Revisar escritura de constitucion - Target S.L.', area: 'MERC', priority: 'critical' as const, dueDate: '2026-02-23' },
    { id: 't2', title: 'Verificar poderes notariales vigentes', area: 'MERC', priority: 'high' as const, dueDate: '2026-02-24' },
    { id: 't3', title: 'Analisis de contratos laborales clave', area: 'LAB', priority: 'high' as const, dueDate: '2026-02-25' },
    { id: 't4', title: 'Comprobar situacion registral de inmueble', area: 'INM', priority: 'medium' as const, dueDate: '2026-02-27' },
    { id: 't5', title: 'Revision de licencias administrativas', area: 'ADMIN', priority: 'low' as const, dueDate: '2026-03-01' },
];

const HITL_ITEMS = [
    { id: 'h1', title: 'IA detecto clausula de cambio de control', skill: 'clausula_change_of_control', confidence: 0.82 },
    { id: 'h2', title: 'Extraccion de datos fiscales — verificar NIF', skill: 'extraccion_fiscal', confidence: 0.74 },
    { id: 'h3', title: 'Resumen de litigios pendientes', skill: 'resumen_litigios', confidence: 0.91 },
];

const DOCS_TO_REVIEW = 14;

/* ------------------------------------------------------------------ */
/*  Priority config                                                    */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
    critical: { label: 'Critica', bg: 'var(--g-severity-critical)', fg: 'var(--g-text-inverse)' },
    high:     { label: 'Alta',    bg: 'var(--g-severity-high)',     fg: 'var(--g-text-inverse)' },
    medium:   { label: 'Media',   bg: 'var(--g-severity-medium)',   fg: 'var(--g-text-inverse)' },
    low:      { label: 'Baja',    bg: 'var(--g-severity-low)',      fg: 'var(--g-text-inverse)' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LawyerDashboard({ projectId }: LawyerDashboardProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Mi Escritorio
                </h1>
                <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                    Vista de abogado de area{projectId ? ` — Proyecto ${projectId}` : ''}
                </p>
            </div>

            {/* Top KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-4)' }}>
                {/* Pending tasks count */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ListChecks style={{ width: 20, height: 20, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {PENDING_TASKS.length}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        Tareas pendientes
                    </p>
                </div>

                {/* HITL count */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: '#fef9ee',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Bot style={{ width: 20, height: 20, color: 'var(--status-warning)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {HITL_ITEMS.length}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        HITL pendientes
                    </p>
                </div>

                {/* Docs to review */}
                <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)',
                            backgroundColor: '#eef4ff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FileSearch style={{ width: 20, height: 20, color: 'var(--status-info)' }} aria-hidden="true" />
                        </div>
                    </div>
                    <p style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {DOCS_TO_REVIEW}
                    </p>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: 'var(--g-space-1)' }}>
                        Documentos por revisar
                    </p>
                </div>
            </div>

            {/* Quick action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    type="button"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)',
                        borderRadius: 'var(--g-radius-md)', border: 'none', cursor: 'pointer',
                        padding: 'var(--g-space-2) var(--g-space-5)', fontSize: 'var(--g-text-body)',
                        fontWeight: 500, boxShadow: 'var(--g-shadow-brand)',
                    }}
                >
                    Ir a siguiente tarea
                    <ArrowRight style={{ width: 16, height: 16 }} aria-hidden="true" />
                </button>
            </div>

            {/* Two-column layout: Tasks + HITL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)' }}>
                {/* Mi Cola de Trabajo */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <ListChecks style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--g-brand-3308)',
                        }}>
                            Mi Cola de Trabajo
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {PENDING_TASKS.map((task) => {
                            const badge = PRIORITY_BADGE[task.priority];
                            return (
                                <div
                                    key={task.id}
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
                                            {task.title}
                                        </p>
                                        <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px' }}>
                                            {task.area} · Vence: {task.dueDate}
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

                {/* HITL Pendientes */}
                <div className="g-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-4) var(--g-space-5)',
                        borderBottom: '1px solid var(--g-border-subtle)',
                    }}>
                        <Bot style={{ width: 14, height: 14, color: 'var(--status-warning)' }} aria-hidden="true" />
                        <span style={{
                            fontWeight: 700, fontSize: 'var(--g-text-caption)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            color: 'var(--status-warning)',
                        }}>
                            HITL Pendientes
                        </span>
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px', borderRadius: 'var(--g-radius-full)',
                            fontSize: 'var(--g-text-caption)', fontWeight: 700,
                            backgroundColor: 'var(--status-warning)', color: 'var(--g-text-inverse)',
                        }}>
                            {HITL_ITEMS.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {HITL_ITEMS.map((item) => (
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                        <AlertCircle style={{ width: 14, height: 14, color: 'var(--status-warning)', flexShrink: 0 }} aria-hidden="true" />
                                        <p style={{ color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)', fontWeight: 500 }}>
                                            {item.title}
                                        </p>
                                    </div>
                                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: '2px', paddingLeft: '22px' }}>
                                        Skill: {item.skill} · Confianza: {Math.round(item.confidence * 100)}%
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flexShrink: 0 }}>
                                    <Clock style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} aria-hidden="true" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
