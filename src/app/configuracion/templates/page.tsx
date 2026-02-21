'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FileText, ChevronDown, ChevronRight, Search, Plus, Pencil, Trash2,
    Check, X, Clock, Filter, ListChecks, FileBarChart, Layers,
    Briefcase, GitMerge, Handshake, Scissors, Store, AlertTriangle,
    Shield, FileCheck, Zap
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ExpectedDocument {
    id: string;
    area_code: string;
    category: string;
    name: string;
    description: string | null;
    is_mandatory: boolean;
    review_depth: string | null;
    sort_order: number;
}

interface ReportTemplateItem {
    key: string;
    report_type: string;
    family: string;
    title_template: string;
    description?: string;
    required_sections: string[];
    evidence_pack_version: string;
    grounding_required: boolean;
    harvey_skill_key?: string;
    export_formats: string[];
    cadencia: string;
    audience: string[];
    url_allowlist?: string[];
}

// ============================================================
// Constants
// ============================================================

const AREA_COLORS: Record<string, string> = {
    MERC: '160, 60%, 35%',
    MA: '120, 60%, 40%',
    PI: '280, 50%, 45%',
    CONT: '30, 70%, 45%',
    LAB: '340, 55%, 45%',
    FISC: '45, 80%, 42%',
    INM: '100, 45%, 38%',
    LIT: '0, 60%, 45%',
    ADMIN: '210, 40%, 45%',
    DATOS: '250, 55%, 50%',
    GENERAL: '160, 20%, 50%',
};

const AREA_NAMES: Record<string, string> = {
    MERC: 'Mercantil / Societario',
    MA: 'Medio Ambiente',
    PI: 'Propiedad Industrial',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    DATOS: 'Proteccion de Datos',
    GENERAL: 'General',
};

const FAMILY_CONFIG: Record<string, { label: string; color: string }> = {
    transactional: { label: 'Transactional', color: '217, 91%, 60%' },
    pmo: { label: 'PMO', color: '160, 60%, 35%' },
    compliance: { label: 'Compliance', color: '280, 50%, 45%' },
    negotiation: { label: 'Negotiation', color: '30, 70%, 45%' },
    consolidated: { label: 'Consolidated', color: '45, 80%, 42%' },
};

const CADENCIA_CONFIG: Record<string, { label: string; color: string }> = {
    on_demand: { label: 'On Demand', color: '210, 40%, 45%' },
    daily: { label: 'Diario', color: '0, 60%, 45%' },
    weekly: { label: 'Semanal', color: '30, 70%, 45%' },
    monthly: { label: 'Mensual', color: '160, 60%, 35%' },
};

const REVIEW_DEPTH_CONFIG: Record<string, { label: string; color: string }> = {
    light: { label: 'Light', color: '160, 60%, 35%' },
    standard: { label: 'Standard', color: '217, 91%, 60%' },
    enhanced: { label: 'Enhanced', color: '280, 50%, 45%' },
};

const CATEGORIES = [
    'contrato', 'escritura', 'estatutos', 'cuentas_anuales', 'nomina',
    'poliza', 'licencia', 'sentencia', 'informe', 'certificado',
    'convenio', 'acta', 'poder', 'registro', 'general',
];

// ============================================================
// Deal Presets
// ============================================================

interface DealPreset {
    id: string;
    name: string;
    description: string;
    deal_type: string;
    deal_type_color: string;
    icon: React.ComponentType<{ style?: React.CSSProperties }>;
    review_depth: 'light' | 'standard' | 'enhanced';
    areas: string[];
    emphasis_areas?: string[];
    expected_documents_count: number;
    mandatory_documents_count: number;
    report_templates_count: number;
    skills_count: number;
    notes?: string;
}

const DEAL_PRESETS: DealPreset[] = [
    {
        id: 'acquisition-standard',
        name: 'Acquisition Standard',
        description: 'Due diligence completa para adquisiciones M&A. Cobertura integral de todas las areas legales con profundidad mejorada y documentacion exhaustiva.',
        deal_type: 'Acquisition',
        deal_type_color: '217, 91%, 60%',
        icon: Briefcase,
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        expected_documents_count: 85,
        mandatory_documents_count: 62,
        report_templates_count: 12,
        skills_count: 10,
        notes: 'Todos los documentos obligatorios. Revision completa en todas las areas.',
    },
    {
        id: 'merger-fusion',
        name: 'Merger / Fusion',
        description: 'DD especializada para fusiones. Enfasis en aspectos laborales, fiscales y contables con analisis profundo de sinergias y contingencias compartidas.',
        deal_type: 'Merger',
        deal_type_color: '280, 50%, 45%',
        icon: GitMerge,
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['LAB', 'FISC', 'CONT'],
        expected_documents_count: 78,
        mandatory_documents_count: 58,
        report_templates_count: 11,
        skills_count: 10,
        notes: 'Enfasis en LAB, FISC y CONT para valoracion de sinergias.',
    },
    {
        id: 'joint-venture',
        name: 'Joint Venture',
        description: 'Revision adaptada para joint ventures. Alcance reducido enfocado en areas clave de gobernanza, contratos, laboral, fiscal, propiedad intelectual y datos.',
        deal_type: 'Joint Venture',
        deal_type_color: '160, 60%, 35%',
        icon: Handshake,
        review_depth: 'standard',
        areas: ['MERC', 'CONT', 'LAB', 'FISC', 'PI', 'DATOS'],
        expected_documents_count: 48,
        mandatory_documents_count: 32,
        report_templates_count: 8,
        skills_count: 6,
        notes: 'Alcance reducido. Sin areas INM, LIT, ADMIN, MA.',
    },
    {
        id: 'carve-out',
        name: 'Carve-Out',
        description: 'DD para escisiones de unidades de negocio. Enfoque en separacion de activos, contratos, empleados y estructuras fiscales del grupo.',
        deal_type: 'Carve-Out',
        deal_type_color: '30, 70%, 45%',
        icon: Scissors,
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['CONT', 'LAB', 'FISC', 'INM'],
        expected_documents_count: 72,
        mandatory_documents_count: 55,
        report_templates_count: 10,
        skills_count: 10,
        notes: 'Foco en separacion de activos, contratos y empleados.',
    },
    {
        id: 'vendor-dd',
        name: 'Vendor DD (Sell-side)',
        description: 'DD iniciada por el vendedor. Alcance reducido y profundidad ligera, orientada a preparar la presentacion de la compania para potenciales compradores.',
        deal_type: 'Vendor DD',
        deal_type_color: '45, 80%, 42%',
        icon: Store,
        review_depth: 'light',
        areas: ['MERC', 'CONT', 'FISC', 'LAB'],
        expected_documents_count: 35,
        mandatory_documents_count: 22,
        report_templates_count: 6,
        skills_count: 4,
        notes: 'Alcance limitado. Enfocado en presentacion para compradores.',
    },
    {
        id: 'distressed-concursal',
        name: 'Distressed / Concursal',
        description: 'Adquisicion de empresa en situacion concursal o dificultad financiera. Revision profunda de litigios, contingencias fiscales y laborales.',
        deal_type: 'Distressed',
        deal_type_color: '0, 60%, 45%',
        icon: AlertTriangle,
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['LIT', 'FISC', 'LAB'],
        expected_documents_count: 82,
        mandatory_documents_count: 65,
        report_templates_count: 12,
        skills_count: 10,
        notes: 'Enfasis en LIT, FISC y LAB. Analisis de contingencias critico.',
    },
];

type TabId = 'documentos' | 'reportes' | 'presets';

// ============================================================
// Inline Form for Expected Document
// ============================================================

interface DocFormData {
    area_code: string;
    category: string;
    name: string;
    description: string;
    is_mandatory: boolean;
    review_depth: string;
}

const EMPTY_FORM: DocFormData = {
    area_code: 'MERC',
    category: 'general',
    name: '',
    description: '',
    is_mandatory: true,
    review_depth: 'standard',
};

function InlineDocForm({
    initial,
    onSave,
    onCancel,
    saving,
}: {
    initial: DocFormData;
    onSave: (data: DocFormData) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [form, setForm] = useState<DocFormData>(initial);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 2fr 2fr',
            gap: 'var(--g-space-3)',
            padding: 'var(--g-space-3) var(--g-space-4)',
            backgroundColor: 'var(--g-surface-subtle)',
            borderRadius: 'var(--g-radius-md)',
            border: '1px solid var(--g-border-default)',
            alignItems: 'end',
        }}>
            {/* Area code */}
            <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                    Area
                </label>
                <select
                    value={form.area_code}
                    onChange={e => setForm(f => ({ ...f, area_code: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                >
                    {Object.keys(AREA_NAMES).map(code => (
                        <option key={code} value={code}>{code}</option>
                    ))}
                </select>
            </div>

            {/* Category */}
            <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                    Categoria
                </label>
                <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                >
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Name */}
            <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                    Nombre
                </label>
                <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre del documento esperado"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                />
            </div>

            {/* Description */}
            <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                    Descripcion
                </label>
                <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descripcion opcional"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                />
            </div>

            {/* Row 2: toggles and actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)' }}>
                    <input
                        type="checkbox"
                        checked={form.is_mandatory}
                        onChange={e => setForm(f => ({ ...f, is_mandatory: e.target.checked }))}
                        style={{ accentColor: 'hsl(var(--g-brand-3308))' }}
                    />
                    Obligatorio
                </label>
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                    Profundidad
                </label>
                <select
                    value={form.review_depth}
                    onChange={e => setForm(f => ({ ...f, review_depth: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                >
                    <option value="light">Light</option>
                    <option value="standard">Standard</option>
                    <option value="enhanced">Enhanced</option>
                </select>
            </div>

            {/* Save / Cancel */}
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-2)' }}>
                <button
                    onClick={onCancel}
                    disabled={saving}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '6px 14px', fontSize: 'var(--g-text-sm)', fontWeight: 500,
                        borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-default)',
                        backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-secondary)',
                        cursor: 'pointer',
                    }}
                >
                    <X style={{ width: '14px', height: '14px' }} /> Cancelar
                </button>
                <button
                    onClick={() => onSave(form)}
                    disabled={saving || !form.name.trim()}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '6px 14px', fontSize: 'var(--g-text-sm)', fontWeight: 600,
                        borderRadius: 'var(--g-radius-md)', border: 'none',
                        backgroundColor: (!form.name.trim() || saving) ? 'var(--g-border-default)' : 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                        cursor: (!form.name.trim() || saving) ? 'not-allowed' : 'pointer',
                    }}
                >
                    <Check style={{ width: '14px', height: '14px' }} /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================

export default function TemplatesPage() {
    const [activeTab, setActiveTab] = useState<TabId>('documentos');
    const [documents, setDocuments] = useState<ExpectedDocument[]>([]);
    const [templates, setTemplates] = useState<ReportTemplateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterArea, setFilterArea] = useState<string>('all');
    const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
    const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

    // Inline editing state
    const [addingNew, setAddingNew] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    // --------------------------------------------------------
    // Data loading
    // --------------------------------------------------------

    const loadDocuments = useCallback(async (): Promise<ExpectedDocument[]> => {
        const res = await fetch('/api/configuracion/templates?type=expected_documents');
        const json = await res.json();
        if (json.success) {
            setDocuments(json.documents);
            return json.documents as ExpectedDocument[];
        }
        return [];
    }, []);

    const loadTemplates = useCallback(async () => {
        const res = await fetch('/api/configuracion/templates?type=report_templates');
        const json = await res.json();
        if (json.success) {
            setTemplates(json.templates);
        }
    }, []);

    useEffect(() => {
        async function load() {
            const [docs] = await Promise.all([loadDocuments(), loadTemplates()]);
            setLoading(false);
            // Expand all areas by default
            const areaCodes = Array.from(new Set(docs.map(d => d.area_code)));
            setExpandedAreas(new Set(areaCodes));
            // Expand all families by default
            setExpandedFamilies(new Set(Object.keys(FAMILY_CONFIG)));
        }
        load();
    }, [loadDocuments, loadTemplates]);

    // --------------------------------------------------------
    // Document CRUD
    // --------------------------------------------------------

    async function handleCreateDoc(data: DocFormData) {
        setSaving(true);
        try {
            const res = await fetch('/api/configuracion/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                await loadDocuments();
                setAddingNew(false);
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdateDoc(id: string, data: DocFormData) {
        setSaving(true);
        try {
            const res = await fetch('/api/configuracion/templates', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...data }),
            });
            if (res.ok) {
                await loadDocuments();
                setEditingId(null);
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteDoc(id: string) {
        const res = await fetch('/api/configuracion/templates', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (res.ok) {
            await loadDocuments();
        }
    }

    // --------------------------------------------------------
    // Derived data
    // --------------------------------------------------------

    const filteredDocuments = useMemo(() => {
        let result = documents;
        if (filterArea !== 'all') {
            result = result.filter(d => d.area_code === filterArea);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(d =>
                d.name.toLowerCase().includes(q) ||
                d.category.toLowerCase().includes(q) ||
                (d.description && d.description.toLowerCase().includes(q))
            );
        }
        return result;
    }, [documents, filterArea, search]);

    const groupedDocuments = useMemo(() => {
        const map: Record<string, ExpectedDocument[]> = {};
        filteredDocuments.forEach(d => {
            if (!map[d.area_code]) map[d.area_code] = [];
            map[d.area_code].push(d);
        });
        return map;
    }, [filteredDocuments]);

    const groupedTemplates = useMemo(() => {
        const map: Record<string, ReportTemplateItem[]> = {};
        templates.forEach(t => {
            if (!map[t.family]) map[t.family] = [];
            map[t.family].push(t);
        });
        return map;
    }, [templates]);

    const docAreas = useMemo(() => Array.from(new Set(documents.map(d => d.area_code))).sort(), [documents]);
    const mandatoryCount = useMemo(() => documents.filter(d => d.is_mandatory).length, [documents]);

    function toggleAreaExpand(code: string) {
        setExpandedAreas(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });
    }

    function toggleFamilyExpand(family: string) {
        setExpandedFamilies(prev => {
            const next = new Set(prev);
            if (next.has(family)) next.delete(family); else next.add(family);
            return next;
        });
    }

    // --------------------------------------------------------
    // Tab definitions
    // --------------------------------------------------------

    const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'documentos', label: 'Documentos Esperados', icon: <ListChecks style={{ width: '16px', height: '16px' }} /> },
        { id: 'reportes', label: 'Plantillas de Reporte', icon: <FileBarChart style={{ width: '16px', height: '16px' }} /> },
        { id: 'presets', label: 'Presets de Deal', icon: <Layers style={{ width: '16px', height: '16px' }} /> },
    ];

    // --------------------------------------------------------
    // Loading state
    // --------------------------------------------------------

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                {[1, 2, 3].map(i => (
                    <div key={`sk-${i}`} className="skeleton" style={{ height: '120px', borderRadius: 'var(--g-radius-lg)' }} />
                ))}
            </div>
        );
    }

    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Breadcrumb */}
            <nav style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                <span>Configuracion</span>
                <span style={{ margin: '0 6px' }}>/</span>
                <span style={{ color: 'var(--g-text-primary)', fontWeight: 600 }}>Plantillas</span>
            </nav>

            {/* Header */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: '4px' }}>
                    <FileText style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                    <h1 style={{ fontSize: 'var(--g-text-h1)', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        Plantillas y Checklists
                    </h1>
                </div>
                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                    Documentos esperados, plantillas de informe y presets de operacion
                </p>
            </div>

            {/* KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                {[
                    { label: 'Docs Esperados', value: documents.length, color: 'var(--g-text-primary)' },
                    { label: 'Obligatorios', value: mandatoryCount, color: 'var(--status-error)' },
                    { label: 'Areas', value: docAreas.length, color: 'var(--g-text-primary)' },
                    { label: 'Plantillas Reporte', value: templates.length, color: 'var(--g-brand-3308)' },
                ].map((kpi, i) => (
                    <div key={i} className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>{kpi.label}</span>
                        <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: '0', borderBottom: '2px solid var(--g-border-subtle)',
            }}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '10px 20px',
                                fontSize: 'var(--g-text-sm)', fontWeight: isActive ? 700 : 500,
                                color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                backgroundColor: 'transparent',
                                border: 'none', borderBottom: isActive ? '2px solid var(--g-brand-3308)' : '2px solid transparent',
                                marginBottom: '-2px',
                                cursor: 'pointer',
                                transition: 'all var(--g-transition-fast)',
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ============================================================ */}
            {/* TAB 1: Documentos Esperados */}
            {/* ============================================================ */}
            {activeTab === 'documentos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: 'var(--g-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Search */}
                        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '350px' }}>
                            <Search style={{ position: 'absolute', left: 'var(--g-space-3)', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--g-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar documento..."
                                aria-label="Buscar documentos esperados"
                                style={{ width: '100%', padding: 'var(--g-space-2) var(--g-space-3) var(--g-space-2) var(--g-space-9)', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                            />
                        </div>

                        {/* Area filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Filter style={{ width: '14px', height: '14px', color: 'var(--g-text-muted)' }} aria-hidden="true" />
                            <select
                                value={filterArea}
                                onChange={e => setFilterArea(e.target.value)}
                                aria-label="Filtrar por area"
                                style={{ padding: '6px 12px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                            >
                                <option value="all">Todas las areas</option>
                                {docAreas.map(code => (
                                    <option key={code} value={code}>{code} — {AREA_NAMES[code] || code}</option>
                                ))}
                            </select>
                        </div>

                        {/* Result count */}
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
                        </span>

                        <div style={{ flex: 1 }} />

                        {/* Add button */}
                        <button
                            onClick={() => { setAddingNew(true); setEditingId(null); }}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px',
                                fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)', border: 'none',
                                backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus style={{ width: '14px', height: '14px' }} />
                            Nuevo Documento
                        </button>
                    </div>

                    {/* Add form */}
                    {addingNew && (
                        <InlineDocForm
                            initial={EMPTY_FORM}
                            onSave={handleCreateDoc}
                            onCancel={() => setAddingNew(false)}
                            saving={saving}
                        />
                    )}

                    {/* Grouped list */}
                    {Object.keys(groupedDocuments).length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--g-space-12) var(--g-space-4)', border: '1px dashed var(--g-border-subtle)', borderRadius: 'var(--g-radius-lg)', backgroundColor: 'var(--g-surface-card)' }}>
                            <ListChecks style={{ width: '32px', height: '32px', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                            <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>No se encontraron documentos esperados.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                            {Object.entries(groupedDocuments).map(([code, docs]) => {
                                const color = AREA_COLORS[code] || AREA_COLORS.GENERAL;
                                const isExpanded = expandedAreas.has(code);

                                return (
                                    <div key={code}>
                                        {/* Area Header */}
                                        <button
                                            onClick={() => toggleAreaExpand(code)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                                marginBottom: isExpanded ? 'var(--g-space-2)' : 0,
                                                paddingLeft: 'var(--g-space-3)',
                                                borderLeft: `3px solid hsl(${color})`,
                                                background: 'none', border: 'none', borderLeftStyle: 'solid', borderLeftWidth: '3px', borderLeftColor: `hsl(${color})`,
                                                cursor: 'pointer', width: '100%', textAlign: 'left',
                                                padding: 'var(--g-space-2) var(--g-space-3)',
                                            }}
                                        >
                                            {isExpanded
                                                ? <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--g-text-muted)', flexShrink: 0 }} />
                                                : <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--g-text-muted)', flexShrink: 0 }} />
                                            }
                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', fontSize: 'var(--g-text-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 'var(--g-radius-full)', backgroundColor: `hsla(${color}, 0.15)`, color: `hsl(${color})` }}>
                                                {code}
                                            </span>
                                            <span style={{ fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                                                {AREA_NAMES[code] || code}
                                            </span>
                                            <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                                ({docs.length} documento{docs.length !== 1 ? 's' : ''})
                                            </span>
                                        </button>

                                        {/* Documents in area */}
                                        {isExpanded && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                                                {docs.map(doc => {
                                                    const isEditing = editingId === doc.id;
                                                    const depthCfg = REVIEW_DEPTH_CONFIG[doc.review_depth || 'standard'];

                                                    if (isEditing) {
                                                        return (
                                                            <InlineDocForm
                                                                key={doc.id}
                                                                initial={{
                                                                    area_code: doc.area_code,
                                                                    category: doc.category,
                                                                    name: doc.name,
                                                                    description: doc.description || '',
                                                                    is_mandatory: doc.is_mandatory,
                                                                    review_depth: doc.review_depth || 'standard',
                                                                }}
                                                                onSave={(data) => handleUpdateDoc(doc.id, data)}
                                                                onCancel={() => setEditingId(null)}
                                                                saving={saving}
                                                            />
                                                        );
                                                    }

                                                    return (
                                                        <div
                                                            key={doc.id}
                                                            className="g-card"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                                                padding: 'var(--g-space-3) var(--g-space-4)',
                                                            }}
                                                        >
                                                            {/* Name */}
                                                            <span style={{ fontWeight: 600, fontSize: 'var(--g-text-sm)', color: 'var(--g-text-primary)', minWidth: 0 }}>
                                                                {doc.name}
                                                            </span>

                                                            {/* Category badge */}
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center',
                                                                padding: '2px 8px', fontSize: '10px', fontWeight: 600,
                                                                borderRadius: 'var(--g-radius-full)',
                                                                backgroundColor: 'var(--g-surface-muted)',
                                                                color: 'var(--g-text-secondary)',
                                                                whiteSpace: 'nowrap', flexShrink: 0,
                                                            }}>
                                                                {doc.category}
                                                            </span>

                                                            {/* Mandatory badge */}
                                                            {doc.is_mandatory && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center',
                                                                    padding: '2px 6px', fontSize: '9px', fontWeight: 700,
                                                                    borderRadius: 'var(--g-radius-sm)',
                                                                    backgroundColor: 'hsla(0, 72%, 51%, 0.1)',
                                                                    color: 'var(--status-error)',
                                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                                    textTransform: 'uppercase',
                                                                }}>
                                                                    Obligatorio
                                                                </span>
                                                            )}

                                                            {/* Review depth badge */}
                                                            {depthCfg && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center',
                                                                    padding: '2px 6px', fontSize: '9px', fontWeight: 600,
                                                                    borderRadius: 'var(--g-radius-sm)',
                                                                    backgroundColor: `hsla(${depthCfg.color}, 0.1)`,
                                                                    color: `hsl(${depthCfg.color})`,
                                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                                }}>
                                                                    {depthCfg.label}
                                                                </span>
                                                            )}

                                                            {/* Description (muted) */}
                                                            {doc.description && (
                                                                <span style={{
                                                                    fontSize: 'var(--g-text-caption)',
                                                                    color: 'var(--g-text-muted)',
                                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                    maxWidth: '300px',
                                                                }}>
                                                                    {doc.description}
                                                                </span>
                                                            )}

                                                            <div style={{ flex: 1 }} />

                                                            {/* Actions */}
                                                            <div style={{ display: 'flex', gap: 'var(--g-space-1)', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={() => { setEditingId(doc.id); setAddingNew(false); }}
                                                                    title="Editar"
                                                                    aria-label={`Editar ${doc.name}`}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        width: '28px', height: '28px',
                                                                        borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-subtle)',
                                                                        backgroundColor: 'transparent', color: 'var(--g-text-muted)',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    <Pencil style={{ width: '13px', height: '13px' }} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteDoc(doc.id)}
                                                                    title="Eliminar"
                                                                    aria-label={`Eliminar ${doc.name}`}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        width: '28px', height: '28px',
                                                                        borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-subtle)',
                                                                        backgroundColor: 'transparent', color: 'var(--g-text-muted)',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    <Trash2 style={{ width: '13px', height: '13px' }} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ============================================================ */}
            {/* TAB 2: Plantillas de Reporte */}
            {/* ============================================================ */}
            {activeTab === 'reportes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                    {/* Summary */}
                    <div style={{ display: 'flex', gap: 'var(--g-space-3)', flexWrap: 'wrap' }}>
                        {Object.entries(FAMILY_CONFIG).map(([family, cfg]) => {
                            const count = groupedTemplates[family]?.length || 0;
                            return (
                                <div key={family} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: `hsla(${cfg.color}, 0.1)`,
                                    fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                    color: `hsl(${cfg.color})`,
                                }}>
                                    {cfg.label}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '20px', height: '20px',
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: `hsla(${cfg.color}, 0.2)`,
                                        fontSize: '10px', fontWeight: 700,
                                    }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Grouped by family */}
                    {Object.entries(FAMILY_CONFIG).map(([family, cfg]) => {
                        const items = groupedTemplates[family] || [];
                        if (items.length === 0) return null;
                        const isExpanded = expandedFamilies.has(family);

                        return (
                            <div key={family}>
                                {/* Family header */}
                                <button
                                    onClick={() => toggleFamilyExpand(family)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                        marginBottom: isExpanded ? 'var(--g-space-2)' : 0,
                                        paddingLeft: 'var(--g-space-3)',
                                        borderLeft: `3px solid hsl(${cfg.color})`,
                                        background: 'none', border: 'none', borderLeftStyle: 'solid', borderLeftWidth: '3px', borderLeftColor: `hsl(${cfg.color})`,
                                        cursor: 'pointer', width: '100%', textAlign: 'left',
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                    }}
                                >
                                    {isExpanded
                                        ? <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--g-text-muted)', flexShrink: 0 }} />
                                        : <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--g-text-muted)', flexShrink: 0 }} />
                                    }
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
                                        fontSize: 'var(--g-text-caption)', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.05em', borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: `hsla(${cfg.color}, 0.15)`, color: `hsl(${cfg.color})`,
                                    }}>
                                        {cfg.label}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                                        {items.length} plantilla{items.length !== 1 ? 's' : ''}
                                    </span>
                                </button>

                                {/* Templates */}
                                {isExpanded && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                                        {items.map(tmpl => {
                                            const cadCfg = CADENCIA_CONFIG[tmpl.cadencia];

                                            return (
                                                <div
                                                    key={tmpl.key}
                                                    className="g-card"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    {/* Report type key */}
                                                    <span style={{
                                                        fontFamily: 'monospace', fontSize: 'var(--g-text-caption)',
                                                        fontWeight: 600, color: 'var(--g-text-muted)',
                                                        whiteSpace: 'nowrap', minWidth: '180px',
                                                    }}>
                                                        {tmpl.report_type}
                                                    </span>

                                                    {/* Family badge */}
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center',
                                                        padding: '2px 8px', fontSize: '10px', fontWeight: 700,
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: `hsla(${cfg.color}, 0.12)`,
                                                        color: `hsl(${cfg.color})`,
                                                        textTransform: 'uppercase',
                                                        whiteSpace: 'nowrap', flexShrink: 0,
                                                    }}>
                                                        {cfg.label}
                                                    </span>

                                                    {/* Title template */}
                                                    <span style={{
                                                        fontWeight: 600, fontSize: 'var(--g-text-sm)',
                                                        color: 'var(--g-text-primary)',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                        maxWidth: '320px',
                                                    }}>
                                                        {tmpl.title_template}
                                                    </span>

                                                    {/* Cadencia badge */}
                                                    {cadCfg && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 6px', fontSize: '9px', fontWeight: 600,
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: `hsla(${cadCfg.color}, 0.1)`,
                                                            color: `hsl(${cadCfg.color})`,
                                                            whiteSpace: 'nowrap', flexShrink: 0,
                                                        }}>
                                                            <Clock style={{ width: '10px', height: '10px' }} />
                                                            {cadCfg.label}
                                                        </span>
                                                    )}

                                                    <div style={{ flex: 1 }} />

                                                    {/* Audience badges */}
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        {tmpl.audience.map(aud => (
                                                            <span key={aud} style={{
                                                                display: 'inline-flex', padding: '1px 6px',
                                                                fontSize: '9px', fontWeight: 500,
                                                                borderRadius: 'var(--g-radius-full)',
                                                                backgroundColor: 'var(--g-surface-muted)',
                                                                color: 'var(--g-text-secondary)',
                                                                whiteSpace: 'nowrap',
                                                            }}>
                                                                {aud}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Grounding indicator */}
                                                    {tmpl.grounding_required && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center',
                                                            padding: '1px 6px', fontSize: '9px', fontWeight: 600,
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'hsla(160, 60%, 35%, 0.1)',
                                                            color: 'hsl(160, 60%, 35%)',
                                                            whiteSpace: 'nowrap', flexShrink: 0,
                                                        }}>
                                                            Grounding
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ============================================================ */}
            {/* TAB 3: Presets de Deal */}
            {/* ============================================================ */}
            {activeTab === 'presets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                    {/* Intro text */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)',
                        padding: 'var(--g-space-4)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'hsla(217, 91%, 60%, 0.06)',
                        border: '1px solid hsla(217, 91%, 60%, 0.15)',
                    }}>
                        <Shield style={{ width: '18px', height: '18px', color: 'hsl(217, 91%, 60%)', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
                        <div>
                            <p style={{ fontSize: 'var(--g-text-sm)', fontWeight: 600, color: 'var(--g-text-primary)', margin: 0, marginBottom: '4px' }}>
                                Presets de operacion preconfigurados
                            </p>
                            <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                Cada preset define documentos esperados, profundidad de revision, plantillas de reporte y skills activos
                                para un tipo de operacion M&A. Selecciona un preset al crear un nuevo deal para autoconfigurar su estructura.
                            </p>
                        </div>
                    </div>

                    {/* Summary strip */}
                    <div style={{ display: 'flex', gap: 'var(--g-space-3)', flexWrap: 'wrap' }}>
                        {DEAL_PRESETS.map(preset => (
                            <div key={preset.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px',
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: `hsla(${preset.deal_type_color}, 0.1)`,
                                fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                color: `hsl(${preset.deal_type_color})`,
                            }}>
                                <preset.icon style={{ width: '13px', height: '13px' }} />
                                {preset.deal_type}
                            </div>
                        ))}
                    </div>

                    {/* Preset cards grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 'var(--g-space-4)',
                    }}>
                        {DEAL_PRESETS.map(preset => {
                            const depthCfg = REVIEW_DEPTH_CONFIG[preset.review_depth];
                            const PresetIcon = preset.icon;

                            return (
                                <div
                                    key={preset.id}
                                    className="g-card"
                                    style={{
                                        display: 'flex', flexDirection: 'column',
                                        padding: 0,
                                        overflow: 'hidden',
                                        transition: 'box-shadow var(--g-transition-fast), border-color var(--g-transition-fast)',
                                    }}
                                >
                                    {/* Card header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-4) var(--g-space-4) var(--g-space-3)',
                                        borderBottom: '1px solid var(--g-border-subtle)',
                                        background: `linear-gradient(135deg, hsla(${preset.deal_type_color}, 0.04) 0%, transparent 60%)`,
                                    }}>
                                        {/* Icon */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '36px', height: '36px', flexShrink: 0,
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: `hsla(${preset.deal_type_color}, 0.12)`,
                                        }}>
                                            <PresetIcon style={{ width: '18px', height: '18px', color: `hsl(${preset.deal_type_color})` }} />
                                        </div>

                                        {/* Title block */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                {/* Deal type badge */}
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center',
                                                    padding: '2px 8px', fontSize: '10px', fontWeight: 700,
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: `hsla(${preset.deal_type_color}, 0.15)`,
                                                    color: `hsl(${preset.deal_type_color})`,
                                                    textTransform: 'uppercase', letterSpacing: '0.04em',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {preset.deal_type}
                                                </span>

                                                {/* Review depth badge */}
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center',
                                                    padding: '2px 6px', fontSize: '9px', fontWeight: 600,
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: `hsla(${depthCfg.color}, 0.1)`,
                                                    color: `hsl(${depthCfg.color})`,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {depthCfg.label}
                                                </span>
                                            </div>
                                            <h3 style={{
                                                fontSize: 'var(--g-text-base)', fontWeight: 700,
                                                color: 'var(--g-text-primary)', margin: 0,
                                            }}>
                                                {preset.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Card body */}
                                    <div style={{ padding: 'var(--g-space-3) var(--g-space-4)', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                                        {/* Description */}
                                        <p style={{
                                            fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)',
                                            margin: 0, lineHeight: '1.5',
                                        }}>
                                            {preset.description}
                                        </p>

                                        {/* Areas */}
                                        <div>
                                            <span style={{
                                                display: 'block', fontSize: '10px', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                                color: 'var(--g-text-muted)', marginBottom: '6px',
                                            }}>
                                                Areas incluidas ({preset.areas.length})
                                            </span>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {preset.areas.map(area => {
                                                    const areaColor = AREA_COLORS[area] || AREA_COLORS.GENERAL;
                                                    const isEmphasis = preset.emphasis_areas?.includes(area);
                                                    return (
                                                        <span key={area} style={{
                                                            display: 'inline-flex', alignItems: 'center',
                                                            padding: '2px 7px', fontSize: '10px', fontWeight: isEmphasis ? 700 : 600,
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: `hsla(${areaColor}, ${isEmphasis ? 0.22 : 0.12})`,
                                                            color: `hsl(${areaColor})`,
                                                            border: isEmphasis ? `1px solid hsla(${areaColor}, 0.35)` : '1px solid transparent',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {area}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {preset.notes && (
                                            <p style={{
                                                fontSize: '11px', color: 'var(--g-text-muted)',
                                                margin: 0, fontStyle: 'italic', lineHeight: '1.4',
                                            }}>
                                                {preset.notes}
                                            </p>
                                        )}

                                        {/* Spacer to push footer down */}
                                        <div style={{ flex: 1 }} />

                                        {/* Stats row */}
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: 'var(--g-space-2)',
                                            padding: 'var(--g-space-3) 0',
                                            borderTop: '1px solid var(--g-border-subtle)',
                                        }}>
                                            {[
                                                { label: 'Docs', value: preset.expected_documents_count, icon: FileCheck },
                                                { label: 'Oblig.', value: preset.mandatory_documents_count, icon: Shield },
                                                { label: 'Reports', value: preset.report_templates_count, icon: FileBarChart },
                                                { label: 'Skills', value: preset.skills_count, icon: Zap },
                                            ].map((stat) => (
                                                <div key={stat.label} style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                    gap: '2px',
                                                }}>
                                                    <stat.icon style={{ width: '12px', height: '12px', color: 'var(--g-text-muted)' }} />
                                                    <span style={{ fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                                                        {stat.value}
                                                    </span>
                                                    <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--g-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {stat.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Card footer */}
                                    <div style={{
                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                        borderTop: '1px solid var(--g-border-subtle)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                    }}>
                                        <button
                                            onClick={() => setSelectedPreset(selectedPreset === preset.id ? null : preset.id)}
                                            style={{
                                                width: '100%',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                padding: '8px 16px',
                                                fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                                borderRadius: 'var(--g-radius-md)',
                                                border: selectedPreset === preset.id ? '1px solid var(--g-brand-3308)' : '1px solid var(--g-border-default)',
                                                backgroundColor: selectedPreset === preset.id ? 'var(--g-brand-3308)' : 'var(--g-surface-card)',
                                                color: selectedPreset === preset.id ? 'white' : 'var(--g-text-primary)',
                                                cursor: 'pointer',
                                                transition: 'all var(--g-transition-fast)',
                                            }}
                                        >
                                            {selectedPreset === preset.id ? (
                                                <>
                                                    <Check style={{ width: '14px', height: '14px' }} />
                                                    Seleccionado
                                                </>
                                            ) : (
                                                <>
                                                    <Layers style={{ width: '14px', height: '14px' }} />
                                                    Seleccionar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedPreset && (() => {
                        const p = DEAL_PRESETS.find(pr => pr.id === selectedPreset);
                        if (!p) return null;
                        return (
                            <div className="g-card" style={{ padding: 'var(--g-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                                        <p.icon style={{ width: '20px', height: '20px', color: `hsl(${p.deal_type_color})` }} />
                                        <h3 style={{ margin: 0, fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                                            {p.name} — Configuracion del Preset
                                        </h3>
                                    </div>
                                    <span style={{
                                        display: 'inline-flex', padding: '4px 12px', borderRadius: 'var(--g-radius-full)',
                                        fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                        backgroundColor: 'hsla(142, 71%, 45%, 0.1)', color: 'var(--status-success)',
                                    }}>
                                        Activo
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                                    {[
                                        { label: 'Profundidad', value: p.review_depth.charAt(0).toUpperCase() + p.review_depth.slice(1) },
                                        { label: 'Documentos esperados', value: String(p.expected_documents_count) },
                                        { label: 'Obligatorios', value: String(p.mandatory_documents_count) },
                                        { label: 'Skills activos', value: String(p.skills_count) },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--g-text-muted)' }}>{item.label}</span>
                                            <span style={{ fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {p.areas.map(area => (
                                        <span key={area} style={{
                                            display: 'inline-flex', padding: '3px 10px', borderRadius: 'var(--g-radius-full)',
                                            fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                            backgroundColor: p.emphasis_areas?.includes(area) ? 'hsla(217, 91%, 60%, 0.15)' : 'var(--g-surface-muted)',
                                            color: p.emphasis_areas?.includes(area) ? 'hsl(217, 91%, 60%)' : 'var(--g-text-secondary)',
                                            border: p.emphasis_areas?.includes(area) ? '1px solid hsla(217, 91%, 60%, 0.3)' : '1px solid transparent',
                                        }}>
                                            {area}
                                        </span>
                                    ))}
                                </div>
                                {p.notes && (
                                    <p style={{ margin: 0, fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontStyle: 'italic' }}>
                                        {p.notes}
                                    </p>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
