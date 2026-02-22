'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderKanban, ChevronLeft, ChevronRight,
    Scale, Bot, Wrench, Building2, Shield, BookOpen, Settings,
    FileBarChart, Database, MessageCircle, FileText, Eye, Gauge,
    Handshake, UserCheck, Activity, ListChecks, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
        { label: 'Dominios', icon: ListChecks, path: '/configuracion/dominios' },
        { label: 'Seguridad', icon: ShieldCheck, path: '/configuracion/seguridad' },
        { label: 'Observabilidad', icon: Activity, path: '/observability' },
    ],
};

/* ------------------------------------------------------------------ */
/*  Project-contextual section builder                                 */
/* ------------------------------------------------------------------ */

const PROJECT_ID_RE = /^\/projects\/([^/]+)/;

function buildProjectSection(projectId: string): NavSection {
    const base = `/projects/${projectId}`;
    return {
        header: 'Proyecto',
        badge: 'Proyecto activo',
        items: [
            { label: 'Vista General', icon: Eye, path: base },
            { label: 'Data Room', icon: Database, path: `${base}/vdr` },
            { label: 'Q&A', icon: MessageCircle, path: `${base}/qa` },
            { label: 'Deal Cockpit', icon: Gauge, path: `${base}/cockpit` },
            { label: 'Negociacion', icon: Handshake, path: `${base}/negotiation` },
            { label: 'Kanban', icon: FolderKanban, path: `${base}/kanban` },
            { label: 'HITL Review', icon: UserCheck, path: `${base}/hitl` },
            { label: 'Actividad', icon: Activity, path: `${base}/activity` },
        ],
    };
}

/* ------------------------------------------------------------------ */
/*  Hook: build final sections array based on current pathname         */
/* ------------------------------------------------------------------ */

function useNavSections(pathname: string): NavSection[] {
    return useMemo(() => {
        const match = PROJECT_ID_RE.exec(pathname);
        const projectId = match ? match[1] : null;

        const sections: NavSection[] = [NAV_SECTION_NAVEGACION];

        if (projectId) {
            sections.push(buildProjectSection(projectId));
        }

        sections.push(NAV_SECTION_HERRAMIENTAS);
        sections.push(NAV_SECTION_CONFIGURACION);

        return sections;
    }, [pathname]);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const sections = useNavSections(pathname);

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

            {/* Navigation */}
            <nav className="flex-1 py-5 px-3 overflow-y-auto">
                {sections.map((section, sIdx) => (
                    <div key={section.header} style={{ marginTop: sIdx > 0 ? '24px' : undefined }}>
                        {/* Section header */}
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
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'rgba(255,255,255,0.5)',
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
                            {section.items.map((item) => {
                                /* Active detection:
                                   - "/" matches only exactly
                                   - "/projects/[id]" (project overview) matches only exactly
                                   - All other paths use startsWith for sub-routes */
                                const isProjectOverview =
                                    PROJECT_ID_RE.test(item.path) &&
                                    item.path.replace(PROJECT_ID_RE, '').replace(/^\//, '') === '';

                                let isActive: boolean;
                                if (item.path === '/') {
                                    isActive = pathname === '/';
                                } else if (isProjectOverview) {
                                    isActive = pathname === item.path;
                                } else {
                                    isActive = pathname === item.path ||
                                        pathname.startsWith(item.path + '/');
                                }

                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        className={cn(
                                            'flex items-center gap-3 transition-all',
                                            isActive
                                                ? 'font-medium'
                                                : 'hover:opacity-100'
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
                            })}
                        </div>
                    </div>
                ))}
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
