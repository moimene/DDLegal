'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, CalendarDays, CheckCircle2, Loader2, Upload, MessageSquare, CheckCheck } from 'lucide-react';
import { formatDate, formatCurrency, useResolvedParams } from '@/lib/utils';

type ProjectStatus = 'draft' | 'active' | 'review' | 'closed';

type ClientTask = {
    id: string;
    notes: string | null;
    due_date: string | null;
    status: 'pending' | 'in_progress' | 'review' | 'blocked' | 'completed';
};

type ClientContingency = {
    id: string;
    title: string;
    description: string | null;
    estimated_amount: number | null;
    status: 'identified' | 'confirmed' | 'mitigated' | 'resolved' | 'accepted';
};

type ClientPayload = {
    success: boolean;
    project: {
        id: string;
        name: string;
        target_company: string;
        status: ProjectStatus;
        deadline: string | null;
    };
    progress_by_area: Array<{
        area_id: string;
        area_name: string;
        area_color: string | null;
        completed: number;
        total: number;
        pct: number;
    }>;
    confirmed_flags: ClientContingency[];
    blockers: ClientTask[];
    next_milestones: ClientTask[];
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
    draft: 'Borrador',
    active: 'Activo',
    review: 'En revisión',
    closed: 'Cerrado',
};

const PROJECT_STATUS_BG: Record<ProjectStatus, string> = {
    draft: 'var(--g-surface-muted)',
    active: 'var(--g-brand-3308)',
    review: 'var(--status-warning)',
    closed: 'var(--status-success)',
};

export default function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);
    const [payload, setPayload] = useState<ClientPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const resp = await fetch(`/api/client/projects/${id}`);
            if (resp.ok) {
                const data = await resp.json();
                setPayload(data);
            }
            setLoading(false);
        }
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="animate-fade-in min-h-[40vh] flex items-center justify-center">
                <div className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando portal cliente...
                </div>
            </div>
        );
    }

    if (!payload?.project) return <div>Proyecto no encontrado</div>;

    const { project, progress_by_area, confirmed_flags, blockers, next_milestones } = payload;

    return (
        <div className="animate-fade-in max-w-6xl" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href={`/projects/${id}`}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Volver al cockpit interno
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Portal cliente
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {project.name} · {project.target_company}
                    </p>
                </div>
                <span
                    className="inline-flex items-center px-3 py-1 text-sm font-medium"
                    style={{
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: PROJECT_STATUS_BG[project.status],
                        color: project.status === 'draft' ? 'var(--g-text-primary)' : 'var(--g-text-inverse)',
                    }}
                >
                    {PROJECT_STATUS_LABEL[project.status]}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                    className="g-card p-4 border transition-shadow"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                >
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: 'var(--g-brand-3308)' }}>
                        Red flags confirmadas
                    </p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        {confirmed_flags.length}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                        Contingencias visibles para cliente
                    </p>
                </div>

                <div
                    className="g-card p-4 border transition-shadow"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                >
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: 'var(--status-warning)' }}>
                        Bloqueos activos
                    </p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        {blockers.length}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                        Elementos pendientes para desbloquear hitos
                    </p>
                </div>

                <div
                    className="g-card p-4 border transition-shadow"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                >
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: 'var(--status-success)' }}>
                        Próximas fechas clave
                    </p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        {next_milestones.length}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                        Fechas planificadas en tareas del proyecto
                    </p>
                </div>
            </div>

            {/* CTAs para el cliente */}
            <div
                className="g-card p-5 border"
                style={{
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    backgroundColor: 'var(--g-surface-card)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <h2 className="font-bold mb-4" style={{ color: 'var(--g-text-primary)' }}>
                    Acciones disponibles
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        className="g-card flex items-center gap-3 p-4 border transition-all hover:translate-y-[-1px]"
                        style={{
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                            boxShadow: 'var(--g-shadow-card)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                    >
                        <div
                            className="h-10 w-10 flex items-center justify-center shrink-0"
                            style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-sec-100)' }}
                        >
                            <Upload className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>Subir documento</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Subir documento solicitado</p>
                        </div>
                    </button>

                    <button
                        className="g-card flex items-center gap-3 p-4 border transition-all hover:translate-y-[-1px]"
                        style={{
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                            boxShadow: 'var(--g-shadow-card)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                    >
                        <div
                            className="h-10 w-10 flex items-center justify-center shrink-0"
                            style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-sec-100)' }}
                        >
                            <MessageSquare className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>Responder Q&A</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Responder preguntas pendientes</p>
                        </div>
                    </button>

                    <button
                        className="g-card flex items-center gap-3 p-4 border transition-all hover:translate-y-[-1px]"
                        style={{
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                            boxShadow: 'var(--g-shadow-card)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--g-shadow-card)'; }}
                    >
                        <div
                            className="h-10 w-10 flex items-center justify-center shrink-0"
                            style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-sec-100)' }}
                        >
                            <CheckCheck className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>Confirmar recepción</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Confirmar recepción de documentos</p>
                        </div>
                    </button>
                </div>
            </div>

            <div
                className="g-card p-5 border"
                style={{
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    backgroundColor: 'var(--g-surface-card)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <h2 className="font-bold mb-4" style={{ color: 'var(--g-text-primary)' }}>
                    Progreso por área
                </h2>
                {progress_by_area.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                        Todavía no hay tareas visibles para mostrar avance.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {progress_by_area.map((item) => (
                            <div key={item.area_id}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        {item.area_name}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                        {item.pct}% ({item.completed}/{item.total})
                                    </p>
                                </div>
                                <div className="h-2 w-full overflow-hidden" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-full)' }}>
                                    <div
                                        className="h-full"
                                        style={{
                                            width: `${item.pct}%`,
                                            backgroundColor: item.area_color || 'var(--g-brand-3308)',
                                            borderRadius: 'var(--g-radius-full)',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                    className="g-card p-5 border"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--g-text-primary)' }}>
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Red flags visibles
                    </h2>
                    {confirmed_flags.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            No hay red flags confirmadas para mostrar en este momento.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {confirmed_flags.map((flag) => (
                                <div key={flag.id} className="p-3 border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-subtle)' }}>
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        {flag.title}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        {flag.description || 'Sin detalle adicional'} · Impacto estimado: {formatCurrency(flag.estimated_amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className="g-card p-5 border"
                    style={{
                        borderColor: 'var(--g-border-default)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                        boxShadow: 'var(--g-shadow-card)',
                    }}
                >
                    <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--g-text-primary)' }}>
                        <CalendarDays className="h-4 w-4" aria-hidden="true" /> Próximas acciones del cliente
                    </h2>
                    {blockers.length === 0 ? (
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5" style={{ color: 'var(--status-success)' }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                No hay acciones bloqueadas pendientes de tu lado.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {blockers.map((task) => (
                                <div key={task.id} className="p-3 border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-subtle)' }}>
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        Acción requerida
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        {task.notes || 'Pendiente de documentación o respuesta en Q&A.'}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        Fecha objetivo: {formatDate(task.due_date)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

