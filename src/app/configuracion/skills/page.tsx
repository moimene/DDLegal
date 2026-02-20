'use client';

import { useState, useEffect, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Search, Shield, AlertTriangle, Users, Zap, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDSkill, DDArea } from '@/lib/supabase';
import ToggleSwitch from '@/components/configuracion/toggle-switch';

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

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    verificacion: { label: 'Verificación', color: '217, 91%, 60%', icon: '🔍' },
    analisis: { label: 'Análisis', color: '160, 60%, 35%', icon: '📊' },
    extraccion: { label: 'Extracción', color: '30, 70%, 45%', icon: '📋' },
    generacion: { label: 'Generación', color: '280, 50%, 45%', icon: '✍️' },
    monitorizacion: { label: 'Monitorización', color: '45, 80%, 42%', icon: '👁️' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    P0: { label: 'P0 — Crítica', color: 'var(--status-error)', bg: 'hsla(0, 72%, 51%, 0.1)' },
    P1: { label: 'P1 — Alta', color: 'hsl(25, 95%, 53%)', bg: 'hsla(25, 95%, 53%, 0.1)' },
    P2: { label: 'P2 — Media', color: 'hsl(45, 80%, 42%)', bg: 'hsla(45, 80%, 42%, 0.1)' },
    P3: { label: 'P3 — Baja', color: 'var(--g-text-muted)', bg: 'var(--g-surface-muted)' },
};

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--g-text-muted)',
            }}>
                {label}
            </span>
            {children}
        </div>
    );
}

function TagList({ items, color }: { items: string[]; color?: string }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {items.map((item, idx) => (
                <span
                    key={idx}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 10px',
                        fontSize: 'var(--g-text-caption)',
                        fontWeight: 500,
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: color ? `hsla(${color}, 0.1)` : 'var(--g-surface-muted)',
                        color: color ? `hsl(${color})` : 'var(--g-text-secondary)',
                    }}
                >
                    {item}
                </span>
            ))}
        </div>
    );
}

export default function SkillsAdminPage() {
    const [skills, setSkills] = useState<DDSkill[]>([]);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    useEffect(() => {
        async function load() {
            const [sRes, aRes] = await Promise.all([
                supabase
                    .from('dd_skills_catalog')
                    .select('*')
                    .order('area_code')
                    .order('skill_key'),
                supabase
                    .from('dd_areas')
                    .select('*')
                    .order('sort_order'),
            ]);
            setSkills(sRes.data || []);
            setAreas(aRes.data || []);
            setLoading(false);
        }
        load();
    }, []);

    const areaByCode = useMemo(() => {
        const map: Record<string, DDArea> = {};
        areas.forEach(a => { map[a.code] = a; });
        return map;
    }, [areas]);

    const filteredSkills = useMemo(() => {
        let result = skills;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                s =>
                    s.name.toLowerCase().includes(q) ||
                    s.skill_key.toLowerCase().includes(q) ||
                    (s.purpose && s.purpose.toLowerCase().includes(q))
            );
        }
        if (filterPriority !== 'all') {
            result = result.filter(s => s.priority === filterPriority);
        }
        if (filterCategory !== 'all') {
            result = result.filter(s => s.category === filterCategory);
        }
        return result;
    }, [skills, search, filterPriority, filterCategory]);

    const grouped = useMemo(() => {
        const map: Record<string, DDSkill[]> = {};
        filteredSkills.forEach(s => {
            if (!map[s.area_code]) map[s.area_code] = [];
            map[s.area_code].push(s);
        });
        return map;
    }, [filteredSkills]);

    const activeCount = useMemo(() => skills.filter(s => s.is_active).length, [skills]);
    const inactiveCount = useMemo(() => skills.filter(s => !s.is_active).length, [skills]);
    const uniqueAreaCount = useMemo(() => new Set(skills.map(s => s.area_code)).size, [skills]);
    const p0Count = useMemo(() => skills.filter(s => s.priority === 'P0').length, [skills]);

    function toggleExpand(skillId: string) {
        setExpandedSkills(prev => {
            const next = new Set(prev);
            if (next.has(skillId)) next.delete(skillId);
            else next.add(skillId);
            return next;
        });
    }

    async function handleToggle(skillId: string, newValue: boolean) {
        setSkills(prev => prev.map(s => s.id === skillId ? { ...s, is_active: newValue } : s));
        try {
            const resp = await fetch('/api/system/skills', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skill_id: skillId, is_active: newValue }),
            });
            if (!resp.ok) {
                setSkills(prev => prev.map(s => s.id === skillId ? { ...s, is_active: !newValue } : s));
            }
        } catch {
            setSkills(prev => prev.map(s => s.id === skillId ? { ...s, is_active: !newValue } : s));
        }
    }

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--g-space-4)' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                {[1, 2, 3, 4].map(i => (
                    <div key={`sk-${i}`} className="skeleton" style={{ height: '120px', borderRadius: 'var(--g-radius-lg)' }} />
                ))}
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: '4px' }}>
                    <BookOpen style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                    <h1 style={{ fontSize: 'var(--g-text-h1)', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        Gestión de Skills
                    </h1>
                </div>
                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                    Catálogo completo de skills IA — Fichas validadas por el equipo legal
                </p>
            </div>

            {/* KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--g-space-4)' }}>
                {[
                    { label: 'Total Skills', value: skills.length, color: 'var(--g-text-primary)' },
                    { label: 'Activas', value: activeCount, color: 'var(--status-success)' },
                    { label: 'Pendientes', value: inactiveCount, color: 'var(--g-text-muted)' },
                    { label: 'P0 Críticas', value: p0Count, color: 'var(--status-error)' },
                    { label: 'Áreas', value: uniqueAreaCount, color: 'var(--g-text-primary)' },
                ].map((kpi, i) => (
                    <div key={i} className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>{kpi.label}</span>
                        <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--g-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '350px' }}>
                    <Search style={{ position: 'absolute', left: 'var(--g-space-3)', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--g-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar skill..."
                        aria-label="Buscar skills"
                        style={{ width: '100%', padding: 'var(--g-space-2) var(--g-space-3) var(--g-space-2) var(--g-space-9)', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                    />
                </div>
                {/* Priority filter */}
                <select
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                    aria-label="Filtrar por prioridad"
                    style={{ padding: '6px 12px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                >
                    <option value="all">Todas prioridades</option>
                    <option value="P0">P0 — Crítica</option>
                    <option value="P1">P1 — Alta</option>
                    <option value="P2">P2 — Media</option>
                </select>
                {/* Category filter */}
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    aria-label="Filtrar por categoría"
                    style={{ padding: '6px 12px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                >
                    <option value="all">Todas categorías</option>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                    ))}
                </select>
                {/* Result count */}
                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                    {filteredSkills.length} resultado{filteredSkills.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Skills Grouped by Area */}
            {Object.keys(grouped).length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--g-space-12) var(--g-space-4)', border: '1px dashed var(--g-border-subtle)', borderRadius: 'var(--g-radius-lg)', backgroundColor: 'var(--g-surface-card)' }}>
                    <BookOpen style={{ width: '32px', height: '32px', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                    <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>No se encontraron skills.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}>
                    {Object.entries(grouped).map(([code, groupSkills]) => {
                        const area = areaByCode[code];
                        const color = AREA_COLORS[code] || AREA_COLORS.GENERAL;

                        return (
                            <div key={code}>
                                {/* Area Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-3)', paddingLeft: 'var(--g-space-3)', borderLeft: `3px solid hsl(${color})` }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', fontSize: 'var(--g-text-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 'var(--g-radius-full)', backgroundColor: `hsla(${color}, 0.15)`, color: `hsl(${color})` }}>
                                        {code}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                                        {area?.name || code}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                        ({groupSkills.length} skill{groupSkills.length !== 1 ? 's' : ''})
                                    </span>
                                </div>

                                {/* Skills in this area */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                                    {groupSkills.map(skill => {
                                        const isExpanded = expandedSkills.has(skill.id);
                                        const catCfg = CATEGORY_CONFIG[skill.category];
                                        const priCfg = skill.priority ? PRIORITY_CONFIG[skill.priority] : null;

                                        return (
                                            <div
                                                key={skill.id}
                                                className="g-card"
                                                style={{ padding: 0, overflow: 'hidden', opacity: skill.is_active ? 1 : 0.75, transition: 'opacity var(--g-transition-fast)' }}
                                            >
                                                {/* Skill row */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', padding: 'var(--g-space-3) var(--g-space-4)', cursor: 'pointer' }} onClick={() => toggleExpand(skill.id)}>
                                                    {/* Expand toggle */}
                                                    <button
                                                        aria-label={isExpanded ? 'Contraer detalle' : 'Expandir detalle'}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--g-text-muted)', flexShrink: 0 }}
                                                        onClick={e => { e.stopPropagation(); toggleExpand(skill.id); }}
                                                    >
                                                        {isExpanded ? <ChevronDown style={{ width: '16px', height: '16px' }} /> : <ChevronRight style={{ width: '16px', height: '16px' }} />}
                                                    </button>

                                                    {/* Priority badge */}
                                                    {priCfg && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: 'var(--g-radius-sm)', backgroundColor: priCfg.bg, color: priCfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                            {skill.priority}
                                                        </span>
                                                    )}

                                                    {/* Category badge */}
                                                    {catCfg && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: '10px', fontWeight: 600, borderRadius: 'var(--g-radius-full)', backgroundColor: `hsla(${catCfg.color}, 0.12)`, color: `hsl(${catCfg.color})`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                            {catCfg.label}
                                                        </span>
                                                    )}

                                                    {/* Skill name */}
                                                    <span style={{ fontWeight: 700, fontSize: 'var(--g-text-sm)', color: 'var(--g-text-primary)', whiteSpace: 'nowrap' }}>{skill.name}</span>

                                                    {/* skill_key */}
                                                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', whiteSpace: 'nowrap' }}>{skill.skill_key}</span>

                                                    {/* HITL badge */}
                                                    {skill.hitl_required && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', fontSize: '9px', fontWeight: 600, borderRadius: 'var(--g-radius-sm)', backgroundColor: 'hsla(25, 95%, 53%, 0.1)', color: 'hsl(25, 95%, 53%)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                            <Users style={{ width: '10px', height: '10px' }} /> HITL
                                                        </span>
                                                    )}

                                                    {/* Version */}
                                                    <span style={{ display: 'inline-flex', padding: '1px 6px', fontSize: '10px', fontWeight: 500, borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                        v{skill.version}
                                                    </span>

                                                    <div style={{ flex: 1 }} />

                                                    {/* Toggle */}
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <ToggleSwitch checked={skill.is_active} onChange={(val) => handleToggle(skill.id, val)} label={`Toggle ${skill.name}`} />
                                                    </div>
                                                </div>

                                                {/* Expanded detail */}
                                                {isExpanded && (
                                                    <div style={{ padding: 'var(--g-space-5)', borderTop: '1px solid var(--g-border-subtle)', backgroundColor: 'var(--g-surface-subtle)' }}>
                                                        {/* 2-column grid for metadata */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)', marginBottom: 'var(--g-space-5)' }}>
                                                            {/* Left column */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                                                {/* Purpose */}
                                                                {skill.purpose && (
                                                                    <DetailSection label="Propósito">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-primary)', margin: 0, lineHeight: 1.5 }}>{skill.purpose}</p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* Inputs */}
                                                                {skill.inputs_required && skill.inputs_required.length > 0 && (
                                                                    <DetailSection label="Inputs Requeridos">
                                                                        <TagList items={skill.inputs_required as string[]} color="217, 91%, 60%" />
                                                                    </DetailSection>
                                                                )}

                                                                {/* Trigger */}
                                                                {skill.trigger_description && (
                                                                    <DetailSection label="Disparador">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <Zap style={{ width: '14px', height: '14px', color: 'hsl(45, 80%, 42%)' }} />
                                                                            {skill.trigger_description}
                                                                        </p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* Authorized Sources */}
                                                                {skill.authorized_sources && (skill.authorized_sources as string[]).length > 0 && (
                                                                    <DetailSection label="Fuentes Autorizadas">
                                                                        <TagList items={skill.authorized_sources as string[]} color="160, 60%, 35%" />
                                                                    </DetailSection>
                                                                )}

                                                                {/* Dependencies */}
                                                                {skill.dependencies && (skill.dependencies as string[]).length > 0 && (
                                                                    <DetailSection label="Dependencias">
                                                                        <TagList items={skill.dependencies as string[]} />
                                                                    </DetailSection>
                                                                )}
                                                            </div>

                                                            {/* Right column */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                                                {/* Validation */}
                                                                {skill.validation_rules && (
                                                                    <DetailSection label="Validación Automática">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                            <Shield style={{ width: '14px', height: '14px', color: 'var(--g-brand-3308)', flexShrink: 0, marginTop: '2px' }} />
                                                                            {skill.validation_rules}
                                                                        </p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* HITL conditions */}
                                                                {skill.hitl_conditions && (
                                                                    <DetailSection label="Revisión Humana (HITL)">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                            <Eye style={{ width: '14px', height: '14px', color: 'hsl(25, 95%, 53%)', flexShrink: 0, marginTop: '2px' }} />
                                                                            {skill.hitl_conditions}
                                                                        </p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* Grounding */}
                                                                {skill.grounding_description && (
                                                                    <DetailSection label="Grounding / Evidencia">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>{skill.grounding_description}</p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* Risks */}
                                                                {skill.risks_limits && (
                                                                    <DetailSection label="Riesgos y Límites">
                                                                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                            <AlertTriangle style={{ width: '14px', height: '14px', color: 'hsl(45, 80%, 42%)', flexShrink: 0, marginTop: '2px' }} />
                                                                            {skill.risks_limits}
                                                                        </p>
                                                                    </DetailSection>
                                                                )}

                                                                {/* KPIs */}
                                                                {skill.kpis && (skill.kpis as string[]).length > 0 && (
                                                                    <DetailSection label="KPIs">
                                                                        <TagList items={skill.kpis as string[]} color="280, 50%, 45%" />
                                                                    </DetailSection>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Full-width sections */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                                            {/* Prompt Template */}
                                                            <DetailSection label="Prompt Template">
                                                                <pre style={{ maxHeight: '160px', overflow: 'auto', backgroundColor: 'var(--g-surface-muted)', padding: 'var(--g-space-3)', fontSize: 'var(--g-text-caption)', borderRadius: 'var(--g-radius-md)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--g-text-primary)', border: '1px solid var(--g-border-subtle)' }}>
                                                                    {skill.prompt_template}
                                                                </pre>
                                                            </DetailSection>

                                                            {/* Output Schema */}
                                                            {skill.expected_output_schema && (
                                                                <DetailSection label="Output Schema">
                                                                    <pre style={{ maxHeight: '160px', overflow: 'auto', backgroundColor: 'var(--g-surface-muted)', padding: 'var(--g-space-3)', fontSize: 'var(--g-text-caption)', borderRadius: 'var(--g-radius-md)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--g-text-primary)', border: '1px solid var(--g-border-subtle)' }}>
                                                                        {JSON.stringify(skill.expected_output_schema, null, 2)}
                                                                    </pre>
                                                                </DetailSection>
                                                            )}

                                                            {/* Agent Pipeline */}
                                                            {skill.agent_pipeline && skill.agent_pipeline.length > 0 && (
                                                                <DetailSection label="Agent Pipeline">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {skill.agent_pipeline.map((step, idx) => (
                                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <code style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', fontSize: 'var(--g-text-caption)', fontFamily: 'monospace', fontWeight: 600, borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-primary)', border: '1px solid var(--g-border-subtle)' }}>
                                                                                    {step}
                                                                                </code>
                                                                                {idx < skill.agent_pipeline!.length - 1 && (
                                                                                    <span style={{ color: 'var(--g-text-muted)', fontSize: '14px' }}>→</span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </DetailSection>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
