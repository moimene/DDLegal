'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, FolderKanban, ChevronRight, Check,
    Briefcase, GitMerge, Handshake, Scissors, Store, AlertTriangle,
    Settings2, Layers, FileCheck, Clock, ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { REVIEW_DEPTH_CONFIG } from '@/lib/utils';
import type { ReviewDepth } from '@/lib/supabase-auth';

// ============================================================
// Types
// ============================================================

type PresetId = 'acquisition' | 'merger' | 'joint-venture' | 'carve-out' | 'vendor-dd' | 'distressed' | 'custom';

interface AreaConfig {
    code: string;
    name: string;
    color: string;
    estimatedTasks: number;
    defaultSlaDays: number;
    enabled: boolean;
    slaDays: number;
}

interface DealPreset {
    id: PresetId;
    emoji: string;
    name: string;
    description: string;
    review_depth: ReviewDepth;
    areas: string[];
    emphasis_areas?: string[];
    expected_documents_count: number;
    icon: React.ComponentType<{ style?: React.CSSProperties; className?: string }>;
}

// ============================================================
// Area Master Data
// ============================================================

const AREA_MASTER: Record<string, { name: string; color: string; estimatedTasks: number; defaultSlaDays: number }> = {
    MERC: { name: 'Mercantil / Societario', color: 'hsl(160, 60%, 35%)', estimatedTasks: 12, defaultSlaDays: 14 },
    CONT: { name: 'Contratos', color: 'hsl(30, 70%, 45%)', estimatedTasks: 10, defaultSlaDays: 12 },
    LAB: { name: 'Laboral', color: 'hsl(340, 55%, 45%)', estimatedTasks: 9, defaultSlaDays: 14 },
    FISC: { name: 'Fiscal', color: 'hsl(45, 80%, 42%)', estimatedTasks: 11, defaultSlaDays: 14 },
    INM: { name: 'Inmobiliario', color: 'hsl(100, 45%, 38%)', estimatedTasks: 7, defaultSlaDays: 10 },
    PI: { name: 'Propiedad Industrial', color: 'hsl(280, 50%, 45%)', estimatedTasks: 6, defaultSlaDays: 10 },
    LIT: { name: 'Litigios', color: 'hsl(0, 60%, 45%)', estimatedTasks: 8, defaultSlaDays: 12 },
    ADMIN: { name: 'Administrativo', color: 'hsl(210, 40%, 45%)', estimatedTasks: 5, defaultSlaDays: 10 },
    MA: { name: 'Medio Ambiente', color: 'hsl(120, 60%, 40%)', estimatedTasks: 6, defaultSlaDays: 10 },
    DATOS: { name: 'Proteccion de Datos', color: 'hsl(250, 55%, 50%)', estimatedTasks: 5, defaultSlaDays: 10 },
};

const ALL_AREA_CODES = Object.keys(AREA_MASTER);

// ============================================================
// Deal Presets
// ============================================================

const DEAL_PRESETS: DealPreset[] = [
    {
        id: 'acquisition',
        emoji: '\uD83D\uDCBC',
        name: 'Adquisicion',
        description: 'DD completa para adquisiciones M&A con cobertura integral.',
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        expected_documents_count: 85,
        icon: Briefcase,
    },
    {
        id: 'merger',
        emoji: '\uD83E\uDD1D',
        name: 'Fusion',
        description: 'Enfasis en laboral, fiscal y contable para sinergias.',
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['LAB', 'FISC', 'CONT'],
        expected_documents_count: 78,
        icon: GitMerge,
    },
    {
        id: 'joint-venture',
        emoji: '\uD83E\uDD1D',
        name: 'Joint Venture',
        description: 'Alcance reducido: gobernanza, contratos, laboral, fiscal.',
        review_depth: 'standard',
        areas: ['MERC', 'CONT', 'LAB', 'FISC', 'PI', 'DATOS'],
        expected_documents_count: 48,
        icon: Handshake,
    },
    {
        id: 'carve-out',
        emoji: '\u2702\uFE0F',
        name: 'Carve-Out',
        description: 'Separacion de activos, contratos y empleados.',
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['CONT', 'LAB', 'FISC', 'INM'],
        expected_documents_count: 72,
        icon: Scissors,
    },
    {
        id: 'vendor-dd',
        emoji: '\uD83C\uDFEA',
        name: 'Vendor DD',
        description: 'Alcance limitado, orientada a presentacion para compradores.',
        review_depth: 'light',
        areas: ['MERC', 'CONT', 'FISC', 'LAB'],
        expected_documents_count: 35,
        icon: Store,
    },
    {
        id: 'distressed',
        emoji: '\u26A0\uFE0F',
        name: 'Distressed',
        description: 'Situacion concursal: litigios, contingencias fiscales y laborales.',
        review_depth: 'enhanced',
        areas: ['MERC', 'MA', 'PI', 'CONT', 'LAB', 'FISC', 'INM', 'LIT', 'ADMIN', 'DATOS'],
        emphasis_areas: ['LIT', 'FISC', 'LAB'],
        expected_documents_count: 82,
        icon: AlertTriangle,
    },
];

// ============================================================
// Helpers
// ============================================================

function buildAreasFromPreset(presetId: PresetId): AreaConfig[] {
    if (presetId === 'custom') {
        return ALL_AREA_CODES.map((code) => ({
            code,
            ...AREA_MASTER[code],
            enabled: false,
            slaDays: AREA_MASTER[code].defaultSlaDays,
        }));
    }
    const preset = DEAL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return [];
    return ALL_AREA_CODES.map((code) => ({
        code,
        ...AREA_MASTER[code],
        enabled: preset.areas.includes(code),
        slaDays: AREA_MASTER[code].defaultSlaDays,
    }));
}

const DEPTH_LABELS: Record<ReviewDepth, string> = {
    light: 'Light',
    standard: 'Standard',
    enhanced: 'Enhanced',
};

const DEAL_TYPE_MAP: Record<PresetId, string> = {
    'acquisition': 'acquisition',
    'merger': 'merger',
    'joint-venture': 'jv',
    'carve-out': 'carve-out',
    'vendor-dd': 'acquisition',
    'distressed': 'acquisition',
    'custom': 'acquisition',
};

// ============================================================
// Component
// ============================================================

export default function NewProjectPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    // Step 1 state
    const [form, setForm] = useState({
        name: '', target_company: '', target_sector: '', deal_type: 'acquisition',
        client_name: '', deadline: '', scope_notes: '',
    });

    // Step 2 state
    const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
    const [reviewDepth, setReviewDepth] = useState<ReviewDepth>('standard');

    // Step 3 state
    const [areas, setAreas] = useState<AreaConfig[]>([]);

    // Derived
    const enabledAreas = useMemo(() => areas.filter((a) => a.enabled), [areas]);
    const totalEstimatedTasks = useMemo(() => enabledAreas.reduce((sum, a) => sum + a.estimatedTasks, 0), [enabledAreas]);

    const selectedPresetData = useMemo(
        () => DEAL_PRESETS.find((p) => p.id === selectedPreset) ?? null,
        [selectedPreset],
    );

    // --------------------------------------------------------
    // Handlers
    // --------------------------------------------------------

    function handleSelectPreset(presetId: PresetId) {
        setSelectedPreset(presetId);
        const newAreas = buildAreasFromPreset(presetId);
        setAreas(newAreas);
        if (presetId !== 'custom') {
            const preset = DEAL_PRESETS.find((p) => p.id === presetId);
            if (preset) {
                setReviewDepth(preset.review_depth);
                // Sync deal_type in step 1 form
                const mappedDealType = DEAL_TYPE_MAP[presetId] || 'acquisition';
                setForm((f) => ({ ...f, deal_type: mappedDealType }));
            }
        }
    }

    function toggleArea(code: string) {
        setAreas((prev) =>
            prev.map((a) => (a.code === code ? { ...a, enabled: !a.enabled } : a)),
        );
    }

    function updateAreaSla(code: string, days: number) {
        setAreas((prev) =>
            prev.map((a) => (a.code === code ? { ...a, slaDays: Math.max(1, days) } : a)),
        );
    }

    const canGoNextFromStep1 = form.name.trim().length > 0 && form.target_company.trim().length > 0;
    const canGoNextFromStep2 = selectedPreset !== null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        const presetName = selectedPresetData?.name ?? 'Personalizado';
        const areaList = enabledAreas.map((a) => a.code).join(', ');

        const setupSummary = [
            form.scope_notes?.trim() || null,
            `Preset: ${presetName}`,
            `Profundidad: ${reviewDepth}`,
            `Areas: ${areaList}`,
            `Tareas estimadas: ~${totalEstimatedTasks}`,
        ].filter(Boolean).join('\n');

        const { data, error } = await supabase.from('dd_projects').insert({
            name: form.name,
            target_company: form.target_company,
            target_sector: form.target_sector,
            deal_type: form.deal_type,
            client_name: form.client_name,
            deadline: form.deadline || null,
            scope_notes: setupSummary || null,
            review_depth: reviewDepth,
            status: 'draft',
            engagement_date: new Date().toISOString().split('T')[0],
        }).select().single();

        if (data && !error) {
            toast.success('Proyecto creado correctamente');
            router.push(`/projects/${data.id}`);
        } else {
            toast.error(error?.message ?? 'Error al crear el proyecto');
        }
        setSaving(false);
    }

    // --------------------------------------------------------
    // Styles
    // --------------------------------------------------------

    const inputStyle: React.CSSProperties = {
        backgroundColor: 'var(--g-surface-card)',
        borderColor: 'var(--g-border-default)',
        borderRadius: 'var(--g-radius-md)',
        color: 'var(--g-text-primary)',
    };

    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------

    return (
        <div className="animate-fade-in max-w-2xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm mb-6"
                style={{ color: 'var(--g-link)' }}
            >
                <ArrowLeft className="h-4 w-4" /> Volver a proyectos
            </Link>

            <div
                className="g-card p-8"
                style={{
                    borderRadius: 'var(--g-radius-xl)',
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="h-12 w-12 flex items-center justify-center"
                        style={{ borderRadius: 'var(--g-radius-lg)', backgroundColor: 'var(--g-sec-100)' }}
                    >
                        <FolderKanban className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} />
                    </div>
                    <div>
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h2)', color: 'var(--g-text-primary)' }}>
                            Nuevo Proyecto Due Diligence
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Configura el proyecto en 4 pasos para empezar sin friccion
                        </p>
                    </div>
                </div>

                {/* Stepper */}
                <div className="mb-6">
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { id: 1, title: 'Datos base' },
                            { id: 2, title: 'Preset' },
                            { id: 3, title: 'Areas' },
                            { id: 4, title: 'Confirmacion' },
                        ].map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center gap-2 px-3 py-2 border"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    borderColor: step === s.id ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                    backgroundColor: step === s.id ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                }}
                            >
                                <span
                                    className="inline-flex items-center justify-center h-5 w-5 text-xs font-bold"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: step >= s.id ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                                        color: step >= s.id ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                                    }}
                                >
                                    {step > s.id ? <Check style={{ width: 12, height: 12 }} /> : s.id}
                                </span>
                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    {s.title}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* ============================== STEP 1 ============================== */}
                    {step === 1 && (
                        <>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="project-name" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Nombre del Proyecto *
                                    </label>
                                    <input
                                        id="project-name"
                                        type="text" required value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="DD FMC S.L. -- Adquisicion"
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="project-target" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Sociedad Target *
                                    </label>
                                    <input
                                        id="project-target"
                                        type="text" required value={form.target_company}
                                        onChange={(e) => setForm({ ...form, target_company: e.target.value })}
                                        placeholder="FMC Operaciones S.L."
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="project-sector" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Sector
                                    </label>
                                    <input
                                        id="project-sector"
                                        type="text" value={form.target_sector}
                                        onChange={(e) => setForm({ ...form, target_sector: e.target.value })}
                                        placeholder="Tecnologia, Energia, Retail..."
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="project-deal-type" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Tipo de Operacion
                                    </label>
                                    <select
                                        id="project-deal-type"
                                        value={form.deal_type}
                                        onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    >
                                        <option value="acquisition">Adquisicion</option>
                                        <option value="merger">Fusion</option>
                                        <option value="jv">Joint Venture</option>
                                        <option value="carve-out">Carve-out</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="project-client" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Cliente
                                    </label>
                                    <input
                                        id="project-client"
                                        type="text" value={form.client_name}
                                        onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                                        placeholder="Nombre del cliente"
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="project-deadline" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Deadline
                                    </label>
                                    <input
                                        id="project-deadline"
                                        type="date" value={form.deadline}
                                        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ============================== STEP 2 — Preset Selection ============================== */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                    Selecciona un preset de operacion
                                </h2>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)', marginTop: '4px' }}>
                                    Cada preset pre-configura las areas de revision, profundidad y documentos esperados
                                </p>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                            }}>
                                {DEAL_PRESETS.map((preset) => {
                                    const isSelected = selectedPreset === preset.id;
                                    const Icon = preset.icon;
                                    return (
                                        <button
                                            type="button"
                                            key={preset.id}
                                            onClick={() => handleSelectPreset(preset.id)}
                                            className="g-card"
                                            style={{
                                                textAlign: 'left',
                                                padding: '16px',
                                                border: `2px solid ${isSelected ? 'var(--g-brand-3308)' : 'var(--g-border-default)'}`,
                                                borderRadius: 'var(--g-radius-lg)',
                                                backgroundColor: isSelected ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                position: 'relative',
                                            }}
                                        >
                                            {/* Selected check */}
                                            {isSelected && (
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--g-brand-3308)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Check style={{ width: 12, height: 12, color: 'var(--g-text-inverse)' }} />
                                                </span>
                                            )}

                                            {/* Icon + emoji */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '20px' }}>{preset.emoji}</span>
                                                <Icon style={{ width: 16, height: 16, color: 'var(--g-text-muted)' }} />
                                            </div>

                                            {/* Name */}
                                            <p className="font-semibold text-sm" style={{ color: 'var(--g-text-primary)', marginBottom: '4px' }}>
                                                {preset.name}
                                            </p>

                                            {/* Description */}
                                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)', marginBottom: '10px', lineHeight: '1.4' }}>
                                                {preset.description}
                                            </p>

                                            {/* Meta badges */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
                                                }}>
                                                    <Layers style={{ width: 10, height: 10 }} />
                                                    {DEPTH_LABELS[preset.review_depth]}
                                                </span>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
                                                }}>
                                                    <ListChecks style={{ width: 10, height: 10 }} />
                                                    {preset.areas.length} areas
                                                </span>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
                                                }}>
                                                    <FileCheck style={{ width: 10, height: 10 }} />
                                                    {preset.expected_documents_count} docs
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Custom / Personalizado */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectPreset('custom')}
                                    className="g-card"
                                    style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        border: `2px solid ${selectedPreset === 'custom' ? 'var(--g-brand-3308)' : 'var(--g-border-default)'}`,
                                        borderRadius: 'var(--g-radius-lg)',
                                        backgroundColor: selectedPreset === 'custom' ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        position: 'relative',
                                        gridColumn: 'span 2',
                                    }}
                                >
                                    {selectedPreset === 'custom' && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: 'var(--g-brand-3308)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Check style={{ width: 12, height: 12, color: 'var(--g-text-inverse)' }} />
                                        </span>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <Settings2 style={{ width: 18, height: 18, color: 'var(--g-text-muted)' }} />
                                        <p className="font-semibold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                            Personalizado
                                        </p>
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                        Configura manualmente las areas, profundidad y SLA para un proyecto a medida.
                                    </p>
                                </button>
                            </div>

                            {/* Review depth selector (always visible on step 2) */}
                            <div style={{ marginTop: '4px' }}>
                                <label className="block text-xs font-medium" style={{ color: 'var(--g-text-primary)', marginBottom: '8px' }}>
                                    Profundidad de revision
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {Object.entries(REVIEW_DEPTH_CONFIG).map(([key, config]) => (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => setReviewDepth(key as ReviewDepth)}
                                            style={{
                                                flex: 1,
                                                padding: '10px 12px',
                                                border: `2px solid ${reviewDepth === key ? 'var(--g-brand-3308)' : 'var(--g-border-default)'}`,
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: reviewDepth === key ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                <span style={{
                                                    display: 'inline-block', width: '8px', height: '8px',
                                                    borderRadius: 'var(--g-radius-full)', backgroundColor: config.color,
                                                }} />
                                                <span className="text-xs font-semibold" style={{ color: 'var(--g-text-primary)' }}>
                                                    {config.labelEs}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '10px', color: 'var(--g-text-secondary)', lineHeight: '1.3' }}>
                                                {config.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================== STEP 3 — Review Configuration ============================== */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                    Configuracion de areas de revision
                                </h2>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)', marginTop: '4px' }}>
                                    Activa o desactiva areas y ajusta el SLA por defecto (dias)
                                </p>
                            </div>

                            {/* Summary bar */}
                            <div className="g-card" style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 16px',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-sec-100)',
                                border: '1px solid var(--g-brand-3308)',
                            }}>
                                <span className="text-xs font-semibold" style={{ color: 'var(--g-brand-3308)' }}>
                                    {enabledAreas.length} areas seleccionadas
                                </span>
                                <span className="text-xs font-semibold" style={{ color: 'var(--g-brand-3308)' }}>
                                    ~{totalEstimatedTasks} tareas estimadas
                                </span>
                            </div>

                            {/* Area list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {areas.map((area) => (
                                    <div
                                        key={area.code}
                                        className="g-card"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: `1px solid ${area.enabled ? 'var(--g-border-default)' : 'var(--g-border-default)'}`,
                                            backgroundColor: area.enabled ? 'var(--g-surface-card)' : 'var(--g-surface-muted)',
                                            opacity: area.enabled ? 1 : 0.6,
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {/* Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => toggleArea(area.code)}
                                            style={{
                                                width: '36px',
                                                height: '20px',
                                                borderRadius: '10px',
                                                backgroundColor: area.enabled ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                                                border: `1px solid ${area.enabled ? 'var(--g-brand-3308)' : 'var(--g-border-default)'}`,
                                                position: 'relative',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <span style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: area.enabled ? '17px' : '2px',
                                                width: '14px',
                                                height: '14px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: area.enabled ? 'var(--g-text-inverse)' : 'var(--g-text-muted)',
                                                transition: 'all 0.15s ease',
                                            }} />
                                        </button>

                                        {/* Color dot */}
                                        <span style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: area.color,
                                            flexShrink: 0,
                                        }} />

                                        {/* Name + meta */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {area.name}
                                            </p>
                                            <p style={{ fontSize: '10px', color: 'var(--g-text-muted)' }}>
                                                {area.code} -- ~{area.estimatedTasks} tareas
                                            </p>
                                        </div>

                                        {/* SLA input */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            <Clock style={{ width: 12, height: 12, color: 'var(--g-text-muted)' }} />
                                            <input
                                                type="number"
                                                min={1}
                                                max={90}
                                                value={area.slaDays}
                                                onChange={(e) => updateAreaSla(area.code, parseInt(e.target.value) || 1)}
                                                disabled={!area.enabled}
                                                style={{
                                                    width: '48px',
                                                    height: '28px',
                                                    padding: '0 4px',
                                                    fontSize: '12px',
                                                    textAlign: 'center',
                                                    border: '1px solid var(--g-border-default)',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: area.enabled ? 'var(--g-surface-card)' : 'transparent',
                                                    color: 'var(--g-text-primary)',
                                                }}
                                            />
                                            <span style={{ fontSize: '10px', color: 'var(--g-text-muted)' }}>d</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Scope notes */}
                            <div>
                                <label htmlFor="project-scope" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                    Notas de Alcance (opcional)
                                </label>
                                <textarea
                                    id="project-scope"
                                    value={form.scope_notes}
                                    onChange={(e) => setForm({ ...form, scope_notes: e.target.value })}
                                    placeholder="Descripcion del alcance de la revision..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border resize-none"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    )}

                    {/* ============================== STEP 4 — Confirmation ============================== */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                Resumen del proyecto
                            </h2>

                            {/* Summary card */}
                            <div className="g-card" style={{
                                padding: '20px',
                                borderRadius: 'var(--g-radius-lg)',
                                border: '1px solid var(--g-border-default)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }}>
                                {/* Project info */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                            Proyecto
                                        </p>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--g-text-primary)' }}>
                                            {form.name || '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                            Sociedad Target
                                        </p>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--g-text-primary)' }}>
                                            {form.target_company || '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                            Tipo de Operacion
                                        </p>
                                        <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                            {selectedPresetData?.name ?? 'Personalizado'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                            Profundidad
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{
                                                width: '8px', height: '8px', borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: REVIEW_DEPTH_CONFIG[reviewDepth]?.color ?? '#999',
                                            }} />
                                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {REVIEW_DEPTH_CONFIG[reviewDepth]?.labelEs ?? reviewDepth}
                                            </p>
                                        </div>
                                    </div>
                                    {form.client_name && (
                                        <div>
                                            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                                Cliente
                                            </p>
                                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {form.client_name}
                                            </p>
                                        </div>
                                    )}
                                    {form.deadline && (
                                        <div>
                                            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '2px' }}>
                                                Deadline
                                            </p>
                                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {form.deadline}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: 'var(--g-border-default)' }} />

                                {/* Areas enabled */}
                                <div>
                                    <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '8px' }}>
                                        Areas habilitadas ({enabledAreas.length})
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {enabledAreas.map((area) => (
                                            <span
                                                key={area.code}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '3px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: area.color,
                                                    color: '#fff',
                                                }}
                                            >
                                                {area.code}
                                                <span style={{ fontWeight: 400, opacity: 0.8, fontSize: '10px' }}>
                                                    {area.slaDays}d
                                                </span>
                                            </span>
                                        ))}
                                        {enabledAreas.length === 0 && (
                                            <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                                Ninguna area seleccionada
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: 'var(--g-border-default)' }} />

                                {/* Estimates */}
                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ListChecks style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} />
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            ~{totalEstimatedTasks} tareas estimadas
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <FileCheck style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} />
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            ~{selectedPresetData?.expected_documents_count ?? enabledAreas.length * 8} documentos esperados
                                        </span>
                                    </div>
                                    {form.deadline && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Clock style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} />
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                {Math.max(0, Math.ceil((new Date(form.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dias restantes
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                {form.scope_notes?.trim() && (
                                    <>
                                        <div style={{ height: '1px', backgroundColor: 'var(--g-border-default)' }} />
                                        <div>
                                            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)', marginBottom: '4px' }}>
                                                Notas de alcance
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                {form.scope_notes}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ============================== Navigation buttons ============================== */}
                    <div className="flex justify-between gap-3 pt-4">
                        <div className="flex gap-3">
                            <Link
                                href="/projects"
                                className="px-5 py-2.5 text-sm font-medium border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                Cancelar
                            </Link>
                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(step - 1)}
                                    className="px-5 py-2.5 text-sm font-medium border"
                                    style={{
                                        borderColor: 'var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-md)',
                                        color: 'var(--g-text-primary)',
                                    }}
                                >
                                    Atras
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            {step < 4 ? (
                                <button
                                    type="button"
                                    disabled={
                                        (step === 1 && !canGoNextFromStep1) ||
                                        (step === 2 && !canGoNextFromStep2)
                                    }
                                    onClick={() => setStep(step + 1)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{
                                        backgroundColor: 'var(--g-brand-3308)',
                                        color: 'var(--g-text-inverse)',
                                        borderRadius: 'var(--g-radius-md)',
                                        boxShadow: 'var(--g-shadow-brand)',
                                    }}
                                >
                                    Continuar <ChevronRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit" disabled={saving || enabledAreas.length === 0}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{
                                        backgroundColor: 'var(--g-brand-3308)',
                                        color: 'var(--g-text-inverse)',
                                        borderRadius: 'var(--g-radius-md)',
                                        boxShadow: 'var(--g-shadow-brand)',
                                    }}
                                >
                                    {saving ? 'Creando...' : 'Crear Proyecto'}
                                    {!saving && <Check className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
