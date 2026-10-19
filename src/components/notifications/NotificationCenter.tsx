'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Bell,
    Zap,
    FileText,
    MessageSquare,
    AlertTriangle,
    BarChart3,
    Flag,
    Check,
    CheckCheck,
    ExternalLink,
    Inbox,
    X,
    Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DDNotification {
    id: string;
    type:
        | 'tool_completed'
        | 'tool_failed'
        | 'document_uploaded'
        | 'qa_new'
        | 'qa_answer'
        | 'qa_sla'
        | 'hitl_required'
        | 'report_ready'
        | 'milestone';
    title: string;
    description: string;
    is_read: boolean;
    action_url: string | null;
    project_id: string;
    created_at: string;
    metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP: Record<DDNotification['type'], typeof Zap> = {
    tool_completed: Zap,
    tool_failed: Zap,
    document_uploaded: FileText,
    qa_new: MessageSquare,
    qa_answer: MessageSquare,
    qa_sla: AlertTriangle,
    hitl_required: AlertTriangle,
    report_ready: BarChart3,
    milestone: Flag,
};

const ICON_COLOR_MAP: Record<DDNotification['type'], string> = {
    tool_completed: 'var(--status-success)',
    tool_failed: 'var(--status-error)',
    document_uploaded: 'var(--status-info)',
    qa_new: 'var(--g-brand-bright)',
    qa_answer: 'var(--status-success)',
    qa_sla: 'var(--status-warning)',
    hitl_required: 'var(--status-error)',
    report_ready: 'var(--g-sec-700)',
    milestone: 'var(--g-brand-3308)',
};

const ICON_BG_MAP: Record<DDNotification['type'], string> = {
    tool_completed: 'rgba(0,154,119,0.10)',
    tool_failed: 'rgba(220,38,38,0.10)',
    document_uploaded: 'rgba(59,130,246,0.10)',
    qa_new: 'rgba(0,154,119,0.10)',
    qa_answer: 'rgba(0,154,119,0.10)',
    qa_sla: 'rgba(230,168,23,0.10)',
    hitl_required: 'rgba(220,38,38,0.10)',
    report_ready: 'rgba(0,115,98,0.10)',
    milestone: 'rgba(0,68,56,0.10)',
};

function relativeTime(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHour < 24) return `hace ${diffHour}h`;
    if (diffDay === 1) return 'ayer';
    if (diffDay < 7) return `hace ${diffDay} dias`;
    return dateFormatter.format(new Date(dateStr));
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
});

function extractProjectId(pathname: string): string | null {
    const match = pathname.match(/\/projects\/([^/]+)/);
    return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationCenter() {
    const router = useRouter();
    const pathname = usePathname();
    const projectId = extractProjectId(pathname);

    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<DDNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        if (open) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    // Fetch unread count
    const fetchCount = useCallback(async () => {
        if (!projectId) {
            setUnreadCount(0);
            return;
        }
        try {
            const res = await fetch(`/api/notifications/count?project_id=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.count ?? 0);
            }
        } catch {
            // silent
        }
    }, [projectId]);

    // Fetch notifications list
    const fetchNotifications = useCallback(async () => {
        if (!projectId) {
            setNotifications([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/notifications?project_id=${projectId}&limit=30`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications ?? []);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    // Poll count every 30s
    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, [fetchCount]);

    // Load notifications when opening dropdown
    useEffect(() => {
        if (open) {
            fetchNotifications();
        }
    }, [open, fetchNotifications]);

    // Mark all as read
    const handleMarkAllRead = async () => {
        if (notifications.length === 0) return;
        setMarkingAll(true);
        const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length === 0) {
            setMarkingAll(false);
            return;
        }
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds }),
            });
            setNotifications((prev) =>
                prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n))
            );
            setUnreadCount(0);
        } catch {
            // silent
        } finally {
            setMarkingAll(false);
        }
    };

    // Mark single as read + navigate
    const handleNotificationClick = async (notification: DDNotification) => {
        if (!notification.is_read) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [notification.id] }),
                });
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
                );
                setUnreadCount((c) => Math.max(0, c - 1));
            } catch {
                // silent
            }
        }
        setOpen(false);
        if (notification.action_url) {
            router.push(notification.action_url);
        }
    };

    const unreadNotifications = notifications.filter((n) => !n.is_read);
    const readNotifications = notifications.filter((n) => n.is_read);

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
            {/* Bell Button */}
            <button
                onClick={() => setOpen((prev) => !prev)}
                aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
                aria-expanded={open}
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--g-radius-md)',
                    border: '1px solid var(--g-border-subtle)',
                    backgroundColor: open ? 'var(--g-surface-subtle)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all var(--g-transition-fast)',
                }}
                onMouseEnter={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = 'var(--g-surface-hover)';
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <Bell
                    style={{
                        width: '18px',
                        height: '18px',
                        color: unreadCount > 0 ? 'var(--g-brand-3308)' : 'var(--g-text-muted)',
                    }}
                />
                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            minWidth: '18px',
                            height: '18px',
                            padding: '0 5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: 'var(--status-error)',
                            color: 'var(--g-text-inverse)',
                            fontSize: '10px',
                            fontWeight: 700,
                            lineHeight: 1,
                            border: '2px solid var(--g-surface-card)',
                        }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    className="animate-scale-in"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '360px',
                        maxHeight: '400px',
                        backgroundColor: 'var(--g-surface-card)',
                        border: '1px solid var(--g-border-subtle)',
                        borderRadius: 'var(--g-radius-lg)',
                        boxShadow: 'var(--g-shadow-dropdown)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--g-space-3) var(--g-space-4)',
                            borderBottom: '1px solid var(--g-border-subtle)',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 'var(--g-text-body)',
                                fontWeight: 600,
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            Notificaciones
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                            {unreadNotifications.length > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    disabled={markingAll}
                                    title="Marcar todas como leidas"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        fontSize: 'var(--g-text-caption)',
                                        fontWeight: 500,
                                        color: 'var(--g-brand-3308)',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: 'var(--g-radius-sm)',
                                        cursor: 'pointer',
                                        transition: 'background var(--g-transition-fast)',
                                        opacity: markingAll ? 0.5 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {markingAll ? (
                                        <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <CheckCheck style={{ width: '12px', height: '12px' }} />
                                    )}
                                    Marcar todas como leidas
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar notificaciones"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: 'var(--g-radius-sm)',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--g-text-muted)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--g-surface-muted)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <X style={{ width: '14px', height: '14px' }} />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}
                    >
                        {loading ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 'var(--g-space-8)',
                                }}
                            >
                                <Loader2
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        color: 'var(--g-text-muted)',
                                        animation: 'spin 1s linear infinite',
                                    }}
                                />
                            </div>
                        ) : notifications.length === 0 ? (
                            /* Empty State */
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 'var(--g-space-10) var(--g-space-6)',
                                    gap: 'var(--g-space-3)',
                                }}
                            >
                                <div
                                    style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: 'var(--g-surface-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Inbox
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            color: 'var(--g-text-muted)',
                                        }}
                                    />
                                </div>
                                <span
                                    style={{
                                        fontSize: 'var(--g-text-small)',
                                        color: 'var(--g-text-muted)',
                                        textAlign: 'center',
                                    }}
                                >
                                    No hay notificaciones nuevas
                                </span>
                                {!projectId && (
                                    <span
                                        style={{
                                            fontSize: 'var(--g-text-caption)',
                                            color: 'var(--g-text-muted)',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Selecciona un proyecto para ver notificaciones
                                    </span>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Unread Section */}
                                {unreadNotifications.length > 0 && (
                                    <div>
                                        <div
                                            style={{
                                                padding: 'var(--g-space-2) var(--g-space-4)',
                                                fontSize: 'var(--g-text-caption)',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                color: 'var(--g-text-muted)',
                                                backgroundColor: 'var(--g-surface-page)',
                                            }}
                                        >
                                            Sin leer ({unreadNotifications.length})
                                        </div>
                                        {unreadNotifications.map((n) => (
                                            <NotificationItem
                                                key={n.id}
                                                notification={n}
                                                onClick={() => handleNotificationClick(n)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Read Section */}
                                {readNotifications.length > 0 && (
                                    <div>
                                        <div
                                            style={{
                                                padding: 'var(--g-space-2) var(--g-space-4)',
                                                fontSize: 'var(--g-text-caption)',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                color: 'var(--g-text-muted)',
                                                backgroundColor: 'var(--g-surface-page)',
                                            }}
                                        >
                                            Anteriores
                                        </div>
                                        {readNotifications.map((n) => (
                                            <NotificationItem
                                                key={n.id}
                                                notification={n}
                                                onClick={() => handleNotificationClick(n)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && projectId && (
                        <div
                            style={{
                                borderTop: '1px solid var(--g-border-subtle)',
                                padding: 'var(--g-space-2) var(--g-space-4)',
                                flexShrink: 0,
                            }}
                        >
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    router.push(`/projects/${projectId}/activity`);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    width: '100%',
                                    padding: 'var(--g-space-2)',
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 500,
                                    color: 'var(--g-brand-3308)',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: 'var(--g-radius-sm)',
                                    cursor: 'pointer',
                                    transition: 'background var(--g-transition-fast)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                Ver toda la actividad
                                <ExternalLink style={{ width: '12px', height: '12px' }} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// NotificationItem sub-component
// ---------------------------------------------------------------------------

function NotificationItem({
    notification,
    onClick,
}: {
    notification: DDNotification;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const IconComponent = ICON_MAP[notification.type] ?? Bell;
    const iconColor = ICON_COLOR_MAP[notification.type] ?? 'var(--g-text-muted)';
    const iconBg = ICON_BG_MAP[notification.type] ?? 'var(--g-surface-muted)';

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--g-space-3)',
                width: '100%',
                padding: 'var(--g-space-3) var(--g-space-4)',
                backgroundColor: hovered
                    ? 'var(--g-surface-hover)'
                    : notification.is_read
                        ? 'transparent'
                        : 'rgba(0,68,56,0.02)',
                border: 'none',
                borderLeft: notification.is_read ? '3px solid transparent' : `3px solid var(--g-brand-bright)`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background var(--g-transition-fast)',
            }}
        >
            {/* Icon */}
            <div
                style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                }}
            >
                <IconComponent style={{ width: '16px', height: '16px', color: iconColor }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-2)',
                        marginBottom: '2px',
                    }}
                >
                    {/* Unread dot */}
                    {!notification.is_read && (
                        <div
                            style={{
                                width: '6px',
                                height: '6px',
                                minWidth: '6px',
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--status-info)',
                            }}
                        />
                    )}
                    <span
                        style={{
                            fontSize: 'var(--g-text-small)',
                            fontWeight: notification.is_read ? 400 : 600,
                            color: 'var(--g-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {notification.title}
                    </span>
                </div>
                <p
                    style={{
                        fontSize: 'var(--g-text-caption)',
                        color: 'var(--g-text-secondary)',
                        lineHeight: 'var(--g-leading-normal)',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        margin: 0,
                    }}
                >
                    {notification.description}
                </p>
                <span
                    style={{
                        fontSize: '10px',
                        color: 'var(--g-text-muted)',
                        marginTop: '4px',
                        display: 'block',
                    }}
                >
                    {relativeTime(notification.created_at)}
                </span>
            </div>

            {/* Action arrow on hover */}
            {notification.action_url && hovered && (
                <ExternalLink
                    style={{
                        width: '14px',
                        height: '14px',
                        color: 'var(--g-text-muted)',
                        marginTop: '4px',
                        flexShrink: 0,
                    }}
                />
            )}
        </button>
    );
}
