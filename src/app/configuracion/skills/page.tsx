'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Search, Shield, AlertTriangle, Users, Zap, Eye, BarChart3, Activity, Clock, Target, TrendingUp, Plus, X, Copy, Play, History, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
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
    P0: { label: 'P0 — Crítica', color: 'var(--g-severity-critical)', bg: 'var(--g-priority-p0-bg)' },
    P1: { label: 'P1 — Alta', color: 'var(--g-severity-high)', bg: 'var(--g-hitl-bg)' },
    P2: { label: 'P2 — Media', color: 'var(--g-severity-medium)', bg: 'var(--g-trigger-bg)' },
    P3: { label: 'P3 — Baja', color: 'var(--g-text-muted)', bg: 'var(--g-surface-muted)' },
};

// ============================================================
// Lifecycle badge configuration
// ============================================================
const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    activo: { label: 'Activo', color: 'var(--status-success)', bg: 'var(--g-source-bg)' },
    inactivo: { label: 'Inactivo', color: 'var(--g-text-muted)', bg: 'var(--g-surface-muted)' },
    testing: { label: 'Testing', color: 'var(--g-severity-medium)', bg: 'var(--g-trigger-bg)' },
};

function getLifecycleStatus(skill: DDSkill): 'activo' | 'inactivo' | 'testing' {
    // Check metadata for testing flag (runtime-safe: metadata may exist on DB rows but not in TS type)
    const meta = (skill as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    if (meta && meta.testing === true) return 'testing';
    return skill.is_active ? 'activo' : 'inactivo';
}

// ============================================================
// Telemetry types
// ============================================================
interface TelemetrySkillStat {
    skill_key: string;
    total_executions: number;
    avg_latency_ms: number | null;
    success_rate: number | null;
    error_rate: number | null;
    avg_grounding: number | null;
    model_distribution: Record<string, number>;
}

interface TelemetryData {
    overall: {
        total_executions: number;
        avg_latency_ms: number | null;
        success_rate: number | null;
        error_rate: number | null;
        avg_grounding: number | null;
    };
    per_skill: TelemetrySkillStat[];
    period: string;
}

// ============================================================
// Sub-components
// ============================================================

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

function LifecycleBadge({ skill }: { skill: DDSkill }) {
    const status = getLifecycleStatus(skill);
    const cfg = LIFECYCLE_CONFIG[status];
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderRadius: 'var(--g-radius-full)',
            backgroundColor: cfg.bg,
            color: cfg.color,
            whiteSpace: 'nowrap',
            flexShrink: 0,
        }}>
            {cfg.label}
        </span>
    );
}

// ============================================================
// Prompt Version History (collapsible, per-skill)
// ============================================================

function VersionHistory({ skill }: { skill: DDSkill }) {
    const [open, setOpen] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    // MVP: derive version entries from the current version + updated_at
    const versions = useMemo(() => {
        const entries: { version: number; date: string; summary: string }[] = [];
        for (let v = skill.version; v >= 1; v--) {
            if (v === skill.version) {
                entries.push({
                    version: v,
                    date: new Date(skill.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                    summary: 'Version actual del prompt',
                });
            } else {
                // Approximate earlier versions based on created_at
                const created = new Date(skill.created_at);
                const updated = new Date(skill.updated_at);
                const span = updated.getTime() - created.getTime();
                const step = span / skill.version;
                const approxDate = new Date(created.getTime() + step * v);
                entries.push({
                    version: v,
                    date: approxDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                    summary: v === 1 ? 'Version inicial' : 'Ajuste de prompt',
                });
            }
        }
        return entries;
    }, [skill]);

    return (
        <div style={{ marginTop: 'var(--g-space-4)' }}>
            <button
                onClick={() => setOpen(prev => !prev)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                    fontSize: 'var(--g-text-sm)', fontWeight: 600, color: 'var(--g-text-secondary)',
                }}
            >
                <History style={{ width: '14px', height: '14px' }} />
                Historial de versiones
                {open ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronRight style={{ width: '14px', height: '14px' }} />}
            </button>
            {open && (
                <div style={{
                    marginTop: 'var(--g-space-3)', padding: 'var(--g-space-4)',
                    backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-md)',
                    border: '1px solid var(--g-border-subtle)',
                }}>
                    {/* Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                        {versions.map((entry, idx) => (
                            <div key={entry.version} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)' }}>
                                {/* Timeline dot + line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '20px', paddingTop: '2px' }}>
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                                        backgroundColor: idx === 0 ? 'var(--g-input-color)' : 'var(--g-border-default)',
                                    }} />
                                    {idx < versions.length - 1 && (
                                        <div style={{ width: '2px', height: '24px', backgroundColor: 'var(--g-border-subtle)', marginTop: '4px' }} />
                                    )}
                                </div>
                                {/* Version badge + info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', padding: '1px 8px',
                                            fontSize: '10px', fontWeight: 700, borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: idx === 0 ? 'var(--g-input-bg)' : 'var(--g-surface-card)',
                                            color: idx === 0 ? 'var(--g-input-color)' : 'var(--g-text-muted)',
                                            border: '1px solid var(--g-border-subtle)',
                                        }}>
                                            v{entry.version}
                                        </span>
                                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>{entry.date}</span>
                                    </div>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>{entry.summary}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Show prompt button */}
                    <div style={{ marginTop: 'var(--g-space-4)' }}>
                        <button
                            onClick={() => setShowPrompt(prev => !prev)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-secondary)',
                                cursor: 'pointer',
                            }}
                        >
                            <Eye style={{ width: '12px', height: '12px' }} />
                            {showPrompt ? 'Ocultar prompt' : 'Ver prompt anterior'}
                        </button>
                        {showPrompt && (
                            <div style={{ marginTop: 'var(--g-space-3)' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
                                    marginBottom: 'var(--g-space-2)',
                                }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', padding: '1px 8px',
                                        fontSize: '10px', fontWeight: 700, borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: 'var(--g-input-bg)', color: 'var(--g-input-color)',
                                    }}>
                                        v{skill.version}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', fontStyle: 'italic' }}>
                                        Version actual
                                    </span>
                                </div>
                                <textarea
                                    readOnly
                                    value={skill.prompt_template}
                                    style={{
                                        width: '100%', minHeight: '120px', resize: 'vertical',
                                        padding: 'var(--g-space-3)', fontSize: 'var(--g-text-caption)',
                                        fontFamily: 'monospace', borderRadius: 'var(--g-radius-md)',
                                        border: '1px solid var(--g-border-subtle)',
                                        backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Skill Testing Panel (inline, per-skill)
// ============================================================

function SkillTestPanel({ skill }: { skill: DDSkill }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<'ready' | 'running' | 'done'>('ready');
    const [formValues, setFormValues] = useState<Record<string, string>>({});

    const inputs = (skill.inputs_required as string[]) || [];

    const statusConfig = {
        ready:   { label: 'Listo para prueba', color: 'var(--g-text-secondary)', bg: 'var(--g-surface-muted)' },
        running: { label: 'Ejecutando...', color: 'var(--g-severity-medium)', bg: 'var(--g-trigger-bg)' },
        done:    { label: 'Completado', color: 'var(--status-success)', bg: 'var(--g-source-bg)' },
    };

    const sc = statusConfig[status];

    return (
        <div style={{ marginTop: 'var(--g-space-4)' }}>
            <button
                onClick={() => setOpen(prev => !prev)}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', fontSize: 'var(--g-text-caption)', fontWeight: 600,
                    borderRadius: 'var(--g-radius-md)',
                    border: '1px solid var(--g-border-default)',
                    backgroundColor: 'var(--g-surface-card)', color: 'var(--g-brand-3308)',
                    cursor: 'pointer',
                }}
            >
                <Play style={{ width: '12px', height: '12px' }} />
                Probar Skill
            </button>
            {open && (
                <div style={{
                    marginTop: 'var(--g-space-3)', padding: 'var(--g-space-4)',
                    backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-md)',
                    border: '1px solid var(--g-border-subtle)',
                }}>
                    {/* Status indicator */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px', marginBottom: 'var(--g-space-4)',
                        fontSize: 'var(--g-text-caption)', fontWeight: 600,
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: sc.bg, color: sc.color,
                    }}>
                        {status === 'done' && <CheckCircle2 style={{ width: '12px', height: '12px' }} />}
                        {sc.label}
                    </div>

                    {/* Input fields */}
                    {inputs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', marginBottom: 'var(--g-space-4)' }}>
                            {inputs.map(inp => (
                                <div key={inp}>
                                    <label style={{
                                        display: 'block', marginBottom: '4px',
                                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
                                        letterSpacing: '0.04em', color: 'var(--g-text-muted)',
                                    }}>
                                        {inp}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={`Valor para ${inp}`}
                                        value={formValues[inp] || ''}
                                        onChange={e => setFormValues(prev => ({ ...prev, [inp]: e.target.value }))}
                                        style={{
                                            width: '100%', padding: '8px 12px',
                                            border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)',
                                            fontSize: 'var(--g-text-sm)', outline: 'none',
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', margin: '0 0 var(--g-space-4) 0' }}>
                            Este skill no define inputs requeridos.
                        </p>
                    )}

                    {/* Execute button (disabled) */}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                            disabled
                            title="Requiere conexion Harvey AI"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '8px 20px', fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)', border: 'none',
                                backgroundColor: 'var(--g-brand-3308)', color: 'white',
                                opacity: 0.5, cursor: 'not-allowed',
                            }}
                        >
                            <Play style={{ width: '14px', height: '14px' }} />
                            Ejecutar prueba
                        </button>
                    </div>

                    {/* Mock response area */}
                    <div style={{
                        marginTop: 'var(--g-space-4)', padding: 'var(--g-space-4)',
                        backgroundColor: 'var(--g-surface-card)', borderRadius: 'var(--g-radius-md)',
                        border: '1px dashed var(--g-border-subtle)', minHeight: '80px',
                    }}>
                        <p style={{
                            fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)',
                            margin: 0, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.6,
                        }}>
                            Los resultados de la prueba apareceran aqui
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function CreateSkillModal({ areas, onClose, onCreated }: { areas: DDArea[]; onClose: () => void; onCreated: (skill: DDSkill) => void }) {
    const [form, setForm] = useState({
        skill_key: '', name: '', area_code: '', category: 'verificacion', priority: 'P1', prompt_template: '', purpose: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.skill_key || !form.name || !form.area_code || !form.prompt_template) {
            setError('skill_key, nombre, area y prompt son obligatorios');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const resp = await fetch('/api/system/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const result = await resp.json();
            if (!resp.ok) {
                setError(result.error || 'Error al crear skill');
                setSaving(false);
                return;
            }
            onCreated(result.data);
        } catch {
            setError('Error de conexion');
            setSaving(false);
        }
    }

    const fieldStyle: React.CSSProperties = {
        width: '100%', padding: '8px 12px',
        border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)',
        backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)',
        fontSize: 'var(--g-text-sm)', outline: 'none',
    };
    const labelStyle: React.CSSProperties = {
        display: 'block', marginBottom: '4px',
        fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const,
        letterSpacing: '0.04em', color: 'var(--g-text-muted)',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div style={{
                width: '560px', maxHeight: '85vh', overflow: 'auto',
                backgroundColor: 'var(--g-surface-card)', borderRadius: 'var(--g-radius-xl)',
                border: '1px solid var(--g-border-default)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--g-text-base)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        Crear Nuevo Skill
                    </h3>
                    <button onClick={onClose} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', border: 'none', borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'transparent', color: 'var(--g-text-muted)', cursor: 'pointer',
                    }}>
                        <X style={{ width: '16px', height: '16px' }} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: 'var(--g-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-3)' }}>
                        <div>
                            <label style={labelStyle}>Skill Key *</label>
                            <input type="text" value={form.skill_key} onChange={e => setForm(prev => ({ ...prev, skill_key: e.target.value }))} placeholder="area.nombre_skill" style={fieldStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Nombre *</label>
                            <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nombre descriptivo" style={fieldStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--g-space-3)' }}>
                        <div>
                            <label style={labelStyle}>Area *</label>
                            <select value={form.area_code} onChange={e => setForm(prev => ({ ...prev, area_code: e.target.value }))} style={fieldStyle}>
                                <option value="">Seleccionar</option>
                                {areas.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Categoria</label>
                            <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} style={fieldStyle}>
                                <option value="verificacion">Verificacion</option>
                                <option value="analisis">Analisis</option>
                                <option value="extraccion">Extraccion</option>
                                <option value="generacion">Generacion</option>
                                <option value="monitorizacion">Monitorizacion</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Prioridad</label>
                            <select value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))} style={fieldStyle}>
                                <option value="P0">P0 — Critica</option>
                                <option value="P1">P1 — Alta</option>
                                <option value="P2">P2 — Media</option>
                                <option value="P3">P3 — Baja</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Proposito</label>
                        <input type="text" value={form.purpose} onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))} placeholder="Descripcion breve del objetivo" style={fieldStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Prompt Template *</label>
                        <textarea value={form.prompt_template} onChange={e => setForm(prev => ({ ...prev, prompt_template: e.target.value }))} placeholder="Escribe el prompt template..." rows={6} style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }} />
                    </div>
                    {error && (
                        <div style={{ padding: '8px 12px', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-priority-p0-bg)', color: 'var(--status-error)', fontSize: 'var(--g-text-caption)', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-3)', paddingTop: 'var(--g-space-2)' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '8px 20px', fontSize: 'var(--g-text-sm)', fontWeight: 500,
                            borderRadius: 'var(--g-radius-md)', border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-secondary)', cursor: 'pointer',
                        }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} style={{
                            padding: '8px 24px', fontSize: 'var(--g-text-sm)', fontWeight: 600,
                            borderRadius: 'var(--g-radius-md)', border: 'none',
                            backgroundColor: 'var(--g-brand-3308)', color: 'white',
                            cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                        }}>
                            {saving ? 'Guardando...' : 'Crear Skill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================
// Telemetry Dashboard Panel
// ============================================================

function TelemetryPanel() {
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [telemetryLoading, setTelemetryLoading] = useState(true);
    const [period, setPeriod] = useState<string>('last_30d');

    const loadTelemetry = useCallback(async (p: string) => {
        setTelemetryLoading(true);
        try {
            const resp = await fetch(`/api/configuracion/skills/telemetry?period=${p}`);
            if (resp.ok) {
                const data = await resp.json();
                setTelemetry(data);
            }
        } catch {
            // Best-effort telemetry
        }
        setTelemetryLoading(false);
    }, []);

    useEffect(() => {
        loadTelemetry(period);
    }, [period, loadTelemetry]);

    const periodOptions = [
        { value: 'last_7d', label: '7 dias' },
        { value: 'last_30d', label: '30 dias' },
        { value: 'all', label: 'Todo' },
    ];

    if (telemetryLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '90px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    const overall = telemetry?.overall || {
        total_executions: 0,
        avg_latency_ms: null,
        success_rate: null,
        error_rate: null,
        avg_grounding: null,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Period Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                <span style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Periodo:</span>
                <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-md)', padding: '2px' }}>
                    {periodOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt.value)}
                            style={{
                                padding: '4px 12px',
                                fontSize: 'var(--g-text-caption)',
                                fontWeight: period === opt.value ? 700 : 500,
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: period === opt.value ? 'var(--g-surface-card)' : 'transparent',
                                color: period === opt.value ? 'var(--g-text-primary)' : 'var(--g-text-muted)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all var(--g-transition-fast)',
                                boxShadow: period === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <Activity style={{ width: '16px', height: '16px', color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Total Ejecuciones</span>
                    </div>
                    <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {overall.total_executions.toLocaleString()}
                    </span>
                </div>

                <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <Clock style={{ width: '16px', height: '16px', color: 'var(--g-input-color)' }} aria-hidden="true" />
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Latencia Media</span>
                    </div>
                    <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: 'var(--g-text-primary)' }}>
                        {overall.avg_latency_ms !== null ? `${overall.avg_latency_ms.toLocaleString()} ms` : '--'}
                    </span>
                </div>

                <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--status-error)' }} aria-hidden="true" />
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Tasa de Error</span>
                    </div>
                    <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: overall.error_rate && overall.error_rate > 10 ? 'var(--status-error)' : 'var(--g-text-primary)' }}>
                        {overall.error_rate !== null ? `${overall.error_rate}%` : '--'}
                    </span>
                </div>

                <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <Target style={{ width: '16px', height: '16px', color: 'var(--status-success)' }} aria-hidden="true" />
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Grounding Medio</span>
                    </div>
                    <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: overall.avg_grounding !== null && overall.avg_grounding >= 80 ? 'var(--status-success)' : overall.avg_grounding !== null && overall.avg_grounding >= 50 ? 'var(--g-severity-medium)' : 'var(--g-text-primary)' }}>
                        {overall.avg_grounding !== null ? `${overall.avg_grounding}%` : '--'}
                    </span>
                </div>
            </div>

            {/* Per-Skill Breakdown Table */}
            <div className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--g-space-4)', borderBottom: '1px solid var(--g-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                    <BarChart3 style={{ width: '16px', height: '16px', color: 'var(--g-brand-3308)' }} aria-hidden="true" />
                    <span style={{ fontSize: 'var(--g-text-sm)', fontWeight: 700, color: 'var(--g-text-primary)' }}>Desglose por Skill</span>
                </div>

                {!telemetry?.per_skill || telemetry.per_skill.length === 0 ? (
                    <div style={{ padding: 'var(--g-space-8) var(--g-space-4)', textAlign: 'center' }}>
                        <BarChart3 style={{ width: '28px', height: '28px', color: 'var(--g-text-muted)', margin: '0 auto var(--g-space-2)' }} aria-hidden="true" />
                        <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                            Sin datos de ejecuciones en este periodo.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--g-surface-subtle)' }}>
                                    {['Skill Key', 'Ejecuciones', 'Latencia Media', 'Tasa Exito', 'Grounding', 'Modelos'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', fontSize: 'var(--g-text-caption)', fontWeight: 700, color: 'var(--g-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid var(--g-border-subtle)' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {telemetry.per_skill.map((stat, idx) => (
                                    <tr key={stat.skill_key} style={{ borderBottom: idx < telemetry.per_skill.length - 1 ? '1px solid var(--g-border-subtle)' : 'none' }}>
                                        <td style={{ padding: '8px 12px' }}>
                                            <code style={{ fontSize: 'var(--g-text-caption)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                                                {stat.skill_key}
                                            </code>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontSize: 'var(--g-text-sm)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                                            {stat.total_executions.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)' }}>
                                            {stat.avg_latency_ms !== null ? `${stat.avg_latency_ms.toLocaleString()} ms` : '--'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {stat.success_rate !== null ? (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    fontSize: 'var(--g-text-caption)',
                                                    fontWeight: 600,
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: stat.success_rate >= 90 ? 'var(--g-source-bg)' : stat.success_rate >= 70 ? 'var(--g-trigger-bg)' : 'var(--g-priority-p0-bg)',
                                                    color: stat.success_rate >= 90 ? 'var(--status-success)' : stat.success_rate >= 70 ? 'var(--g-severity-medium)' : 'var(--status-error)',
                                                }}>
                                                    {stat.success_rate}%
                                                </span>
                                            ) : '--'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {stat.avg_grounding !== null ? (
                                                <span style={{
                                                    fontSize: 'var(--g-text-sm)',
                                                    fontWeight: 600,
                                                    color: stat.avg_grounding >= 80 ? 'var(--status-success)' : stat.avg_grounding >= 50 ? 'var(--g-severity-medium)' : 'var(--status-error)',
                                                }}>
                                                    {stat.avg_grounding}%
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-muted)' }}>--</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {Object.entries(stat.model_distribution).map(([model, count]) => (
                                                    <span key={model} style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '1px 6px',
                                                        fontSize: '9px',
                                                        fontWeight: 500,
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-surface-muted)',
                                                        color: 'var(--g-text-secondary)',
                                                    }}>
                                                        {model} ({count})
                                                    </span>
                                                ))}
                                                {Object.keys(stat.model_distribution).length === 0 && (
                                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>--</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Main Page Component
// ============================================================

export default function SkillsAdminPage() {
    const [skills, setSkills] = useState<DDSkill[]>([]);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'catalogo' | 'telemetria'>('catalogo');
    const [showCreateModal, setShowCreateModal] = useState(false);

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
    const testingCount = useMemo(() => skills.filter(s => getLifecycleStatus(s) === 'testing').length, [skills]);

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
                        Gesti&oacute;n de Skills
                    </h1>
                </div>
                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                    Cat&aacute;logo completo de skills IA — Fichas validadas por el equipo legal
                </p>
            </div>

            {/* KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--g-space-4)' }}>
                {[
                    { label: 'Total Skills', value: skills.length, color: 'var(--g-text-primary)' },
                    { label: 'Activas', value: activeCount, color: 'var(--status-success)' },
                    { label: 'Pendientes', value: inactiveCount, color: 'var(--g-text-muted)' },
                    { label: 'P0 Criticas', value: p0Count, color: 'var(--status-error)' },
                    { label: 'Areas', value: uniqueAreaCount, color: 'var(--g-text-primary)' },
                ].map((kpi, i) => (
                    <div key={i} className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>{kpi.label}</span>
                        <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--g-border-subtle)' }}>
                <button
                    onClick={() => setActiveTab('catalogo')}
                    style={{
                        padding: 'var(--g-space-3) var(--g-space-5)',
                        fontSize: 'var(--g-text-sm)',
                        fontWeight: activeTab === 'catalogo' ? 700 : 500,
                        color: activeTab === 'catalogo' ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'catalogo' ? '2px solid var(--g-brand-3308)' : '2px solid transparent',
                        marginBottom: '-2px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-2)',
                        transition: 'all var(--g-transition-fast)',
                    }}
                >
                    <BookOpen style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                    Catalogo
                    {testingCount > 0 && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '18px',
                            height: '18px',
                            padding: '0 5px',
                            fontSize: '10px',
                            fontWeight: 700,
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--g-trigger-bg)',
                            color: 'var(--g-severity-medium)',
                        }}>
                            {testingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('telemetria')}
                    style={{
                        padding: 'var(--g-space-3) var(--g-space-5)',
                        fontSize: 'var(--g-text-sm)',
                        fontWeight: activeTab === 'telemetria' ? 700 : 500,
                        color: activeTab === 'telemetria' ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'telemetria' ? '2px solid var(--g-brand-3308)' : '2px solid transparent',
                        marginBottom: '-2px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-2)',
                        transition: 'all var(--g-transition-fast)',
                    }}
                >
                    <TrendingUp style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                    Telemetria
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'telemetria' ? (
                <TelemetryPanel />
            ) : (
                <>
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
                            <option value="P0">P0 — Critica</option>
                            <option value="P1">P1 — Alta</option>
                            <option value="P2">P2 — Media</option>
                        </select>
                        {/* Category filter */}
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            aria-label="Filtrar por categoria"
                            style={{ padding: '6px 12px', border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)', fontSize: 'var(--g-text-sm)', outline: 'none' }}
                        >
                            <option value="all">Todas categorias</option>
                            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                            ))}
                        </select>
                        {/* Result count */}
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            {filteredSkills.length} resultado{filteredSkills.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            style={{
                                marginLeft: 'auto',
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px',
                                fontSize: 'var(--g-text-sm)', fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: 'none',
                                backgroundColor: 'var(--g-brand-3308)',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'opacity var(--g-transition-fast)',
                            }}
                        >
                            <Plus style={{ width: '14px', height: '14px' }} />
                            Crear Skill
                        </button>
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

                                                            {/* Lifecycle badge */}
                                                            <LifecycleBadge skill={skill} />

                                                            {/* skill_key */}
                                                            <span style={{ fontFamily: 'monospace', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', whiteSpace: 'nowrap' }}>{skill.skill_key}</span>

                                                            {/* HITL badge */}
                                                            {skill.hitl_required && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', fontSize: '9px', fontWeight: 600, borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--g-hitl-bg)', color: 'var(--g-severity-high)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                                                                {/* Version & Prompt Info bar */}
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 'var(--g-space-4)',
                                                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                                                    marginBottom: 'var(--g-space-5)',
                                                                    backgroundColor: 'var(--g-surface-muted)',
                                                                    borderRadius: 'var(--g-radius-md)',
                                                                    border: '1px solid var(--g-border-subtle)',
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)' }}>Version</span>
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: 'var(--g-text-caption)', fontWeight: 700, borderRadius: 'var(--g-radius-full)', backgroundColor: 'var(--g-input-bg)', color: 'var(--g-input-color)' }}>
                                                                            v{skill.version}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--g-border-subtle)' }} />
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)' }}>Estado</span>
                                                                        <LifecycleBadge skill={skill} />
                                                                    </div>
                                                                    <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--g-border-subtle)' }} />
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)' }}>Categoria</span>
                                                                        <span style={{ fontSize: 'var(--g-text-caption)', fontWeight: 600, color: catCfg ? `hsl(${catCfg.color})` : 'var(--g-text-secondary)' }}>
                                                                            {catCfg?.label || skill.category}
                                                                        </span>
                                                                    </div>
                                                                    {skill.priority && (
                                                                        <>
                                                                            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--g-border-subtle)' }} />
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                                                                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--g-text-muted)' }}>Prioridad</span>
                                                                                <span style={{ fontSize: 'var(--g-text-caption)', fontWeight: 600, color: priCfg?.color || 'var(--g-text-secondary)' }}>
                                                                                    {PRIORITY_CONFIG[skill.priority]?.label || skill.priority}
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    <div style={{ flex: 1 }} />
                                                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                                                        Actualizado: {new Date(skill.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </span>
                                                                </div>

                                                                {/* 2-column grid for metadata */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-5)', marginBottom: 'var(--g-space-5)' }}>
                                                                    {/* Left column */}
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
                                                                        {/* Purpose */}
                                                                        {skill.purpose && (
                                                                            <DetailSection label="Proposito">
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
                                                                                    <Zap style={{ width: '14px', height: '14px', color: 'var(--g-severity-medium)' }} />
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
                                                                            <DetailSection label="Validacion Automatica">
                                                                                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                                    <Shield style={{ width: '14px', height: '14px', color: 'var(--g-brand-3308)', flexShrink: 0, marginTop: '2px' }} />
                                                                                    {skill.validation_rules}
                                                                                </p>
                                                                            </DetailSection>
                                                                        )}

                                                                        {/* HITL conditions */}
                                                                        {skill.hitl_conditions && (
                                                                            <DetailSection label="Revision Humana (HITL)">
                                                                                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                                    <Eye style={{ width: '14px', height: '14px', color: 'var(--g-severity-high)', flexShrink: 0, marginTop: '2px' }} />
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
                                                                            <DetailSection label="Riesgos y Limites">
                                                                                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                                    <AlertTriangle style={{ width: '14px', height: '14px', color: 'var(--g-severity-medium)', flexShrink: 0, marginTop: '2px' }} />
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
                                                                                            <span style={{ color: 'var(--g-text-muted)', fontSize: '14px' }}>{'\u2192'}</span>
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
                </>
            )}
            {showCreateModal && (
                <CreateSkillModal
                    areas={areas}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(newSkill) => {
                        setSkills(prev => [...prev, newSkill]);
                        setShowCreateModal(false);
                    }}
                />
            )}
        </div>
    );
}
