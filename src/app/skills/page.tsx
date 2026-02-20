'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDSkill, DDArea } from '@/lib/supabase';
import { AREA_COLORS, SKILL_CATEGORY_CONFIG } from '@/lib/utils';
import SkillCard from '@/components/skills/skill-card';

export default function SkillsCatalogPage() {
    const [skills, setSkills] = useState<DDSkill[]>([]);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

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
            result = result.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.skill_key.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q) ||
                s.purpose?.toLowerCase().includes(q)
            );
        }

        if (filterCategory) {
            result = result.filter(s => s.category === filterCategory);
        }

        if (filterPriority) {
            result = result.filter(s => s.priority === filterPriority);
        }

        return result;
    }, [skills, search, filterCategory, filterPriority]);

    const grouped = useMemo(() => {
        const map: Record<string, DDSkill[]> = {};
        filteredSkills.forEach(s => {
            if (!map[s.area_code]) map[s.area_code] = [];
            map[s.area_code].push(s);
        });
        return map;
    }, [filteredSkills]);

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-10 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-32 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <BookOpen className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Catálogo de Skills
                    </h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                    Skills especializadas por área de due diligence. Cada skill define prompts estructurados, esquemas de salida y requisitos de evidencia para Harvey AI.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                        style={{ color: 'var(--g-text-muted)' }}
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border"
                        style={{
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                        }}
                        placeholder="Buscar skills..."
                        aria-label="Buscar en catálogo de skills"
                    />
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setFilterCategory('')}
                        className="px-2.5 py-1.5 text-xs font-medium transition-colors"
                        style={{
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: !filterCategory ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                            color: !filterCategory ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                        }}
                    >
                        Todas
                    </button>
                    {Object.entries(SKILL_CATEGORY_CONFIG).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => setFilterCategory(filterCategory === key ? '' : key)}
                            className="px-2.5 py-1.5 text-xs font-medium transition-colors"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: filterCategory === key ? cfg.bg : 'var(--g-surface-muted)',
                                color: filterCategory === key ? cfg.fg : 'var(--g-text-primary)',
                            }}
                        >
                            {cfg.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {['P0', 'P1', 'P2'].map(p => (
                        <button
                            key={p}
                            onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
                            className="px-2.5 py-1.5 text-xs font-bold transition-colors"
                            style={{
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: filterPriority === p
                                    ? (p === 'P0' ? 'rgba(220,38,38,0.15)' : p === 'P1' ? 'rgba(234,88,12,0.15)' : 'rgba(202,138,4,0.15)')
                                    : 'var(--g-surface-muted)',
                                color: filterPriority === p
                                    ? (p === 'P0' ? '#dc2626' : p === 'P1' ? '#ea580c' : '#ca8a04')
                                    : 'var(--g-text-secondary)',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                <span>{filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{Object.keys(grouped).length} área{Object.keys(grouped).length !== 1 ? 's' : ''}</span>
            </div>

            {/* Grouped skills */}
            {Object.keys(grouped).length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center py-12 border border-dashed"
                    style={{
                        borderColor: 'var(--g-border-subtle)',
                        borderRadius: 'var(--g-radius-lg)',
                        backgroundColor: 'var(--g-surface-card)',
                    }}
                >
                    <BookOpen className="h-8 w-8 mb-2" style={{ color: 'var(--g-text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                        No se encontraron skills con esos filtros.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([code, groupSkills]) => {
                        const area = areaByCode[code];
                        const color = AREA_COLORS[code] || AREA_COLORS.GENERAL;

                        return (
                            <div key={code}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div
                                        className="h-3 w-3 shrink-0"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: `hsl(${color})`,
                                        }}
                                    />
                                    <h2 className="text-base font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                        {area?.name || code}
                                    </h2>
                                    <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                        ({groupSkills.length})
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {groupSkills.map(skill => (
                                        <SkillCard key={skill.id} skill={skill} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
