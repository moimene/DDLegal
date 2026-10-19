'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getCachedDateTimeFormat,  useResolvedParams } from '@/lib/utils';
import Link from 'next/link';
import {
    ArrowLeft, RefreshCw, Download, Shield, AlertTriangle, TrendingUp,
    Clock, ArrowRightCircle,
    Bell, Activity, FileText, Scale,
    ChevronDown, Filter, Loader2, AlertOctagon, Gavel,
    ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    DECISION_TYPE_CONFIG, SEVERITY_CONFIG,
    AREA_COLORS, formatCurrency, formatDate,
} from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RedFlag {
    id: string;
    source: 'alert' | 'contingency';
    title: string;
    severity: string;
    area_code: string | null;
    status: string;
    impact: string | null;
    evidence: string[];
    recommendation: string | null;
    created_at: string;
    actions: string[];
}

interface DashboardData {
    red_flags: Array<{
        id: string;
        title: string;
        severity: string;
        area_code: string | null;
        status: string;
        evidence: string[];
        recommendation: string | null;
    }>;
    blockers: Array<{
        id: string;
        title: string;
        area_code: string;
        state: string;
        entered_state_at: string;
        assigned_to: string | null;
    }>;
    progress: Array<{
        area_code: string;
        total_tasks: number;
        completed_tasks: number;
        blocked_tasks: number;
        pct_complete: number;
    }>;
    decisions: Array<Record<string, unknown>>;
    notifications: Array<Record<string, unknown>>;
}

interface TimelineEvent {
    timestamp: string;
    event_type: 'decision' | 'action_proposed' | 'action_status_change' | 'notification' | 'severity_change';
    title: string;
    description: string | null;
    severity: string | null;
    actor: string | null;
    linked_finding: string | null;
    linked_action: string | null;
    linked_decision: string | null;
    metadata?: Record<string, unknown>;
}

interface SPAClause {
    clause_id: string;
    clause_key: string | null;
    clause_title: string | null;
    clause_type: string | null;
    actions: Array<{
        id: string;
        action_type: string;
        title: string;
        status: string;
        economic_impact_amount: number | null;
        economic_impact_currency: string;
        finding_ref: string | null;
        contingency_id: string | null;
    }>;
    linked_findings: Array<{
        id: string;
        title: string;
        severity: string;
        area_code: string | null;
        estimated_amount: number | null;
    }>;
    coverage_status: 'fully_covered' | 'partially_covered' | 'uncovered';
}

interface UncoveredFinding {
    id: string;
    title: string;
    severity: string;
    area_code: string | null;
    probability: string | null;
    estimated_amount: number | null;
    status: string;
}

interface SPAMappingData {
    spa_clauses: SPAClause[];
    uncovered_findings: UncoveredFinding[];
    coverage_pct: number;
    total_contingencies: number;
    covered_contingencies: number;
    total_economic_exposure: number;
    total_proposed_mitigation: number;
}

interface DecisionResolution {
    id: string;
    project_id: string;
    decision_type: string;
    title: string;
    rationale: string | null;
    contingency_id: string | null;
    alert_id: string | null;
    decided_by: string | null;
    decided_at: string;
    client_visible: boolean;
    metadata: Record<string, unknown>;
    resolution: {
        status: string;
        evidence_refs: Array<{ source_id: string; document_name: string; snippet?: string }>;
        evidence_count: number;
        resolution_notes: string | null;
        resolved_at: string | null;
    };
}

interface DecisionResolutionData {
    decisions: DecisionResolution[];
    summary: {
        total: number;
        resolved: number;
        partially_resolved: number;
        unresolved: number;
    };
}

/* ------------------------------------------------------------------ */
/*  Color maps                                                         */
/* ------------------------------------------------------------------ */

const SEVERITY_COLOR_MAP: Record<string, { bg: string; fg: string; border: string }> = {
    critical: { bg: 'hsl(0, 72%, 96%)', fg: 'hsl(0, 72%, 51%)', border: 'hsl(0, 72%, 85%)' },
    high: { bg: 'hsl(25, 95%, 96%)', fg: 'hsl(25, 95%, 45%)', border: 'hsl(25, 95%, 85%)' },
    medium: { bg: 'hsl(38, 92%, 96%)', fg: 'hsl(38, 92%, 40%)', border: 'hsl(38, 92%, 85%)' },
    low: { bg: 'hsl(160, 100%, 96%)', fg: 'hsl(160, 100%, 25%)', border: 'hsl(160, 100%, 85%)' },
};

const RESOLUTION_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    resolved: { label: 'Resuelta', bg: 'hsl(160, 100%, 95%)', fg: 'hsl(160, 100%, 25%)' },
    partially_resolved: { label: 'Parcial', bg: 'hsl(38, 92%, 95%)', fg: 'hsl(38, 92%, 35%)' },
    unresolved: { label: 'Sin resolver', bg: 'hsl(0, 72%, 96%)', fg: 'hsl(0, 72%, 45%)' },
};

const COVERAGE_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    fully_covered: { label: 'Cubierta', bg: 'hsl(160, 100%, 95%)', fg: 'hsl(160, 100%, 25%)' },
    partially_covered: { label: 'Parcial', bg: 'hsl(38, 92%, 95%)', fg: 'hsl(38, 92%, 35%)' },
    uncovered: { label: 'Sin cubrir', bg: 'hsl(0, 72%, 96%)', fg: 'hsl(0, 72%, 45%)' },
};

const EVENT_TYPE_ICONS: Record<string, typeof Gavel> = {
    decision: Gavel,
    action_proposed: ArrowRightCircle,
    action_status_change: Activity,
    notification: Bell,
    severity_change: AlertTriangle,
};

const EVENT_TYPE_COLORS: Record<string, string> = {
    decision: '#8B5CF6',
    action_proposed: 'var(--status-info)',
    action_status_change: 'var(--status-warning)',
    notification: 'var(--g-brand-3308)',
    severity_change: 'var(--status-error)',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    decision: 'Decision',
    action_proposed: 'Accion',
    action_status_change: 'Cambio estado',
    notification: 'Notificacion',
    severity_change: 'Severidad',
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

function formatDateTime(ts: string): string {
    return getCachedDateTimeFormat('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
}

function relativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

/* ------------------------------------------------------------------ */
/*  Tabs config                                                        */
/* ------------------------------------------------------------------ */

type TabKey = 'dashboard' | 'timeline' | 'spa' | 'resolutions';

const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
    { key: 'dashboard', label: 'Panel de Control', icon: Shield },
    { key: 'timeline', label: 'Cronologia', icon: Clock },
    { key: 'spa', label: 'Cobertura SPA', icon: FileText },
    { key: 'resolutions', label: 'Resoluciones', icon: Scale },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function WarRoomPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = useResolvedParams(params);

    const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
    const [loading, setLoading] = useState(true);

    // Dashboard state
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [redFlags, setRedFlags] = useState<RedFlag[]>([]);

    // Timeline state
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [timelineTotal, setTimelineTotal] = useState(0);
    const [timelineFilter, setTimelineFilter] = useState<string>('all');
    const [timelineLimit, setTimelineLimit] = useState(50);
    const [timelineLoading, setTimelineLoading] = useState(false);

    // SPA Mapping state
    const [spaMapping, setSpaMapping] = useState<SPAMappingData | null>(null);

    // Decision Resolution state
    const [decisionRes, setDecisionRes] = useState<DecisionResolutionData | null>(null);

    // Decision modal state
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [decisionTarget, setDecisionTarget] = useState<{ id: string; title: string; source: 'contingency' | 'alert' } | null>(null);
    const [decisionType, setDecisionType] = useState('accept_risk');
    const [decisionRationale, setDecisionRationale] = useState('');
    const [submittingDecision, setSubmittingDecision] = useState(false);

    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    /* ---------- Fetch functions ---------- */

    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch(`/api/war-room/${projectId}`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setDashboard(data);
            }
        } catch { /* silent */ }
    }, [projectId]);

    const fetchRedFlags = useCallback(async () => {
        try {
            const res = await fetch(`/api/war-room/${projectId}/red-flags`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setRedFlags(data.red_flags || []);
            }
        } catch { /* silent */ }
    }, [projectId]);

    const fetchTimeline = useCallback(async (limit: number, type: string) => {
        setTimelineLoading(true);
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (type !== 'all') params.set('type', type);
            const res = await fetch(`/api/war-room/${projectId}/timeline?${params}`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setTimeline(data.timeline || []);
                setTimelineTotal(data.total_events || 0);
            }
        } catch { /* silent */ }
        setTimelineLoading(false);
    }, [projectId]);

    const fetchSPAMapping = useCallback(async () => {
        try {
            const res = await fetch(`/api/war-room/${projectId}/spa-mapping`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setSpaMapping({
                    spa_clauses: data.spa_clauses || [],
                    uncovered_findings: data.uncovered_findings || [],
                    coverage_pct: data.coverage_pct || 0,
                    total_contingencies: data.total_contingencies || 0,
                    covered_contingencies: data.covered_contingencies || 0,
                    total_economic_exposure: data.total_economic_exposure || 0,
                    total_proposed_mitigation: data.total_proposed_mitigation || 0,
                });
            }
        } catch { /* silent */ }
    }, [projectId]);

    const fetchDecisionResolution = useCallback(async () => {
        try {
            const res = await fetch(`/api/war-room/${projectId}/decision-resolution`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setDecisionRes({
                    decisions: data.decisions || [],
                    summary: data.summary || { total: 0, resolved: 0, partially_resolved: 0, unresolved: 0 },
                });
            }
        } catch { /* silent */ }
    }, [projectId]);

    const fetchAll = useCallback(async () => {
        await Promise.all([
            fetchDashboard(),
            fetchRedFlags(),
            fetchTimeline(timelineLimit, timelineFilter),
            fetchSPAMapping(),
            fetchDecisionResolution(),
        ]);
        setLoading(false);
    }, [fetchDashboard, fetchRedFlags, fetchTimeline, fetchSPAMapping, fetchDecisionResolution, timelineLimit, timelineFilter]);

    useEffect(() => {
        fetchAll();
        refreshTimerRef.current = setInterval(fetchAll, 60000);
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [fetchAll]);

    // Refetch timeline when filter/limit changes
    useEffect(() => {
        if (!loading) {
            fetchTimeline(timelineLimit, timelineFilter);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timelineFilter, timelineLimit]);

    /* ---------- Decision submit ---------- */

    const handleSubmitDecision = async () => {
        if (!decisionTarget) return;
        setSubmittingDecision(true);
        try {
            const body: Record<string, unknown> = {
                decision_type: decisionType,
                title: decisionTarget.title,
                rationale: decisionRationale || null,
            };
            if (decisionTarget.source === 'contingency') {
                body.contingency_id = decisionTarget.id;
            } else {
                body.alert_id = decisionTarget.id;
            }

            const res = await fetch(`/api/war-room/${projectId}/decisions`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Decision registrada correctamente');
                setShowDecisionModal(false);
                setDecisionRationale('');
                setDecisionType('accept_risk');
                setDecisionTarget(null);
                fetchAll();
            } else {
                toast.error(data.error || 'Error al registrar decision');
            }
        } catch {
            toast.error('Error de conexion');
        } finally {
            setSubmittingDecision(false);
        }
    };

    /* ---------- Export ---------- */

    const handleExport = async () => {
        try {
            const res = await fetch(`/api/war-room/${projectId}/export`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ format: 'json' }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `war-room-export-${projectId}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Exportacion completada');
            } else {
                toast.error('Error al exportar');
            }
        } catch {
            toast.error('Error de conexion');
        }
    };

    /* ---------- Loading skeleton ---------- */

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-12 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    /* ---------- Computed metrics ---------- */

    const totalDecisions = dashboard?.decisions?.length || 0;
    const criticalFlags = redFlags.filter(f => f.severity === 'critical').length;
    const coveragePct = spaMapping?.coverage_pct || 0;
    const totalExposure = spaMapping?.total_economic_exposure || 0;

    /* ---------- Render ---------- */

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <Link
                        href={`/projects/${projectId}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1
                        className="font-bold"
                        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
                    >
                        War Room
                    </h1>
                    <p style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)', marginTop: '2px' }}>
                        Centro de decisiones y negociacion
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                    <button
                        onClick={() => fetchAll()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            color: 'var(--g-text-secondary)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                    </button>
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            color: 'var(--g-text-secondary)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <Download className="h-3.5 w-3.5" /> Exportar
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div
                style={{
                    display: 'flex',
                    gap: '2px',
                    borderBottom: '2px solid var(--g-border-default)',
                    paddingBottom: '0',
                }}
            >
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-md) var(--g-radius-md) 0 0',
                                border: 'none',
                                borderBottom: isActive ? '2px solid var(--g-brand-3308)' : '2px solid transparent',
                                backgroundColor: isActive ? 'var(--g-surface-card)' : 'transparent',
                                color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                cursor: 'pointer',
                                marginBottom: '-2px',
                                transition: 'color var(--g-transition-fast), border-color var(--g-transition-fast)',
                            }}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'dashboard' && (
                    <DashboardTab
                        dashboard={dashboard}
                        redFlags={redFlags}
                        totalDecisions={totalDecisions}
                        criticalFlags={criticalFlags}
                        coveragePct={coveragePct}
                        totalExposure={totalExposure}
                        onDecide={(target) => {
                            setDecisionTarget(target);
                            setShowDecisionModal(true);
                        }}
                    />
                )}
                {activeTab === 'timeline' && (
                    <TimelineTab
                        timeline={timeline}
                        total={timelineTotal}
                        filter={timelineFilter}
                        onFilterChange={setTimelineFilter}
                        limit={timelineLimit}
                        onLoadMore={() => setTimelineLimit(prev => prev + 50)}
                        loading={timelineLoading}
                    />
                )}
                {activeTab === 'spa' && (
                    <SPAMappingTab data={spaMapping} />
                )}
                {activeTab === 'resolutions' && (
                    <ResolutionsTab data={decisionRes} />
                )}
            </div>

            {/* Decision Modal */}
            {showDecisionModal && decisionTarget && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 50,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                    }}
                    onClick={() => setShowDecisionModal(false)}
                >
                    <div
                        className="g-card animate-scale-in"
                        style={{
                            padding: 'var(--g-space-6)',
                            width: '100%', maxWidth: '520px',
                            borderRadius: 'var(--g-radius-xl)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            className="font-bold"
                            style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-2)' }}
                        >
                            Registrar Decision
                        </h3>
                        <p style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)', marginBottom: 'var(--g-space-5)' }}>
                            {decisionTarget.title}
                        </p>

                        {/* Decision type grid */}
                        <label
                            className="block text-xs font-medium mb-2"
                            style={{ color: 'var(--g-text-primary)' }}
                        >
                            Tipo de decision
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-2)', marginBottom: 'var(--g-space-4)' }}>
                            {Object.entries(DECISION_TYPE_CONFIG).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    onClick={() => setDecisionType(key)}
                                    style={{
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: decisionType === key ? `2px solid ${cfg.color}` : '1px solid var(--g-border-default)',
                                        backgroundColor: decisionType === key ? `${cfg.color}10` : 'var(--g-surface-card)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontSize: 'var(--g-text-small)', fontWeight: 600, color: cfg.color, display: 'block' }}>
                                        {cfg.label}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', display: 'block', marginTop: '2px' }}>
                                        {cfg.description}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Rationale */}
                        <label
                            className="block text-xs font-medium mb-1"
                            style={{ color: 'var(--g-text-primary)' }}
                        >
                            Justificacion
                        </label>
                        <textarea
                            value={decisionRationale}
                            onChange={e => setDecisionRationale(e.target.value)}
                            placeholder="Detalle la justificacion de esta decision..."
                            rows={3}
                            className="w-full"
                            style={{
                                padding: 'var(--g-space-2) var(--g-space-3)',
                                fontSize: 'var(--g-text-body)',
                                border: '1px solid var(--g-border-default)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)',
                                resize: 'vertical',
                            }}
                        />

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-2)', marginTop: 'var(--g-space-5)' }}>
                            <button
                                onClick={() => setShowDecisionModal(false)}
                                className="px-4 py-2 text-sm border"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    borderColor: 'var(--g-border-default)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitDecision}
                                disabled={submittingDecision}
                                className="px-4 py-2 text-sm font-medium"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-brand-3308)',
                                    color: 'var(--g-text-inverse)',
                                    border: 'none',
                                    cursor: submittingDecision ? 'not-allowed' : 'pointer',
                                    opacity: submittingDecision ? 0.5 : 1,
                                }}
                            >
                                {submittingDecision ? 'Registrando...' : 'Registrar decision'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Tab 1: Panel de Control (Dashboard)                                */
/* ================================================================== */

function DashboardTab({
    dashboard,
    redFlags,
    totalDecisions,
    criticalFlags,
    coveragePct,
    totalExposure,
    onDecide,
}: {
    dashboard: DashboardData | null;
    redFlags: RedFlag[];
    totalDecisions: number;
    criticalFlags: number;
    coveragePct: number;
    totalExposure: number;
    onDecide: (target: { id: string; title: string; source: 'contingency' | 'alert' }) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                <SummaryCard
                    icon={<Gavel className="h-5 w-5" />}
                    label="Total decisiones"
                    value={String(totalDecisions)}
                    color="var(--g-brand-3308)"
                />
                <SummaryCard
                    icon={<AlertOctagon className="h-5 w-5" />}
                    label="Red flags criticos"
                    value={String(criticalFlags)}
                    color="var(--status-error)"
                    highlight={criticalFlags > 0}
                />
                <SummaryCard
                    icon={<ShieldCheck className="h-5 w-5" />}
                    label="Cobertura SPA"
                    value={`${coveragePct}%`}
                    color={coveragePct >= 80 ? 'var(--status-success)' : coveragePct >= 50 ? 'var(--status-warning)' : 'var(--status-error)'}
                />
                <SummaryCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Impacto economico"
                    value={formatCurrency(totalExposure)}
                    color="var(--status-error)"
                />
            </div>

            {/* Progress by area */}
            {dashboard?.progress && dashboard.progress.length > 0 && (
                <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                    <h3 style={{ fontSize: 'var(--g-text-h4)', fontWeight: 700, color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-4)' }}>
                        Progreso por Area
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--g-space-3)' }}>
                        {dashboard.progress.map(p => {
                            const areaHsl = AREA_COLORS[p.area_code] || AREA_COLORS.GENERAL;
                            return (
                                <div key={p.area_code} style={{ padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-subtle)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--g-space-2)' }}>
                                        <span style={{
                                            fontSize: 'var(--g-text-small)', fontWeight: 600,
                                            padding: '1px 8px', borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: `hsla(${areaHsl}, 0.12)`, color: `hsl(${areaHsl})`,
                                        }}>
                                            {p.area_code}
                                        </span>
                                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>
                                            {p.pct_complete}%
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: '6px', borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${p.pct_complete}%`,
                                            borderRadius: 'var(--g-radius-full)', backgroundColor: `hsl(${areaHsl})`,
                                            transition: 'width var(--g-transition-smooth)',
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--g-space-1)', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                        <span>{p.completed_tasks}/{p.total_tasks} tareas</span>
                                        {p.blocked_tasks > 0 && (
                                            <span style={{ color: 'var(--status-error)' }}>{p.blocked_tasks} bloq.</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Red flags list */}
            <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--g-space-4)' }}>
                    <h3 style={{ fontSize: 'var(--g-text-h4)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        Red Flags ({redFlags.length})
                    </h3>
                </div>

                {redFlags.length === 0 ? (
                    <EmptyState message="Sin red flags activos" icon={<ShieldCheck className="h-8 w-8" />} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                        {redFlags.map(flag => {
                            const sevColors = SEVERITY_COLOR_MAP[flag.severity] || SEVERITY_COLOR_MAP.medium;
                            const sevConfig = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG];
                            return (
                                <div
                                    key={flag.id}
                                    style={{
                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: `1px solid ${sevColors.border}`,
                                        backgroundColor: sevColors.bg,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--g-space-3)',
                                    }}
                                >
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: sevColors.fg }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBottom: '2px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 700, padding: '1px 6px',
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: sevColors.fg, color: '#fff',
                                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                            }}>
                                                {sevConfig?.label || flag.severity}
                                            </span>
                                            {flag.area_code && (
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: `hsla(${AREA_COLORS[flag.area_code] || AREA_COLORS.GENERAL}, 0.15)`,
                                                    color: `hsl(${AREA_COLORS[flag.area_code] || AREA_COLORS.GENERAL})`,
                                                }}>
                                                    {flag.area_code}
                                                </span>
                                            )}
                                            <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                                {flag.source === 'alert' ? 'Alerta' : 'Contingencia'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 'var(--g-text-small)', fontWeight: 500, color: 'var(--g-text-primary)', marginBottom: '4px' }}>
                                            {flag.title}
                                        </p>
                                        {flag.recommendation && (
                                            <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>
                                                {flag.recommendation}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onDecide({ id: flag.id, title: flag.title, source: flag.source })}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium shrink-0"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-brand-3308)',
                                            color: 'var(--g-text-inverse)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <Gavel className="h-3 w-3" /> Decidir
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Blockers */}
            {dashboard?.blockers && dashboard.blockers.length > 0 && (
                <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                    <h3 style={{ fontSize: 'var(--g-text-h4)', fontWeight: 700, color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-4)' }}>
                        Tareas Bloqueadas ({dashboard.blockers.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                        {dashboard.blockers.map(b => {
                            const days = Math.floor((Date.now() - new Date(b.entered_state_at).getTime()) / (1000 * 60 * 60 * 24));
                            const areaHsl = AREA_COLORS[b.area_code] || AREA_COLORS.GENERAL;
                            return (
                                <div
                                    key={b.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: '1px solid var(--g-border-subtle)',
                                    }}
                                >
                                    <AlertOctagon className="h-4 w-4 shrink-0" style={{ color: 'var(--status-error)' }} />
                                    <span style={{
                                        fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: `hsla(${areaHsl}, 0.12)`, color: `hsl(${areaHsl})`,
                                    }}>
                                        {b.area_code}
                                    </span>
                                    <span style={{ flex: 1, fontSize: 'var(--g-text-small)', color: 'var(--g-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {b.title}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: days > 3 ? 'var(--status-error)' : 'var(--g-text-muted)', fontWeight: days > 3 ? 600 : 400 }}>
                                        {days}d bloqueada
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {b.assigned_to || 'Sin asignar'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Tab 2: Cronologia (Timeline)                                       */
/* ================================================================== */

function TimelineTab({
    timeline,
    total,
    filter,
    onFilterChange,
    limit,
    onLoadMore,
    loading,
}: {
    timeline: TimelineEvent[];
    total: number;
    filter: string;
    onFilterChange: (f: string) => void;
    limit: number;
    onLoadMore: () => void;
    loading: boolean;
}) {
    const filterOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'decision', label: 'Decisiones' },
        { value: 'action_proposed', label: 'Acciones' },
        { value: 'action_status_change', label: 'Cambios estado' },
        { value: 'notification', label: 'Notificaciones' },
        { value: 'severity_change', label: 'Severidad' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', flexWrap: 'wrap' }}>
                <Filter className="h-4 w-4" style={{ color: 'var(--g-text-muted)' }} />
                {filterOptions.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => onFilterChange(opt.value)}
                        className="px-3 py-1 text-xs font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-full)',
                            border: filter === opt.value ? '1px solid var(--g-brand-3308)' : '1px solid var(--g-border-default)',
                            backgroundColor: filter === opt.value ? 'var(--g-surface-subtle)' : 'var(--g-surface-card)',
                            color: filter === opt.value ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all var(--g-transition-fast)',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', marginLeft: 'auto' }}>
                    {total} eventos
                </span>
            </div>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--g-space-6)' }}>
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
                </div>
            )}

            {!loading && timeline.length === 0 ? (
                <EmptyState message="Sin eventos en la cronologia" icon={<Clock className="h-8 w-8" />} />
            ) : !loading && (
                <div style={{ position: 'relative', paddingLeft: 'var(--g-space-8)' }}>
                    {/* Vertical line */}
                    <div style={{
                        position: 'absolute', left: '15px', top: '8px', bottom: '8px',
                        width: '2px', backgroundColor: 'var(--g-border-default)',
                    }} />

                    {timeline.map((event, idx) => {
                        const Icon = EVENT_TYPE_ICONS[event.event_type] || Bell;
                        const color = EVENT_TYPE_COLORS[event.event_type] || 'var(--g-text-muted)';
                        const typeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type;

                        return (
                            <div
                                key={idx}
                                style={{
                                    position: 'relative',
                                    paddingBottom: 'var(--g-space-4)',
                                    paddingLeft: 'var(--g-space-4)',
                                }}
                            >
                                {/* Dot */}
                                <div style={{
                                    position: 'absolute', left: '-25px', top: '4px',
                                    width: '24px', height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--g-surface-card)',
                                    border: `2px solid ${color}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    zIndex: 1,
                                }}>
                                    <Icon className="h-3 w-3" style={{ color }} />
                                </div>

                                {/* Content */}
                                <div
                                    className="g-card"
                                    style={{
                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                        borderRadius: 'var(--g-radius-md)',
                                        borderLeft: `3px solid ${color}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: `${color}15`, color,
                                        }}>
                                            {typeLabel}
                                        </span>
                                        {event.severity && (
                                            <SeverityBadge severity={event.severity} />
                                        )}
                                        {!!event.metadata?.decision_type && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: 500, padding: '1px 6px',
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
                                            }}>
                                                {DECISION_TYPE_CONFIG[String(event.metadata.decision_type)]?.label || String(event.metadata.decision_type)}
                                            </span>
                                        )}
                                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', marginLeft: 'auto' }}>
                                            {relativeTime(event.timestamp)}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 'var(--g-text-small)', fontWeight: 500, color: 'var(--g-text-primary)' }}>
                                        {event.title}
                                    </p>
                                    {event.description && (
                                        <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', marginTop: '2px' }}>
                                            {event.description}
                                        </p>
                                    )}
                                    {event.actor && (
                                        <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', marginTop: '4px' }}>
                                            Por: {event.actor}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Load more */}
            {!loading && timeline.length < total && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={onLoadMore}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-secondary)',
                            cursor: 'pointer',
                        }}
                    >
                        <ChevronDown className="h-4 w-4" /> Cargar mas ({total - timeline.length} restantes)
                    </button>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Tab 3: Cobertura SPA (SPA Mapping)                                 */
/* ================================================================== */

function SPAMappingTab({ data }: { data: SPAMappingData | null }) {
    if (!data) {
        return <EmptyState message="Sin datos de cobertura SPA disponibles" icon={<FileText className="h-8 w-8" />} />;
    }

    const coverageColor = data.coverage_pct >= 80
        ? 'var(--status-success)'
        : data.coverage_pct >= 50
            ? 'var(--status-warning)'
            : 'var(--status-error)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Coverage hero */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--g-space-4)' }}>
                <div className="g-card" style={{
                    padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)',
                    textAlign: 'center', gridColumn: 'span 1',
                }}>
                    <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }}>Cobertura SPA</p>
                    <p style={{ fontSize: '3rem', fontWeight: 700, color: coverageColor, lineHeight: 1 }}>
                        {data.coverage_pct}%
                    </p>
                    <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', marginTop: 'var(--g-space-2)' }}>
                        {data.covered_contingencies} de {data.total_contingencies} contingencias cubiertas
                    </p>
                </div>
                <SummaryCard
                    icon={<FileText className="h-5 w-5" />}
                    label="Clausulas SPA"
                    value={String(data.spa_clauses.length)}
                    color="var(--g-brand-3308)"
                />
                <SummaryCard
                    icon={<ShieldAlert className="h-5 w-5" />}
                    label="Hallazgos sin cubrir"
                    value={String(data.uncovered_findings.length)}
                    color={data.uncovered_findings.length > 0 ? 'var(--status-error)' : 'var(--status-success)'}
                />
                <SummaryCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Exposicion total"
                    value={formatCurrency(data.total_economic_exposure)}
                    color="var(--status-error)"
                />
            </div>

            {/* SPA Clauses table */}
            <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                <h3 style={{ fontSize: 'var(--g-text-h4)', fontWeight: 700, color: 'var(--g-text-primary)', marginBottom: 'var(--g-space-4)' }}>
                    Clausulas SPA
                </h3>
                {data.spa_clauses.length === 0 ? (
                    <EmptyState message="Sin clausulas SPA mapeadas" icon={<FileText className="h-6 w-6" />} small />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--g-text-small)' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--g-border-default)' }}>
                                    <th style={thStyle}>Clausula</th>
                                    <th style={thStyle}>Titulo</th>
                                    <th style={thStyle}>Tipo</th>
                                    <th style={thStyle}>Estado</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Hallazgos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.spa_clauses.map(clause => {
                                    const covCfg = COVERAGE_STATUS_CONFIG[clause.coverage_status] || COVERAGE_STATUS_CONFIG.uncovered;
                                    return (
                                        <tr key={clause.clause_id} style={{ borderBottom: '1px solid var(--g-border-subtle)' }}>
                                            <td style={tdStyle}>
                                                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--g-text-caption)' }}>
                                                    {clause.clause_key || '---'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ color: 'var(--g-text-primary)' }}>
                                                    {clause.clause_title || 'Sin titulo'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>
                                                    {clause.clause_type || '---'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: covCfg.bg, color: covCfg.fg,
                                                }}>
                                                    {covCfg.label}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <span style={{ fontWeight: 600 }}>{clause.actions.length}</span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <span style={{ fontWeight: 600 }}>{clause.linked_findings.length}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Uncovered findings */}
            {data.uncovered_findings.length > 0 && (
                <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                    <h3 style={{ fontSize: 'var(--g-text-h4)', fontWeight: 700, color: 'var(--status-error)', marginBottom: 'var(--g-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <ShieldAlert className="h-5 w-5" /> Hallazgos sin cobertura ({data.uncovered_findings.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                        {data.uncovered_findings.map(f => {
                            const sevColors = SEVERITY_COLOR_MAP[f.severity] || SEVERITY_COLOR_MAP.medium;
                            return (
                                <div
                                    key={f.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: `1px solid ${sevColors.border}`,
                                        backgroundColor: sevColors.bg,
                                    }}
                                >
                                    <SeverityBadge severity={f.severity} />
                                    {f.area_code && (
                                        <span style={{
                                            fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: `hsla(${AREA_COLORS[f.area_code] || AREA_COLORS.GENERAL}, 0.15)`,
                                            color: `hsl(${AREA_COLORS[f.area_code] || AREA_COLORS.GENERAL})`,
                                        }}>
                                            {f.area_code}
                                        </span>
                                    )}
                                    <span style={{ flex: 1, fontSize: 'var(--g-text-small)', color: 'var(--g-text-primary)' }}>
                                        {f.title}
                                    </span>
                                    {f.estimated_amount != null && f.estimated_amount > 0 && (
                                        <span style={{ fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--status-error)' }}>
                                            {formatCurrency(f.estimated_amount)}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Tab 4: Resoluciones (Decision Resolution)                          */
/* ================================================================== */

function ResolutionsTab({ data }: { data: DecisionResolutionData | null }) {
    if (!data) {
        return <EmptyState message="Sin datos de resoluciones disponibles" icon={<Scale className="h-8 w-8" />} />;
    }

    const { decisions, summary } = data;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Summary bar */}
            <div className="g-card" style={{ padding: 'var(--g-space-4) var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color: 'var(--g-text-primary)' }}>{summary.total}</span>
                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>Total</span>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(160, 100%, 25%)' }} />
                        <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color: 'hsl(160, 100%, 25%)' }}>{summary.resolved}</span>
                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>Resueltas</span>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(38, 92%, 40%)' }} />
                        <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color: 'hsl(38, 92%, 40%)' }}>{summary.partially_resolved}</span>
                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>Parciales</span>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--g-border-default)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(0, 72%, 45%)' }} />
                        <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color: 'hsl(0, 72%, 45%)' }}>{summary.unresolved}</span>
                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)' }}>Sin resolver</span>
                    </div>

                    {/* Resolution progress bar */}
                    {summary.total > 0 && (
                        <div style={{ flex: 1, display: 'flex', gap: '2px', height: '8px', borderRadius: 'var(--g-radius-full)', overflow: 'hidden', marginLeft: 'var(--g-space-4)' }}>
                            <div style={{ width: `${(summary.resolved / summary.total) * 100}%`, backgroundColor: 'hsl(160, 100%, 30%)', transition: 'width var(--g-transition-smooth)' }} />
                            <div style={{ width: `${(summary.partially_resolved / summary.total) * 100}%`, backgroundColor: 'hsl(38, 92%, 50%)', transition: 'width var(--g-transition-smooth)' }} />
                            <div style={{ width: `${(summary.unresolved / summary.total) * 100}%`, backgroundColor: 'hsl(0, 72%, 60%)', transition: 'width var(--g-transition-smooth)' }} />
                        </div>
                    )}
                </div>
            </div>

            {/* Decisions table */}
            <div className="g-card" style={{ padding: 'var(--g-space-5)', borderRadius: 'var(--g-radius-lg)' }}>
                {decisions.length === 0 ? (
                    <EmptyState message="Sin decisiones registradas" icon={<Gavel className="h-8 w-8" />} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--g-text-small)' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--g-border-default)' }}>
                                    <th style={thStyle}>Decision</th>
                                    <th style={thStyle}>Tipo</th>
                                    <th style={thStyle}>Justificacion</th>
                                    <th style={thStyle}>Resolucion</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Evidencias</th>
                                    <th style={thStyle}>Decidido por</th>
                                    <th style={thStyle}>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {decisions.map(d => {
                                    const dtCfg = DECISION_TYPE_CONFIG[d.decision_type];
                                    const resCfg = RESOLUTION_STATUS_CONFIG[d.resolution.status] || RESOLUTION_STATUS_CONFIG.unresolved;
                                    return (
                                        <tr key={d.id} style={{ borderBottom: '1px solid var(--g-border-subtle)' }}>
                                            <td style={tdStyle}>
                                                <span style={{ color: 'var(--g-text-primary)', fontWeight: 500 }}>
                                                    {d.title}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: dtCfg ? `${dtCfg.color}18` : 'var(--g-surface-muted)',
                                                    color: dtCfg?.color || 'var(--g-text-secondary)',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {dtCfg?.label || d.decision_type}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, maxWidth: '200px' }}>
                                                <span style={{
                                                    color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-caption)',
                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                                                    overflow: 'hidden',
                                                }}>
                                                    {d.rationale || '---'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: resCfg.bg, color: resCfg.fg,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {resCfg.label}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <span style={{ fontWeight: 600 }}>{d.resolution.evidence_count}</span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                                    {d.decided_by || '---'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', whiteSpace: 'nowrap' }}>
                                                    {formatDate(d.decided_at)}
                                                </span>
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

/* ================================================================== */
/*  Shared sub-components                                              */
/* ================================================================== */

function SummaryCard({
    icon, label, value, color, highlight = false,
}: {
    icon: React.ReactNode; label: string; value: string; color: string; highlight?: boolean;
}) {
    return (
        <div
            className="g-card"
            style={{
                padding: 'var(--g-space-4) var(--g-space-5)',
                borderRadius: 'var(--g-radius-lg)',
                display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                borderLeft: `4px solid ${color}`,
                ...(highlight ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
            }}
        >
            <div style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color, lineHeight: 1 }}>
                    {value}
                </p>
                <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {label}
                </p>
            </div>
        </div>
    );
}

function MetricCard({
    icon, label, value, color,
}: {
    icon: React.ReactNode; label: string; value: string; color: string;
}) {
    return (
        <div
            className="g-card"
            style={{
                padding: 'var(--g-space-4)',
                borderRadius: 'var(--g-radius-lg)',
                textAlign: 'center',
            }}
        >
            <div style={{ color, display: 'flex', justifyContent: 'center', marginBottom: 'var(--g-space-2)' }}>
                {icon}
            </div>
            <p style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color, lineHeight: 1 }}>
                {value}
            </p>
            <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', marginTop: '4px' }}>
                {label}
            </p>
        </div>
    );
}

function SeverityBadge({ severity }: { severity: string }) {
    const sevColors = SEVERITY_COLOR_MAP[severity] || SEVERITY_COLOR_MAP.medium;
    const sevConfig = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
    return (
        <span style={{
            fontSize: '10px', fontWeight: 600, padding: '1px 6px',
            borderRadius: 'var(--g-radius-sm)',
            backgroundColor: sevColors.bg, color: sevColors.fg,
            textTransform: 'uppercase',
        }}>
            {sevConfig?.label || severity}
        </span>
    );
}

function EmptyState({ message, icon, small = false }: { message: string; icon: React.ReactNode; small?: boolean }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: small ? 'var(--g-space-6)' : 'var(--g-space-10)',
            color: 'var(--g-text-muted)',
        }}>
            <div style={{ marginBottom: 'var(--g-space-3)', opacity: 0.5 }}>
                {icon}
            </div>
            <p style={{ fontSize: small ? 'var(--g-text-caption)' : 'var(--g-text-small)', fontStyle: 'italic' }}>
                {message}
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Table style helpers                                                */
/* ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--g-space-2) var(--g-space-3)',
    fontSize: 'var(--g-text-caption)',
    fontWeight: 600,
    color: 'var(--g-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: 'var(--g-space-3)',
    verticalAlign: 'middle',
    color: 'var(--g-text-primary)',
};
