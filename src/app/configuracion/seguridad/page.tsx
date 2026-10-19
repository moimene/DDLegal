'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Shield, Users, ScrollText, KeyRound,
    Search, RefreshCw, ChevronRight, Lock,
    Filter,
} from 'lucide-react';
import { ROLE_CONFIG, getCachedDateTimeFormat } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface UserRoleRow {
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    area_code: string | null;
    is_active: boolean;
    granted_by: string | null;
    granted_at: string;
    expires_at: string | null;
    dd_projects: { name: string } | null;
}

interface AuditEntry {
    id: string;
    project_id: string | null;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    dd_projects: { name: string } | null;
}

type TabKey = 'usuarios' | 'auditoria' | 'sso';

// ============================================================
// Action color mapping
// ============================================================

const ACTION_COLOR_MAP: Record<string, { bg: string; fg: string }> = {
    create: { bg: 'hsla(142, 71%, 45%, 0.12)', fg: 'hsl(142, 71%, 35%)' },
    insert: { bg: 'hsla(142, 71%, 45%, 0.12)', fg: 'hsl(142, 71%, 35%)' },
    update: { bg: 'hsla(217, 91%, 60%, 0.12)', fg: 'hsl(217, 91%, 50%)' },
    delete: { bg: 'hsla(0, 72%, 51%, 0.12)', fg: 'hsl(0, 72%, 45%)' },
    remove: { bg: 'hsla(0, 72%, 51%, 0.12)', fg: 'hsl(0, 72%, 45%)' },
    login: { bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    logout: { bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    view: { bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
};

function getActionColor(action: string): { bg: string; fg: string } {
    const key = action.toLowerCase();
    for (const [prefix, colors] of Object.entries(ACTION_COLOR_MAP)) {
        if (key.startsWith(prefix) || key.includes(prefix)) {
            return colors;
        }
    }
    return { bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' };
}

// ============================================================
// Helpers
// ============================================================

function formatTimestamp(dateStr: string): string {
    const d = new Date(dateStr);
    return getCachedDateTimeFormat({
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(d);
}

function formatDateShort(dateStr: string): string {
    return getCachedDateTimeFormat({
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateStr));
}

function RoleBadge({ role }: { role: string }) {
    const cfg = ROLE_CONFIG[role];
    if (!cfg) {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, borderRadius: 'var(--g-radius-full)',
                backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)',
            }}>
                {role}
            </span>
        );
    }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
            fontSize: '10px', fontWeight: 600, borderRadius: 'var(--g-radius-full)',
            backgroundColor: `${cfg.color}18`, color: cfg.color,
        }}>
            {cfg.label}
        </span>
    );
}

function StatusDot({ active }: { active: boolean }) {
    return (
        <span style={{
            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: active ? 'var(--status-success)' : 'var(--g-text-muted)',
            flexShrink: 0,
        }} />
    );
}

// ============================================================
// Main Page
// ============================================================

export default function SeguridadPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('usuarios');

    // Users state
    const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [userSearch, setUserSearch] = useState('');
    const [userFilterRole, setUserFilterRole] = useState('all');
    const [userFilterProject, setUserFilterProject] = useState('all');

    // Audit state
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(true);
    const [auditFilterAction, setAuditFilterAction] = useState('all');
    const [auditFilterEntity, setAuditFilterEntity] = useState('all');
    const [auditFilterProject, setAuditFilterProject] = useState('all');

    // --------------------------------------------------------
    // Data loading
    // --------------------------------------------------------

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch('/api/configuracion/seguridad?type=users');
            const json = await res.json();
            if (json.success) {
                setUserRoles(json.users);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const loadAudit = useCallback(async () => {
        setLoadingAudit(true);
        try {
            const params = new URLSearchParams({ type: 'audit', limit: '200' });
            if (auditFilterProject !== 'all') {
                params.set('project_id', auditFilterProject);
            }
            const res = await fetch(`/api/configuracion/seguridad?${params}`);
            const json = await res.json();
            if (json.success) {
                setAuditEntries(json.audit);
            }
        } catch (err) {
            console.error('Failed to load audit:', err);
        } finally {
            setLoadingAudit(false);
        }
    }, [auditFilterProject]);

    // Initial load
    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { loadAudit(); }, [loadAudit]);

    // Auto-refresh audit every 30s
    useEffect(() => {
        if (activeTab !== 'auditoria') return;
        const interval = setInterval(loadAudit, 30_000);
        return () => clearInterval(interval);
    }, [activeTab, loadAudit]);

    // --------------------------------------------------------
    // Derived data — Users
    // --------------------------------------------------------

    const uniqueProjects = useMemo(() => {
        const map = new Map<string, string>();
        userRoles.forEach(r => {
            if (r.dd_projects?.name) {
                map.set(r.project_id, r.dd_projects.name);
            }
        });
        return Array.from(map.entries()); // [id, name][]
    }, [userRoles]);

    const filteredUsers = useMemo(() => {
        let result = userRoles;
        if (userSearch.trim()) {
            const q = userSearch.toLowerCase();
            result = result.filter(r =>
                r.user_id.toLowerCase().includes(q) ||
                (r.dd_projects?.name || '').toLowerCase().includes(q) ||
                r.role.toLowerCase().includes(q)
            );
        }
        if (userFilterRole !== 'all') {
            result = result.filter(r => r.role === userFilterRole);
        }
        if (userFilterProject !== 'all') {
            result = result.filter(r => r.project_id === userFilterProject);
        }
        return result;
    }, [userRoles, userSearch, userFilterRole, userFilterProject]);

    const userStats = useMemo(() => {
        const uniqueUsers = new Set(userRoles.map(r => r.user_id));
        const byRole: Record<string, number> = {};
        userRoles.forEach(r => {
            byRole[r.role] = (byRole[r.role] || 0) + 1;
        });
        return { totalUsers: uniqueUsers.size, totalAssignments: userRoles.length, byRole };
    }, [userRoles]);

    // --------------------------------------------------------
    // Derived data — Audit
    // --------------------------------------------------------

    const auditProjects = useMemo(() => {
        const map = new Map<string, string>();
        auditEntries.forEach(e => {
            if (e.project_id && e.dd_projects?.name) {
                map.set(e.project_id, e.dd_projects.name);
            }
        });
        return Array.from(map.entries());
    }, [auditEntries]);

    const uniqueActions = useMemo(() => {
        const set = new Set(auditEntries.map(e => e.action));
        return Array.from(set).sort();
    }, [auditEntries]);

    const uniqueEntityTypes = useMemo(() => {
        const set = new Set(auditEntries.map(e => e.entity_type));
        return Array.from(set).sort();
    }, [auditEntries]);

    const filteredAudit = useMemo(() => {
        let result = auditEntries;
        if (auditFilterAction !== 'all') {
            result = result.filter(e => e.action === auditFilterAction);
        }
        if (auditFilterEntity !== 'all') {
            result = result.filter(e => e.entity_type === auditFilterEntity);
        }
        return result;
    }, [auditEntries, auditFilterAction, auditFilterEntity]);

    // --------------------------------------------------------
    // Tab config
    // --------------------------------------------------------

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'usuarios', label: 'Usuarios', icon: <Users style={{ width: '15px', height: '15px' }} /> },
        { key: 'auditoria', label: 'Auditoria', icon: <ScrollText style={{ width: '15px', height: '15px' }} /> },
        { key: 'sso', label: 'SSO', icon: <KeyRound style={{ width: '15px', height: '15px' }} /> },
    ];

    // --------------------------------------------------------
    // Shared styles
    // --------------------------------------------------------

    const selectStyle: React.CSSProperties = {
        padding: '6px 12px',
        border: '1px solid var(--g-border-default)',
        borderRadius: 'var(--g-radius-md)',
        backgroundColor: 'var(--g-surface-card)',
        color: 'var(--g-text-primary)',
        fontSize: 'var(--g-text-sm)',
        outline: 'none',
    };

    const thStyle: React.CSSProperties = {
        padding: '8px 12px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--g-text-muted)',
        textAlign: 'left',
        borderBottom: '1px solid var(--g-border-default)',
        whiteSpace: 'nowrap',
    };

    const tdStyle: React.CSSProperties = {
        padding: '10px 12px',
        fontSize: 'var(--g-text-sm)',
        color: 'var(--g-text-primary)',
        borderBottom: '1px solid var(--g-border-subtle)',
        whiteSpace: 'nowrap',
    };

    // --------------------------------------------------------
    // Loading skeleton
    // --------------------------------------------------------

    if (loadingUsers && loadingAudit) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--g-radius-lg)' }} />
                    ))}
                </div>
                {[1, 2, 3].map(i => (
                    <div key={`sk-${i}`} className="skeleton" style={{ height: '60px', borderRadius: 'var(--g-radius-lg)' }} />
                ))}
            </div>
        );
    }

    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                <span>Configuracion</span>
                <ChevronRight style={{ width: '12px', height: '12px' }} />
                <span style={{ color: 'var(--g-text-primary)', fontWeight: 600 }}>Seguridad</span>
            </div>

            {/* Header */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBottom: '4px' }}>
                    <Shield style={{ width: '24px', height: '24px', color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                    <h1 style={{ fontSize: 'var(--g-text-h1)', fontWeight: 700, color: 'var(--g-text-primary)', margin: 0 }}>
                        Seguridad y Accesos
                    </h1>
                </div>
                <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>
                    Gestion de usuarios, roles por proyecto y registro de auditoria
                </p>
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex', gap: '2px', borderBottom: '1px solid var(--g-border-default)',
            }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '10px 16px',
                                fontSize: 'var(--g-text-sm)', fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                backgroundColor: 'transparent',
                                border: 'none', borderBottom: isActive ? '2px solid var(--g-brand-3308)' : '2px solid transparent',
                                cursor: 'pointer',
                                marginBottom: '-1px',
                                transition: 'color var(--g-transition-fast), border-color var(--g-transition-fast)',
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ============================== */}
            {/* TAB 1 — Usuarios               */}
            {/* ============================== */}
            {activeTab === 'usuarios' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                    {/* KPI strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${2 + Object.keys(userStats.byRole).length}, 1fr)`, gap: 'var(--g-space-3)' }}>
                        <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                            <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Usuarios</span>
                            <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: 'var(--g-text-primary)' }}>{userStats.totalUsers}</span>
                        </div>
                        <div className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                            <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>Asignaciones</span>
                            <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: 'var(--g-text-primary)' }}>{userStats.totalAssignments}</span>
                        </div>
                        {Object.entries(userStats.byRole).map(([role, count]) => {
                            const cfg = ROLE_CONFIG[role];
                            return (
                                <div key={role} className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
                                    <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)', fontWeight: 500 }}>
                                        {cfg?.labelEs || role}
                                    </span>
                                    <span style={{ fontSize: 'var(--g-text-h2)', fontWeight: 700, color: cfg?.color || 'var(--g-text-primary)' }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 'var(--g-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
                            <Search style={{ position: 'absolute', left: 'var(--g-space-3)', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--g-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
                            <input
                                type="text"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                placeholder="Buscar usuario..."
                                aria-label="Buscar usuarios"
                                style={{
                                    width: '100%',
                                    padding: 'var(--g-space-2) var(--g-space-3) var(--g-space-2) var(--g-space-9)',
                                    border: '1px solid var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                    fontSize: 'var(--g-text-sm)',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <select value={userFilterRole} onChange={e => setUserFilterRole(e.target.value)} aria-label="Filtrar por rol" style={selectStyle}>
                            <option value="all">Todos los roles</option>
                            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.labelEs}</option>
                            ))}
                        </select>
                        <select value={userFilterProject} onChange={e => setUserFilterProject(e.target.value)} aria-label="Filtrar por proyecto" style={selectStyle}>
                            <option value="all">Todos los proyectos</option>
                            {uniqueProjects.map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            {filteredUsers.length} resultado{filteredUsers.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Users table */}
                    {loadingUsers ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--g-radius-md)' }} />
                            ))}
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="g-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--g-space-12) var(--g-space-4)' }}>
                            <Users style={{ width: '32px', height: '32px', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                            <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>No se encontraron asignaciones de usuario.</p>
                        </div>
                    ) : (
                        <div className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Usuario</th>
                                            <th style={thStyle}>Rol</th>
                                            <th style={thStyle}>Proyecto</th>
                                            <th style={thStyle}>Area</th>
                                            <th style={thStyle}>Estado</th>
                                            <th style={thStyle}>Asignado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(row => (
                                            <tr key={row.id} style={{ transition: 'background-color var(--g-transition-fast)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--g-surface-subtle)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                            >
                                                <td style={tdStyle}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--g-text-caption)' }}>
                                                        {row.user_id.length > 20 ? `${row.user_id.slice(0, 8)}...${row.user_id.slice(-6)}` : row.user_id}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <RoleBadge role={row.role} />
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-primary)' }}>
                                                        {row.dd_projects?.name || row.project_id.slice(0, 8)}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    {row.area_code ? (
                                                        <span style={{
                                                            display: 'inline-flex', padding: '1px 6px', fontSize: '10px',
                                                            fontWeight: 600, borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-secondary)',
                                                        }}>
                                                            {row.area_code}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-caption)' }}>--</span>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <StatusDot active={row.is_active} />
                                                        <span style={{ fontSize: 'var(--g-text-caption)', color: row.is_active ? 'var(--status-success)' : 'var(--g-text-muted)' }}>
                                                            {row.is_active ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, color: 'var(--g-text-secondary)' }}>
                                                    {formatDateShort(row.granted_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ============================== */}
            {/* TAB 2 — Auditoria              */}
            {/* ============================== */}
            {activeTab === 'auditoria' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
                    {/* Filters row */}
                    <div style={{ display: 'flex', gap: 'var(--g-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Filter style={{ width: '16px', height: '16px', color: 'var(--g-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                        <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)} aria-label="Filtrar por accion" style={selectStyle}>
                            <option value="all">Todas las acciones</option>
                            {uniqueActions.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                        <select value={auditFilterEntity} onChange={e => setAuditFilterEntity(e.target.value)} aria-label="Filtrar por tipo de entidad" style={selectStyle}>
                            <option value="all">Todos los tipos</option>
                            {uniqueEntityTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <select value={auditFilterProject} onChange={e => setAuditFilterProject(e.target.value)} aria-label="Filtrar por proyecto" style={selectStyle}>
                            <option value="all">Todos los proyectos</option>
                            {auditProjects.map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                        <div style={{ flex: 1 }} />
                        <button
                            onClick={loadAudit}
                            aria-label="Refrescar auditoria"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', fontSize: 'var(--g-text-sm)',
                                border: '1px solid var(--g-border-default)', borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)', color: 'var(--g-text-primary)',
                                cursor: 'pointer',
                            }}
                        >
                            <RefreshCw style={{ width: '14px', height: '14px' }} />
                            Refrescar
                        </button>
                        <span style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                            {filteredAudit.length} entrada{filteredAudit.length !== 1 ? 's' : ''} &middot; auto-refresh 30s
                        </span>
                    </div>

                    {/* Audit table */}
                    {loadingAudit ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--g-radius-md)' }} />
                            ))}
                        </div>
                    ) : filteredAudit.length === 0 ? (
                        <div className="g-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--g-space-12) var(--g-space-4)' }}>
                            <ScrollText style={{ width: '32px', height: '32px', color: 'var(--g-text-muted)', marginBottom: 'var(--g-space-2)' }} aria-hidden="true" />
                            <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0 }}>No hay entradas de auditoria.</p>
                        </div>
                    ) : (
                        <div className="g-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Fecha / Hora</th>
                                            <th style={thStyle}>Usuario</th>
                                            <th style={thStyle}>Accion</th>
                                            <th style={thStyle}>Tipo Entidad</th>
                                            <th style={thStyle}>ID Entidad</th>
                                            <th style={thStyle}>Proyecto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAudit.map(entry => {
                                            const actionColor = getActionColor(entry.action);
                                            return (
                                                <tr key={entry.id}
                                                    style={{ transition: 'background-color var(--g-transition-fast)' }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--g-surface-subtle)'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                                >
                                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>
                                                        {formatTimestamp(entry.created_at)}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{ fontFamily: 'monospace', fontSize: 'var(--g-text-caption)' }}>
                                                            {entry.user_id
                                                                ? entry.user_id.length > 20
                                                                    ? `${entry.user_id.slice(0, 8)}...${entry.user_id.slice(-6)}`
                                                                    : entry.user_id
                                                                : '--'}
                                                        </span>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center',
                                                            padding: '2px 8px', fontSize: '10px', fontWeight: 600,
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: actionColor.bg, color: actionColor.fg,
                                                        }}>
                                                            {entry.action}
                                                        </span>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{
                                                            display: 'inline-flex', padding: '1px 6px',
                                                            fontSize: '10px', fontWeight: 500,
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-secondary)',
                                                        }}>
                                                            {entry.entity_type}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)' }}>
                                                        {entry.entity_id
                                                            ? entry.entity_id.length > 16
                                                                ? `${entry.entity_id.slice(0, 8)}...`
                                                                : entry.entity_id
                                                            : '--'}
                                                    </td>
                                                    <td style={{ ...tdStyle, color: 'var(--g-text-secondary)' }}>
                                                        {entry.dd_projects?.name || (entry.project_id ? entry.project_id.slice(0, 8) : '--')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ============================== */}
            {/* TAB 3 — SSO                    */}
            {/* ============================== */}
            {activeTab === 'sso' && (
                <div className="g-card" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 'var(--g-space-16) var(--g-space-6)',
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: 'var(--g-radius-xl)',
                        backgroundColor: 'var(--g-surface-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 'var(--g-space-5)',
                    }}>
                        <Lock style={{ width: '36px', height: '36px', color: 'var(--g-text-muted)' }} aria-hidden="true" />
                    </div>
                    <h2 style={{ fontSize: 'var(--g-text-h3)', fontWeight: 700, color: 'var(--g-text-primary)', margin: '0 0 8px 0' }}>
                        Configuracion SSO proximamente
                    </h2>
                    <p style={{ fontSize: 'var(--g-text-sm)', color: 'var(--g-text-secondary)', margin: 0, maxWidth: '440px', lineHeight: 1.6 }}>
                        La integracion con proveedores de identidad (SAML, OIDC) estara disponible en una futura version. Esto permitira inicio de sesion unico y gestion centralizada de credenciales.
                    </p>
                    <div style={{
                        display: 'flex', gap: 'var(--g-space-4)', marginTop: 'var(--g-space-6)',
                        fontSize: 'var(--g-text-caption)', color: 'var(--g-text-muted)',
                    }}>
                        <span>SAML 2.0</span>
                        <span>&middot;</span>
                        <span>OpenID Connect</span>
                        <span>&middot;</span>
                        <span>Azure AD</span>
                        <span>&middot;</span>
                        <span>Okta</span>
                    </div>
                </div>
            )}
        </div>
    );
}
