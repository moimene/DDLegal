'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PresenceUser {
    id: string;
    name: string;
    initials: string;
    role: 'clo' | 'pm' | 'abogado' | 'sponsor' | 'cliente' | 'unknown';
    lastSeen: number; // timestamp
}

interface PresenceIndicatorProps {
    projectId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
    clo: '#7C3AED',
    pm: '#2563EB',
    abogado: '#059669',
    sponsor: '#D97706',
    cliente: '#6B7280',
    unknown: '#9CA3AF',
};

const ROLE_LABELS: Record<string, string> = {
    clo: 'CLO',
    pm: 'PM',
    abogado: 'Abogado',
    sponsor: 'Sponsor',
    cliente: 'Cliente',
    unknown: 'Usuario',
};

const STORAGE_KEY_PREFIX = 'dd_presence_';
const PRESENCE_TIMEOUT_MS = 60000; // 60s — considered offline after this
const HEARTBEAT_MS = 15000; // send heartbeat every 15s
const MAX_VISIBLE_AVATARS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function getCurrentUser(): PresenceUser | null {
    try {
        const token = localStorage.getItem('dd_session_token');
        if (!token) return null;

        // Decode JWT payload to get user info
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(atob(parts[1]));
        const email: string = payload.email ?? 'usuario@desconocido.com';
        const userId: string = payload.sub ?? 'anon';

        // Derive initials from email
        const namepart = email.split('@')[0];
        const segments = namepart.split(/[._-]/);
        const initials =
            segments.length >= 2
                ? (segments[0][0] + segments[1][0]).toUpperCase()
                : namepart.substring(0, 2).toUpperCase();

        // Try to infer role from stored data
        let role: PresenceUser['role'] = 'unknown';
        try {
            const rolesRaw = localStorage.getItem('dd_user_roles');
            if (rolesRaw) {
                const roles = JSON.parse(rolesRaw);
                if (Array.isArray(roles) && roles.length > 0) {
                    const r = roles[0]?.role ?? '';
                    if (r.includes('clo')) role = 'clo';
                    else if (r.includes('pm')) role = 'pm';
                    else if (r.includes('abogado')) role = 'abogado';
                    else if (r.includes('sponsor')) role = 'sponsor';
                    else if (r.includes('cliente')) role = 'cliente';
                }
            }
        } catch {
            // ignore
        }

        return {
            id: userId,
            name: email,
            initials,
            role,
            lastSeen: Date.now(),
        };
    } catch {
        return null;
    }
}

function readPresence(projectId: string): PresenceUser[] {
    try {
        const raw = localStorage.getItem(getStorageKey(projectId));
        if (!raw) return [];
        const users: PresenceUser[] = JSON.parse(raw);
        const now = Date.now();
        return users.filter((u) => now - u.lastSeen < PRESENCE_TIMEOUT_MS);
    } catch {
        return [];
    }
}

function writePresence(projectId: string, currentUser: PresenceUser) {
    try {
        const existing = readPresence(projectId);
        const now = Date.now();

        // Remove stale + current user then re-add
        const filtered = existing.filter(
            (u) => u.id !== currentUser.id && now - u.lastSeen < PRESENCE_TIMEOUT_MS
        );
        filtered.push({ ...currentUser, lastSeen: now });

        localStorage.setItem(getStorageKey(projectId), JSON.stringify(filtered));
    } catch {
        // ignore
    }
}

function removePresence(projectId: string, userId: string) {
    try {
        const existing = readPresence(projectId);
        const filtered = existing.filter((u) => u.id !== userId);
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(filtered));
    } catch {
        // ignore
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PresenceIndicator({ projectId }: PresenceIndicatorProps) {
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
    const currentUserRef = useRef<PresenceUser | null>(null);

    // Heartbeat: update presence & read others
    const tick = useCallback(() => {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        currentUserRef.current = currentUser;
        writePresence(projectId, currentUser);
        const online = readPresence(projectId);
        setUsers(online);
    }, [projectId]);

    useEffect(() => {
        tick(); // immediate
        const interval = setInterval(tick, HEARTBEAT_MS);

        return () => {
            clearInterval(interval);
            // Remove self on unmount
            if (currentUserRef.current) {
                removePresence(projectId, currentUserRef.current.id);
            }
        };
    }, [projectId, tick]);

    // Also listen for storage changes from other tabs
    useEffect(() => {
        function onStorage(e: StorageEvent) {
            if (e.key === getStorageKey(projectId)) {
                const online = readPresence(projectId);
                setUsers(online);
            }
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [projectId]);

    if (users.length === 0) return null;

    const visible = users.slice(0, MAX_VISIBLE_AVATARS);
    const overflow = users.length - MAX_VISIBLE_AVATARS;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--g-space-2)',
            }}
        >
            {/* Label */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: 'var(--g-space-1)',
                }}
            >
                <Users
                    style={{ width: '14px', height: '14px', color: 'var(--g-text-muted)' }}
                />
                <span
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        color: 'var(--g-text-muted)',
                        fontWeight: 500,
                    }}
                >
                    En linea
                </span>
            </div>

            {/* Avatar Stack */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {visible.map((user, index) => {
                    const color = ROLE_COLORS[user.role] ?? ROLE_COLORS.unknown;
                    const roleLabel = ROLE_LABELS[user.role] ?? 'Usuario';
                    const isHovered = hoveredUserId === user.id;

                    return (
                        <div
                            key={user.id}
                            style={{
                                position: 'relative',
                                marginLeft: index > 0 ? '-6px' : '0',
                                zIndex: isHovered ? 10 : MAX_VISIBLE_AVATARS - index,
                            }}
                            onMouseEnter={() => setHoveredUserId(user.id)}
                            onMouseLeave={() => setHoveredUserId(null)}
                        >
                            {/* Avatar circle */}
                            <div
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: color,
                                    color: '#ffffff',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid var(--g-surface-card)',
                                    cursor: 'default',
                                    transition: 'transform var(--g-transition-fast)',
                                    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {user.initials}
                            </div>

                            {/* Online dot */}
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: '-1px',
                                    right: '-1px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: '#10B981',
                                    border: '2px solid var(--g-surface-card)',
                                }}
                            />

                            {/* Tooltip */}
                            {isHovered && (
                                <div
                                    className="animate-fade-in"
                                    style={{
                                        position: 'absolute',
                                        bottom: 'calc(100% + 8px)',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        backgroundColor: 'var(--g-text-primary)',
                                        color: 'var(--g-text-inverse)',
                                        padding: '6px 10px',
                                        borderRadius: 'var(--g-radius-sm)',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        zIndex: 100,
                                        boxShadow: 'var(--g-shadow-dropdown)',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                                    <div
                                        style={{
                                            marginTop: '2px',
                                            opacity: 0.75,
                                            fontSize: '10px',
                                        }}
                                    >
                                        {roleLabel}
                                    </div>
                                    {/* Tooltip arrow */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: '-4px',
                                            left: '50%',
                                            transform: 'translateX(-50%) rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'var(--g-text-primary)',
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Overflow indicator */}
                {overflow > 0 && (
                    <div
                        style={{
                            marginLeft: '-6px',
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--g-surface-muted)',
                            color: 'var(--g-text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid var(--g-surface-card)',
                        }}
                    >
                        +{overflow}
                    </div>
                )}
            </div>
        </div>
    );
}
