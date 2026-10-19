'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderKanban, ChevronLeft, ChevronRight, ChevronDown,
    Scale, Bot, Wrench, Building2, Shield, BookOpen, Settings,
    FileBarChart, Database, MessageCircle, FileText, Eye,
    Handshake, UserCheck, Activity, ListChecks, ShieldCheck,
    Swords, Workflow, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectNavBadges } from '@/hooks/use-project-nav-badges';
import { useProjectAreas } from '@/hooks/use-project-areas';
import ProjectSelector from './project-selector';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavItem {
    label: string;
    icon: typeof LayoutDashboard;
    path: string;
}

interface NavSection {
    header: string;
    badge?: string;
    items: NavItem[];
}

interface NavGroup {
    id: string;
    header: string;
    icon: typeof LayoutDashboard;
    items: NavItem[];
    separator?: { label: string; afterIndex: number };
}

/* ------------------------------------------------------------------ */
/*  Static sections (always visible)                                   */
/* ------------------------------------------------------------------ */

const NAV_SECTION_NAVEGACION: NavSection = {
    header: 'Navegacion',
    items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Proyectos DD', icon: FolderKanban, path: '/projects' },
        { label: 'Informes', icon: FileBarChart, path: '/reports' },
    ],
};

const NAV_SECTION_HERRAMIENTAS: NavSection = {
    header: 'Herramientas',
    items: [
        { label: 'Hub Herramientas', icon: Wrench, path: '/tools' },
        { label: 'Societario', icon: Building2, path: '/tools/societario' },
        { label: 'Radar Marcas', icon: Shield, path: '/tools/marcas' },
    ],
};

const NAV_SECTION_CONFIGURACION: NavSection = {
    header: 'Configuracion',
    items: [
        { label: 'Estado del Sistema', icon: Settings, path: '/configuracion' },
        { label: 'Catalogo Skills', icon: BookOpen, path: '/skills' },
        { label: 'Gestion Herramientas', icon: Wrench, path: '/configuracion/herramientas' },
        { label: 'Gestion Skills', icon: BookOpen, path: '/configuracion/skills' },
        { label: 'Plantillas', icon: FileText, path: '/configuracion/templates' },
        { label: 'Findings ABM', icon: ListChecks, path: '/configuracion/findings' },
        { label: 'Dominios', icon: ListChecks, path: '/configuracion/dominios' },
        { label: 'Seguridad', icon: ShieldCheck, path: '/configuracion/seguridad' },
        { label: 'Observabilidad', icon: Activity, path: '/observability' },
    ],
};

/* ------------------------------------------------------------------ */
/*  Project-contextual section builder                                 */
/* ------------------------------------------------------------------ */

const PROJECT_ID_RE = /^\/projects\/([^/]+)/;

function buildProjectGroups(projectId: string): NavGroup[] {
    const base = `/projects/${projectId}`;
    return [
        {
            id: 'informacion',
            header: 'Informacion',
            icon: Database,
            items: [
                { label: 'Vista General', icon: Eye, path: base },
                { label: 'Data Room', icon: Database, path: `${base}/vdr` },
                { label: 'Q&A', icon: MessageCircle, path: `${base}/qa` },
            ],
        },
        {
            id: 'analisis',
            header: 'Analisis',
            icon: Target,
            items: [
                { label: 'Kanban', icon: FolderKanban, path: `${base}/kanban` },
                { label: 'Workflows', icon: Workflow, path: `${base}/workflows` },
                { label: 'Findings', icon: ListChecks, path: `${base}/findings` },
                { label: 'HITL Review', icon: UserCheck, path: `${base}/hitl` },
                { label: 'Scoring', icon: Target, path: `${base}/scoring` },
            ],
            separator: { label: 'Areas activas', afterIndex: 4 },
        },
        {
            id: 'decision',
            header: 'Decision',
            icon: Swords,
            items: [
                { label: 'War Room', icon: Swords, path: `${base}/war-room` },
                { label: 'Negociacion', icon: Handshake, path: `${base}/negotiation` },
                { label: 'Actividad', icon: Activity, path: `${base}/activity` },
            ],
        },
    ];
}

/* ------------------------------------------------------------------ */
/*  Hook: build resolved nav (sections + project groups)               */
/* ------------------------------------------------------------------ */

interface ResolvedNav {
    sections: NavSection[];
    projectGroups: NavGroup[] | null;
    projectId: string | null;
}

function useResolvedNav(pathname: string): ResolvedNav {
    return useMemo(() => {
        const match = PROJECT_ID_RE.exec(pathname);
        const projectId = match ? match[1] : null;
        const sections: NavSection[] = [NAV_SECTION_NAVEGACION];
        sections.push(NAV_SECTION_HERRAMIENTAS);
        sections.push(NAV_SECTION_CONFIGURACION);
        const projectGroups = projectId ? buildProjectGroups(projectId) : null;
        return { sections, projectGroups, projectId };
    }, [pathname]);
}

/* ------------------------------------------------------------------ */
/*  Hook: collapsible group state with localStorage persistence        */
/* ------------------------------------------------------------------ */

function useGroupCollapse(
    projectId: string | null,
    projectGroups: NavGroup[] | null,
    pathname: string,
) {
    const storageKey = projectId ? `dd-nav-collapsed-${projectId}` : null;

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Load from localStorage on mount / when projectId changes
    useEffect(() => {
        if (!storageKey) return;
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                setCollapsedGroups(JSON.parse(stored));
            } else {
                setCollapsedGroups({});
            }
        } catch {
            setCollapsedGroups({});
        }
    }, [storageKey]);

    // Auto-expand the group containing the active route
    useEffect(() => {
        if (!projectGroups) return;
        for (const group of projectGroups) {
            const hasActive = group.items.some((item) => {
                if (item.path === '/') return pathname === '/';
                const isProjectOverview =
                    PROJECT_ID_RE.test(item.path) &&
                    item.path.replace(PROJECT_ID_RE, '').replace(/^\//, '') === '';
                if (isProjectOverview) return pathname === item.path;
                return pathname === item.path || pathname.startsWith(item.path + '/');
            });
            if (hasActive && collapsedGroups[group.id]) {
                setCollapsedGroups((prev) => {
                    const next = { ...prev, [group.id]: false };
                    if (storageKey) {
                        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
                    }
                    return next;
                });
                break;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, projectGroups, storageKey]);

    const toggle = (groupId: string) => {
        setCollapsedGroups((prev) => {
            const next = { ...prev, [groupId]: !prev[groupId] };
            if (storageKey) {
                try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
            }
            return next;
        });
    };

    return { collapsedGroups, toggle };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isItemActive(itemPath: string, pathname: string): boolean {
    if (itemPath === '/') return pathname === '/';
    const isProjectOverview =
        PROJECT_ID_RE.test(itemPath) &&
        itemPath.replace(PROJECT_ID_RE, '').replace(/^\//, '') === '';
    if (isProjectOverview) return pathname === itemPath;
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
}

function groupHasActiveItem(group: NavGroup, pathname: string): boolean {
    return group.items.some((item) => isItemActive(item.path, pathname));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Sidebar() {
    const baseId = useId();
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { sections, projectGroups, projectId } = useResolvedNav(pathname);
    const { collapsedGroups, toggle } = useGroupCollapse(projectId, projectGroups, pathname);
    const badges = useProjectNavBadges(projectId);
    const activeAreas = useProjectAreas(projectId);

    // Merge dynamic area items into the Analisis group
    const enrichedGroups = useMemo(() => {
        if (!projectGroups || activeAreas.length === 0) return projectGroups;
        return projectGroups.map((group) => {
            if (group.id !== 'analisis') return group;
            const areaItems: NavItem[] = activeAreas.map((area) => ({
                label: area.name,
                icon: FileText,
                path: `/projects/${projectId}/areas/${area.code}`,
            }));
            return { ...group, items: [...group.items, ...areaItems] };
        });
    }, [projectGroups, activeAreas, projectId]);

    /* Shared renderer for a single nav item */
    const renderNavItem = (item: NavItem) => {
        const isActive = isItemActive(item.path, pathname);
        return (
            <Link
                key={item.path}
                href={item.path}
                className={cn(
                    'flex items-center gap-3 transition-all',
                    isActive ? 'font-medium' : 'hover:opacity-100',
                )}
                style={{
                    borderRadius: 'var(--g-radius-md)',
                    color: 'var(--g-text-inverse)',
                    backgroundColor: isActive ? 'var(--g-sidebar-active)' : 'transparent',
                    opacity: isActive ? 1 : 0.75,
                    fontSize: 'var(--g-text-body)',
                    fontWeight: isActive ? 600 : 500,
                    padding: '8px 12px',
                    letterSpacing: '0.01em',
                }}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
            >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
            </Link>
        );
    };

    /* Shared renderer for a flat section */
    const renderSection = (section: NavSection, sIdx: number) => (
        <div key={section.header} style={{ marginTop: sIdx > 0 ? '24px' : undefined }}>
            {!collapsed ? (
                <div
                    className="animate-fade-in"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        marginBottom: '8px',
                    }}
                >
                    <p
                        style={{
                            fontSize: 'var(--g-text-caption)',
                            fontWeight: 'var(--g-font-weight-bold)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--g-sidebar-text-muted)',
                            lineHeight: '1',
                            margin: 0,
                        }}
                    >
                        {section.header}
                    </p>
                    {section.badge && (
                        <span
                            style={{
                                fontSize: '0.5625rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--g-brand-3308)',
                                backgroundColor: 'var(--g-brand-bright)',
                                borderRadius: 'var(--g-radius-full)',
                                padding: '2px 8px',
                                lineHeight: '1.4',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {section.badge}
                        </span>
                    )}
                </div>
            ) : sIdx > 0 ? (
                <hr
                    className="mx-3 mb-3"
                    style={{ borderColor: 'var(--g-sidebar-border)' }}
                />
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {section.items.map(renderNavItem)}
            </div>
        </div>
    );

    /* Render a collapsible project group */
    const renderGroup = (group: NavGroup) => {
        const isGroupCollapsed = !!collapsedGroups[group.id];
        const hasActive = groupHasActiveItem(group, pathname);
        const GroupIcon = group.icon;

        return (
            <div key={group.id} style={{ marginTop: '4px' }}>
                {/* Group header button */}
                <button
                    onClick={() => toggle(group.id)}
                    className="w-full flex items-center gap-2 transition-all"
                    style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--g-radius-md)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderLeft: hasActive ? '2px solid var(--g-brand-bright)' : '2px solid transparent',
                    }}
                    aria-expanded={!isGroupCollapsed}
                    aria-controls={(!isGroupCollapsed && !collapsed) ? `${baseId}-${group.id}-panel` : undefined}
                    aria-label={`${group.header} grupo`}
                >
                    <GroupIcon
                        className="h-[16px] w-[16px] shrink-0"
                        style={{ color: hasActive ? 'var(--g-brand-bright)' : 'var(--g-sidebar-icon-muted)' }}
                    />
                    {!collapsed && (
                        <>
                            <span
                                style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: hasActive ? 'var(--g-brand-bright)' : 'var(--g-sidebar-icon-muted)',
                                    lineHeight: '1',
                                    flex: 1,
                                    textAlign: 'left',
                                }}
                            >
                                {group.header}
                            </span>
                            {/* Badge */}
                            {badges[group.id as keyof typeof badges] && (
                                <span
                                    style={{
                                        fontSize: '0.5625rem',
                                        fontWeight: 600,
                                        color: 'var(--g-brand-3308)',
                                        backgroundColor: 'var(--g-brand-bright)',
                                        borderRadius: 'var(--g-radius-full)',
                                        padding: '1px 6px',
                                        lineHeight: '1.4',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {badges[group.id as keyof typeof badges]}
                                </span>
                            )}
                            <ChevronDown
                                className="h-3.5 w-3.5 shrink-0 transition-transform"
                                style={{
                                    color: 'var(--g-sidebar-icon-faint)',
                                    transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                }}
                            />
                        </>
                    )}
                </button>

                {/* Group items */}
                {!isGroupCollapsed && !collapsed && (
                    <div
                        id={`${baseId}-${group.id}-panel`}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            marginTop: '2px',
                            paddingLeft: '4px',
                        }}
                    >
                        {group.items.map((item, itemIdx) => (
                            <div key={item.path}>
                                {renderNavItem(item)}
                                {/* Separator after specified index */}
                                {group.separator && itemIdx === group.separator.afterIndex && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 12px 2px',
                                        }}
                                    >
                                        <hr
                                            style={{
                                                flex: 1,
                                                border: 'none',
                                                borderTop: '1px solid var(--g-sidebar-divider)',
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: '0.5625rem',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                color: 'var(--g-sidebar-text-ghost)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {group.separator.label}
                                        </span>
                                        <hr
                                            style={{
                                                flex: 1,
                                                border: 'none',
                                                borderTop: '1px solid var(--g-sidebar-divider)',
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Collapsed sidebar: show only group icon (already rendered in button) */}
            </div>
        );
    };

    return (
        <aside
            className="fixed left-0 top-0 h-screen flex flex-col z-40"
            style={{
                width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
                backgroundColor: 'var(--g-brand-3308)',
                transition: 'width var(--g-transition-smooth)',
            }}
        >
            {/* Logo */}
            <div
                className="flex items-center gap-3 px-5 border-b shrink-0"
                style={{
                    borderColor: 'var(--g-sidebar-border)',
                    height: 'var(--g-header-height)',
                }}
            >
                <Scale className="h-6 w-6 shrink-0" style={{ color: 'var(--g-brand-bright)' }} />
                {!collapsed && (
                    <div className="animate-fade-in overflow-hidden">
                        <span
                            className="font-bold tracking-wide block"
                            style={{
                                color: 'var(--g-text-inverse)',
                                fontSize: 'var(--g-text-body-lg)',
                                lineHeight: 'var(--g-leading-tight)',
                            }}
                        >
                            DD Legal
                        </span>
                        <span
                            className="block"
                            style={{
                                color: 'var(--g-sec-300)',
                                fontSize: 'var(--g-text-caption)',
                            }}
                        >
                            PMO &middot; Due Diligence
                        </span>
                    </div>
                )}
            </div>

            {/* Project Selector */}
            <ProjectSelector collapsed={collapsed} />

            {/* Navigation */}
            <nav className="flex-1 py-5 px-3 overflow-y-auto">
                {/* Navegacion section (always first, index 0) */}
                {renderSection(sections[0], 0)}

                {/* Project groups (between Navegacion and Herramientas) */}
                {enrichedGroups && (
                    <div style={{ marginTop: '20px' }}>
                        {!collapsed && (
                            <div
                                className="animate-fade-in"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '0 12px',
                                    marginBottom: '6px',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'var(--g-sidebar-text-muted)',
                                        lineHeight: '1',
                                        margin: 0,
                                    }}
                                >
                                    Proyecto
                                </p>
                                <span
                                    style={{
                                        fontSize: '0.5625rem',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        color: 'var(--g-brand-3308)',
                                        backgroundColor: 'var(--g-brand-bright)',
                                        borderRadius: 'var(--g-radius-full)',
                                        padding: '2px 8px',
                                        lineHeight: '1.4',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Proyecto activo
                                </span>
                            </div>
                        )}
                        {collapsed && (
                            <hr
                                className="mx-3 mb-3"
                                style={{ borderColor: 'var(--g-sidebar-border)' }}
                            />
                        )}
                        {enrichedGroups.map(renderGroup)}
                    </div>
                )}

                {/* Herramientas and Configuracion (indices 1 and 2, but offset for margin) */}
                {sections.slice(1).map((section, idx) => {
                    /* sIdx offset: Navegacion=0, project groups take a slot, so these start visually after */
                    const sIdx = enrichedGroups ? idx + 2 : idx + 1;
                    return renderSection(section, sIdx);
                })}
            </nav>

            {/* AI Assist */}
            <div className="px-3 pb-3">
                <button
                    className="w-full flex items-center gap-3 px-3 py-2 transition-all hover:opacity-90"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-brand-bright)',
                        color: 'var(--g-text-inverse)',
                        fontSize: 'var(--g-text-body)',
                    }}
                    title="Harvey AI"
                    aria-label="Abrir Harvey AI"
                >
                    <Bot className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="font-medium">Harvey AI</span>}
                </button>
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-center h-10 border-t transition-colors shrink-0"
                style={{
                    color: 'var(--g-text-inverse)',
                    borderColor: 'var(--g-sidebar-border)',
                    opacity: 0.5,
                }}
                aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
        </aside>
    );
}
