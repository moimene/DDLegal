'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Wrench, Building2, Shield, FileSearch, AlertTriangle,
    ArrowRight, Clock, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDTool, DDToolExecution } from '@/lib/supabase';
import { AREA_COLORS, formatDate } from '@/lib/utils';
import ExecutionStatus from '@/components/tools/execution-status';

const TOOL_ICONS: Record<string, typeof Wrench> = {
    Building2: Building2,
    Shield: Shield,
    FileSearch: FileSearch,
    AlertTriangle: AlertTriangle,
};

const TOOL_ROUTES: Record<string, string> = {
    societario: '/tools/societario',
    marcas: '/tools/marcas',
};

export default function ToolsHubPage() {
    const [tools, setTools] = useState<DDTool[]>([]);
    const [executions, setExecutions] = useState<(DDToolExecution & { dd_tools: { slug: string; name: string; icon: string | null } })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [tRes, eRes] = await Promise.all([
                supabase
                    .from('dd_tools')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order'),
                supabase
                    .from('dd_tool_executions')
                    .select('*, dd_tools!inner ( slug, name, icon )')
                    .order('created_at', { ascending: false })
                    .limit(5),
            ]);
            setTools(tRes.data || []);
            setExecutions(eRes.data as typeof executions || []);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="animate-fade-in space-y-6">
                <div className="skeleton h-10 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton h-48" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}>
            {/* Header */}
            <div>
                <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                    Herramientas Legal
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                    Microherramientas de verificación y análisis. Funcionan de forma independiente o vinculadas a proyectos DD.
                </p>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool.icon || ''] || Wrench;
                    const route = TOOL_ROUTES[tool.slug];
                    const isAvailable = !!route;

                    return (
                        <div
                            key={tool.id}
                            className="group relative border transition-all"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                                boxShadow: 'var(--g-shadow-card)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = 'var(--g-shadow-card-hover)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'var(--g-shadow-card)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div className="p-5">
                                {/* Icon + badges */}
                                <div className="flex items-start justify-between mb-3">
                                    <div
                                        className="p-2.5"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-subtle)',
                                        }}
                                    >
                                        <Icon className="h-6 w-6" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(tool.area_codes || []).map((code) => {
                                            const color = AREA_COLORS[code] || AREA_COLORS.GENERAL;
                                            return (
                                                <span
                                                    key={code}
                                                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: `hsla(${color}, 0.15)`,
                                                        color: `hsl(${color})`,
                                                    }}
                                                >
                                                    {code}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Name + description */}
                                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--g-text-primary)' }}>
                                    {tool.name}
                                </h3>
                                <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--g-text-secondary)' }}>
                                    {tool.description}
                                </p>

                                {/* CTA */}
                                {isAvailable ? (
                                    <Link
                                        href={route}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors hover:opacity-90"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-brand-3308)',
                                            color: 'var(--g-text-inverse)',
                                        }}
                                    >
                                        Ejecutar <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                            color: 'var(--g-text-secondary)',
                                        }}
                                    >
                                        Próximamente
                                    </span>
                                )}

                                {tool.requires_project && (
                                    <span
                                        className="inline-flex items-center ml-2 text-[10px]"
                                        style={{ color: 'var(--g-text-muted)' }}
                                    >
                                        Requiere proyecto
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Executions */}
            {executions.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                            Ejecuciones Recientes
                        </h2>
                        <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                            Últimas {executions.length}
                        </span>
                    </div>

                    <div
                        className="border divide-y"
                        style={{
                            borderColor: 'var(--g-border-subtle)',
                            borderRadius: 'var(--g-radius-lg)',
                            backgroundColor: 'var(--g-surface-card)',
                            '--tw-divide-color': 'var(--g-border-subtle)',
                        } as React.CSSProperties}
                    >
                        {executions.map((exec) => {
                            const toolIcon = TOOL_ICONS[exec.dd_tools?.icon || ''] || Wrench;
                            const ToolIcon = toolIcon;
                            return (
                                <div key={exec.id} className="flex items-center gap-3 px-4 py-3">
                                    <ToolIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>
                                            {exec.dd_tools?.name || 'Herramienta'}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                                            {formatDate(exec.created_at)}
                                            {exec.duration_ms && (
                                                <>
                                                    <span>·</span>
                                                    <span>{(exec.duration_ms / 1000).toFixed(1)}s</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <ExecutionStatus status={exec.status} />
                                    {TOOL_ROUTES[exec.dd_tools?.slug || ''] && (
                                        <Link
                                            href={TOOL_ROUTES[exec.dd_tools.slug]}
                                            className="p-1 transition-colors hover:opacity-80"
                                            style={{ color: 'var(--g-text-secondary)' }}
                                            aria-label={`Ir a ${exec.dd_tools?.name}`}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
