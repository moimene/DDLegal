'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Activity, RefreshCw, Clock, AlertTriangle, CheckCircle2,
    XCircle, Zap, Server, Globe, ToggleRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GatewayHealth {
    status: string;
    p95_latency_ms: number;
    rate_limit_429_pct: number;
    requests_last_hour: number;
    active_requests: number;
    feature_flag: string;
}

interface GatewayWhoami {
    service: string;
    version: string;
    endpoint: string;
    history_endpoint: string;
    feature_flag: string;
    region: string;
}

interface SloData {
    total: number;
    period_hours: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    rate_429_pct: number;
    error_rate_pct: number;
    retry_rate_pct: number;
}

interface TelemetryEntry {
    request_id: string;
    endpoint: string;
    method: string;
    status_code: number;
    duration_ms: number;
    retries: number;
    client_matter_id: string;
    feature_flag: string;
    created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SLO_P95_TARGET = 5000;
const REFRESH_INTERVAL = 15_000;
const PERIOD_OPTIONS = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 },
];

type TelemetryFilter = 'all' | '429' | 'errors';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dd_session_token');
}

function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

function formatMs(ms: number | undefined | null): string {
    if (ms == null) return '--';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatPct(pct: number | undefined | null): string {
    if (pct == null) return '--';
    return `${pct.toFixed(2)}%`;
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return iso;
    }
}

function statusColor(code: number): string {
    if (code >= 200 && code < 300) return '#009a77';
    if (code === 429) return '#e6a817';
    if (code >= 400) return '#dc2626';
    return 'var(--g-text-secondary)';
}

function healthColor(status: string): string {
    const s = status?.toLowerCase();
    if (s === 'healthy' || s === 'ok') return '#009a77';
    if (s === 'degraded') return '#e6a817';
    return '#dc2626';
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MetricCard({
    label,
    value,
    sub,
    icon: Icon,
    accent,
    large,
}: {
    label: string;
    value: string;
    sub?: string;
    icon?: typeof Activity;
    accent?: string;
    large?: boolean;
}) {
    return (
        <div
            style={{
                backgroundColor: 'var(--g-surface-card)',
                border: `1px solid ${accent ? accent + '33' : 'var(--g-border-subtle)'}`,
                borderRadius: 'var(--g-radius-lg)',
                padding: 'var(--g-space-5)',
                boxShadow: 'var(--g-shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--g-space-2)',
                minWidth: 0,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                {Icon && (
                    <Icon
                        style={{ width: 16, height: 16, color: accent || 'var(--g-text-muted)', flexShrink: 0 }}
                        aria-hidden="true"
                    />
                )}
                <span
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        fontWeight: 600,
                        color: 'var(--g-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                >
                    {label}
                </span>
            </div>
            <span
                style={{
                    fontSize: large ? 'var(--g-text-display)' : 'var(--g-text-h1)',
                    fontWeight: 700,
                    color: accent || 'var(--g-text-primary)',
                    lineHeight: 'var(--g-leading-tight)',
                }}
            >
                {value}
            </span>
            {sub && (
                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                    {sub}
                </span>
            )}
        </div>
    );
}

function SloGauge({
    label,
    value,
    target,
    unit,
    invert,
}: {
    label: string;
    value: number;
    target: number;
    unit: string;
    invert?: boolean;
}) {
    const ratio = invert
        ? (target > 0 ? Math.min(value / target, 1) : 0)
        : (target > 0 ? Math.min(value / target, 1) : 0);
    const met = invert ? value <= target : value <= target;
    const pct = Math.round(ratio * 100);
    const barColor = met ? '#009a77' : '#dc2626';

    return (
        <div
            style={{
                backgroundColor: 'var(--g-surface-card)',
                border: `1px solid ${met ? '#009a7733' : '#dc262633'}`,
                borderRadius: 'var(--g-radius-lg)',
                padding: 'var(--g-space-5)',
                boxShadow: 'var(--g-shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--g-space-3)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span
                        style={{
                            fontSize: 'var(--g-text-caption)',
                            fontWeight: 600,
                            color: 'var(--g-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {label}
                    </span>
                    <div
                        style={{
                            fontSize: 'var(--g-text-h1)',
                            fontWeight: 700,
                            color: met ? '#009a77' : '#dc2626',
                            lineHeight: 'var(--g-leading-tight)',
                            marginTop: 'var(--g-space-1)',
                        }}
                    >
                        {formatMs(value)}
                    </div>
                </div>
                <span
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        fontWeight: 600,
                        color: met ? '#009a77' : '#dc2626',
                        backgroundColor: met ? 'rgba(0,154,119,0.1)' : 'rgba(220,38,38,0.1)',
                        padding: '2px 8px',
                        borderRadius: 'var(--g-radius-full)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {met ? 'SLO OK' : 'SLO BREACH'}
                </span>
            </div>
            {/* Progress bar */}
            <div>
                <div
                    style={{
                        height: 6,
                        backgroundColor: 'var(--g-surface-muted)',
                        borderRadius: 'var(--g-radius-full)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: barColor,
                            borderRadius: 'var(--g-radius-full)',
                            transition: 'width var(--g-transition-smooth)',
                        }}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 'var(--g-space-1)',
                        fontSize: '10px',
                        color: 'var(--g-text-muted)',
                    }}
                >
                    <span>0{unit}</span>
                    <span>Target: {target}{unit}</span>
                </div>
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: string }) {
    const color = healthColor(status);
    return (
        <span
            style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 'var(--g-radius-full)',
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}66`,
                flexShrink: 0,
            }}
            aria-label={`Status: ${status}`}
        />
    );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function ObservabilityPage() {
    const [health, setHealth] = useState<GatewayHealth | null>(null);
    const [whoami, setWhoami] = useState<GatewayWhoami | null>(null);
    const [slo, setSlo] = useState<SloData | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodHours, setPeriodHours] = useState(24);
    const [telemetryFilter, setTelemetryFilter] = useState<TelemetryFilter>('all');
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    /* ----- Fetch functions ----- */

    const fetchGateway = useCallback(async () => {
        const [h, w] = await Promise.all([
            fetchJson<{ status: string; p95_latency_ms: number; rate_limit_429_pct: number; requests_last_hour: number; active_requests: number; feature_flag: string }>('/api/gateway/health'),
            fetchJson<GatewayWhoami>('/api/gateway/whoami'),
        ]);
        if (h) setHealth(h as GatewayHealth);
        if (w) setWhoami(w);
    }, []);

    const fetchSlo = useCallback(async (hours: number) => {
        const data = await fetchJson<{ slo: SloData }>(`/api/observability/slo?hours=${hours}`);
        if (data?.slo) setSlo(data.slo);
    }, []);

    const fetchTelemetry = useCallback(async (filter: TelemetryFilter) => {
        let url = '/api/observability/telemetry?limit=50';
        if (filter === '429') url += '&status=429';
        else if (filter === 'errors') url += '&status=error';
        const data = await fetchJson<{ telemetry: TelemetryEntry[] }>(url);
        if (data?.telemetry) setTelemetry(data.telemetry);
    }, []);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            fetchGateway(),
            fetchSlo(periodHours),
            fetchTelemetry(telemetryFilter),
        ]);
        setLastRefresh(new Date());
        setLoading(false);
    }, [fetchGateway, fetchSlo, fetchTelemetry, periodHours, telemetryFilter]);

    /* ----- Effects ----- */

    useEffect(() => {
        refreshAll();
        const id = setInterval(refreshAll, REFRESH_INTERVAL);
        return () => clearInterval(id);
    }, [refreshAll]);

    /* When period changes, refetch SLO */
    const handlePeriodChange = (hours: number) => {
        setPeriodHours(hours);
    };

    /* When telemetry filter changes, refetch */
    const handleTelemetryFilter = (filter: TelemetryFilter) => {
        setTelemetryFilter(filter);
    };

    /* ----- Loading state ----- */

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-10 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton h-24" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-32" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    const sloMet = slo ? slo.p95_ms <= SLO_P95_TARGET : true;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}>
            {/* ========== Header ========== */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--g-space-4)' }}>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Activity className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                            Observabilidad
                        </h1>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                        Estado del gateway, metricas SLO y telemetria en tiempo real.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                        Auto-refresh 15s &middot; {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <button
                        onClick={() => refreshAll()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--g-space-2)',
                            padding: '6px 12px',
                            fontSize: 'var(--g-text-caption)',
                            fontWeight: 600,
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                            cursor: 'pointer',
                            transition: 'all var(--g-transition-fast)',
                        }}
                        aria-label="Refrescar datos"
                    >
                        <RefreshCw style={{ width: 14, height: 14 }} aria-hidden="true" />
                        Refrescar
                    </button>
                </div>
            </div>

            {/* ========== Section 1: Gateway Status ========== */}
            <div>
                <h2
                    className="font-bold mb-3"
                    style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                >
                    Estado del Gateway
                </h2>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    {/* Status */}
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            border: '1px solid var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-lg)',
                            padding: 'var(--g-space-5)',
                            boxShadow: 'var(--g-shadow-card)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--g-space-2)',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 'var(--g-text-caption)',
                                fontWeight: 600,
                                color: 'var(--g-text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}
                        >
                            Estado
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                            <StatusDot status={health?.status || 'unknown'} />
                            <span
                                style={{
                                    fontSize: 'var(--g-text-h2)',
                                    fontWeight: 700,
                                    color: healthColor(health?.status || 'unknown'),
                                    textTransform: 'capitalize',
                                }}
                            >
                                {health?.status || 'Unknown'}
                            </span>
                        </div>
                    </div>

                    {/* Feature Flag */}
                    <MetricCard
                        label="Feature Flag"
                        value={health?.feature_flag || whoami?.feature_flag || '--'}
                        icon={ToggleRight}
                        accent="var(--g-brand-bright)"
                    />

                    {/* Active Requests */}
                    <MetricCard
                        label="Peticiones Activas"
                        value={health?.active_requests?.toString() || '0'}
                        icon={Zap}
                    />

                    {/* Requests/hour */}
                    <MetricCard
                        label="Peticiones / Hora"
                        value={health?.requests_last_hour?.toString() || '0'}
                        icon={Server}
                    />

                    {/* Region */}
                    <MetricCard
                        label="Region"
                        value={whoami?.region || '--'}
                        sub={whoami?.version ? `v${whoami.version}` : undefined}
                        icon={Globe}
                    />
                </div>
            </div>

            {/* ========== Section 2: SLO Metrics ========== */}
            <div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 'var(--g-space-3)',
                        marginBottom: 'var(--g-space-4)',
                    }}
                >
                    <h2
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                    >
                        Metricas SLO
                    </h2>
                    {/* Period selector */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.hours}
                                onClick={() => handlePeriodChange(opt.hours)}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: 'var(--g-text-caption)',
                                    fontWeight: 600,
                                    borderRadius: 'var(--g-radius-full)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all var(--g-transition-fast)',
                                    backgroundColor:
                                        periodHours === opt.hours
                                            ? 'var(--g-brand-3308)'
                                            : 'var(--g-surface-muted)',
                                    color:
                                        periodHours === opt.hours
                                            ? 'var(--g-text-inverse)'
                                            : 'var(--g-text-primary)',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Latency gauges */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 'var(--g-space-4)',
                        marginBottom: 'var(--g-space-4)',
                    }}
                >
                    <SloGauge
                        label="P50 Latencia"
                        value={slo?.p50_ms ?? 0}
                        target={SLO_P95_TARGET}
                        unit="ms"
                    />
                    <SloGauge
                        label="P95 Latencia (SLO)"
                        value={slo?.p95_ms ?? 0}
                        target={SLO_P95_TARGET}
                        unit="ms"
                    />
                    <SloGauge
                        label="P99 Latencia"
                        value={slo?.p99_ms ?? 0}
                        target={SLO_P95_TARGET}
                        unit="ms"
                    />
                </div>

                {/* Rate cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    <MetricCard
                        label="Tasa 429 (Rate Limit)"
                        value={formatPct(slo?.rate_429_pct)}
                        icon={AlertTriangle}
                        accent={slo && slo.rate_429_pct > 5 ? '#dc2626' : slo && slo.rate_429_pct > 1 ? '#e6a817' : '#009a77'}
                    />
                    <MetricCard
                        label="Tasa de Error"
                        value={formatPct(slo?.error_rate_pct)}
                        icon={XCircle}
                        accent={slo && slo.error_rate_pct > 5 ? '#dc2626' : slo && slo.error_rate_pct > 1 ? '#e6a817' : '#009a77'}
                    />
                    <MetricCard
                        label="Tasa de Reintentos"
                        value={formatPct(slo?.retry_rate_pct)}
                        icon={RefreshCw}
                        accent={slo && slo.retry_rate_pct > 10 ? '#dc2626' : slo && slo.retry_rate_pct > 3 ? '#e6a817' : '#009a77'}
                    />
                    <MetricCard
                        label="Total Peticiones"
                        value={slo?.total?.toLocaleString('es-ES') ?? '0'}
                        sub={`Periodo: ${PERIOD_OPTIONS.find(o => o.hours === periodHours)?.label || periodHours + 'h'}`}
                        icon={CheckCircle2}
                        accent="var(--g-brand-3308)"
                    />
                </div>
            </div>

            {/* ========== Section 3: Recent Telemetry ========== */}
            <div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 'var(--g-space-3)',
                        marginBottom: 'var(--g-space-4)',
                    }}
                >
                    <h2
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}
                    >
                        Telemetria Reciente
                    </h2>
                    {/* Telemetry filter */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {([
                            { key: 'all' as TelemetryFilter, label: 'Todas' },
                            { key: '429' as TelemetryFilter, label: '429 Only' },
                            { key: 'errors' as TelemetryFilter, label: 'Errores' },
                        ]).map((opt) => (
                            <button
                                key={opt.key}
                                onClick={() => handleTelemetryFilter(opt.key)}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: 'var(--g-text-caption)',
                                    fontWeight: 600,
                                    borderRadius: 'var(--g-radius-full)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all var(--g-transition-fast)',
                                    backgroundColor:
                                        telemetryFilter === opt.key
                                            ? 'var(--g-brand-3308)'
                                            : 'var(--g-surface-muted)',
                                    color:
                                        telemetryFilter === opt.key
                                            ? 'var(--g-text-inverse)'
                                            : 'var(--g-text-primary)',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {telemetry.length === 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--g-space-12) var(--g-space-6)',
                            border: '1px dashed var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                        }}
                    >
                        <Clock style={{ width: 32, height: 32, color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                        <p style={{ fontSize: 'var(--g-text-body)', color: 'var(--g-text-secondary)' }}>
                            No hay registros de telemetria para este filtro.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            border: '1px solid var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                            boxShadow: 'var(--g-shadow-card)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ overflowX: 'auto' }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 'var(--g-text-body)',
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            borderBottom: '1px solid var(--g-border-subtle)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                        }}
                                    >
                                        {['Hora', 'Endpoint', 'Status', 'Duracion', 'Reintentos', 'Client Matter'].map(
                                            (col) => (
                                                <th
                                                    key={col}
                                                    style={{
                                                        padding: '10px 16px',
                                                        textAlign: 'left',
                                                        fontSize: 'var(--g-text-caption)',
                                                        fontWeight: 700,
                                                        color: 'var(--g-text-secondary)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {col}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {telemetry.map((entry) => (
                                        <tr
                                            key={entry.request_id}
                                            style={{
                                                borderBottom: '1px solid var(--g-border-subtle)',
                                                transition: 'background var(--g-transition-fast)',
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--g-surface-hover)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                                            }}
                                        >
                                            <td
                                                style={{
                                                    padding: '10px 16px',
                                                    whiteSpace: 'nowrap',
                                                    color: 'var(--g-text-secondary)',
                                                    fontSize: 'var(--g-text-small)',
                                                }}
                                            >
                                                {formatTime(entry.created_at)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 16px',
                                                    color: 'var(--g-text-primary)',
                                                    fontWeight: 500,
                                                    fontSize: 'var(--g-text-small)',
                                                    maxWidth: 280,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title={entry.endpoint}
                                            >
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        marginRight: 6,
                                                        padding: '1px 5px',
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'var(--g-surface-muted)',
                                                        color: 'var(--g-text-secondary)',
                                                    }}
                                                >
                                                    {entry.method}
                                                </span>
                                                {entry.endpoint}
                                            </td>
                                            <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        fontSize: 'var(--g-text-small)',
                                                        fontWeight: 700,
                                                        color: statusColor(entry.status_code),
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 7,
                                                            height: 7,
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: statusColor(entry.status_code),
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    {entry.status_code}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 16px',
                                                    whiteSpace: 'nowrap',
                                                    color: 'var(--g-text-primary)',
                                                    fontSize: 'var(--g-text-small)',
                                                    fontWeight: 500,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {formatMs(entry.duration_ms)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 16px',
                                                    whiteSpace: 'nowrap',
                                                    color: entry.retries > 0 ? '#e6a817' : 'var(--g-text-muted)',
                                                    fontSize: 'var(--g-text-small)',
                                                    fontWeight: entry.retries > 0 ? 600 : 400,
                                                }}
                                            >
                                                {entry.retries}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 16px',
                                                    color: 'var(--g-text-secondary)',
                                                    fontSize: 'var(--g-text-small)',
                                                    maxWidth: 160,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title={entry.client_matter_id || undefined}
                                            >
                                                {entry.client_matter_id || '--'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
