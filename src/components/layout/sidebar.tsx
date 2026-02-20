'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderKanban, ChevronLeft, ChevronRight,
    Scale, Bot, Wrench, Building2, Shield, BookOpen, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    label: string;
    icon: typeof LayoutDashboard;
    path: string;
}

interface NavSection {
    header: string;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        header: 'Navegación',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
            { label: 'Proyectos DD', icon: FolderKanban, path: '/projects' },
        ],
    },
    {
        header: 'Herramientas',
        items: [
            { label: 'Hub Herramientas', icon: Wrench, path: '/tools' },
            { label: 'Societario', icon: Building2, path: '/tools/societario' },
            { label: 'Radar Marcas', icon: Shield, path: '/tools/marcas' },
        ],
    },
    {
        header: 'Configuración',
        items: [
            { label: 'Estado del Sistema', icon: Settings, path: '/configuracion' },
            { label: 'Catálogo Skills', icon: BookOpen, path: '/skills' },
            { label: 'Gestión Herramientas', icon: Wrench, path: '/configuracion/herramientas' },
            { label: 'Gestión Skills', icon: BookOpen, path: '/configuracion/skills' },
        ],
    },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

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
                            PMO · Due Diligence
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-5 px-3 overflow-y-auto">
                {NAV_SECTIONS.map((section, sIdx) => (
                    <div key={sIdx} className={sIdx > 0 ? 'mt-6' : ''}>
                        {/* Section header */}
                        {!collapsed ? (
                            <p
                                className="px-3 mb-2 animate-fade-in"
                                style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: 'rgba(255,255,255,0.5)',
                                    lineHeight: '1',
                                }}
                            >
                                {section.header}
                            </p>
                        ) : sIdx > 0 ? (
                            <hr
                                className="mx-3 mb-3"
                                style={{ borderColor: 'var(--g-sidebar-border)' }}
                            />
                        ) : null}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {section.items.map((item) => {
                                const isActive = pathname === item.path ||
                                    (item.path !== '/' && pathname.startsWith(item.path));
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
                aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
        </aside>
    );
}
