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
                        title="Cerrar sesión"
                        aria-label="Cerrar sesión"
                        className="bg-transparent border-[var(--g-border-subtle)] hover:bg-[var(--g-error-surface)] hover:border-[var(--g-error-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--g-radius-md, 8px)',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <LogOut style={{ width: '14px', height: '14px', color: 'var(--g-text-muted, #9ca3af)' }} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleLoginRedirect}
                    className="bg-transparent border-[var(--g-border-default)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-2)',
                        padding: 'var(--g-space-1) var(--g-space-3)',
                        borderRadius: 'var(--g-radius-md, 8px)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        color: 'var(--g-text-secondary, #6b7280)',
                        fontSize: 'var(--g-text-small, 0.8125rem)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    <User style={{ width: '14px', height: '14px' }} />
                    Iniciar sesión
                </button>
            )}
        </div>
    );
}
