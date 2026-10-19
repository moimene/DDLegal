'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Shield, Users, Zap, AlertTriangle } from 'lucide-react';
import type { DDSkill } from '@/lib/supabase';
import { SKILL_CATEGORY_CONFIG, AREA_COLORS } from '@/lib/utils';

const PRIORITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    P0: { label: 'P0', color: 'var(--g-priority-p0)', bg: 'var(--g-priority-p0-bg)' },
    P1: { label: 'P1', color: 'var(--g-priority-p1)', bg: 'var(--g-priority-p1-bg)' },
    P2: { label: 'P2', color: 'var(--g-priority-p2)', bg: 'var(--g-priority-p2-bg)' },
    P3: { label: 'P3', color: 'var(--g-priority-p3)', bg: 'var(--g-priority-p3-bg)' },
};

interface SkillCardProps {
    skill: DDSkill;
}

export default function SkillCard({ skill }: SkillCardProps) {
    const [expanded, setExpanded] = useState(false);
    const categoryConfig = SKILL_CATEGORY_CONFIG[skill.category] || SKILL_CATEGORY_CONFIG.verificacion;
    const areaColor = AREA_COLORS[skill.area_code] || AREA_COLORS.GENERAL;
    const priBadge = skill.priority ? PRIORITY_BADGE[skill.priority] : null;
    const contentId = `skill-content-${skill.id}`;

    return (
        <div
            className="border transition-all"
            style={{
                borderColor: 'var(--g-border-subtle)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
                boxShadow: 'var(--g-shadow-card)',
                opacity: skill.is_active ? 1 : 0.75,
            }}
        >
            {/* Header — always visible */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                                style={{
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: `hsla(${areaColor}, 0.15)`,
                                    color: `hsl(${areaColor})`,
                                }}
                            >
                                {skill.area_code}
                            </span>
                            <span
                                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium"
                                style={{
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: categoryConfig.bg,
                                    color: categoryConfig.fg,
                                }}
                            >
                                {categoryConfig.label}
                            </span>
                            {priBadge && (
                                <span
                                    className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: priBadge.bg,
                                        color: priBadge.color,
                                    }}
                                >
                                    {priBadge.label}
                                </span>
                            )}
                            {skill.hitl_required && (
                                <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: 'var(--g-hitl-bg)',
                                        color: 'var(--g-hitl-color)',
                                    }}
                                >
                                    <Users className="h-2.5 w-2.5" /> HITL
                                </span>
                            )}
                            {!skill.is_active && (
                                <span
                                    className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: 'var(--g-surface-muted)',
                                        color: 'var(--g-text-muted)',
                                    }}
                                >
                                    Pendiente
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            {skill.name}
                        </h3>
                        {(skill.purpose || skill.description) && (
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--g-text-secondary)' }}>
                                {skill.purpose || skill.description}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 shrink-0 transition-colors hover:opacity-80"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            color: 'var(--g-text-secondary)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                        aria-label={expanded ? 'Colapsar detalle' : 'Expandir detalle'}
                        aria-expanded={expanded}
                        aria-controls={contentId}
                    >
                        {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>

                {/* Pipeline badges */}
                {skill.agent_pipeline && skill.agent_pipeline.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3">
                        <Cpu className="h-3 w-3 shrink-0" style={{ color: 'var(--g-text-muted)' }} aria-hidden="true" />
                        {skill.agent_pipeline.map((agent, idx) => (
                            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span
                                    className="px-1.5 py-0.5 text-[9px] font-medium uppercase"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: 'var(--g-surface-muted)',
                                        color: 'var(--g-text-secondary)',
                                    }}
                                >
                                    {agent}
                                </span>
                                {idx < skill.agent_pipeline!.length - 1 && (
                                    <span style={{ color: 'var(--g-text-muted)', fontSize: '10px' }}>→</span>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div
                    id={contentId}
                    className="px-4 pb-4 pt-0 animate-fade-in border-t"
                    style={{ borderColor: 'var(--g-border-subtle)' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
                        {/* Inputs */}
                        {skill.inputs_required && (skill.inputs_required as string[]).length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>Inputs Requeridos</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(skill.inputs_required as string[]).map((inp, i) => (
                                        <span key={i} className="px-2 py-0.5 text-[11px] font-medium" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-input-bg)', color: 'var(--g-input-color)' }}>
                                            {inp}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Trigger */}
                        {skill.trigger_description && (
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                <Zap className="h-3.5 w-3.5" style={{ color: 'var(--g-trigger-color)' }} />
                                <span><strong>Disparador:</strong> {skill.trigger_description}</span>
                            </div>
                        )}

                        {/* Authorized Sources */}
                        {skill.authorized_sources && (skill.authorized_sources as string[]).length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>Fuentes Autorizadas</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(skill.authorized_sources as string[]).map((src, i) => (
                                        <span key={i} className="px-2 py-0.5 text-[11px] font-medium" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-source-bg)', color: 'var(--g-source-color)' }}>
                                            {src}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Validation */}
                        {skill.validation_rules && (
                            <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--g-brand-3308)' }} />
                                <span><strong>Validación:</strong> {skill.validation_rules}</span>
                            </div>
                        )}

                        {/* HITL conditions */}
                        {skill.hitl_conditions && (
                            <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--g-hitl-color)' }} />
                                <span><strong>Revisión Humana:</strong> {skill.hitl_conditions}</span>
                            </div>
                        )}

                        {/* Risks */}
                        {skill.risks_limits && (
                            <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--g-trigger-color)' }} />
                                <span><strong>Riesgos:</strong> {skill.risks_limits}</span>
                            </div>
                        )}

                        {/* KPIs */}
                        {skill.kpis && (skill.kpis as string[]).length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>KPIs</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(skill.kpis as string[]).map((kpi, i) => (
                                        <span key={i} className="px-2 py-0.5 text-[11px] font-medium" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-kpi-bg)', color: 'var(--g-kpi-color)' }}>
                                            {kpi}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Prompt template */}
                        <div>
                            <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>Prompt Template</p>
                            <pre
                                className="text-xs p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-subtle)',
                                    color: 'var(--g-text-primary)',
                                    maxHeight: '160px',
                                    border: '1px solid var(--g-border-subtle)',
                                }}
                            >
                                {skill.prompt_template}
                            </pre>
                        </div>

                        {/* Expected output schema */}
                        {skill.expected_output_schema && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>Esquema de Salida</p>
                                <pre
                                    className="text-xs p-3 overflow-x-auto leading-relaxed"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        color: 'var(--g-text-primary)',
                                        maxHeight: '140px',
                                        border: '1px solid var(--g-border-subtle)',
                                    }}
                                >
                                    {JSON.stringify(skill.expected_output_schema, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Dependencies */}
                        {skill.dependencies && (skill.dependencies as string[]).length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--g-text-muted)' }}>Dependencias</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(skill.dependencies as string[]).map((dep, i) => (
                                        <span key={i} className="px-2 py-0.5 text-[11px] font-medium" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)' }}>
                                            {dep}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer: skill_key / version */}
                        <div className="flex items-center gap-3 text-[10px] pt-1" style={{ color: 'var(--g-text-muted)' }}>
                            <span>Clave: {skill.skill_key}</span>
                            <span>·</span>
                            <span>v{skill.version}</span>
                            {skill.grounding_description && (
                                <>
                                    <span>·</span>
                                    <span>Grounding: {skill.grounding_description}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
