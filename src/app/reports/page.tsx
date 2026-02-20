'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileBarChart, Plus, Search, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDReport } from '@/lib/supabase';
import { cn, formatDate, REPORT_FAMILY_CONFIG } from '@/lib/utils';

const REPORT_STATUS_CONFIG: Record<DDReport['status'], { label: string; bg: string; fg: string }> = {
    pending:    { label: 'Pendiente',   bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    generating: { label: 'Generando',   bg: 'var(--status-info)',     fg: 'var(--g-text-inverse)' },
    done:       { label: 'Completado',  bg: 'var(--status-success)',  fg: 'var(--g-text-inverse)' },
    failed:     { label: 'Fallido',     bg: 'var(--status-error)',    fg: 'var(--g-text-inverse)' },
};

const FAMILY_FILTERS = [
    { key: 'all', label: 'Todos' },
    { key: 'transactional', label: 'Transaccional' },
    { key: 'pmo', label: 'PMO' },
    { key: 'compliance', label: 'Compliance' },
] as const;

const STATUS_FILTERS = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendiente' },
    { key: 'generating', label: 'Generando' },
    { key: 'done', label: 'Completado' },
    { key: 'failed', label: 'Fallido' },
] as const;

// Map report_type to family based on known prefixes/keywords
function inferFamily(reportType: string): string {
    const pmoTypes = ['pmo_estado', 'pmo_workload', 'pmo_qa_log', 'pmo_evidence_matrix', 'pmo_cross_consistency', 'pmo_burndown', 'pmo_deliverables', 'pmo_risk_register'];
    const complianceTypes = ['compliance_access_audit', 'compliance_grounding', 'compliance_borme_health', 'compliance_agent_observability', 'compliance_data_quality', 'compliance_gdpr_audit', 'compliance_skill_performance'];

    if (pmoTypes.includes(reportType)) return 'pmo';
    if (complianceTypes.includes(reportType)) return 'compliance';
    return 'transactional';
}

function GroundingBar({ score }: { score: number }) {
    const color = score < 60 ? 'var(--status-error)' : score < 80 ? 'var(--status-warning)' : 'var(--status-success)';
    return (
        <div className="flex items-center gap-2">
            <div
                className="h-2 flex-1 overflow-hidden"
                style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-full)', minWidth: 60, maxWidth: 100 }}
            >
                <div
                    className="h-full"
                    style={{
                        width: `${Math.min(100, Math.max(0, score))}%`,
                        backgroundColor: color,
                        borderRadius: 'var(--g-radius-full)',
                        transition: 'width var(--g-transition-smooth)',
                    }}
                />
            </div>
            <span className="text-xs font-medium tabular-nums" style={{ color, minWidth: 32, textAlign: 'right' }}>
                {score}%
            </span>
        </div>
    );
}

export default function ReportsPage() {
    const [reports, setReports] = useState<DDReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [familyFilter, setFamilyFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        supabase
            .from('dd_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                setReports(data || []);
                setLoading(false);
            });
    }, []);

    const filtered = reports.filter(r => {
        if (search && !r.report_type.toLowerCase().includes(search.toLowerCase())) return false;
        if (familyFilter !== 'all' && inferFamily(r.report_type) !== familyFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
    });

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Informes
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)', marginTop: '2px' }}>
                        Generacion y gestion de informes Due Diligence
                    </p>
                </div>
                <Link
                    href="/reports/new"
                    className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-90"
                    style={{
                        padding: 'var(--g-space-2) var(--g-space-5)',
                        fontSize: 'var(--g-text-body)',
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                        borderRadius: 'var(--g-radius-md)',
                        boxShadow: 'var(--g-shadow-brand)',
                    }}
                >
                    <Plus className="h-4 w-4" /> Generar Informe
                </Link>
            </div>

            {/* Search */}
            <div>
                <label
                    htmlFor="reports-search"
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: 'var(--g-text-primary)' }}
                >
                    Buscar informes
                </label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} aria-hidden="true" />
                    <input
                        id="reports-search"
                        type="text"
                        placeholder="Buscar por tipo de informe..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 text-sm border transition-colors"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderColor: 'var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-md)',
                            color: 'var(--g-text-primary)',
                        }}
                    />
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                {/* Family filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-muted)' }}>Familia:</span>
                    {FAMILY_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFamilyFilter(f.key)}
                            className="px-3 py-1 text-xs font-medium transition-all"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: familyFilter === f.key
                                    ? (f.key === 'all' ? 'var(--g-brand-3308)' : (REPORT_FAMILY_CONFIG[f.key]?.bg || 'var(--g-brand-3308)'))
                                    : 'var(--g-surface-muted)',
                                color: familyFilter === f.key
                                    ? 'var(--g-text-inverse)'
                                    : 'var(--g-text-primary)',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Status filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-muted)' }}>Estado:</span>
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className="px-3 py-1 text-xs font-medium transition-all"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: statusFilter === f.key
                                    ? (f.key === 'all' ? 'var(--g-brand-3308)' : (REPORT_STATUS_CONFIG[f.key as DDReport['status']]?.bg || 'var(--g-brand-3308)'))
                                    : 'var(--g-surface-muted)',
                                color: statusFilter === f.key
                                    ? (f.key === 'all' ? 'var(--g-text-inverse)' : (REPORT_STATUS_CONFIG[f.key as DDReport['status']]?.fg || 'var(--g-text-inverse)'))
                                    : 'var(--g-text-primary)',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div
                className="g-card overflow-hidden"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-lg)',
                }}
            >
                <table className="w-full">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                            {['Tipo de Informe', 'Familia', 'Estado', 'Grounding', 'Fecha', ''].map(h => (
                                <th
                                    key={h}
                                    className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                    style={{ color: 'var(--g-text-muted)' }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}>
                                    <td colSpan={6} className="px-5 py-4">
                                        <div className="skeleton h-5 w-full" style={{ borderRadius: 'var(--g-radius-sm)' }} />
                                    </td>
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-12 text-center">
                                    <FileBarChart className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--g-sec-300)' }} />
                                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        Sin informes generados
                                    </p>
                                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                        {search || familyFilter !== 'all' || statusFilter !== 'all'
                                            ? 'No se encontraron informes con los filtros actuales'
                                            : 'Genera tu primer informe con Harvey AI.'}
                                    </p>
                                    {!search && familyFilter === 'all' && statusFilter === 'all' && (
                                        <Link
                                            href="/reports/new"
                                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
                                            style={{
                                                backgroundColor: 'var(--g-brand-3308)',
                                                color: 'var(--g-text-inverse)',
                                                borderRadius: 'var(--g-radius-md)',
                                            }}
                                        >
                                            <Plus className="h-4 w-4" /> Generar Informe
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ) : filtered.map((r) => {
                            const family = inferFamily(r.report_type);
                            const familyCfg = REPORT_FAMILY_CONFIG[family];
                            const statusCfg = REPORT_STATUS_CONFIG[r.status];

                            return (
                                <tr
                                    key={r.id}
                                    className="transition-colors cursor-pointer"
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <td className="px-5 py-4">
                                        <Link href={`/reports/${r.id}`} className="flex items-center gap-3">
                                            <FileBarChart className="h-5 w-5 shrink-0" style={{ color: 'var(--g-brand-3308)' }} />
                                            <span className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {r.report_type.replace(/_/g, ' ')}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-5 py-4">
                                        {familyCfg && (
                                            <span
                                                className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: familyCfg.bg,
                                                    color: familyCfg.fg,
                                                }}
                                            >
                                                {familyCfg.label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={cn(
                                                'inline-flex items-center px-2.5 py-0.5 text-xs font-medium',
                                                r.status === 'generating' && 'animate-pulse'
                                            )}
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: statusCfg.bg,
                                                color: statusCfg.fg,
                                            }}
                                        >
                                            {statusCfg.label}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4" style={{ minWidth: 150 }}>
                                        <GroundingBar score={r.grounding_score} />
                                    </td>
                                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                        {formatDate(r.created_at)}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <Link href={`/reports/${r.id}`} aria-label={`Ver informe ${r.report_type}`}>
                                            <ArrowRight className="h-4 w-4" style={{ color: 'var(--g-link)' }} />
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
