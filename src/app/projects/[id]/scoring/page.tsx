'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Loader2, AlertTriangle, RefreshCw, ShieldAlert,
    TrendingUp, Target, BarChart3, AlertOctagon, Activity,
    CheckCircle2, XCircle, MinusCircle, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { SEVERITY_CONFIG, AREA_COLORS, formatCurrency, formatDate, useResolvedParams } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

interface ScoredFinding {
    id: string;
    title: string;
    raw_score: number;
    weighted_score: number;
    is_deal_breaker: boolean;
    area_code: string;
}

interface AreaScore {
    score: number;
    finding_count: number;
    critical_count: number;
}

interface SensitivityAnalysis {
    best_case: number;
    base_case: number;
    worst_case: number;
}

interface DealRiskScore {
    id?: string;
    project_id: string;
    overall_score: number;
    recommendation: 'go' | 'conditional_go' | 'no_go';
    area_scores: Record<string, AreaScore>;
    deal_breakers: ScoredFinding[];
    top_risks: ScoredFinding[];
    sensitivity: SensitivityAnalysis;
    total_economic_exposure: number;
    scored_findings: ScoredFinding[];
    created_at?: string;
}

interface RedFlagEntry {
    id: string;
    title: string;
    area_code: string;
    severity: string;
    probability: string;
    economic_impact?: number;
    source: string;
    source_id: string;
    mitigation?: string;
    hitl_status?: string;
    war_room_decision?: string;
}

interface RedFlagReport {
    project_id: string;
    generated_at: string;
    total_red_flags: number;
    by_severity: Record<string, number>;
    by_area: Record<string, number>;
    deal_breakers: RedFlagEntry[];
    critical_flags: RedFlagEntry[];
    high_flags: RedFlagEntry[];
    medium_low_flags: RedFlagEntry[];
    executive_summary: string;
    war_room_decisions_count: number;
    unresolved_count: number;
}

// ── Config maps ────────────────────────────────────────────────────

const RECOMMENDATION_CONFIG: Record<string, { label: string; bg: string; fg: string; icon: typeof CheckCircle2 }> = {
    go: { label: 'Proceder', bg: 'var(--status-success)', fg: '#fff', icon: CheckCircle2 },
    conditional_go: { label: 'Proceder con condiciones', bg: 'var(--status-warning)', fg: '#fff', icon: MinusCircle },
    no_go: { label: 'No proceder', bg: 'var(--status-error)', fg: '#fff', icon: XCircle },
};

const AREA_NAME_MAP: Record<string, string> = {
    MERC: 'Mercantil',
    CONT: 'Contractual',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Intelectual',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'Medio Ambiente',
    DATOS: 'Proteccion de Datos',
    GENERAL: 'General',
};

const TIMING_LABELS: Record<string, string> = {
    blocking: 'Bloqueante',
    post_closing: 'Post-cierre',
};

// ── Helpers ────────────────────────────────────────────────────────

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

function getScoreColor(score: number): string {
    if (score <= 30) return 'var(--status-success)';
    if (score <= 65) return 'var(--status-warning)';
    return 'var(--status-error)';
}

function getAreaColor(code: string): string {
    return AREA_COLORS[code] || AREA_COLORS.GENERAL;
}

// ── Score Circle Component ─────────────────────────────────────────

function ScoreCircle({ score, size = 180 }: { score: number; size?: number }) {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = getScoreColor(score);

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--g-surface-muted)"
                    strokeWidth="10"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease' }}
                />
            </svg>
            {/* Center text */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <span
                    className="font-bold"
                    style={{ fontSize: size * 0.28, lineHeight: 1, color }}
                >
                    {Math.round(score)}
                </span>
                <span
                    className="text-xs"
                    style={{ color: 'var(--g-text-secondary)', marginTop: 4 }}
                >
                    / 100
                </span>
            </div>
        </div>
    );
}

// ── Mini Severity Bar Component ────────────────────────────────────

function SeverityBar({ findings }: { findings: ScoredFinding[] }) {
    const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    // We don't have severity directly in ScoredFinding, but we can infer from weighted_score
    // Instead, let's count by deal_breaker and score ranges
    for (const f of findings) {
        if (f.weighted_score >= 75) severityCounts.critical++;
        else if (f.weighted_score >= 40) severityCounts.high++;
        else if (f.weighted_score >= 15) severityCounts.medium++;
        else severityCounts.low++;
    }
    const total = findings.length;
    if (total === 0) return null;

    return (
        <div className="flex w-full h-2 overflow-hidden" style={{ borderRadius: 'var(--g-radius-full)' }}>
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const count = severityCounts[sev];
                if (count === 0) return null;
                const pct = (count / total) * 100;
                const sevCfg = SEVERITY_CONFIG[sev];
                return (
                    <div
                        key={sev}
                        title={`${sevCfg.label}: ${count}`}
                        style={{
                            width: `${pct}%`,
                            backgroundColor: sevCfg.color,
                            minWidth: '3px',
                        }}
                    />
                );
            })}
        </div>
    );
}

// ── Sensitivity Bar Component ──────────────────────────────────────

function SensitivitySection({ sensitivity }: { sensitivity: SensitivityAnalysis }) {
    const scenarios = [
        { key: 'best_case', label: 'Mejor caso', score: sensitivity.best_case, description: 'Todas las probabilidades reducidas a remoto' },
        { key: 'base_case', label: 'Caso base', score: sensitivity.base_case, description: 'Probabilidades actuales segun hallazgos' },
        { key: 'worst_case', label: 'Peor caso', score: sensitivity.worst_case, description: 'Todas las probabilidades elevadas a cierto' },
    ];

    return (
        <div
            style={{
                backgroundColor: 'var(--g-surface-card)',
                borderRadius: 'var(--g-radius-lg)',
                border: '1px solid var(--g-border-default)',
                padding: 'var(--g-space-5)',
            }}
        >
            <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                    Analisis de Sensibilidad
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scenarios.map((s) => {
                    const color = getScoreColor(s.score);
                    const rec = s.score < 30 ? 'go' : s.score <= 65 ? 'conditional_go' : 'no_go';
                    const recCfg = RECOMMENDATION_CONFIG[rec];
                    return (
                        <div
                            key={s.key}
                            className="p-4"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                border: s.key === 'base_case'
                                    ? '2px solid var(--g-brand-3308)'
                                    : '1px solid var(--g-border-default)',
                                backgroundColor: s.key === 'base_case'
                                    ? 'rgba(0, 68, 56, 0.04)'
                                    : 'var(--g-surface-muted)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold" style={{ color: 'var(--g-text-primary)' }}>
                                    {s.label}
                                </span>
                                <span
                                    className="px-2 py-0.5 text-xs font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: recCfg.bg,
                                        color: recCfg.fg,
                                    }}
                                >
                                    {recCfg.label}
                                </span>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-3xl font-bold" style={{ color, lineHeight: 1 }}>
                                    {Math.round(s.score)}
                                </span>
                                <span className="text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                    / 100
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div
                                className="w-full h-2 mb-2"
                                style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)' }}
                            >
                                <div
                                    className="h-full transition-all"
                                    style={{
                                        width: `${Math.min(s.score, 100)}%`,
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: color,
                                    }}
                                />
                            </div>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                {s.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Loading Skeleton ───────────────────────────────────────────────

function ScoringSkeletons() {
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header skeleton */}
            <div>
                <div className="h-4 w-24 mb-3" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-sm)' }} />
                <div className="h-8 w-64" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-md)' }} />
            </div>
            {/* Score circle skeleton */}
            <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-4">
                    <div
                        className="flex items-center justify-center"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-8)',
                            height: 280,
                        }}
                    >
                        <div
                            className="animate-pulse"
                            style={{
                                width: 180,
                                height: 180,
                                borderRadius: '50%',
                                backgroundColor: 'var(--g-surface-muted)',
                            }}
                        />
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-8">
                    <div
                        className="animate-pulse"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            height: 280,
                        }}
                    />
                </div>
            </div>
            {/* Bottom skeleton */}
            <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-6">
                    <div
                        className="animate-pulse"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            height: 300,
                        }}
                    />
                </div>
                <div className="col-span-12 lg:col-span-6">
                    <div
                        className="animate-pulse"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            height: 300,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Main Page Component ────────────────────────────────────────────

export default function ScoringDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);

    const [score, setScore] = useState<DealRiskScore | null>(null);
    const [redFlagReport, setRedFlagReport] = useState<RedFlagReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notScored, setNotScored] = useState(false);

    // ── Fetch latest persisted score ──────────────────────────────

    const fetchScore = useCallback(async () => {
        try {
            const res = await fetch(`/api/scoring/deal-risk?project_id=${id}`, {
                headers: authHeaders(),
            });
            const json = await res.json();
            if (json.success) {
                setScore({
                    id: json.id,
                    project_id: json.project_id,
                    overall_score: json.overall_score,
                    recommendation: json.recommendation,
                    area_scores: json.area_scores,
                    deal_breakers: json.deal_breakers,
                    top_risks: json.top_risks,
                    sensitivity: json.sensitivity,
                    total_economic_exposure: json.total_economic_exposure,
                    scored_findings: json.scored_findings || [],
                    created_at: json.created_at,
                });
                setNotScored(false);
                setError(null);
            } else if (res.status === 404) {
                setNotScored(true);
                setError(null);
            } else {
                setError(json.error || 'Error al cargar la puntuacion');
            }
        } catch (err) {
            console.error('Score fetch error:', err);
            setError('Error de conexion');
        }
    }, [id]);

    // ── Fetch red flag report ─────────────────────────────────────

    const fetchRedFlags = useCallback(async () => {
        try {
            const res = await fetch(`/api/reports/red-flags?project_id=${id}`, {
                headers: authHeaders(),
            });
            const json = await res.json();
            if (json.success) {
                setRedFlagReport(json.report);
            }
        } catch (err) {
            console.error('Red flag report fetch error:', err);
        }
    }, [id]);

    // ── Initial load ──────────────────────────────────────────────

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            await Promise.all([fetchScore(), fetchRedFlags()]);
            setLoading(false);
        }
        loadData();
    }, [fetchScore, fetchRedFlags]);

    // ── Auto-refresh every 60s ────────────────────────────────────

    useEffect(() => {
        const interval = setInterval(() => {
            fetchScore();
        }, 60_000);
        return () => clearInterval(interval);
    }, [fetchScore]);

    // ── Recalculate ───────────────────────────────────────────────

    const handleRecalculate = async () => {
        setRecalculating(true);
        try {
            const res = await fetch('/api/scoring/deal-risk', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ project_id: id }),
            });
            const json = await res.json();
            if (json.success) {
                setScore({
                    id: json.score_id,
                    project_id: id,
                    overall_score: json.overall_score,
                    recommendation: json.recommendation,
                    area_scores: json.area_scores,
                    deal_breakers: json.deal_breakers,
                    top_risks: json.top_risks,
                    sensitivity: json.sensitivity,
                    total_economic_exposure: json.total_economic_exposure,
                    scored_findings: json.scored_findings || [],
                    created_at: new Date().toISOString(),
                });
                setNotScored(false);
                setError(null);
                toast.success('Puntuacion recalculada correctamente');
                // Also refresh red flags
                fetchRedFlags();
            } else {
                toast.error(json.error || 'Error al recalcular');
            }
        } catch (err) {
            console.error('Recalculate error:', err);
            toast.error('Error de conexion al recalcular');
        } finally {
            setRecalculating(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Scoring Dashboard
                    </h1>
                </div>
                <ScoringSkeletons />
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────

    if (error && !score) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Scoring Dashboard
                    </h1>
                </div>
                <div
                    className="flex flex-col items-center justify-center py-16"
                    style={{
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
                        href={`/projects/${id}`}
                        className="text-sm mt-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        Volver al proyecto
                    </Link>
                </div>
            </div>
        );
    }

    // ── Not scored yet ────────────────────────────────────────────

    if (notScored && !score) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Scoring Dashboard
                    </h1>
                </div>
                <div
                    className="flex flex-col items-center justify-center py-20"
                    style={{
                        backgroundColor: 'var(--g-surface-card)',
                        borderRadius: 'var(--g-radius-lg)',
                        border: '1px solid var(--g-border-default)',
                    }}
                >
                    <Target className="h-16 w-16 mb-4" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                    <p className="text-lg font-bold mb-1" style={{ color: 'var(--g-text-primary)' }}>
                        Puntuacion no calculada
                    </p>
                    <p className="text-sm mb-6" style={{ color: 'var(--g-text-secondary)', maxWidth: 400, textAlign: 'center' }}>
                        Aun no se ha calculado la puntuacion de riesgo del deal para este proyecto.
                        Pulse el boton para generar el analisis.
                    </p>
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                        }}
                    >
                        {recalculating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <BarChart3 className="h-4 w-4" />
                        )}
                        {recalculating ? 'Calculando...' : 'Calcular puntuacion'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Data ready ────────────────────────────────────────────────

    if (!score) return null;

    const recCfg = RECOMMENDATION_CONFIG[score.recommendation] || RECOMMENDATION_CONFIG.conditional_go;
    const RecIcon = recCfg.icon;
    const areaEntries = Object.entries(score.area_scores).sort((a, b) => b[1].score - a[1].score);

    // Get severity distribution from scored_findings for each area
    function getAreaFindings(areaCode: string): ScoredFinding[] {
        return score!.scored_findings.filter((f) => f.area_code === areaCode);
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>

            {/* ============================================================ */}
            {/* HEADER */}
            {/* ============================================================ */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Scoring Dashboard
                    </h1>
                    {score.created_at && (
                        <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                            Ultima actualizacion: {formatDate(score.created_at)}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium disabled:opacity-50 mt-6"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                    }}
                >
                    {recalculating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {recalculating ? 'Recalculando...' : 'Recalcular'}
                </button>
            </div>

            {/* ============================================================ */}
            {/* TOP SECTION: Deal Risk Score */}
            {/* ============================================================ */}
            <div className="grid grid-cols-12 gap-5">
                {/* Score Circle + Recommendation */}
                <div className="col-span-12 lg:col-span-4">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--g-space-4)',
                        }}
                    >
                        <ScoreCircle score={score.overall_score} size={180} />

                        {/* Recommendation badge */}
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 font-medium text-sm"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: recCfg.bg,
                                color: recCfg.fg,
                            }}
                        >
                            <RecIcon className="h-4 w-4" />
                            {recCfg.label}
                        </div>

                        {/* Economic exposure */}
                        <div className="text-center mt-2">
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                                <DollarSign className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>
                                    Exposicion economica total
                                </span>
                            </div>
                            <p
                                className="text-xl font-bold"
                                style={{
                                    color: score.total_economic_exposure > 0
                                        ? 'var(--status-error)'
                                        : 'var(--g-text-primary)',
                                }}
                            >
                                {formatCurrency(score.total_economic_exposure)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary Stats + Key Metrics */}
                <div className="col-span-12 lg:col-span-8">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Resumen de Riesgo
                            </h2>
                        </div>

                        {/* Summary stats grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="p-3 text-center" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                    {score.scored_findings.length}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Hallazgos totales</p>
                            </div>
                            <div className="p-3 text-center" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{ color: score.deal_breakers.length > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                                    {score.deal_breakers.length}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Deal breakers</p>
                            </div>
                            <div className="p-3 text-center" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                    {areaEntries.length}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Areas evaluadas</p>
                            </div>
                            <div className="p-3 text-center" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)' }}>
                                <p className="text-2xl font-bold" style={{
                                    color: getScoreColor(score.sensitivity.worst_case),
                                }}>
                                    {Math.round(score.sensitivity.worst_case)}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Peor escenario</p>
                            </div>
                        </div>

                        {/* Red flag summary from report */}
                        {redFlagReport && (
                            <div
                                className="p-3 flex-1"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-muted)',
                                    border: '1px solid var(--g-border-default)',
                                }}
                            >
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--g-text-primary)' }}>
                                    Resumen ejecutivo
                                </p>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--g-text-secondary)' }}>
                                    {redFlagReport.executive_summary || 'Sin resumen disponible.'}
                                </p>
                                {redFlagReport.total_red_flags > 0 && (
                                    <div className="flex items-center gap-3 mt-3 pt-2 border-t" style={{ borderColor: 'var(--g-border-default)' }}>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {redFlagReport.total_red_flags} red flags identificados
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {redFlagReport.unresolved_count} sin resolver
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {redFlagReport.war_room_decisions_count} decisiones War Room
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* MIDDLE SECTION: Area Risk Breakdown */}
            {/* ============================================================ */}
            <div
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-lg)',
                    border: '1px solid var(--g-border-default)',
                    padding: 'var(--g-space-5)',
                }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                    <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                        Desglose de Riesgo por Area
                    </h2>
                    <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                        {areaEntries.length} areas
                    </span>
                </div>

                {areaEntries.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--g-text-secondary)' }}>
                        No hay areas con hallazgos.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {areaEntries.map(([areaCode, areaScore]) => {
                            const aColor = getAreaColor(areaCode);
                            const scoreColor = getScoreColor(areaScore.score);
                            const areaFindings = getAreaFindings(areaCode);

                            return (
                                <div
                                    key={areaCode}
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        border: '1px solid var(--g-border-default)',
                                        borderLeft: `3px solid hsla(${aColor}, 1)`,
                                        padding: 'var(--g-space-3)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    {/* Area header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span
                                            className="text-xs font-bold px-1.5 py-0.5"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: `hsla(${aColor}, 0.12)`,
                                                color: `hsla(${aColor}, 1)`,
                                            }}
                                        >
                                            {areaCode}
                                        </span>
                                        <span className="text-lg font-bold" style={{ color: scoreColor }}>
                                            {Math.round(areaScore.score)}
                                        </span>
                                    </div>

                                    {/* Area name */}
                                    <p className="text-xs font-medium mb-2 truncate" style={{ color: 'var(--g-text-primary)' }}>
                                        {AREA_NAME_MAP[areaCode] || areaCode}
                                    </p>

                                    {/* Score progress bar */}
                                    <div
                                        className="w-full h-1.5 mb-2"
                                        style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)' }}
                                    >
                                        <div
                                            className="h-full transition-all"
                                            style={{
                                                width: `${Math.min(areaScore.score, 100)}%`,
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: scoreColor,
                                            }}
                                        />
                                    </div>

                                    {/* Finding counts */}
                                    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--g-text-secondary)' }}>
                                        <span>{areaScore.finding_count} hallazgos</span>
                                        {areaScore.critical_count > 0 && (
                                            <span style={{ color: 'var(--g-severity-critical)' }}>
                                                {areaScore.critical_count} criticos
                                            </span>
                                        )}
                                    </div>

                                    {/* Mini severity distribution bar */}
                                    <SeverityBar findings={areaFindings} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ============================================================ */}
            {/* BOTTOM SECTION: Deal Breakers + Top Risks */}
            {/* ============================================================ */}
            <div className="grid grid-cols-12 gap-5">

                {/* ── Deal Breakers ──────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-5">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                            height: '100%',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <AlertOctagon className="h-4 w-4" style={{ color: 'var(--g-severity-critical)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Deal Breakers
                            </h2>
                            <span
                                className="text-xs ml-auto px-1.5 py-0.5 font-medium"
                                style={{
                                    borderRadius: 'var(--g-radius-sm)',
                                    backgroundColor: score.deal_breakers.length > 0 ? 'var(--g-severity-critical)' : 'var(--status-success)',
                                    color: '#fff',
                                }}
                            >
                                {score.deal_breakers.length}
                            </span>
                        </div>

                        {score.deal_breakers.length === 0 ? (
                            <div className="flex flex-col items-center py-8">
                                <CheckCircle2 className="h-10 w-10 mb-2" style={{ color: 'var(--status-success)', opacity: 0.4 }} />
                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    Sin deal breakers
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                    No se han identificado hallazgos bloqueantes.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                                {score.deal_breakers.map((db) => {
                                    const aColor = getAreaColor(db.area_code);
                                    return (
                                        <div
                                            key={db.id}
                                            className="p-3"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                                                borderLeft: '3px solid var(--g-severity-critical)',
                                            }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <AlertOctagon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--g-severity-critical)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                                        {db.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className="px-1.5 py-0.5 text-xs font-medium"
                                                            style={{
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: 'var(--g-severity-critical)',
                                                                color: '#fff',
                                                            }}
                                                        >
                                                            Deal Breaker
                                                        </span>
                                                        <span
                                                            className="px-1.5 py-0.5 text-xs"
                                                            style={{
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: `hsla(${aColor}, 0.12)`,
                                                                color: `hsla(${aColor}, 1)`,
                                                            }}
                                                        >
                                                            {db.area_code}
                                                        </span>
                                                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>
                                                            Score: {Math.round(db.weighted_score)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Top 10 Risks ───────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-7">
                    <div
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-lg)',
                            border: '1px solid var(--g-border-default)',
                            padding: 'var(--g-space-5)',
                            height: '100%',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="h-4 w-4" style={{ color: 'var(--status-warning)' }} />
                            <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Top 10 Riesgos
                            </h2>
                            <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                                Por contribucion al score
                            </span>
                        </div>

                        {score.top_risks.length === 0 ? (
                            <div className="flex flex-col items-center py-8">
                                <CheckCircle2 className="h-10 w-10 mb-2" style={{ color: 'var(--status-success)', opacity: 0.4 }} />
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                    No hay riesgos identificados.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                #
                                            </th>
                                            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                Hallazgo
                                            </th>
                                            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                Area
                                            </th>
                                            <th className="text-right px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                Raw
                                            </th>
                                            <th className="text-right px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                Weighted
                                            </th>
                                            <th className="text-center px-2 py-2 text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
                                                Tipo
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {score.top_risks.map((risk, idx) => {
                                            const aColor = getAreaColor(risk.area_code);
                                            const scoreColor = getScoreColor(risk.weighted_score);
                                            return (
                                                <tr
                                                    key={risk.id}
                                                    style={{ borderBottom: '1px solid var(--g-border-default)' }}
                                                >
                                                    <td className="px-2 py-2.5">
                                                        <span className="text-xs font-bold" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)', maxWidth: 260 }}>
                                                            {risk.title.length > 60 ? risk.title.slice(0, 60) + '...' : risk.title}
                                                        </p>
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <span
                                                            className="px-1.5 py-0.5 text-xs font-medium"
                                                            style={{
                                                                borderRadius: 'var(--g-radius-sm)',
                                                                backgroundColor: `hsla(${aColor}, 0.12)`,
                                                                color: `hsla(${aColor}, 1)`,
                                                            }}
                                                        >
                                                            {risk.area_code}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right">
                                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {Math.round(risk.raw_score)}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right">
                                                        <span className="text-xs font-bold" style={{ color: scoreColor }}>
                                                            {Math.round(risk.weighted_score)}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {risk.is_deal_breaker ? (
                                                            <span
                                                                className="px-1.5 py-0.5 text-xs font-medium"
                                                                style={{
                                                                    borderRadius: 'var(--g-radius-sm)',
                                                                    backgroundColor: 'var(--g-severity-critical)',
                                                                    color: '#fff',
                                                                }}
                                                            >
                                                                Bloqueante
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                                Riesgo
                                                            </span>
                                                        )}
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
            </div>

            {/* ============================================================ */}
            {/* SENSITIVITY ANALYSIS */}
            {/* ============================================================ */}
            {score.sensitivity && (
                <SensitivitySection sensitivity={score.sensitivity} />
            )}

            {/* ============================================================ */}
            {/* RED FLAG REPORT DETAILS (from /api/reports/red-flags) */}
            {/* ============================================================ */}
            {redFlagReport && redFlagReport.total_red_flags > 0 && (
                <div
                    style={{
                        backgroundColor: 'var(--g-surface-card)',
                        borderRadius: 'var(--g-radius-lg)',
                        border: '1px solid var(--g-border-default)',
                        padding: 'var(--g-space-5)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldAlert className="h-4 w-4" style={{ color: 'var(--g-severity-critical)' }} />
                        <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                            Informe Red Flags
                        </h2>
                        <span
                            className="text-xs ml-auto px-1.5 py-0.5 font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: 'var(--g-severity-critical)',
                                color: '#fff',
                            }}
                        >
                            {redFlagReport.total_red_flags}
                        </span>
                    </div>

                    {/* Severity distribution pills */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                            const count = redFlagReport.by_severity[sev] || 0;
                            if (count === 0) return null;
                            const sevCfg = SEVERITY_CONFIG[sev];
                            return (
                                <span
                                    key={sev}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: sevCfg.color,
                                        color: '#fff',
                                    }}
                                >
                                    {sevCfg.label}: {count}
                                </span>
                            );
                        })}
                    </div>

                    {/* Area distribution pills */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Por area:</span>
                        {Object.entries(redFlagReport.by_area)
                            .sort((a, b) => b[1] - a[1])
                            .map(([areaCode, count]) => {
                                const aColor = getAreaColor(areaCode);
                                return (
                                    <span
                                        key={areaCode}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                                        style={{
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: `hsla(${aColor}, 0.12)`,
                                            color: `hsla(${aColor}, 1)`,
                                        }}
                                    >
                                        {areaCode}: {count}
                                    </span>
                                );
                            })}
                    </div>

                    {/* Red flag entries grouped by severity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                        {/* Deal breakers from red flag report */}
                        {redFlagReport.deal_breakers.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--g-severity-critical)' }}>
                                    Deal Breakers ({redFlagReport.deal_breakers.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {redFlagReport.deal_breakers.map((flag) => (
                                        <RedFlagRow key={flag.id} flag={flag} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Critical flags */}
                        {redFlagReport.critical_flags.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: SEVERITY_CONFIG.critical.color }}>
                                    Criticos ({redFlagReport.critical_flags.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {redFlagReport.critical_flags.map((flag) => (
                                        <RedFlagRow key={flag.id} flag={flag} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* High flags */}
                        {redFlagReport.high_flags.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: SEVERITY_CONFIG.high.color }}>
                                    Altos ({redFlagReport.high_flags.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {redFlagReport.high_flags.map((flag) => (
                                        <RedFlagRow key={flag.id} flag={flag} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Medium/Low flags (collapsed if many) */}
                        {redFlagReport.medium_low_flags.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: SEVERITY_CONFIG.medium.color }}>
                                    Medios / Bajos ({redFlagReport.medium_low_flags.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {redFlagReport.medium_low_flags.map((flag) => (
                                        <RedFlagRow key={flag.id} flag={flag} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Red Flag Row Sub-component ─────────────────────────────────────

function RedFlagRow({ flag }: { flag: RedFlagEntry }) {
    const sevCfg = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG];
    const aColor = getAreaColor(flag.area_code);

    return (
        <div
            className="flex items-start gap-3 p-2.5"
            style={{
                borderRadius: 'var(--g-radius-md)',
                backgroundColor: 'var(--g-surface-muted)',
                borderLeft: `3px solid ${sevCfg?.color || 'var(--g-border-default)'}`,
            }}
        >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: sevCfg?.color || 'var(--g-text-secondary)' }} />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                    {flag.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sevCfg && (
                        <span
                            className="px-1.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: sevCfg.color,
                                color: '#fff',
                            }}
                        >
                            {sevCfg.label}
                        </span>
                    )}
                    <span
                        className="px-1.5 py-0.5 text-xs"
                        style={{
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: `hsla(${aColor}, 0.12)`,
                            color: `hsla(${aColor}, 1)`,
                        }}
                    >
                        {flag.area_code}
                    </span>
                    {flag.probability && (
                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                            Prob: {flag.probability}
                        </span>
                    )}
                    {flag.war_room_decision && (
                        <span className="text-xs" style={{ color: 'var(--status-info)' }}>
                            Decision: {flag.war_room_decision}
                        </span>
                    )}
                </div>
                {flag.mitigation && (
                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        Mitigacion: {flag.mitigation}
                    </p>
                )}
            </div>
            {flag.economic_impact != null && flag.economic_impact > 0 && (
                <span className="text-xs font-bold shrink-0" style={{ color: 'var(--g-text-primary)' }}>
                    {formatCurrency(flag.economic_impact)}
                </span>
            )}
        </div>
    );
}
