'use client';

import { useState, useEffect, useMemo } from 'react';
import { Wrench, ChevronDown, ChevronRight, Building2, Shield, FileSearch, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDTool, DDToolExecution } from '@/lib/supabase';
import ToggleSwitch from '@/components/configuracion/toggle-switch';

const TOOL_ICONS: Record<string, typeof Wrench> = {
    societario: Building2,
    marcas: Shield,
    'reps-warranties': FileSearch,
    'digest-pmo': AlertTriangle,
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--status-warning)',
    running: 'var(--status-info)',
    completed: 'var(--status-success)',
    error: 'var(--status-error)',
    cancelled: 'var(--g-text-muted)',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    running: 'En ejecución',
    completed: 'Completada',
    error: 'Error',
    cancelled: 'Cancelada',
};

export default function HerramientasAdminPage() {
    const [tools, setTools] = useState<DDTool[]>([]);
    const [executions, setExecutions] = useState<DDToolExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function load() {
            const [tRes, eRes] = await Promise.all([
                supabase
                    .from('dd_tools')
                    .select('*')
                    .order('sort_order'),
                supabase
                    .from('dd_tool_executions')
                    .select('*')
                    .order('created_at', { ascending: false }),
            ]);
            setTools(tRes.data || []);
            setExecutions(eRes.data || []);
            setLoading(false);
        }
        load();
    }, []);

    const activeCount = useMemo(() => tools.filter(t => t.is_active).length, [tools]);

    const statusBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        executions.forEach(e => {
            counts[e.status] = (counts[e.status] || 0) + 1;
        });
        return counts;
    }, [executions]);

    function toggleExpanded(toolId: string) {
        setExpandedTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
    }

    async function handleToggle(toolId: string, newValue: boolean) {
        setTools(prev => prev.map(t => t.id === toolId ? { ...t, is_active: newValue } : t));
        try {
            const resp = await fetch('/api/system/tools', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool_id: toolId, is_active: newValue }),
            });
            if (!resp.ok) {
                setTools(prev => prev.map(t => t.id === toolId ? { ...t, is_active: !newValue } : t));
            }
        } catch {
            setTools(prev => prev.map(t => t.id === toolId ? { ...t, is_active: !newValue } : t));
        }
    }

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton" style={{ height: '40px', width: '320px', borderRadius: 'var(--g-radius-md)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-4)' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ height: '88px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: '4px' }}>
                    <Wrench style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    <h1 style={{ fontSize: 'var(--g-text-h1)', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        Gestión de Herramientas
                    </h1>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--g-text-secondary)', margin: 0 }}>
                    Administra y controla las microherramientas del sistema
                </p>
            </div>

            {/* KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--g-space-4)' }}>
                <div className="g-card" style={{ padding: 'var(--g-space-4)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                        Total Herramientas
                    </p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        {tools.length}
                    </p>
                </div>

                <div className="g-card" style={{ padding: 'var(--g-space-4)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                        Activas
                    </p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--status-success)', margin: 0 }}>
                        {activeCount}
                    </p>
                </div>

                <div className="g-card" style={{ padding: 'var(--g-space-4)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--g-text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                        Ejecuciones Totales
                    </p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        {executions.length}
                    </p>
                </div>
            </div>

            {/* Tool Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                {tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool.slug] || Wrench;
                    const isExpanded = expandedTools[tool.id] || false;

                    return (
                        <div key={tool.id} className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* Main row */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--g-space-3)',
                                    padding: 'var(--g-space-4)',
                                }}
                            >
                                {/* Expand toggle */}
                                <button
                                    onClick={() => toggleExpanded(tool.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '2px',
                                        cursor: 'pointer',
                                        color: 'var(--g-text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexShrink: 0,
                                    }}
                                    aria-label={isExpanded ? 'Contraer detalles' : 'Expandir detalles'}
                                >
                                    {isExpanded
                                        ? <ChevronDown style={{ width: '16px', height: '16px' }} />
                                        : <ChevronRight style={{ width: '16px', height: '16px' }} />
                                    }
                                </button>

                                {/* Icon */}
                                <div
                                    style={{
                                        padding: '8px',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon style={{ width: '20px', height: '20px', color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                                </div>

                                {/* Name + slug */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                                        {tool.name}
                                    </p>
                                    <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--g-text-muted)', margin: '2px 0 0 0' }}>
                                        {tool.slug}
                                    </p>
                                </div>

                                {/* Area code pills */}
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flexShrink: 0 }}>
                                    {(tool.area_codes || []).map(code => (
                                        <span
                                            key={code}
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                                color: 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {code}
                                        </span>
                                    ))}
                                </div>

                                {/* Toggle */}
                                <ToggleSwitch
                                    checked={tool.is_active}
                                    onChange={(val) => handleToggle(tool.id, val)}
                                    label={`Activar/desactivar ${tool.name}`}
                                />
                            </div>

                            {/* Expandable detail section */}
                            {isExpanded && (
                                <div
                                    style={{
                                        borderTop: '1px solid var(--g-border-subtle)',
                                        padding: 'var(--g-space-4)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--g-space-4)',
                                    }}
                                >
                                    {/* Description */}
                                    {tool.description && (
                                        <p style={{ fontSize: '13px', color: 'var(--g-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                            {tool.description}
                                        </p>
                                    )}

                                    {/* Meta badges row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-3)', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--g-text-muted)', fontWeight: 500 }}>
                                                Requiere proyecto:
                                            </span>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: tool.requires_project ? 'var(--status-warning)' : 'var(--g-surface-muted)',
                                                    color: tool.requires_project ? 'var(--g-text-primary)' : 'var(--g-text-muted)',
                                                }}
                                            >
                                                {tool.requires_project ? 'Sí' : 'No'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Skills used */}
                                    {tool.skills_used && tool.skills_used.length > 0 && (
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--g-text-muted)', fontWeight: 500, margin: '0 0 6px 0' }}>
                                                Skills utilizadas:
                                            </p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(tool.skills_used || []).map(skill => (
                                                    <code
                                                        key={skill}
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '2px 8px',
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-secondary)',
                                                            border: '1px solid var(--g-border-subtle)',
                                                        }}
                                                    >
                                                        {skill}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Input schema */}
                                    {tool.input_schema && (
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--g-text-muted)', fontWeight: 500, margin: '0 0 6px 0' }}>
                                                Input Schema:
                                            </p>
                                            <pre
                                                style={{
                                                    fontSize: '11px',
                                                    fontFamily: 'monospace',
                                                    backgroundColor: 'var(--g-surface-muted)',
                                                    color: 'var(--g-text-secondary)',
                                                    padding: 'var(--g-space-3)',
                                                    borderRadius: 'var(--g-radius-md)',
                                                    border: '1px solid var(--g-border-subtle)',
                                                    overflow: 'auto',
                                                    maxHeight: '200px',
                                                    margin: 0,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {JSON.stringify(tool.input_schema, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Output schema */}
                                    {tool.output_schema && (
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--g-text-muted)', fontWeight: 500, margin: '0 0 6px 0' }}>
                                                Output Schema:
                                            </p>
                                            <pre
                                                style={{
                                                    fontSize: '11px',
                                                    fontFamily: 'monospace',
                                                    backgroundColor: 'var(--g-surface-muted)',
                                                    color: 'var(--g-text-secondary)',
                                                    padding: 'var(--g-space-3)',
                                                    borderRadius: 'var(--g-radius-md)',
                                                    border: '1px solid var(--g-border-subtle)',
                                                    overflow: 'auto',
                                                    maxHeight: '200px',
                                                    margin: 0,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {JSON.stringify(tool.output_schema, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Execution Statistics Section */}
            <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
                <h2 className="g-section-label" style={{ margin: '0 0 var(--g-space-4) 0' }}>
                    Estadísticas de Ejecución
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                    {/* Total */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: 'var(--g-text-secondary)' }}>
                            Total de ejecuciones
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                            {executions.length}
                        </span>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: 'var(--g-border-subtle)' }} />

                    {/* By-status breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                        {Object.entries(STATUS_LABELS).map(([status, label]) => {
                            const count = statusBreakdown[status] || 0;
                            return (
                                <div
                                    key={status}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: STATUS_COLORS[status],
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--g-text-secondary)' }}>
                                            {label}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
