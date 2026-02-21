'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, FileBarChart, ChevronRight, Search, Loader2,
    Bot, CheckCircle2, Users, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject } from '@/lib/supabase';
import { cn, REPORT_FAMILY_CONFIG, REPORT_CATEGORY_CONFIG, REPORT_VISIBILITY_CONFIG } from '@/lib/utils';

interface ReportTemplateItem {
    key: string;
    report_type: string;
    family: 'transactional' | 'pmo' | 'compliance';
    title_template: string;
    required_sections: string[];
    harvey_skill_key: string | null;
    cadencia: string;
    audience: string[];
}

const CADENCIA_LABELS: Record<string, string> = {
    on_demand: 'Bajo demanda',
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
};

const AUDIENCE_LABELS: Record<string, string> = {
    equipo: 'Equipo',
    cliente: 'Cliente',
    pm: 'PM',
};

const STEPS = [
    { id: 1, title: 'Plantilla' },
    { id: 2, title: 'Configurar' },
    { id: 3, title: 'Generar' },
];

export default function NewReportPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [templates, setTemplates] = useState<ReportTemplateItem[]>([]);
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateItem | null>(null);
    const [familyFilter, setFamilyFilter] = useState<string>('all');
    const [templateSearch, setTemplateSearch] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [extraInstructions, setExtraInstructions] = useState('');
    const [reportCategory, setReportCategory] = useState<string>('transactional');
    const [reportVisibility, setReportVisibility] = useState<string>('internal');

    // Load templates and projects
    useEffect(() => {
        fetch('/api/reports/generate?list=true')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTemplates(data.templates || []);
                }
                setLoadingTemplates(false);
            })
            .catch(() => setLoadingTemplates(false));

        supabase
            .from('dd_projects')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => setProjects(data || []));
    }, []);

    const filteredTemplates = templates.filter(t => {
        if (familyFilter !== 'all' && t.family !== familyFilter) return false;
        if (templateSearch) {
            const term = templateSearch.toLowerCase();
            return (
                t.report_type.toLowerCase().includes(term) ||
                t.title_template.toLowerCase().includes(term) ||
                t.required_sections.some(s => s.toLowerCase().includes(term))
            );
        }
        return true;
    });

    const groupedTemplates = {
        transactional: filteredTemplates.filter(t => t.family === 'transactional'),
        pmo: filteredTemplates.filter(t => t.family === 'pmo'),
        compliance: filteredTemplates.filter(t => t.family === 'compliance'),
    };

    const handleGenerate = async () => {
        if (!selectedTemplate) return;
        setGenerating(true);
        setError(null);

        try {
            const body: Record<string, unknown> = {
                template_type: selectedTemplate.key,
                params: {},
                report_category: reportCategory,
                visibility: reportVisibility,
            };

            if (selectedProjectId) {
                body.project_id = selectedProjectId;
            }

            if (extraInstructions.trim()) {
                (body.params as Record<string, unknown>).extra_instructions = extraInstructions.trim();
            }

            const res = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (data.success && data.reportId) {
                router.push(`/reports/${data.reportId}`);
            } else {
                setError(data.error || 'Error al generar el informe');
                setGenerating(false);
            }
        } catch {
            setError('Error de conexion al generar el informe');
            setGenerating(false);
        }
    };

    const inputStyle = {
        backgroundColor: 'var(--g-surface-card)',
        borderColor: 'var(--g-border-default)',
        borderRadius: 'var(--g-radius-md)',
        color: 'var(--g-text-primary)',
    };

    return (
        <div className="animate-fade-in max-w-3xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-sm"
                style={{ color: 'var(--g-link)' }}
            >
                <ArrowLeft className="h-4 w-4" /> Volver a informes
            </Link>

            {/* Card wrapper */}
            <div
                className="g-card p-8"
                style={{ borderRadius: 'var(--g-radius-xl)' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="h-12 w-12 flex items-center justify-center"
                        style={{ borderRadius: 'var(--g-radius-lg)', backgroundColor: 'var(--g-sec-100)' }}
                    >
                        <FileBarChart className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} />
                    </div>
                    <div>
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h2)', color: 'var(--g-text-primary)' }}>
                            Generar Informe
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Selecciona plantilla, configura y genera con Harvey AI
                        </p>
                    </div>
                </div>

                {/* Stepper */}
                <div className="mb-8">
                    <div className="grid grid-cols-3 gap-3">
                        {STEPS.map((s) => (
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
                                    {step > s.id ? <CheckCircle2 className="h-3 w-3" /> : s.id}
                                </span>
                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    {s.title}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step 1: Select Template */}
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                        {/* Search and family filter */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1" style={{ minWidth: 200 }}>
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} aria-hidden="true" />
                                <input
                                    type="text"
                                    placeholder="Buscar plantilla..."
                                    value={templateSearch}
                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                    className="w-full h-9 pl-10 pr-4 text-sm border transition-colors"
                                    style={inputStyle}
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                {(['all', 'transactional', 'pmo', 'compliance'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFamilyFilter(f)}
                                        className="px-3 py-1 text-xs font-medium transition-all"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: familyFilter === f
                                                ? (f === 'all' ? 'var(--g-brand-3308)' : (REPORT_FAMILY_CONFIG[f]?.bg || 'var(--g-brand-3308)'))
                                                : 'var(--g-surface-muted)',
                                            color: familyFilter === f
                                                ? 'var(--g-text-inverse)'
                                                : 'var(--g-text-primary)',
                                        }}
                                    >
                                        {f === 'all' ? 'Todas' : REPORT_FAMILY_CONFIG[f]?.label || f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingTemplates ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                                {(['transactional', 'pmo', 'compliance'] as const).map(family => {
                                    const familyTemplates = groupedTemplates[family];
                                    if (familyTemplates.length === 0) return null;
                                    const cfg = REPORT_FAMILY_CONFIG[family];

                                    return (
                                        <div key={family}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span
                                                    className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: cfg.bg,
                                                        color: cfg.fg,
                                                    }}
                                                >
                                                    {cfg.label}
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {familyTemplates.length} plantilla{familyTemplates.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                {familyTemplates.map(t => {
                                                    const isSelected = selectedTemplate?.key === t.key;
                                                    return (
                                                        <button
                                                            key={t.key}
                                                            type="button"
                                                            onClick={() => setSelectedTemplate(t)}
                                                            className="w-full text-left p-4 border transition-all hover:translate-y-[-1px]"
                                                            style={{
                                                                borderRadius: 'var(--g-radius-lg)',
                                                                borderColor: isSelected ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                                                backgroundColor: isSelected ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                                        {t.report_type.replace(/_/g, ' ')}
                                                                    </p>
                                                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                                        {t.title_template}
                                                                    </p>
                                                                </div>
                                                                {isSelected && (
                                                                    <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--g-brand-3308)' }} />
                                                                )}
                                                            </div>

                                                            {/* Metadata row */}
                                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                {/* Required sections */}
                                                                {t.required_sections.map(s => (
                                                                    <span
                                                                        key={s}
                                                                        className="px-2 py-0.5 text-xs"
                                                                        style={{
                                                                            borderRadius: 'var(--g-radius-sm)',
                                                                            backgroundColor: 'var(--g-surface-muted)',
                                                                            color: 'var(--g-text-secondary)',
                                                                        }}
                                                                    >
                                                                        {s}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="flex items-center gap-3 mt-2">
                                                                {t.harvey_skill_key && (
                                                                    <span
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
                                                                        style={{
                                                                            borderRadius: 'var(--g-radius-sm)',
                                                                            backgroundColor: 'var(--g-brand-bright)',
                                                                            color: 'var(--g-text-inverse)',
                                                                        }}
                                                                    >
                                                                        <Bot className="h-3 w-3" />
                                                                        {t.harvey_skill_key}
                                                                    </span>
                                                                )}
                                                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                                                    <Clock className="h-3 w-3" />
                                                                    {CADENCIA_LABELS[t.cadencia] || t.cadencia}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                                                    <Users className="h-3 w-3" />
                                                                    {t.audience.map(a => AUDIENCE_LABELS[a] || a).join(', ')}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredTemplates.length === 0 && (
                                    <div className="text-center py-8">
                                        <FileBarChart className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--g-sec-300)' }} />
                                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                            No se encontraron plantillas con ese filtro
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Configure */}
                {step === 2 && selectedTemplate && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                        {/* Summary of selected template */}
                        <div
                            className="p-4 border"
                            style={{
                                borderRadius: 'var(--g-radius-lg)',
                                borderColor: 'var(--g-brand-3308)',
                                backgroundColor: 'var(--g-sec-100)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <FileBarChart className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    {selectedTemplate.report_type.replace(/_/g, ' ')}
                                </span>
                                <span
                                    className="inline-flex px-2 py-0.5 text-xs font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: REPORT_FAMILY_CONFIG[selectedTemplate.family]?.bg,
                                        color: REPORT_FAMILY_CONFIG[selectedTemplate.family]?.fg,
                                    }}
                                >
                                    {REPORT_FAMILY_CONFIG[selectedTemplate.family]?.label}
                                </span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                {selectedTemplate.title_template}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {selectedTemplate.harvey_skill_key && (
                                    <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
                                        style={{
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: 'var(--g-brand-bright)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                    >
                                        <Bot className="h-3 w-3" />
                                        {selectedTemplate.harvey_skill_key}
                                    </span>
                                )}
                                {selectedTemplate.required_sections.map(s => (
                                    <span
                                        key={s}
                                        className="px-2 py-0.5 text-xs"
                                        style={{
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                            color: 'var(--g-text-secondary)',
                                        }}
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Project selector */}
                        <div>
                            <label
                                htmlFor="report-project"
                                className="block text-xs font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Proyecto (opcional)
                            </label>
                            <select
                                id="report-project"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="w-full h-10 px-3 text-sm border"
                                style={inputStyle}
                            >
                                <option value="">Sin proyecto vinculado</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — {p.target_company}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-muted)' }}>
                                Vincular un proyecto proporciona contexto adicional al informe
                            </p>
                        </div>

                        {/* Report category */}
                        <div>
                            <label
                                htmlFor="report-category"
                                className="block text-xs font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Categoria del informe
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {Object.entries(REPORT_CATEGORY_CONFIG).map(([key, cfg]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setReportCategory(key)}
                                        className="px-3 py-1.5 text-xs font-medium transition-all"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: reportCategory === key ? cfg.bg : 'var(--g-surface-muted)',
                                            color: reportCategory === key ? cfg.fg : 'var(--g-text-primary)',
                                            border: reportCategory === key ? '2px solid transparent' : '2px solid var(--g-border-default)',
                                        }}
                                    >
                                        {cfg.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Report visibility */}
                        <div>
                            <label
                                htmlFor="report-visibility"
                                className="block text-xs font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Visibilidad
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {Object.entries(REPORT_VISIBILITY_CONFIG).map(([key, cfg]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setReportVisibility(key)}
                                        className="px-3 py-1.5 text-xs font-medium transition-all"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: reportVisibility === key ? 'var(--g-surface-subtle)' : 'var(--g-surface-muted)',
                                            color: cfg.color,
                                            border: reportVisibility === key ? `2px solid ${cfg.color}` : '2px solid var(--g-border-default)',
                                        }}
                                    >
                                        {cfg.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--g-text-muted)' }}>
                                Determina quien puede ver este informe
                            </p>
                        </div>

                        {/* Extra instructions */}
                        <div>
                            <label
                                htmlFor="report-instructions"
                                className="block text-xs font-medium mb-1.5"
                                style={{ color: 'var(--g-text-primary)' }}
                            >
                                Instrucciones adicionales
                            </label>
                            <textarea
                                id="report-instructions"
                                value={extraInstructions}
                                onChange={(e) => setExtraInstructions(e.target.value)}
                                placeholder="Instrucciones especificas para Harvey AI al generar este informe..."
                                rows={4}
                                className="w-full px-3 py-2 text-sm border resize-none"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Generate */}
                {step === 3 && selectedTemplate && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)', alignItems: 'center' }}>
                        {generating ? (
                            <div className="flex flex-col items-center py-12">
                                <div
                                    className="h-16 w-16 flex items-center justify-center mb-4 animate-pulse"
                                    style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-sec-100)' }}
                                >
                                    <Bot className="h-8 w-8" style={{ color: 'var(--g-brand-3308)' }} />
                                </div>
                                <Loader2 className="h-6 w-6 animate-spin mb-3" style={{ color: 'var(--g-brand-3308)' }} />
                                <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    Generando informe con Harvey AI...
                                </p>
                                <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                    Esto puede tardar unos segundos
                                </p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-8">
                                <div
                                    className="p-4 border mb-4"
                                    style={{
                                        borderRadius: 'var(--g-radius-lg)',
                                        borderColor: 'var(--status-error)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    <p className="text-sm font-medium" style={{ color: 'var(--status-error)' }}>
                                        {error}
                                    </p>
                                </div>
                                <button
                                    onClick={handleGenerate}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: 'var(--g-brand-3308)',
                                        color: 'var(--g-text-inverse)',
                                        borderRadius: 'var(--g-radius-md)',
                                    }}
                                >
                                    Reintentar
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-8 w-full">
                                {/* Pre-generation summary */}
                                <div
                                    className="p-5 border mb-6 text-left"
                                    style={{
                                        borderRadius: 'var(--g-radius-lg)',
                                        borderColor: 'var(--g-border-default)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--g-text-primary)' }}>
                                        Resumen de generacion
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span style={{ color: 'var(--g-text-secondary)' }}>Plantilla:</span>
                                            <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {selectedTemplate.report_type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span style={{ color: 'var(--g-text-secondary)' }}>Familia:</span>
                                            <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {REPORT_FAMILY_CONFIG[selectedTemplate.family]?.label}
                                            </span>
                                        </div>
                                        {selectedTemplate.harvey_skill_key && (
                                            <div className="flex justify-between">
                                                <span style={{ color: 'var(--g-text-secondary)' }}>Skill IA:</span>
                                                <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    {selectedTemplate.harvey_skill_key}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span style={{ color: 'var(--g-text-secondary)' }}>Secciones:</span>
                                            <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                {selectedTemplate.required_sections.join(', ')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span style={{ color: 'var(--g-text-secondary)' }}>Categoria:</span>
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: REPORT_CATEGORY_CONFIG[reportCategory]?.bg || 'var(--g-surface-muted)',
                                                    color: REPORT_CATEGORY_CONFIG[reportCategory]?.fg || 'var(--g-text-primary)',
                                                }}
                                            >
                                                {REPORT_CATEGORY_CONFIG[reportCategory]?.label || reportCategory}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span style={{ color: 'var(--g-text-secondary)' }}>Visibilidad:</span>
                                            <span className="font-medium text-xs" style={{ color: REPORT_VISIBILITY_CONFIG[reportVisibility]?.color || 'var(--g-text-primary)' }}>
                                                {REPORT_VISIBILITY_CONFIG[reportVisibility]?.label || reportVisibility}
                                            </span>
                                        </div>
                                        {selectedProjectId && (
                                            <div className="flex justify-between">
                                                <span style={{ color: 'var(--g-text-secondary)' }}>Proyecto:</span>
                                                <span className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    {projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}
                                                </span>
                                            </div>
                                        )}
                                        {extraInstructions.trim() && (
                                            <div>
                                                <span style={{ color: 'var(--g-text-secondary)' }}>Instrucciones extra:</span>
                                                <p className="mt-1 text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                                    {extraInstructions}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: 'var(--g-brand-bright)',
                                        color: 'var(--g-text-inverse)',
                                        borderRadius: 'var(--g-radius-md)',
                                        boxShadow: 'var(--g-shadow-brand)',
                                    }}
                                >
                                    <Bot className="h-4 w-4" />
                                    Generar con Harvey AI
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation buttons */}
                {!generating && (
                    <div className="flex justify-between gap-3 pt-6 mt-6 border-t" style={{ borderColor: 'var(--g-border-subtle)' }}>
                        <div className="flex gap-3">
                            <Link
                                href="/reports"
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
                                    onClick={() => { setStep(step - 1); setError(null); }}
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

                        {step < 3 && (
                            <button
                                type="button"
                                disabled={step === 1 && !selectedTemplate}
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
