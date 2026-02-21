'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ProjectUserRole, ProjectRole } from '@/lib/supabase';

interface UserInfo {
    id: string;
    email: string;
}

interface UserContextValue {
    user: UserInfo | null;
    roles: ProjectUserRole[];
    loading: boolean;
    /** Primary role label for display */
    primaryRole: ProjectRole | null;
    /** Login with email + password, returns true on success */
    login: (email: string, password: string) => Promise<boolean>;
    /** Clear session */
    logout: () => void;
    /** Force-refresh user data */
    refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
    user: null,
    roles: [],
    loading: true,
    primaryRole: null,
    login: async () => false,
    logout: () => {},
    refresh: async () => {},
});

export function useUser() {
    return useContext(UserContext);
}

const TOKEN_KEY = 'dd_session_token';

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [roles, setRoles] = useState<ProjectUserRole[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async (token: string) => {
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                localStorage.removeItem(TOKEN_KEY);
                setUser(null);
                setRoles([]);
                return;
            }
            const data = await res.json();
            setUser(data.user);
            setRoles(data.roles || []);
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            setUser(null);
            setRoles([]);
        }
    }, []);

    // On mount, check for existing token
    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            fetchMe(token).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [fetchMe]);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) return false;

            const data = await res.json();
            if (data.session?.access_token) {
                localStorage.setItem(TOKEN_KEY, data.session.access_token);
                setUser(data.user);
                // Fetch roles after login
                await fetchMe(data.session.access_token);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [fetchMe]);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setRoles([]);
    }, []);

    const refresh = useCallback(async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) await fetchMe(token);
    }, [fetchMe]);

    // Derive primary role from first role found
    const primaryRole = roles.length > 0 ? roles[0].role : null;

    return (
        <UserContext.Provider value={{ user, roles, loading, primaryRole, login, logout, refresh }}>
            {children}
        </UserContext.Provider>
    );
}
