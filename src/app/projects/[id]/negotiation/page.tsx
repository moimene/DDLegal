'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Plus, LayoutGrid, Table2, Filter, X,
    ChevronDown, ChevronUp, Save, Link2, Unlink,
    AlertTriangle, Scale, BookOpen
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    NEGOTIATION_STATUS_CONFIG,
    TREATMENT_CONFIG,
    CLAUSE_TYPE_CONFIG,
    BASKET_TYPE_CONFIG,
    SEVERITY_CONFIG,
    AREA_COLORS,
    formatCurrency,
} from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface ContingencyExt {
    id: string;
    contingency_id: string;
    buy_position: string | null;
    sell_position: string | null;
    treatment: string | null;
    cap_amount: number | null;
    basket_type: string | null;
    basket_amount: number | null;
    survival_months: number | null;
    rwi_coverage: boolean;
    spa_clause_ref: string | null;
    negotiation_status: string;
    notes: string | null;
}

interface NegotiationItem {
    id: string;
    project_id: string;
    area_id: string | null;
    title: string;
    description: string | null;
    severity: string;
    probability: string;
    estimated_amount: number | null;
    amount_currency: string;
    status: string;
    recommendation: string | null;
    created_at: string;
    ext: ContingencyExt | null;
    clause_maps?: Array<{ clause_key: string; is_primary: boolean; merge_fields: Record<string, unknown> }>;
}

interface AreaInfo {
    id: string;
    code: string;
    name: string;
}

interface SPAClause {
    id: string;
    clause_key: string;
    clause_type: string;
    title: string;
    standard_text: string;
    area_code: string | null;
    version: number;
    is_active: boolean;
}

interface LinkedClause {
    id: string;
    contingency_id: string;
    clause_key: string;
    merge_fields: Record<string, unknown>;
    is_primary: boolean;
    clause: SPAClause | null;
}

// ── Constants ────────────────────────────────────────────────────

const NEG_STATUSES = ['open', 'proposed', 'agreed', 'rejected', 'deferred'] as const;
const TREATMENTS = ['indemnity', 'retention', 'escrow', 'price_adjustment', 'insurance', 'waiver'] as const;

type SortField = 'title' | 'area' | 'severity' | 'treatment' | 'estimated_amount' | 'cap_amount' | 'basket_amount' | 'survival_months' | 'negotiation_status' | 'clauses';
type SortDir = 'asc' | 'desc';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const NEG_STATUS_ORDER: Record<string, number> = { open: 0, proposed: 1, agreed: 2, rejected: 3, deferred: 4 };

// ── Helpers ──────────────────────────────────────────────────────

function getNegStatus(item: NegotiationItem): string {
    return item.ext?.negotiation_status || 'open';
}

function getAreaCode(item: NegotiationItem, areas: AreaInfo[]): string {
    if (!item.area_id) return '';
    const area = areas.find(a => a.id === item.area_id);
    return area?.code || '';
}

function truncate(text: string | null | undefined, len: number): string {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '...' : text;
}

// ── Component ────────────────────────────────────────────────────

export default function NegotiationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    // Data state
    const [items, setItems] = useState<NegotiationItem[]>([]);
    const [areas, setAreas] = useState<AreaInfo[]>([]);
    const [projectName, setProjectName] = useState('');
    const [loading, setLoading] = useState(true);

    // View state
    const [viewMode, setViewMode] = useState<'board' | 'table'>('board');

    // Filter state
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterTreatment, setFilterTreatment] = useState<string>('');
    const [filterArea, setFilterArea] = useState<string>('');

    // Detail panel
    const [selectedItem, setSelectedItem] = useState<NegotiationItem | null>(null);
    const [detailSaving, setDetailSaving] = useState(false);

    // Detail form fields (editable copy of ext)
    const [formBuyPosition, setFormBuyPosition] = useState('');
    const [formSellPosition, setFormSellPosition] = useState('');
    const [formTreatment, setFormTreatment] = useState('');
    const [formCapAmount, setFormCapAmount] = useState('');
    const [formBasketType, setFormBasketType] = useState('');
    const [formBasketAmount, setFormBasketAmount] = useState('');
    const [formSurvivalMonths, setFormSurvivalMonths] = useState('');
    const [formRwiCoverage, setFormRwiCoverage] = useState(false);
    const [formSpaClauseRef, setFormSpaClauseRef] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formNegStatus, setFormNegStatus] = useState('open');

    // Linked clauses state
    const [linkedClauses, setLinkedClauses] = useState<LinkedClause[]>([]);

    // SPA clause picker modal
    const [showClausePicker, setShowClausePicker] = useState(false);
    const [clauseLibrary, setClauseLibrary] = useState<SPAClause[]>([]);
    const [clauseFilterType, setClauseFilterType] = useState('');
    const [clauseFilterArea, setClauseFilterArea] = useState('');

    // Table sort
    const [sortField, setSortField] = useState<SortField>('severity');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // New contingency modal
    const [showNewModal, setShowNewModal] = useState(false);

    // ── Data fetching ────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/negotiation?project_id=${id}`);
            const json = await res.json();
            if (json.success) {
                setItems(json.contingencies || []);
            }
        } catch (err) {
            console.error('Failed to fetch negotiation data:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchProjectAndAreas = useCallback(async () => {
        try {
            const [projRes, areasRes] = await Promise.all([
                supabase.from('dd_projects').select('id, name, target_company').eq('id', id).single(),
                supabase.from('dd_areas').select('id, code, name').order('sort_order'),
            ]);
            if (projRes.data) {
                setProjectName(projRes.data.name || projRes.data.target_company || '');
            }
            if (areasRes.data) {
                setAreas(areasRes.data);
            }
        } catch {
            // Silently fail
        }
    }, [id]);

    useEffect(() => {
        fetchData();
        fetchProjectAndAreas();
    }, [fetchData, fetchProjectAndAreas]);

    const fetchLinkedClauses = useCallback(async (contingencyId: string) => {
        try {
            // Use the single-contingency endpoint which returns clause_maps
            const res = await fetch(`/api/negotiation?project_id=${id}&contingency_id=${contingencyId}`);
            const json = await res.json();
            if (json.success && json.contingency?.clause_maps) {
                // Fetch clause details for each clause_key
                const maps = json.contingency.clause_maps as Array<{
                    id: string; contingency_id: string; clause_key: string;
                    merge_fields: Record<string, unknown>; is_primary: boolean;
                }>;
                // Fetch clause library to resolve clause details
                const libRes = await fetch('/api/negotiation/clauses');
                const libJson = await libRes.json();
                const clauseByKey: Record<string, SPAClause> = {};
                if (libJson.success) {
                    for (const c of (libJson.clauses || [])) {
                        clauseByKey[c.clause_key] = c;
                    }
                }
                setLinkedClauses(maps.map(m => ({
                    ...m,
                    clause: clauseByKey[m.clause_key] || null,
                })));
            } else {
                setLinkedClauses([]);
            }
        } catch {
            setLinkedClauses([]);
        }
    }, [id]);

    const fetchClauseLibrary = useCallback(async () => {
        try {
            const res = await fetch('/api/negotiation/clauses');
            const json = await res.json();
            if (json.success) {
                setClauseLibrary(json.clauses || []);
            }
        } catch {
            setClauseLibrary([]);
        }
    }, []);

    // ── Detail panel logic ───────────────────────────────────────

    const openDetail = (item: NegotiationItem) => {
        setSelectedItem(item);
        const ext = item.ext;
        setFormBuyPosition(ext?.buy_position || '');
        setFormSellPosition(ext?.sell_position || '');
        setFormTreatment(ext?.treatment || '');
        setFormCapAmount(ext?.cap_amount != null ? String(ext.cap_amount) : '');
        setFormBasketType(ext?.basket_type || '');
        setFormBasketAmount(ext?.basket_amount != null ? String(ext.basket_amount) : '');
        setFormSurvivalMonths(ext?.survival_months != null ? String(ext.survival_months) : '');
        setFormRwiCoverage(ext?.rwi_coverage || false);
        setFormSpaClauseRef(ext?.spa_clause_ref || '');
        setFormNotes(ext?.notes || '');
        setFormNegStatus(ext?.negotiation_status || 'open');
        fetchLinkedClauses(item.id);
    };

    const closeDetail = () => {
        setSelectedItem(null);
        setLinkedClauses([]);
    };

    const handleSaveDetail = async () => {
        if (!selectedItem) return;
        setDetailSaving(true);

        try {
            const payload: Record<string, unknown> = {
                contingency_id: selectedItem.id,
                buy_position: formBuyPosition || null,
                sell_position: formSellPosition || null,
                treatment: formTreatment || null,
                cap_amount: formCapAmount ? parseFloat(formCapAmount) : null,
                basket_type: formBasketType || null,
                basket_amount: formBasketAmount ? parseFloat(formBasketAmount) : null,
                survival_months: formSurvivalMonths ? parseInt(formSurvivalMonths) : null,
                rwi_coverage: formRwiCoverage,
                spa_clause_ref: formSpaClauseRef || null,
                notes: formNotes || null,
                negotiation_status: formNegStatus,
            };

            const res = await fetch('/api/negotiation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.success) {
                // Refresh data
                await fetchData();
                // Update selected item's ext data in-place
                setSelectedItem(prev => prev ? {
                    ...prev,
                    ext: json.ext as ContingencyExt,
                } : null);
            }
        } catch (err) {
            console.error('Failed to save negotiation data:', err);
        } finally {
            setDetailSaving(false);
        }
    };

    // ── Clause linking ───────────────────────────────────────────

    const handleLinkClause = async (clauseKey: string) => {
        if (!selectedItem) return;
        try {
            const res = await fetch('/api/negotiation/clauses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contingency_id: selectedItem.id, clause_key: clauseKey }),
            });
            const json = await res.json();
            if (json.success) {
                fetchLinkedClauses(selectedItem.id);
                fetchData();
            }
        } catch (err) {
            console.error('Failed to link clause:', err);
        }
    };

    const handleUnlinkClause = async (clauseKey: string) => {
        if (!selectedItem) return;
        try {
            const res = await fetch('/api/negotiation/clauses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contingency_id: selectedItem.id, clause_key: clauseKey }),
            });
            const json = await res.json();
            if (json.success) {
                fetchLinkedClauses(selectedItem.id);
                fetchData();
            }
        } catch (err) {
            console.error('Failed to unlink clause:', err);
        }
    };

    // ── Filtering ────────────────────────────────────────────────

    const filteredItems = items.filter(item => {
        if (filterStatus && getNegStatus(item) !== filterStatus) return false;
        if (filterTreatment && (item.ext?.treatment || '') !== filterTreatment) return false;
        if (filterArea) {
            const code = getAreaCode(item, areas);
            if (code !== filterArea) return false;
        }
        return true;
    });

    // ── Sorting (for table view) ─────────────────────────────────

    const sortedItems = [...filteredItems].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case 'title':
                cmp = a.title.localeCompare(b.title);
                break;
            case 'area':
                cmp = getAreaCode(a, areas).localeCompare(getAreaCode(b, areas));
                break;
            case 'severity':
                cmp = (SEVERITY_ORDER[a.severity] || 9) - (SEVERITY_ORDER[b.severity] || 9);
                break;
            case 'treatment':
                cmp = (a.ext?.treatment || '').localeCompare(b.ext?.treatment || '');
                break;
            case 'estimated_amount':
                cmp = (a.estimated_amount || 0) - (b.estimated_amount || 0);
                break;
            case 'cap_amount':
                cmp = (a.ext?.cap_amount || 0) - (b.ext?.cap_amount || 0);
                break;
            case 'basket_amount':
                cmp = (a.ext?.basket_amount || 0) - (b.ext?.basket_amount || 0);
                break;
            case 'survival_months':
                cmp = (a.ext?.survival_months || 0) - (b.ext?.survival_months || 0);
                break;
            case 'negotiation_status':
                cmp = (NEG_STATUS_ORDER[getNegStatus(a)] || 9) - (NEG_STATUS_ORDER[getNegStatus(b)] || 9);
                break;
            case 'clauses':
                cmp = (a.clause_maps?.length || 0) - (b.clause_maps?.length || 0);
                break;
        }
        return sortDir === 'desc' ? -cmp : cmp;
    });

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    // ── Board grouping ───────────────────────────────────────────

    const boardColumns = NEG_STATUSES.map(status => ({
        status,
        config: NEGOTIATION_STATUS_CONFIG[status],
        items: filteredItems.filter(item => getNegStatus(item) === status),
    }));

    // ── Unique area codes for filter ─────────────────────────────

    const uniqueAreaCodes = Array.from(new Set(items.map(i => getAreaCode(i, areas)).filter(Boolean))).sort();

    // ── Loading state ────────────────────────────────────────────

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-12 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-96 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* ── Header ──────────────────────────────────────────── */}
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
                        Negociacion
                    </h1>
                    {projectName && (
                        <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>{projectName}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', overflow: 'hidden' }}>
                        <button
                            onClick={() => setViewMode('board')}
                            className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                            style={{
                                backgroundColor: viewMode === 'board' ? 'var(--g-brand-3308)' : 'var(--g-surface-card)',
                                color: viewMode === 'board' ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                            }}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Board
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                            style={{
                                backgroundColor: viewMode === 'table' ? 'var(--g-brand-3308)' : 'var(--g-surface-card)',
                                color: viewMode === 'table' ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                            }}
                        >
                            <Table2 className="h-3.5 w-3.5" /> Tabla
                        </button>
                    </div>
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                        style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                    >
                        <Plus className="h-3.5 w-3.5" /> Nuevo
                    </button>
                </div>
            </div>

            {/* ── Filter Bar ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--g-text-secondary)' }} />

                {/* Status pills */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setFilterStatus('')}
                        className="px-2 py-1 text-xs"
                        style={{
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: !filterStatus ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                            color: !filterStatus ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                            fontWeight: !filterStatus ? 600 : 400,
                        }}
                    >
                        Todos
                    </button>
                    {NEG_STATUSES.map(s => {
                        const cfg = NEGOTIATION_STATUS_CONFIG[s];
                        return (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                                className="px-2 py-1 text-xs"
                                style={{
                                    borderRadius: 'var(--g-radius-sm)',
                                    backgroundColor: filterStatus === s ? cfg.bg : 'var(--g-surface-muted)',
                                    color: filterStatus === s ? cfg.fg : 'var(--g-text-secondary)',
                                    fontWeight: filterStatus === s ? 600 : 400,
                                }}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>

                {/* Treatment dropdown */}
                <select
                    value={filterTreatment}
                    onChange={e => setFilterTreatment(e.target.value)}
                    className="h-7 px-2 text-xs border"
                    style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)' }}
                >
                    <option value="">Tratamiento: Todos</option>
                    {TREATMENTS.map(t => (
                        <option key={t} value={t}>{TREATMENT_CONFIG[t].label}</option>
                    ))}
                </select>

                {/* Area dropdown */}
                {uniqueAreaCodes.length > 0 && (
                    <select
                        value={filterArea}
                        onChange={e => setFilterArea(e.target.value)}
                        className="h-7 px-2 text-xs border"
                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)' }}
                    >
                        <option value="">Area: Todas</option>
                        {uniqueAreaCodes.map(code => (
                            <option key={code} value={code}>{code}</option>
                        ))}
                    </select>
                )}

                <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                    {filteredItems.length} de {items.length} contingencias
                </span>
            </div>

            {/* ── Empty state ─────────────────────────────────────── */}
            {items.length === 0 && (
                <div
                    className="flex flex-col items-center justify-center py-16"
                    style={{ backgroundColor: 'var(--g-surface-card)', borderRadius: 'var(--g-radius-lg)', border: '1px solid var(--g-border-default)' }}
                >
                    <Scale className="h-12 w-12 mb-4" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>No hay contingencias en negociacion</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        Las contingencias identificadas en el proyecto aparecen aqui para su seguimiento de negociacion.
                    </p>
                </div>
            )}

            {/* ── Board View ──────────────────────────────────────── */}
            {viewMode === 'board' && items.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '400px' }}>
                    {boardColumns.map(col => (
                        <div
                            key={col.status}
                            className="flex-1 min-w-[240px] flex flex-col"
                            style={{ minWidth: 240 }}
                        >
                            {/* Column header */}
                            <div
                                className="flex items-center justify-between px-3 py-2 mb-2"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: col.config.bg,
                                    color: col.config.fg,
                                }}
                            >
                                <span className="text-xs font-semibold">{col.config.label}</span>
                                <span
                                    className="text-xs px-1.5 py-0.5"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                    }}
                                >
                                    {col.items.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="flex flex-col gap-2 flex-1">
                                {col.items.length === 0 && (
                                    <div
                                        className="flex items-center justify-center py-8 text-xs"
                                        style={{
                                            color: 'var(--g-text-secondary)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1px dashed var(--g-border-default)',
                                        }}
                                    >
                                        Sin items
                                    </div>
                                )}
                                {col.items.map(item => {
                                    const sevCfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
                                    const areaCode = getAreaCode(item, areas);
                                    const treatCfg = item.ext?.treatment ? TREATMENT_CONFIG[item.ext.treatment as keyof typeof TREATMENT_CONFIG] : null;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => openDetail(item)}
                                            className="w-full text-left p-3 transition-all hover:translate-y-[-1px]"
                                            style={{
                                                backgroundColor: 'var(--g-surface-card)',
                                                borderRadius: 'var(--g-radius-md)',
                                                border: '1px solid var(--g-border-default)',
                                            }}
                                        >
                                            {/* Title */}
                                            <p className="text-xs font-medium mb-2 line-clamp-2" style={{ color: 'var(--g-text-primary)' }}>
                                                {item.title}
                                            </p>

                                            {/* Badges row */}
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {/* Severity */}
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
                                                {/* Area */}
                                                {areaCode && (
                                                    <span
                                                        className="px-1.5 py-0.5 text-xs"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: AREA_COLORS[areaCode]
                                                                ? `hsla(${AREA_COLORS[areaCode]}, 0.15)`
                                                                : 'var(--g-surface-muted)',
                                                            color: AREA_COLORS[areaCode]
                                                                ? `hsl(${AREA_COLORS[areaCode]})`
                                                                : 'var(--g-text-secondary)',
                                                        }}
                                                    >
                                                        {areaCode}
                                                    </span>
                                                )}
                                                {/* Treatment */}
                                                {treatCfg && (
                                                    <span
                                                        className="px-1.5 py-0.5 text-xs"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: treatCfg.color,
                                                        }}
                                                    >
                                                        {treatCfg.label}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Impact */}
                                            {item.estimated_amount != null && (
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                                    {formatCurrency(item.estimated_amount)}
                                                </p>
                                            )}

                                            {/* Positions (truncated) */}
                                            {item.ext?.buy_position && (
                                                <p className="text-xs mb-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                    <span style={{ color: 'var(--status-info)' }}>C:</span> {truncate(item.ext.buy_position, 60)}
                                                </p>
                                            )}
                                            {item.ext?.sell_position && (
                                                <p className="text-xs mb-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                    <span style={{ color: 'var(--status-warning)' }}>V:</span> {truncate(item.ext.sell_position, 60)}
                                                </p>
                                            )}

                                            {/* Cap + Clauses footer */}
                                            <div className="flex items-center gap-2 mt-2 pt-1.5 border-t" style={{ borderColor: 'var(--g-border-default)' }}>
                                                {item.ext?.cap_amount != null && (
                                                    <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                        Cap: {formatCurrency(item.ext.cap_amount)}
                                                    </span>
                                                )}
                                                {(item.clause_maps?.length || 0) > 0 && (
                                                    <span className="text-xs ml-auto inline-flex items-center gap-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                        <BookOpen className="h-3 w-3" />
                                                        {item.clause_maps?.length} SPA
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Table View ──────────────────────────────────────── */}
            {viewMode === 'table' && items.length > 0 && (
                <div
                    className="overflow-x-auto"
                    style={{ backgroundColor: 'var(--g-surface-card)', borderRadius: 'var(--g-radius-lg)', border: '1px solid var(--g-border-default)' }}
                >
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                {([
                                    { key: 'title' as SortField, label: 'Contingencia', width: 'auto' },
                                    { key: 'area' as SortField, label: 'Area', width: '70px' },
                                    { key: 'severity' as SortField, label: 'Severidad', width: '90px' },
                                    { key: 'treatment' as SortField, label: 'Tratamiento', width: '110px' },
                                    { key: 'estimated_amount' as SortField, label: 'Impacto Est.', width: '110px' },
                                    { key: 'cap_amount' as SortField, label: 'Cap', width: '100px' },
                                    { key: 'basket_amount' as SortField, label: 'Basket', width: '100px' },
                                    { key: 'survival_months' as SortField, label: 'Supervivencia', width: '95px' },
                                    { key: 'negotiation_status' as SortField, label: 'Estado Neg.', width: '100px' },
                                    { key: 'clauses' as SortField, label: 'SPA', width: '55px' },
                                ]).map(col => (
                                    <th
                                        key={col.key}
                                        className="text-left px-3 py-2 text-xs font-semibold cursor-pointer select-none"
                                        style={{ color: 'var(--g-text-secondary)', width: col.width }}
                                        onClick={() => toggleSort(col.key)}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {col.label}
                                            {sortField === col.key && (
                                                sortDir === 'asc'
                                                    ? <ChevronUp className="h-3 w-3" />
                                                    : <ChevronDown className="h-3 w-3" />
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map(item => {
                                const sevCfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
                                const areaCode = getAreaCode(item, areas);
                                const treatCfg = item.ext?.treatment ? TREATMENT_CONFIG[item.ext.treatment as keyof typeof TREATMENT_CONFIG] : null;
                                const negCfg = NEGOTIATION_STATUS_CONFIG[getNegStatus(item)];

                                return (
                                    <tr
                                        key={item.id}
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ borderBottom: '1px solid var(--g-border-default)' }}
                                        onClick={() => openDetail(item)}
                                    >
                                        <td className="px-3 py-2.5">
                                            <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>{truncate(item.title, 50)}</p>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {areaCode && (
                                                <span
                                                    className="px-1.5 py-0.5 text-xs"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: AREA_COLORS[areaCode]
                                                            ? `hsla(${AREA_COLORS[areaCode]}, 0.15)`
                                                            : 'var(--g-surface-muted)',
                                                        color: AREA_COLORS[areaCode]
                                                            ? `hsl(${AREA_COLORS[areaCode]})`
                                                            : 'var(--g-text-secondary)',
                                                    }}
                                                >
                                                    {areaCode}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {sevCfg && (
                                                <span
                                                    className="px-1.5 py-0.5 text-xs font-medium"
                                                    style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: sevCfg.color, color: '#fff' }}
                                                >
                                                    {sevCfg.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {treatCfg && (
                                                <span className="text-xs" style={{ color: treatCfg.color }}>{treatCfg.label}</span>
                                            )}
                                            {!treatCfg && <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>--</span>}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                                {formatCurrency(item.estimated_amount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                                {formatCurrency(item.ext?.cap_amount ?? null)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                                {formatCurrency(item.ext?.basket_amount ?? null)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                                {item.ext?.survival_months != null ? `${item.ext.survival_months}m` : '--'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {negCfg && (
                                                <span
                                                    className="px-1.5 py-0.5 text-xs"
                                                    style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: negCfg.bg, color: negCfg.fg }}
                                                >
                                                    {negCfg.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                {item.clause_maps?.length || 0}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Detail Panel (Slide-out) ────────────────────────── */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    {/* Backdrop close */}
                    <div className="flex-1" onClick={closeDetail} />

                    {/* Panel */}
                    <div
                        className="w-full max-w-lg overflow-y-auto"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderLeft: '1px solid var(--g-border-default)',
                        }}
                    >
                        <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                            {/* Panel header */}
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                        {selectedItem.title}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(() => {
                                            const sc = SEVERITY_CONFIG[selectedItem.severity as keyof typeof SEVERITY_CONFIG];
                                            return sc ? (
                                                <span className="px-1.5 py-0.5 text-xs font-medium" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: sc.color, color: '#fff' }}>
                                                    {sc.label}
                                                </span>
                                            ) : null;
                                        })()}
                                        {getAreaCode(selectedItem, areas) && (
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                {getAreaCode(selectedItem, areas)}
                                            </span>
                                        )}
                                        {selectedItem.estimated_amount != null && (
                                            <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {formatCurrency(selectedItem.estimated_amount)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={closeDetail} className="p-1 ml-2" style={{ color: 'var(--g-text-secondary)' }}>
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Description */}
                            {selectedItem.description && (
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{selectedItem.description}</p>
                                </div>
                            )}

                            {/* Recommendation */}
                            {selectedItem.recommendation && (
                                <div className="p-2 text-xs" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-md)', color: 'var(--g-text-primary)' }}>
                                    <span className="font-medium">Recomendacion:</span> {selectedItem.recommendation}
                                </div>
                            )}

                            <hr style={{ borderColor: 'var(--g-border-default)' }} />

                            {/* ── Estado Negociacion ────────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Estado Negociacion</label>
                                <div className="flex flex-wrap gap-1">
                                    {NEG_STATUSES.map(s => {
                                        const cfg = NEGOTIATION_STATUS_CONFIG[s];
                                        const selected = formNegStatus === s;
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setFormNegStatus(s)}
                                                className="px-2.5 py-1 text-xs"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: selected ? cfg.bg : 'var(--g-surface-muted)',
                                                    color: selected ? cfg.fg : 'var(--g-text-secondary)',
                                                    fontWeight: selected ? 600 : 400,
                                                    border: selected ? 'none' : '1px solid var(--g-border-default)',
                                                }}
                                            >
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Posicion Compradora ───────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                    Posicion Compradora
                                </label>
                                <textarea
                                    value={formBuyPosition}
                                    onChange={e => setFormBuyPosition(e.target.value)}
                                    rows={3}
                                    placeholder="Posicion y argumentos del comprador..."
                                    className="w-full px-3 py-2 text-xs border resize-none"
                                    style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                />
                            </div>

                            {/* ── Posicion Vendedora ────────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                    Posicion Vendedora
                                </label>
                                <textarea
                                    value={formSellPosition}
                                    onChange={e => setFormSellPosition(e.target.value)}
                                    rows={3}
                                    placeholder="Posicion y argumentos del vendedor..."
                                    className="w-full px-3 py-2 text-xs border resize-none"
                                    style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                />
                            </div>

                            {/* ── Tratamiento ──────────────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Tratamiento</label>
                                <select
                                    value={formTreatment}
                                    onChange={e => setFormTreatment(e.target.value)}
                                    className="w-full h-9 px-3 text-xs border"
                                    style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                >
                                    <option value="">Sin asignar</option>
                                    {TREATMENTS.map(t => (
                                        <option key={t} value={t}>{TREATMENT_CONFIG[t].label} -- {TREATMENT_CONFIG[t].description}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ── Cap + Basket row ─────────────────── */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Cap (EUR)</label>
                                    <input
                                        type="number"
                                        value={formCapAmount}
                                        onChange={e => setFormCapAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-9 px-3 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Basket Type</label>
                                    <select
                                        value={formBasketType}
                                        onChange={e => setFormBasketType(e.target.value)}
                                        className="w-full h-9 px-3 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    >
                                        <option value="">Sin asignar</option>
                                        {(Object.entries(BASKET_TYPE_CONFIG) as [string, { label: string; description: string }][]).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label} -- {v.description}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ── Basket Amount + Survival ─────────── */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Basket Amount (EUR)</label>
                                    <input
                                        type="number"
                                        value={formBasketAmount}
                                        onChange={e => setFormBasketAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-9 px-3 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Meses Supervivencia</label>
                                    <input
                                        type="number"
                                        value={formSurvivalMonths}
                                        onChange={e => setFormSurvivalMonths(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-9 px-3 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                </div>
                            </div>

                            {/* ── R&W Coverage ─────────────────────── */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rwiCoverage"
                                    checked={formRwiCoverage}
                                    onChange={e => setFormRwiCoverage(e.target.checked)}
                                    className="h-4 w-4"
                                    style={{ accentColor: 'var(--g-brand-3308)' }}
                                />
                                <label htmlFor="rwiCoverage" className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    Cobertura R&W (Seguro de Representaciones y Garantias)
                                </label>
                            </div>

                            {/* ── SPA Clause Ref ───────────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Referencia Clausula SPA</label>
                                <input
                                    type="text"
                                    value={formSpaClauseRef}
                                    onChange={e => setFormSpaClauseRef(e.target.value)}
                                    placeholder="Ej: Clausula 8.2(a)"
                                    className="w-full h-9 px-3 text-xs border"
                                    style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                />
                            </div>

                            {/* ── Notas ────────────────────────────── */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Notas</label>
                                <textarea
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Notas internas sobre la negociacion..."
                                    className="w-full px-3 py-2 text-xs border resize-none"
                                    style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                />
                            </div>

                            <hr style={{ borderColor: 'var(--g-border-default)' }} />

                            {/* ── Clausulas SPA Vinculadas ─────────── */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        Clausulas SPA Vinculadas ({linkedClauses.length})
                                    </label>
                                    <button
                                        onClick={() => {
                                            fetchClauseLibrary();
                                            setShowClausePicker(true);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                                        style={{
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                            color: 'var(--g-brand-3308)',
                                        }}
                                    >
                                        <Link2 className="h-3 w-3" /> Vincular
                                    </button>
                                </div>
                                {linkedClauses.length === 0 && (
                                    <p className="text-xs py-2" style={{ color: 'var(--g-text-secondary)' }}>
                                        Sin clausulas vinculadas.
                                    </p>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {linkedClauses.map(lc => {
                                        const ct = lc.clause?.clause_type ? CLAUSE_TYPE_CONFIG[lc.clause.clause_type as keyof typeof CLAUSE_TYPE_CONFIG] : null;
                                        return (
                                            <div
                                                key={lc.id}
                                                className="flex items-start gap-2 p-2 border"
                                                style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)' }}
                                            >
                                                <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--g-brand-3308)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {lc.clause?.title || lc.clause_key}
                                                    </p>
                                                    {ct && (
                                                        <span className="text-xs" style={{ color: ct.color }}>{ct.label}</span>
                                                    )}
                                                    {lc.clause?.standard_text && (
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {truncate(lc.clause.standard_text, 100)}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleUnlinkClause(lc.clause_key)}
                                                    className="p-1 shrink-0"
                                                    style={{ color: 'var(--status-error)' }}
                                                    title="Desvincular"
                                                >
                                                    <Unlink className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Save Button ──────────────────────── */}
                            <button
                                onClick={handleSaveDetail}
                                disabled={detailSaving}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                                style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                            >
                                <Save className="h-4 w-4" />
                                {detailSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SPA Clause Picker Modal ─────────────────────────── */}
            {showClausePicker && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div
                        className="w-full max-w-2xl max-h-[80vh] flex flex-col"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderRadius: 'var(--g-radius-xl)',
                            border: '1px solid var(--g-border-default)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--g-border-default)' }}>
                            <h3 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                Biblioteca de Clausulas SPA
                            </h3>
                            <button onClick={() => setShowClausePicker(false)} className="p-1" style={{ color: 'var(--g-text-secondary)' }}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--g-border-default)' }}>
                            <select
                                value={clauseFilterType}
                                onChange={e => setClauseFilterType(e.target.value)}
                                className="h-7 px-2 text-xs border"
                                style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                            >
                                <option value="">Tipo: Todos</option>
                                {Object.entries(CLAUSE_TYPE_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                            <select
                                value={clauseFilterArea}
                                onChange={e => setClauseFilterArea(e.target.value)}
                                className="h-7 px-2 text-xs border"
                                style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                            >
                                <option value="">Area: Todas</option>
                                {uniqueAreaCodes.map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                            <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>
                                {clauseLibrary.filter(c => {
                                    if (clauseFilterType && c.clause_type !== clauseFilterType) return false;
                                    if (clauseFilterArea && c.area_code !== clauseFilterArea) return false;
                                    return true;
                                }).length} clausulas
                            </span>
                        </div>

                        {/* Clause list */}
                        <div className="flex-1 overflow-y-auto p-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {clauseLibrary
                                .filter(c => {
                                    if (clauseFilterType && c.clause_type !== clauseFilterType) return false;
                                    if (clauseFilterArea && c.area_code !== clauseFilterArea) return false;
                                    return true;
                                })
                                .map(clause => {
                                    const ct = CLAUSE_TYPE_CONFIG[clause.clause_type as keyof typeof CLAUSE_TYPE_CONFIG];
                                    const alreadyLinked = linkedClauses.some(lc => lc.clause_key === clause.clause_key);
                                    return (
                                        <div
                                            key={clause.id}
                                            className="flex items-start gap-3 p-3 border transition-all"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                borderColor: alreadyLinked ? 'var(--status-success)' : 'var(--g-border-default)',
                                                opacity: alreadyLinked ? 0.6 : 1,
                                            }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {clause.title}
                                                    </p>
                                                    {ct && (
                                                        <span
                                                            className="px-1.5 py-0.5 text-xs shrink-0"
                                                            style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--g-surface-muted)', color: ct.color }}
                                                        >
                                                            {ct.label}
                                                        </span>
                                                    )}
                                                    {clause.area_code && (
                                                        <span className="text-xs shrink-0" style={{ color: 'var(--g-text-secondary)' }}>
                                                            {clause.area_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {truncate(clause.standard_text, 150)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => !alreadyLinked && handleLinkClause(clause.clause_key)}
                                                disabled={alreadyLinked}
                                                className="px-2.5 py-1 text-xs font-medium shrink-0 disabled:opacity-50"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: alreadyLinked ? 'var(--status-success)' : 'var(--g-brand-3308)',
                                                    color: 'var(--g-text-inverse)',
                                                }}
                                            >
                                                {alreadyLinked ? 'Vinculada' : 'Vincular'}
                                            </button>
                                        </div>
                                    );
                                })}
                            {clauseLibrary.length === 0 && (
                                <div className="text-center py-8">
                                    <BookOpen className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                        No hay clausulas en la biblioteca.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── "Nuevo" Modal (link contingency to negotiation) ── */}
            {showNewModal && (
                <NewNegotiationModal
                    items={items}
                    onClose={() => setShowNewModal(false)}
                    onCreated={() => {
                        setShowNewModal(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}

// ── New Negotiation Modal (sub-component) ────────────────────────

interface NewNegotiationModalProps {
    items: NegotiationItem[];
    onClose: () => void;
    onCreated: () => void;
}

function NewNegotiationModal({ items, onClose, onCreated }: NewNegotiationModalProps) {
    const [contingencies, setContingencies] = useState<Array<{ id: string; title: string; severity: string }>>([]);
    const [selectedContingencyId, setSelectedContingencyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Filter contingencies that don't yet have ext (negotiation) records
        const unlinked = items.filter(i => !i.ext);
        setContingencies(unlinked.map(c => ({ id: c.id, title: c.title, severity: c.severity })));
        setLoading(false);
    }, [items]);

    const handleCreate = async () => {
        if (!selectedContingencyId) return;
        setSaving(true);
        try {
            const res = await fetch('/api/negotiation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contingency_id: selectedContingencyId,
                    negotiation_status: 'open',
                }),
            });
            const json = await res.json();
            if (json.success) {
                onCreated();
            }
        } catch (err) {
            console.error('Failed to create negotiation record:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div
                className="w-full max-w-md p-6"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-xl)',
                    border: '1px solid var(--g-border-default)',
                }}
            >
                <h3 className="font-bold mb-4" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                    Agregar Contingencia a Negociacion
                </h3>

                {loading ? (
                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Cargando...</p>
                ) : contingencies.length === 0 ? (
                    <div className="text-center py-6">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                            Todas las contingencias ya estan vinculadas a negociacion.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                Seleccionar contingencia
                            </label>
                            <select
                                value={selectedContingencyId}
                                onChange={e => setSelectedContingencyId(e.target.value)}
                                className="w-full h-9 px-3 text-xs border"
                                style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                            >
                                <option value="">Seleccionar...</option>
                                {contingencies.map(c => {
                                    const sev = SEVERITY_CONFIG[c.severity as keyof typeof SEVERITY_CONFIG];
                                    return (
                                        <option key={c.id} value={c.id}>
                                            [{sev?.label || c.severity}] {c.title}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border"
                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!selectedContingencyId || saving}
                        className="px-4 py-2 text-sm font-medium disabled:opacity-50"
                        style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                    >
                        {saving ? 'Creando...' : 'Agregar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
