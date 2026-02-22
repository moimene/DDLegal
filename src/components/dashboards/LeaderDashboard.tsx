'use client';

import { useEffect, useState } from 'react';
import {
    Users,
    AlertTriangle,
    Gavel,
    ShieldAlert,
    ChevronRight,
    Loader2,
} from 'lucide-react';

interface LeaderDashboardProps {
    projectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Types for API responses                                            */
/* ------------------------------------------------------------------ */

interface WarRoomProgress {
    area_code: string;
    total_tasks: number;
    completed_tasks: number;
    blocked_tasks: number;
    pct_complete: number;
}

interface WarRoomRedFlag {
    id: string;
    title: string;
    severity: string;
    area_code: string;
    status: string;
}

interface WarRoomDecision {
    id: string;
    title: string;
    area_code: string | null;
    severity: string | null;
    status: string;
    decided_at: string;
}

/* ------------------------------------------------------------------ */
/*  Derived types                                                      */
/* ------------------------------------------------------------------ */

interface TeamMember {
    name: string;
    area: string;
    tasks: number;
    capacity: number;
}

interface RedFlagsSummary {
    total: number;
    critical: number;
    high: number;
    medium: number;
}

interface PendingDecision {
    id: string;
    title: string;
    area: string;
    urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface AtRiskArea {
    area: string;
    label: string;
    slaBreaches: number;
    overdueTasks: number;
}

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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_session_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function deriveTeamWorkload(progress: WarRoomProgress[]): TeamMember[] {
    return progress
        .map((p) => ({
            name: `Area ${p.area_code}`,
            area: p.area_code,
            tasks: p.total_tasks - p.completed_tasks,
            capacity: Math.max(p.total_tasks, 1),
        }))
        .filter((m) => m.tasks > 0 || m.capacity > 0)
        .sort((a, b) => b.tasks - a.tasks)
        .slice(0, 8);
}

function deriveRedFlags(redFlags: WarRoomRedFlag[]): RedFlagsSummary {
    const summary: RedFlagsSummary = { total: redFlags.length, critical: 0, high: 0, medium: 0 };
    for (const rf of redFlags) {
        if (rf.severity === 'critical') summary.critical++;
        else if (rf.severity === 'high') summary.high++;
        else summary.medium++;
    }
    return summary;
}

function derivePendingDecisions(decisions: WarRoomDecision[]): PendingDecision[] {
    return decisions
        .filter((d) => d.status === 'pending' || d.status === 'open')
        .map((d) => ({
            id: d.id,
            title: d.title,
            area: d.area_code || 'GENERAL',
            urgency: (d.severity as PendingDecision['urgency']) || 'medium',
        }))
        .slice(0, 6);
}

function deriveAtRiskAreas(progress: WarRoomProgress[]): AtRiskArea[] {
    return progress
        .filter((p) => p.blocked_tasks > 0 || p.pct_complete < 30)
        .map((p) => ({
            area: p.area_code,
            label: p.area_code,
            slaBreaches: p.blocked_tasks,
            overdueTasks: p.total_tasks - p.completed_tasks,
        }))
        .sort((a, b) => b.slaBreaches - a.slaBreaches)
        .slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderDashboard({ projectId }: LeaderDashboardProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [teamWorkload, setTeamWorkload] = useState<TeamMember[]>([]);
    const [redFlags, setRedFlags] = useState<RedFlagsSummary>({ total: 0, critical: 0, high: 0, medium: 0 });
    const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
    const [atRiskAreas, setAtRiskAreas] = useState<AtRiskArea[]>([]);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        async function loadData() {
            try {
                const warRoomRes = await fetchJSON<{
                    success: boolean;
                    blockers: unknown[];
                    progress: WarRoomProgress[];
                    red_flags: WarRoomRedFlag[];
                    decisions: WarRoomDecision[];
                }>(`/api/war-room/${projectId}`);

                const progress = warRoomRes?.progress || [];
                const rawRedFlags = warRoomRes?.red_flags || [];
                const decisions = warRoomRes?.decisions || [];

                setTeamWorkload(deriveTeamWorkload(progress));
                setRedFlags(deriveRedFlags(rawRedFlags));
                setPendingDecisions(derivePendingDecisions(decisions));
                setAtRiskAreas(deriveAtRiskAreas(progress));

            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [projectId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Panel del CLO
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Vision estrategica del equipo{projectId ? ` — Proyecto ${projectId}` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--g-space-12)' }}>
                    <Loader2 style={{ width: 32, height: 32, color: 'var(--g-brand-3308)', animation: 'spin 1s linear infinite' }} />
                </div>
            </div>
        );
    }

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

            {error && (
                <div style={{
                    padding: 'var(--g-space-3) var(--g-space-4)',
                    backgroundColor: '#fef9ee',
                    borderRadius: 'var(--g-radius-md)',
                    color: 'var(--status-warning)',
                    fontSize: 'var(--g-text-body)',
                }}>
                    Algunos datos no pudieron cargarse. Mostrando informacion parcial.
                </div>
            )}

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
                        {teamWorkload.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin datos de equipo disponibles
                            </p>
                        ) : (
                            teamWorkload.map((member) => {
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
                            })
                        )}
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
                            {redFlags.total}
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
                                            {redFlags[sev]}
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
                            {pendingDecisions.length}
                        </span>
                    </div>

                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {pendingDecisions.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin decisiones pendientes
                            </p>
                        ) : (
                            pendingDecisions.map((item) => {
                                const badge = SEVERITY_BADGE[item.urgency] || SEVERITY_BADGE.medium;
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
                            })
                        )}
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
                        {atRiskAreas.length === 0 ? (
                            <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)', padding: 'var(--g-space-3)' }}>
                                Sin areas en riesgo
                            </p>
                        ) : (
                            atRiskAreas.map((item) => (
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
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
