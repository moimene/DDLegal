'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    List,
    Plus,
    ChevronUp,
    ChevronDown,
    Save,
    X,
    Trash2,
    Palette,
    Search,
    ChevronRight,
    Clock,
    Eye,
    EyeOff,
    CheckSquare,
    Square,
    Power,
    PowerOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDDomainEnum } from '@/lib/supabase';
import ToggleSwitch from '@/components/configuracion/toggle-switch';

// ---------------------------------------------------------------------------
// Domain registry — known domains with Spanish labels
// ---------------------------------------------------------------------------
const DOMAIN_CATALOG: { key: string; label: string }[] = [
    { key: 'severity', label: 'Severidad' },
    { key: 'task_status', label: 'Estado de tarea' },
    { key: 'contingency_category', label: 'Categoria contingencia' },
    { key: 'treatment_type', label: 'Tipo tratamiento' },
    { key: 'negotiation_status', label: 'Estado negociacion' },
    { key: 'report_category', label: 'Categoria informe' },
    { key: 'visibility', label: 'Visibilidad' },
];

const domainLabel = (key: string) =>
    DOMAIN_CATALOG.find(d => d.key === key)?.label ?? key;

// ---------------------------------------------------------------------------
// Inline editable cell
// ---------------------------------------------------------------------------
function EditableCell({
    value,
    onSave,
    type = 'text',
    placeholder,
}: {
    value: string;
    onSave: (v: string) => void;
    type?: 'text' | 'color';
    placeholder?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => { setDraft(value); }, [value]);

    if (!editing) {
        return (
            <span
                onClick={() => setEditing(true)}
                style={{
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: 'var(--g-radius-sm)',
                    minWidth: '40px',
                    display: 'inline-block',
                    transition: 'background var(--g-transition-fast)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--g-surface-muted)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title="Clic para editar"
            >
                {type === 'color' && value ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            width: '14px', height: '14px', borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: value, border: '1px solid var(--g-border-default)',
                            flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 'var(--g-text-caption)', fontFamily: 'monospace', color: 'var(--g-text-secondary)' }}>{value}</span>
                    </span>
                ) : (
                    <span style={{ color: value ? 'var(--g-text-primary)' : 'var(--g-text-muted)', fontSize: 'var(--g-text-sm)' }}>
                        {value || (placeholder ?? '—')}
                    </span>
                )}
            </span>
        );
    }

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {type === 'color' && (
                <input
                    type="color"
                    value={draft || '#888888'}
                    onChange={e => setDraft(e.target.value)}
                    style={{ width: '24px', height: '24px', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                />
            )}
            <input
                autoFocus
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') { onSave(draft); setEditing(false); }
                    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
                }}
                placeholder={placeholder}
                style={{
                    width: type === 'color' ? '80px' : '120px',
                    padding: '2px 6px',
                    fontSize: 'var(--g-text-sm)',
                    border: '1px solid var(--g-brand-3308)',
                    borderRadius: 'var(--g-radius-sm)',
                    backgroundColor: 'var(--g-surface-card)',
                    color: 'var(--g-text-primary)',
                    outline: 'none',
                }}
            />
            <button
                onClick={() => { onSave(draft); setEditing(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-success)', padding: '2px', display: 'flex' }}
                aria-label="Guardar"
            >
                <Save style={{ width: '14px', height: '14px' }} />
            </button>
            <button
                onClick={() => { setDraft(value); setEditing(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--g-text-muted)', padding: '2px', display: 'flex' }}
                aria-label="Cancelar"
            >
                <X style={{ width: '14px', height: '14px' }} />
            </button>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Add-enum inline form
// ---------------------------------------------------------------------------
interface NewEnumForm {
    code: string;
    label: string;
    label_en: string;
    color: string;
    icon: string;
}

const EMPTY_FORM: NewEnumForm = { code: '', label: '', label_en: '', color: '', icon: '' };

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function DominiosPage() {
    const [enums, setEnums] = useState<DDDomainEnum[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDomain, setSelectedDomain] = useState<string>(DOMAIN_CATALOG[0].key);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [newForm, setNewForm] = useState<NewEnumForm>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

    // -----------------------------------------------------------------------
    // Load all enums once
    // -----------------------------------------------------------------------
    const loadEnums = useCallback(async () => {
        const { data } = await supabase
            .from('dd_domain_enums')
            .select('*')
            .order('domain')
            .order('sort_order');
        setEnums(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { loadEnums(); }, [loadEnums]);

    // -----------------------------------------------------------------------
    // Derived data
    // -----------------------------------------------------------------------
    const countByDomain = useMemo(() => {
        const map: Record<string, number> = {};
        enums.forEach(e => { map[e.domain] = (map[e.domain] || 0) + 1; });
        return map;
    }, [enums]);

    const domainEnums = useMemo(() => {
        let items = enums.filter(e => e.domain === selectedDomain);
        if (!showInactive) {
            items = items.filter(e => e.is_active);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(
                e =>
                    e.code.toLowerCase().includes(q) ||
                    e.label.toLowerCase().includes(q) ||
                    (e.label_en && e.label_en.toLowerCase().includes(q))
            );
        }
        return items.sort((a, b) => a.sort_order - b.sort_order);
    }, [enums, selectedDomain, search, showInactive]);

    const maxVersion = useMemo(() => {
        const versions = enums.filter(e => e.domain === selectedDomain).map(e => e.version);
        return versions.length ? Math.max(...versions) : 0;
    }, [enums, selectedDomain]);

    // -----------------------------------------------------------------------
    // API helpers
    // -----------------------------------------------------------------------
    async function apiCall(method: string, body: Record<string, unknown>) {
        const resp = await fetch('/api/configuracion/dominios', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Error de servidor' }));
            throw new Error(err.error || 'Error de servidor');
        }
        return resp.json();
    }

    // -----------------------------------------------------------------------
    // PATCH a single field
    // -----------------------------------------------------------------------
    async function patchField(id: string, field: string, value: unknown) {
        // Optimistic update
        setEnums(prev =>
            prev.map(e => (e.id === id ? { ...e, [field]: value } : e))
        );
        try {
            await apiCall('PATCH', { id, [field]: value });
        } catch {
            // Revert on failure
            await loadEnums();
        }
    }

    // -----------------------------------------------------------------------
    // Toggle is_active
    // -----------------------------------------------------------------------
    async function handleToggle(id: string, newValue: boolean) {
        await patchField(id, 'is_active', newValue);
    }

    // -----------------------------------------------------------------------
    // Move up / down (swap sort_order with neighbour)
    // -----------------------------------------------------------------------
    async function handleMove(id: string, direction: 'up' | 'down') {
        const sorted = [...domainEnums];
        const idx = sorted.findIndex(e => e.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const current = sorted[idx];
        const neighbour = sorted[swapIdx];

        // Optimistic swap
        setEnums(prev =>
            prev.map(e => {
                if (e.id === current.id) return { ...e, sort_order: neighbour.sort_order };
                if (e.id === neighbour.id) return { ...e, sort_order: current.sort_order };
                return e;
            })
        );

        try {
            await Promise.all([
                apiCall('PATCH', { id: current.id, sort_order: neighbour.sort_order }),
                apiCall('PATCH', { id: neighbour.id, sort_order: current.sort_order }),
            ]);
        } catch {
            await loadEnums();
        }
    }

    // -----------------------------------------------------------------------
    // Soft-delete
    // -----------------------------------------------------------------------
    async function handleDelete(id: string) {
        setEnums(prev => prev.map(e => (e.id === id ? { ...e, is_active: false } : e)));
        try {
            await apiCall('DELETE', { id });
        } catch {
            await loadEnums();
        }
    }

    // -----------------------------------------------------------------------
    // Create new enum
    // -----------------------------------------------------------------------
    async function handleCreate() {
        if (!newForm.code.trim() || !newForm.label.trim()) return;
        setSaving(true);
        try {
            const nextOrder = domainEnums.length > 0
                ? Math.max(...domainEnums.map(e => e.sort_order)) + 1
                : 0;

            await apiCall('POST', {
                domain: selectedDomain,
                code: newForm.code.trim(),
                label: newForm.label.trim(),
                label_en: newForm.label_en.trim() || null,
                color: newForm.color.trim() || null,
                icon: newForm.icon.trim() || null,
                sort_order: nextOrder,
            });
            setNewForm({ ...EMPTY_FORM });
            setShowAdd(false);
            await loadEnums();
        } catch (err) {
            console.error('Error creando enum:', err);
        } finally {
            setSaving(false);
        }
    }

    // -----------------------------------------------------------------------
    // Clear selection when domain changes
    // -----------------------------------------------------------------------
    useEffect(() => {
        setSelectedIds(new Set());
        setSelectedEntryId(null);
    }, [selectedDomain]);

    // -----------------------------------------------------------------------
    // Selection helpers
    // -----------------------------------------------------------------------
    function toggleSelection(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAllSelection() {
        if (selectedIds.size === domainEnums.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(domainEnums.map(e => e.id)));
        }
    }

    // -----------------------------------------------------------------------
    // Bulk activate / deactivate
    // -----------------------------------------------------------------------
    async function handleBulkSetActive(active: boolean) {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        // Optimistic update
        setEnums(prev =>
            prev.map(e => (ids.includes(e.id) ? { ...e, is_active: active } : e))
        );
        setSelectedIds(new Set());

        try {
            await Promise.all(
                ids.map(id => apiCall('PATCH', { id, is_active: active }))
            );
        } catch {
            await loadEnums();
        }
    }

    // -----------------------------------------------------------------------
    // Version history for selected entry
    // -----------------------------------------------------------------------
    const selectedEntry = useMemo(() => {
        if (!selectedEntryId) return null;
        return enums.find(e => e.id === selectedEntryId) ?? null;
    }, [enums, selectedEntryId]);

    // -----------------------------------------------------------------------
    // Loading skeleton
    // -----------------------------------------------------------------------
    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--g-space-4)', height: '400px' }}>
                    <div className="skeleton" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                    <div className="skeleton" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                </div>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Breadcrumb */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                <a
                    href="/configuracion"
                    style={{ color: 'var(--g-text-muted)', textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--g-text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--g-text-muted)'; }}
                >
                    Configuracion
                </a>
                <ChevronRight style={{ width: '12px', height: '12px' }} />
                <span style={{ color: 'var(--g-text-primary)', fontWeight: 600 }}>Dominios</span>
            </nav>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: '4px' }}>
                        <List style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                        <h1 style={{ fontSize: 'var(--g-text-h1)', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                            Dominios y Enumeraciones
                        </h1>
                    </div>
                    <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                        Administra los valores enumerados del sistema agrupados por dominio
                    </p>
                </div>

                {/* Version badge */}
                {maxVersion > 0 && (
                    <span style={{
                        display: 'inline-flex', padding: '4px 12px', fontSize: 'var(--g-text-caption)',
                        fontWeight: 600, borderRadius: 'var(--g-radius-full)',
                        backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
                    }}>
                        v{maxVersion}
                    </span>
                )}
            </div>

            {/* Main layout: sidebar + table */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--g-space-4)', alignItems: 'start' }}>
                {/* Left sidebar — domain list */}
                <div className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        padding: 'var(--g-space-3) var(--g-space-4)',
                        borderBottom: '1px solid var(--g-border-default)',
                        fontSize: 'var(--g-text-caption)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--g-text-muted)',
                    }}>
                        Dominios
                    </div>
                    {DOMAIN_CATALOG.map(d => {
                        const isActive = d.key === selectedDomain;
                        const count = countByDomain[d.key] || 0;
                        return (
                            <button
                                key={d.key}
                                onClick={() => { setSelectedDomain(d.key); setSearch(''); setShowAdd(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    width: '100%', padding: 'var(--g-space-3) var(--g-space-4)',
                                    border: 'none', cursor: 'pointer',
                                    backgroundColor: isActive ? 'hsla(217, 91%, 60%, 0.08)' : 'transparent',
                                    borderLeft: isActive ? '3px solid var(--g-brand-3308)' : '3px solid transparent',
                                    color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-primary)',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: 'var(--g-text-sm)',
                                    textAlign: 'left',
                                    transition: 'all var(--g-transition-fast)',
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--g-surface-muted)';
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                            >
                                <span>{d.label}</span>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    minWidth: '22px', height: '20px', padding: '0 6px',
                                    fontSize: '11px', fontWeight: 700,
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: isActive ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                                    color: isActive ? 'white' : 'var(--g-text-muted)',
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right main area — table */}
                <div className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Toolbar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                        padding: 'var(--g-space-3) var(--g-space-4)',
                        borderBottom: '1px solid var(--g-border-default)',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--g-text-base)', color: 'var(--g-text-primary)' }}>
                            {domainLabel(selectedDomain)}
                        </span>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            ({domainEnums.length} valor{domainEnums.length !== 1 ? 'es' : ''})
                        </span>

                        <div style={{ flex: 1 }} />

                        {/* Search within domain */}
                        <div style={{ position: 'relative', width: '200px' }}>
                            <Search style={{
                                position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                                width: '14px', height: '14px', color: 'var(--g-text-muted)', pointerEvents: 'none',
                            }} aria-hidden="true" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                aria-label="Buscar enumeraciones"
                                style={{
                                    width: '100%', padding: '4px 8px 4px 28px',
                                    border: '1px solid var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                    fontSize: 'var(--g-text-caption)', outline: 'none',
                                }}
                            />
                        </div>

                        {/* Show inactive toggle */}
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', border: '1px solid var(--g-border-default)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: showInactive ? 'hsla(217, 91%, 60%, 0.08)' : 'transparent',
                                color: showInactive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                fontSize: 'var(--g-text-caption)', fontWeight: 500,
                                cursor: 'pointer', transition: 'all var(--g-transition-fast)',
                            }}
                            aria-label="Mostrar inactivos"
                        >
                            {showInactive
                                ? <Eye style={{ width: '14px', height: '14px' }} />
                                : <EyeOff style={{ width: '14px', height: '14px' }} />
                            }
                            Mostrar inactivos
                        </button>

                        {/* Add button */}
                        <button
                            onClick={() => setShowAdd(!showAdd)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '5px 12px', border: 'none',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-brand-3308)', color: 'white',
                                fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                cursor: 'pointer', transition: 'opacity var(--g-transition-fast)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        >
                            <Plus style={{ width: '14px', height: '14px' }} />
                            Agregar
                        </button>
                    </div>

                    {/* Inline add form */}
                    {showAdd && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)',
                            padding: 'var(--g-space-3) var(--g-space-4)',
                            borderBottom: '1px solid var(--g-border-default)',
                            backgroundColor: 'hsla(217, 91%, 60%, 0.04)',
                        }}>
                            <input
                                type="text" placeholder="code *" value={newForm.code}
                                onChange={e => setNewForm(p => ({ ...p, code: e.target.value }))}
                                style={inputStyle('100px')}
                            />
                            <input
                                type="text" placeholder="label *" value={newForm.label}
                                onChange={e => setNewForm(p => ({ ...p, label: e.target.value }))}
                                style={inputStyle('120px')}
                            />
                            <input
                                type="text" placeholder="label_en" value={newForm.label_en}
                                onChange={e => setNewForm(p => ({ ...p, label_en: e.target.value }))}
                                style={inputStyle('110px')}
                            />
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="color" value={newForm.color || '#888888'}
                                    onChange={e => setNewForm(p => ({ ...p, color: e.target.value }))}
                                    style={{ width: '24px', height: '24px', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                                />
                                <input
                                    type="text" placeholder="color" value={newForm.color}
                                    onChange={e => setNewForm(p => ({ ...p, color: e.target.value }))}
                                    style={inputStyle('72px')}
                                />
                            </span>
                            <input
                                type="text" placeholder="icono" value={newForm.icon}
                                onChange={e => setNewForm(p => ({ ...p, icon: e.target.value }))}
                                style={inputStyle('60px')}
                            />

                            <div style={{ flex: 1 }} />

                            <button
                                onClick={handleCreate} disabled={saving || !newForm.code.trim() || !newForm.label.trim()}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', border: 'none',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--status-success)', color: 'white',
                                    fontSize: 'var(--g-text-caption)', fontWeight: 600,
                                    cursor: saving ? 'wait' : 'pointer',
                                    opacity: (!newForm.code.trim() || !newForm.label.trim()) ? 0.5 : 1,
                                }}
                            >
                                <Save style={{ width: '13px', height: '13px' }} />
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                                onClick={() => { setShowAdd(false); setNewForm({ ...EMPTY_FORM }); }}
                                style={{
                                    display: 'inline-flex', alignItems: 'center',
                                    padding: '4px 8px', border: 'none',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'transparent', color: 'var(--g-text-muted)',
                                    cursor: 'pointer', fontSize: 'var(--g-text-caption)',
                                }}
                            >
                                <X style={{ width: '14px', height: '14px' }} />
                            </button>
                        </div>
                    )}

                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 48px 120px 1fr 140px 90px 60px 80px 80px 56px',
                        alignItems: 'center',
                        padding: 'var(--g-space-2) var(--g-space-4)',
                        borderBottom: '1px solid var(--g-border-default)',
                        backgroundColor: 'var(--g-surface-subtle)',
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: 'var(--g-text-muted)',
                    }}>
                        {/* Select-all checkbox */}
                        <span style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                                onClick={toggleAllSelection}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: selectedIds.size === domainEnums.length && domainEnums.length > 0
                                        ? 'var(--g-brand-3308)'
                                        : 'var(--g-text-muted)',
                                    padding: '2px',
                                }}
                                aria-label="Seleccionar todos"
                            >
                                {selectedIds.size === domainEnums.length && domainEnums.length > 0
                                    ? <CheckSquare style={{ width: '15px', height: '15px' }} />
                                    : <Square style={{ width: '15px', height: '15px' }} />
                                }
                            </button>
                        </span>
                        <span>Orden</span>
                        <span>Code</span>
                        <span>Label</span>
                        <span>Label EN</span>
                        <span>Color</span>
                        <span>Icono</span>
                        <span>Orden #</span>
                        <span>Activo</span>
                        <span />
                    </div>

                    {/* Rows */}
                    {domainEnums.length === 0 ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: 'var(--g-space-10) var(--g-space-4)',
                        }}>
                            <Palette style={{ width: '28px', height: '28px', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                            <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                                {search.trim() ? 'Sin resultados para esta busqueda.' : 'No hay enumeraciones en este dominio.'}
                            </p>
                        </div>
                    ) : (
                        domainEnums.map((item, idx) => {
                            const isRowSelected = selectedEntryId === item.id;
                            return (
                            <div
                                key={item.id}
                                onClick={() => setSelectedEntryId(prev => prev === item.id ? null : item.id)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '32px 48px 120px 1fr 140px 90px 60px 80px 80px 56px',
                                    alignItems: 'center',
                                    padding: 'var(--g-space-2) var(--g-space-4)',
                                    borderBottom: '1px solid var(--g-border-subtle)',
                                    opacity: item.is_active ? 1 : 0.5,
                                    transition: 'opacity var(--g-transition-fast), background var(--g-transition-fast)',
                                    cursor: 'pointer',
                                    backgroundColor: isRowSelected ? 'hsla(217, 91%, 60%, 0.06)' : 'transparent',
                                    borderLeft: isRowSelected ? '3px solid var(--g-brand-3308)' : '3px solid transparent',
                                }}
                                onMouseEnter={e => {
                                    if (!isRowSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--g-surface-subtle)';
                                }}
                                onMouseLeave={e => {
                                    if (!isRowSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                            >
                                {/* Checkbox */}
                                <span style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        onClick={e => { e.stopPropagation(); toggleSelection(item.id); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: selectedIds.has(item.id) ? 'var(--g-brand-3308)' : 'var(--g-text-muted)',
                                            padding: '2px',
                                        }}
                                        aria-label={`Seleccionar ${item.code}`}
                                    >
                                        {selectedIds.has(item.id)
                                            ? <CheckSquare style={{ width: '15px', height: '15px' }} />
                                            : <Square style={{ width: '15px', height: '15px' }} />
                                        }
                                    </button>
                                </span>

                                {/* Up / Down arrows */}
                                <span style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                                    <button
                                        onClick={() => handleMove(item.id, 'up')}
                                        disabled={idx === 0}
                                        aria-label="Mover arriba"
                                        style={arrowBtnStyle(idx === 0)}
                                    >
                                        <ChevronUp style={{ width: '14px', height: '14px' }} />
                                    </button>
                                    <button
                                        onClick={() => handleMove(item.id, 'down')}
                                        disabled={idx === domainEnums.length - 1}
                                        aria-label="Mover abajo"
                                        style={arrowBtnStyle(idx === domainEnums.length - 1)}
                                    >
                                        <ChevronDown style={{ width: '14px', height: '14px' }} />
                                    </button>
                                </span>

                                {/* Code */}
                                <span style={{ fontFamily: 'monospace', fontSize: 'var(--g-text-caption)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                                    {item.code}
                                </span>

                                {/* Label — editable */}
                                <EditableCell
                                    value={item.label}
                                    onSave={v => patchField(item.id, 'label', v)}
                                    placeholder="label"
                                />

                                {/* Label EN — editable */}
                                <EditableCell
                                    value={item.label_en || ''}
                                    onSave={v => patchField(item.id, 'label_en', v || null)}
                                    placeholder="label_en"
                                />

                                {/* Color — editable */}
                                <EditableCell
                                    value={item.color || ''}
                                    onSave={v => patchField(item.id, 'color', v || null)}
                                    type="color"
                                    placeholder="color"
                                />

                                {/* Icon — editable */}
                                <EditableCell
                                    value={item.icon || ''}
                                    onSave={v => patchField(item.id, 'icon', v || null)}
                                    placeholder="icono"
                                />

                                {/* Sort order */}
                                <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)', textAlign: 'center' }}>
                                    {item.sort_order}
                                </span>

                                {/* Toggle active */}
                                <span style={{ display: 'flex', justifyContent: 'center' }}>
                                    <ToggleSwitch
                                        checked={item.is_active}
                                        onChange={val => handleToggle(item.id, val)}
                                        label={`Toggle ${item.code}`}
                                    />
                                </span>

                                {/* Delete (soft) */}
                                <span style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        aria-label={`Desactivar ${item.code}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--g-text-muted)', padding: '4px',
                                            borderRadius: 'var(--g-radius-sm)',
                                            transition: 'color var(--g-transition-fast)',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--status-error)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--g-text-muted)'; }}
                                    >
                                        <Trash2 style={{ width: '14px', height: '14px' }} />
                                    </button>
                                </span>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
function inputStyle(width: string): React.CSSProperties {
    return {
        width,
        padding: '4px 8px',
        fontSize: 'var(--g-text-caption)',
        border: '1px solid var(--g-border-default)',
        borderRadius: 'var(--g-radius-sm)',
        backgroundColor: 'var(--g-surface-card)',
        color: 'var(--g-text-primary)',
        outline: 'none',
    };
}

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: '0px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--g-border-default)' : 'var(--g-text-muted)',
        opacity: disabled ? 0.4 : 1,
        transition: 'color var(--g-transition-fast)',
    };
}
