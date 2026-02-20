'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderKanban, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type DataRoomMode = 'espejo_controlado' | 'indice_referenciado' | 'hibrido_contextual';
type DealTemplate = 'express_dd' | 'full_dd' | 'vendor_due_diligence';

const DATA_ROOM_OPTIONS: Array<{ id: DataRoomMode; title: string; description: string }> = [
    {
        id: 'indice_referenciado',
        title: 'Indice referenciado',
        description: 'No replica binarios; opera con metadatos y punteros al VDR.',
    },
    {
        id: 'hibrido_contextual',
        title: 'Hibrido contextual',
        description: 'Metadatos globales + extracciones puntuales con cache efimera.',
    },
    {
        id: 'espejo_controlado',
        title: 'Espejo controlado',
        description: 'Replica autorizada con control de version y auditoria.',
    },
];

const TEMPLATE_OPTIONS: Array<{ id: DealTemplate; title: string; description: string }> = [
    {
        id: 'express_dd',
        title: 'Express DD',
        description: 'Foco en red flags y riesgos materiales para decision rapida.',
    },
    {
        id: 'full_dd',
        title: 'Full DD',
        description: 'Cobertura completa por areas con mayor profundidad documental.',
    },
    {
        id: 'vendor_due_diligence',
        title: 'Vendor Due Diligence',
        description: 'Preparacion de informe para proceso liderado por vendedor.',
    },
];

export default function NewProjectPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', target_company: '', target_sector: '', deal_type: 'acquisition',
        client_name: '', deadline: '', scope_notes: '',
        dataroom_mode: 'indice_referenciado' as DataRoomMode,
        template: 'express_dd' as DealTemplate,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const setupSummary = [
            form.scope_notes?.trim() || null,
            `Modo Data Room: ${form.dataroom_mode}`,
            `Plantilla inicial: ${form.template}`,
        ].filter(Boolean).join('\n');

        const { data, error } = await supabase.from('dd_projects').insert({
            name: form.name,
            target_company: form.target_company,
            target_sector: form.target_sector,
            deal_type: form.deal_type,
            client_name: form.client_name,
            deadline: form.deadline || null,
            scope_notes: setupSummary || null,
            status: 'draft',
            engagement_date: new Date().toISOString().split('T')[0],
        }).select().single();

        if (data && !error) {
            router.push(`/projects/${data.id}`);
        }
        setSaving(false);
    };

    const canGoNextFromStep1 = form.name.trim().length > 0 && form.target_company.trim().length > 0;

    const inputStyle = {
        backgroundColor: 'var(--g-surface-card)',
        borderColor: 'var(--g-border-default)',
        borderRadius: 'var(--g-radius-md)',
        color: 'var(--g-text-primary)',
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm mb-6"
                style={{ color: 'var(--g-link)' }}
            >
                <ArrowLeft className="h-4 w-4" /> Volver a proyectos
            </Link>

            <div
                className="border p-8"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-xl)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="h-12 w-12 flex items-center justify-center"
                        style={{ borderRadius: 'var(--g-radius-lg)', backgroundColor: 'var(--g-sec-100)' }}
                    >
                        <FolderKanban className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            Nuevo Proyecto Due Diligence
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            Configura el proyecto en 3 pasos para empezar sin fricción
                        </p>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 1, title: 'Datos base' },
                            { id: 2, title: 'Data Room' },
                            { id: 3, title: 'Plantilla' },
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
                                    {s.id}
                                </span>
                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    {s.title}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {step === 1 && (
                        <>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Nombre del Proyecto *
                                    </label>
                                    <input
                                        type="text" required value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="DD FMC S.L. – Adquisición"
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Sociedad Target *
                                    </label>
                                    <input
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
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Sector
                                    </label>
                                    <input
                                        type="text" value={form.target_sector}
                                        onChange={(e) => setForm({ ...form, target_sector: e.target.value })}
                                        placeholder="Tecnología, Energía, Retail..."
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Tipo de Operación
                                    </label>
                                    <select
                                        value={form.deal_type}
                                        onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    >
                                        <option value="acquisition">Adquisición</option>
                                        <option value="merger">Fusión</option>
                                        <option value="jv">Joint Venture</option>
                                        <option value="carve-out">Carve-out</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Cliente
                                    </label>
                                    <input
                                        type="text" value={form.client_name}
                                        onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                                        placeholder="Nombre del cliente"
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                        Deadline
                                    </label>
                                    <input
                                        type="date" value={form.deadline}
                                        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                                        className="w-full h-10 px-3 text-sm border"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                Modo de trabajo Data Room
                            </h2>
                            {DATA_ROOM_OPTIONS.map((option) => (
                                <button
                                    type="button"
                                    key={option.id}
                                    onClick={() => setForm({ ...form, dataroom_mode: option.id })}
                                    className="w-full text-left p-4 border transition-all hover:translate-y-[-1px]"
                                    style={{
                                        borderRadius: 'var(--g-radius-lg)',
                                        borderColor: form.dataroom_mode === option.id ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                        backgroundColor: form.dataroom_mode === option.id ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                    }}
                                >
                                    <p className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                        {option.title}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        {option.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 3 && (
                        <>
                            <div className="space-y-3">
                                <h2 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                    Plantilla inicial de ejecución
                                </h2>
                                {TEMPLATE_OPTIONS.map((option) => (
                                    <button
                                        type="button"
                                        key={option.id}
                                        onClick={() => setForm({ ...form, template: option.id })}
                                        className="w-full text-left p-4 border transition-all hover:translate-y-[-1px]"
                                        style={{
                                            borderRadius: 'var(--g-radius-lg)',
                                            borderColor: form.template === option.id ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                            backgroundColor: form.template === option.id ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                        }}
                                    >
                                        <p className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                            {option.title}
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                            {option.description}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--g-text-primary)' }}>
                                    Notas de Alcance
                                </label>
                                <textarea
                                    value={form.scope_notes}
                                    onChange={(e) => setForm({ ...form, scope_notes: e.target.value })}
                                    placeholder="Descripción del alcance de la revisión..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm border resize-none"
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}

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
                                    Atrás
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            {step < 3 ? (
                                <button
                                    type="button"
                                    disabled={step === 1 && !canGoNextFromStep1}
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
                                    type="submit" disabled={saving}
                                    className="px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{
                                        backgroundColor: 'var(--g-brand-3308)',
                                        color: 'var(--g-text-inverse)',
                                        borderRadius: 'var(--g-radius-md)',
                                        boxShadow: 'var(--g-shadow-brand)',
                                    }}
                                >
                                    {saving ? 'Creando...' : 'Crear Proyecto'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
