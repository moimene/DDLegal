'use client';

import { usePathname } from 'next/navigation';
import { UserProvider } from '@/contexts/UserContext';
import Sidebar from '@/components/layout/sidebar';
import UserIndicator from '@/components/layout/user-indicator';

/**
 * AppShell wraps the entire app with:
 * - UserProvider context for auth state
 * - Sidebar navigation (hidden on /login)
 * - User indicator in top-right (hidden on /login)
 * - Main content area
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <UserProvider>
            {isLoginPage ? (
                // Login page: no sidebar, no header
                <>{children}</>
            ) : (
                <div className="flex min-h-screen">
                    <Sidebar />
                    <div
                        className="flex-1 flex flex-col min-h-screen transition-all"
                        style={{ marginLeft: 'var(--sidebar-width)' }}
                    >
                        {/* Top bar with user indicator */}
                        <UserIndicator />

                        <main
                            className="flex-1"
                            style={{
                                padding: 'var(--g-space-8) var(--g-space-10) var(--g-space-12)',
                                maxWidth: 'var(--g-content-max-width)',
                                width: '100%',
                            }}
                        >
                            {children}
                        </main>
                    </div>
                </div>
            )}
        </UserProvider>
    );
}
