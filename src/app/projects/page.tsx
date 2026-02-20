'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, Search, ArrowRight, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject } from '@/lib/supabase';
import { STATUS_CONFIG, formatDate } from '@/lib/utils';

export default function ProjectsPage() {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        supabase.from('dd_projects').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { setProjects(data || []); setLoading(false); });
    }, []);

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.target_company.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Proyectos Due Diligence
                    </h1>
                    <p style={{ color: 'var(--g-text-secondary)' }}>
                        {projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90"
                    style={{
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                        borderRadius: 'var(--g-radius-md)',
                        boxShadow: 'var(--g-shadow-brand)',
                    }}
                >
                    <Plus className="h-4 w-4" /> Nuevo Proyecto
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o sociedad target..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 text-sm border transition-colors"
                    style={{
                        backgroundColor: 'var(--g-surface-card)',
                        borderColor: 'var(--g-border-subtle)',
                        borderRadius: 'var(--g-radius-md)',
                        color: 'var(--g-text-primary)',
                    }}
                />
            </div>

            {/* Table */}
            <div
                className="overflow-hidden border"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <table className="w-full">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--g-surface-subtle)' }}>
                            {['Proyecto', 'Target', 'Tipo', 'Estado', 'Fecha', ''].map(h => (
                                <th
                                    key={h}
                                    className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                    style={{ color: 'var(--g-text-primary)' }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--g-border-subtle)' }}>
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
                                    <FolderKanban className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--g-sec-300)' }} />
                                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin resultados</p>
                                    <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                        {filter ? 'Prueba con otro término de búsqueda' : 'Crea tu primer proyecto'}
                                    </p>
                                </td>
                            </tr>
                        ) : filtered.map((p) => (
                            <tr
                                key={p.id}
                                className="hover:bg-opacity-50 transition-colors cursor-pointer"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 shrink-0" style={{ color: 'var(--g-brand-3308)' }} />
                                        <span className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>{p.name}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm" style={{ color: 'var(--g-text-secondary)' }}>{p.target_company}</td>
                                <td className="px-5 py-4 text-sm capitalize" style={{ color: 'var(--g-text-secondary)' }}>{p.deal_type}</td>
                                <td className="px-5 py-4">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: p.status === 'active' ? 'var(--g-brand-3308)'
                                                : p.status === 'review' ? 'var(--status-warning)'
                                                    : p.status === 'closed' ? 'var(--status-success)'
                                                        : 'var(--g-surface-muted)',
                                            color: p.status === 'draft' ? 'var(--g-text-primary)' : 'var(--g-text-inverse)',
                                        }}
                                    >
                                        {STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]?.label}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                    {formatDate(p.created_at)}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <Link href={`/projects/${p.id}`}>
                                        <ArrowRight className="h-4 w-4" style={{ color: 'var(--g-link)' }} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
