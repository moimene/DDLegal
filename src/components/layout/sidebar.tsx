'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderKanban, ChevronLeft, ChevronRight,
    Scale, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Proyectos DD', icon: FolderKanban, path: '/projects' },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className="fixed left-0 top-0 h-screen flex flex-col transition-all z-40"
            style={{
                width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
                backgroundColor: 'var(--g-brand-3308)',
                transition: 'width var(--g-transition-smooth)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
                <Scale className="h-7 w-7 shrink-0" style={{ color: 'var(--g-brand-bright)' }} />
                {!collapsed && (
                    <div className="animate-fade-in">
                        <span
                            className="text-lg font-bold tracking-wide"
                            style={{ color: 'var(--g-text-inverse)' }}
                        >
                            DD Legal
                        </span>
                        <span
                            className="block text-xs"
                            style={{ color: 'var(--g-sec-300)' }}
                        >
                            PMO · Due Diligence
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.path ||
                        (item.path !== '/' && pathname.startsWith(item.path));
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 transition-all',
                                isActive
                                    ? 'font-medium'
                                    : 'opacity-70 hover:opacity-100'
                            )}
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                color: 'var(--g-text-inverse)',
                                backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                            }}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span className="text-sm">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* AI Assist */}
            <div className="px-2 pb-2">
                <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-all hover:opacity-90"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-brand-bright)',
                        color: 'var(--g-text-inverse)',
                    }}
                    title="Harvey AI"
                >
                    <Bot className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">Harvey AI</span>}
                </button>
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-center h-10 border-t border-white/10 hover:bg-white/5 transition-colors"
                style={{ color: 'var(--g-text-inverse)' }}
                aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
        </aside>
    );
}
