'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Filter } from 'lucide-react';
import { AREA_COLORS, SEVERITY_CONFIG, KANBAN_STATE_CONFIG, formatDate, useResolvedParams } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AreaTask {
    id: string;
    title: string;
    state: string;
    priority: string;
    assigned_to: string | null;
    updated_at: string;
}

interface AreaContingency {
    id: string;
    title: string;
    severity: string;
    probability: string;
    estimated_amount: number | null;
    status: string;
    recommendation: string | null;
}

interface AreaData {
    area_code: string;
    area_name: string;
    tasks: AreaTask[];
    contingencies: AreaContingency[];
}

/* ------------------------------------------------------------------ */
/*  Config maps                                                        */
/* ------------------------------------------------------------------ */

const PROBABILITY_LABELS: Record<string, string> = {
    certain: 'Cierta',
    probable: 'Probable',
    possible: 'Posible',
    remote: 'Remota',
};

const STATUS_LABELS: Record<string, string> = {
    identified: 'Identificada',
    confirmed: 'Confirmada',
    mitigated: 'Mitigada',
    resolved: 'Resuelta',
    accepted: 'Aceptada',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dd_session_token');
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AreaPage({ params }: { params: Promise<{ id: string; code: string }> }) {
    const { id: projectId, code } = useResolvedParams(params);

    const [data, setData] = useState<AreaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severityFilter, setSeverityFilter] = useState<string>('all');

    /* ---------- Fetch ---------- */

    const fetchArea = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/areas/${code}`, {
                headers: authHeaders(),
            });
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                setError(null);
            } else {
                setError(json.error || 'Error al cargar el area');
            }
        } catch {
            setError('Error de conexion');
        } finally {
            setLoading(false);
        }
    }, [projectId, code]);

    useEffect(() => {
        fetchArea();
    }, [fetchArea]);

    /* ---------- Derived data ---------- */

    const filteredContingencies = data?.contingencies.filter((c) =>
        severityFilter === 'all' ? true : c.severity === severityFilter
    ) ?? [];

    const areaHsl = AREA_COLORS[code] || AREA_COLORS.GENERAL;

    /* ---------- Loading state ---------- */

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <div className="skeleton" style={{ height: '16px', width: '100px', borderRadius: 'var(--g-radius-sm)', marginBottom: '12px' }} />
                    <div className="skeleton" style={{ height: '32px', width: '300px', borderRadius: 'var(--g-radius-md)' }} />
                </div>
                <div className="skeleton" style={{ height: '300px', width: '100%', borderRadius: 'var(--g-radius-lg)' }} />
                <div className="skeleton" style={{ height: '250px', width: '100%', borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    /* ---------- Error state ---------- */

    if (error && !data) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <Link
                        href={`/projects/${projectId}/kanban`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Kanban
                    </Link>
                    <h1
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        Area {code}
                    </h1>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--g-space-8) 0',
                        backgroundColor: 'var(--g-surface-card)',
                        borderRadius: 'var(--g-radius-lg)',
                        border: '1px solid var(--g-border-default)',
                    }}
                >
                    <AlertTriangle className="h-10 w-10 mb-3" style={{ color: 'var(--status-error)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        {error}
                    </p>
                    <Link
                        href={`/projects/${projectId}/kanban`}
                        className="text-sm mt-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        Volver al Kanban
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) return null;

    /* ---------- Render ---------- */

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* ── Header ──────────────────────────────────────────── */}
            <div>
                <Link
                    href={`/projects/${projectId}/kanban`}
                    className="inline-flex items-center gap-1 text-sm mb-3"
                    style={{ color: 'var(--g-link)' }}
                >
                    <ArrowLeft className="h-4 w-4" /> Kanban
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                    <span
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            padding: '4px 12px',
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: `hsla(${areaHsl}, 0.12)`,
                            color: `hsl(${areaHsl})`,
                            letterSpacing: '0.03em',
                        }}
                    >
                        {code}
                    </span>
                    <h1
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        {data.area_name}
                    </h1>
                </div>
            </div>

            {/* ── Contingencies ────────────────────────────────────── */}
            <div
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-lg)',
                    border: '1px solid var(--g-border-default)',
                    padding: 'var(--g-space-5)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--g-space-4)' }}>
                    <h2
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                    >
                        Contingencias
                        <span
                            style={{
                                fontSize: 'var(--g-text-caption)',
                                fontWeight: 400,
                                color: 'var(--g-text-secondary)',
                                marginLeft: 'var(--g-space-2)',
                            }}
                        >
                            ({filteredContingencies.length})
                        </span>
                    </h2>
                    {/* Severity filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <Filter className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            style={{
                                height: '30px',
                                padding: '0 var(--g-space-3)',
                                fontSize: 'var(--g-text-small)',
                                border: '1px solid var(--g-border-default)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            <option value="all">Todas</option>
                            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {filteredContingencies.length === 0 ? (
                    <p
                        style={{
                            textAlign: 'center',
                            padding: 'var(--g-space-6) 0',
                            color: 'var(--g-text-secondary)',
                            fontSize: 'var(--g-text-small)',
                        }}
                    >
                        Sin contingencias{severityFilter !== 'all' ? ` con severidad ${SEVERITY_CONFIG[severityFilter as keyof typeof SEVERITY_CONFIG]?.label || severityFilter}` : ''}.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Titulo
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Severidad
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Probabilidad
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Estado
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Recomendacion
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContingencies.map((c) => {
                                    const sevCfg = SEVERITY_CONFIG[c.severity as keyof typeof SEVERITY_CONFIG];
                                    return (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-primary)', maxWidth: '280px' }}>
                                                {c.title}
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                {sevCfg ? (
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            padding: '2px 8px',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: sevCfg.color,
                                                            color: '#fff',
                                                        }}
                                                    >
                                                        {sevCfg.label}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                        {c.severity}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                {PROBABILITY_LABELS[c.probability] || c.probability}
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                {STATUS_LABELS[c.status] || c.status}
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)', maxWidth: '300px' }}>
                                                {c.recommendation || '\u2014'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Tasks ────────────────────────────────────────────── */}
            <div
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-lg)',
                    border: '1px solid var(--g-border-default)',
                    padding: 'var(--g-space-5)',
                }}
            >
                <h2
                    className="font-bold"
                    style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-4)' }}
                >
                    Tareas
                    <span
                        style={{
                            fontSize: 'var(--g-text-caption)',
                            fontWeight: 400,
                            color: 'var(--g-text-secondary)',
                            marginLeft: 'var(--g-space-2)',
                        }}
                    >
                        ({data.tasks.length})
                    </span>
                </h2>

                {data.tasks.length === 0 ? (
                    <p
                        style={{
                            textAlign: 'center',
                            padding: 'var(--g-space-6) 0',
                            color: 'var(--g-text-secondary)',
                            fontSize: 'var(--g-text-small)',
                        }}
                    >
                        Sin tareas para esta area.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Titulo
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Estado
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Asignado
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                        Actualizado
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tasks.map((t) => {
                                    const stateCfg = KANBAN_STATE_CONFIG[t.state];
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-primary)', maxWidth: '320px' }}>
                                                {t.title}
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                {stateCfg ? (
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            padding: '2px 8px',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-primary)',
                                                        }}
                                                    >
                                                        {stateCfg.label}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                        {t.state}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                {t.assigned_to || '\u2014'}
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>
                                                {formatDate(t.updated_at)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
