'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getRoleLabel } from '@/lib/supabase-auth';
import { NotificationCenter } from '@/components/notifications';

/**
 * Small user indicator shown in the top-right corner of the app.
 * Displays current user email and primary role, with a logout button.
 * Shows a "login" link when not authenticated.
 */
export default function UserIndicator() {
    const { user, primaryRole, loading, logout } = useUser();
    const router = useRouter();

    function handleLogout() {
        logout();
        router.push('/login');
    }

    function handleLoginRedirect() {
        router.push('/login');
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: 'var(--g-space-3) var(--g-space-6)',
                borderBottom: '1px solid var(--g-border-subtle, #e5e7eb)',
                backgroundColor: 'var(--g-surface-primary, #ffffff)',
                minHeight: '48px',
            }}
        >
            {loading ? (
                <Loader2
                    style={{
                        width: '16px',
                        height: '16px',
                        color: 'var(--g-text-muted)',
                        animation: 'spin 1s linear infinite',
                    }}
                />
            ) : user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                    {/* Notification center */}
                    <NotificationCenter />

                    {/* Role badge */}
                    {primaryRole && (
                        <span
                            style={{
                                fontSize: 'var(--g-text-caption, 0.75rem)',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 'var(--g-radius-full, 50px)',
                                backgroundColor: 'var(--g-surface-subtle, #f8f9fa)',
                                color: 'var(--g-brand-3308, #1a1a2e)',
                                border: '1px solid var(--g-border-subtle, #e5e7eb)',
                            }}
                        >
                            {getRoleLabel(primaryRole)}
                        </span>
                    )}

                    {/* User avatar + email */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--g-radius-full, 50%)',
                                backgroundColor: 'var(--g-brand-3308, #1a1a2e)',
                            }}
                        >
                            <User style={{ width: '14px', height: '14px', color: 'var(--g-text-inverse, #ffffff)' }} />
                        </div>
                        <span
                            style={{
                                fontSize: 'var(--g-text-small, 0.8125rem)',
                                color: 'var(--g-text-secondary, #6b7280)',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {user.email}
                        </span>
                    </div>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        title="Cerrar sesion"
                        aria-label="Cerrar sesion"
                        className="flex items-center justify-center w-[28px] h-[28px] rounded-md border border-[var(--g-border-subtle,#e5e7eb)] bg-transparent cursor-pointer transition-all duration-150 hover:bg-[var(--g-error-surface)] hover:border-[var(--g-error-border)]"
                    >
                        <LogOut style={{ width: '14px', height: '14px', color: 'var(--g-text-muted, #9ca3af)' }} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleLoginRedirect}
                    className="flex items-center gap-[var(--g-space-2)] px-[var(--g-space-3)] py-[var(--g-space-1)] rounded-md border border-[var(--g-border-default,#d1d5db)] bg-transparent text-[var(--g-text-secondary,#6b7280)] text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--g-surface-subtle)]"
                >
                    <User style={{ width: '14px', height: '14px' }} />
                    Iniciar sesion
                </button>
            )}
        </div>
    );
}
