'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    FileText,
    MessageSquare,
    AlertTriangle,
    BarChart3,
    Flag,
    CheckCircle2,
    Loader2,
    ChevronDown,
    Clock,
    Filter,
    XCircle,
    Upload,
    Brain,
} from 'lucide-react';
import { getDateTimeFormatter } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityEvent {
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
        | 'milestone'
        | 'task_completed';
    category: 'documentos' | 'qa' | 'ia' | 'tareas' | 'general';
    title: string;
    description: string;
    details: string | null;
    user_name: string | null;
    user_initials: string | null;
    action_url: string | null;
    project_id: string;
    created_at: string;
    metadata: Record<string, unknown>;
}

interface ActivityTimelineProps {
    projectId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_TABS: { key: string; label: string }[] = [
    { key: 'todo', label: 'Todo' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'qa', label: 'Q&A' },
    { key: 'ia', label: 'IA' },
    { key: 'tareas', label: 'Tareas' },
];

const ICON_MAP: Record<string, typeof Zap> = {
    tool_completed: Zap,
    tool_failed: XCircle,
    document_uploaded: Upload,
    qa_new: MessageSquare,
    qa_answer: MessageSquare,
    qa_sla: AlertTriangle,
    hitl_required: Brain,
    report_ready: BarChart3,
    milestone: Flag,
    task_completed: CheckCircle2,
};

const ICON_COLOR_MAP: Record<string, string> = {
    tool_completed: 'var(--status-success)',
    tool_failed: 'var(--status-error)',
    document_uploaded: 'var(--status-info)',
    qa_new: 'var(--g-brand-bright)',
    qa_answer: 'var(--status-success)',
    qa_sla: 'var(--status-warning)',
    hitl_required: 'var(--status-error)',
    report_ready: 'var(--g-sec-700)',
    milestone: 'var(--g-brand-3308)',
    task_completed: 'var(--status-success)',
};

const CATEGORY_BORDER_MAP: Record<string, string> = {
    documentos: 'var(--status-info)',
    qa: 'var(--g-brand-bright)',
    ia: 'var(--g-sec-700)',
    tareas: 'var(--status-warning)',
    general: 'var(--g-border-default)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGroupDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return getDateTimeFormatter({
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

function formatTime(dateStr: string): string {
    return getDateTimeFormatter({
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateStr));
}

function groupByDate(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
    const groups = new Map<string, ActivityEvent[]>();
    for (const event of events) {
        const dateKey = formatGroupDate(event.created_at);
        const existing = groups.get(dateKey);
        if (existing) {
            existing.push(event);
        } else {
            groups.set(dateKey, [event]);
        }
    }
    return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityTimeline({ projectId }: ActivityTimelineProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeFilter, setActiveFilter] = useState('todo');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const limit = 20;

    const fetchEvents = useCallback(
        async (currentOffset: number, append: boolean) => {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            try {
                const typeParam = activeFilter !== 'todo' ? `&type=${activeFilter}` : '';
                const res = await fetch(
                    `/api/notifications?project_id=${projectId}${typeParam}&limit=${limit}&offset=${currentOffset}&timeline=true`
                );
                if (res.ok) {
                    const data = await res.json();
                    const newEvents: ActivityEvent[] = data.notifications ?? [];
                    if (append) {
                        setEvents((prev) => [...prev, ...newEvents]);
                    } else {
                        setEvents(newEvents);
                    }
                    setHasMore(newEvents.length >= limit);
                }
            } catch {
                // silent
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [projectId, activeFilter]
    );

    // Fetch on filter change
    useEffect(() => {
        setOffset(0);
        setExpandedIds(new Set());
        fetchEvents(0, false);
    }, [fetchEvents]);

    // Load more
    const handleLoadMore = () => {
        const newOffset = offset + limit;
        setOffset(newOffset);
        fetchEvents(newOffset, true);
    };

    // Toggle expand
    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const grouped = groupByDate(events);
    const groupKeys = Array.from(grouped.keys());

    return (
        <div>
            {/* Filter Tabs */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-1)',
                    marginBottom: 'var(--g-space-6)',
                    padding: 'var(--g-space-1)',
                    backgroundColor: 'var(--g-surface-muted)',
                    borderRadius: 'var(--g-radius-md)',
                    width: 'fit-content',
                }}
            >
                {FILTER_TABS.map((tab) => {
                    const isActive = activeFilter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveFilter(tab.key)}
                            style={{
                                padding: 'var(--g-space-2) var(--g-space-4)',
                                fontSize: 'var(--g-text-small)',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                backgroundColor: isActive ? 'var(--g-surface-card)' : 'transparent',
                                border: 'none',
                                borderRadius: 'var(--g-radius-sm)',
                                cursor: 'pointer',
                                transition: 'all var(--g-transition-fast)',
                                boxShadow: isActive ? 'var(--g-shadow-sm)' : 'none',
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Loading state */}
            {loading ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--g-space-12)',
                    }}
                >
                    <Loader2
                        style={{
                            width: '24px',
                            height: '24px',
                            color: 'var(--g-text-muted)',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                </div>
            ) : events.length === 0 ? (
                /* Empty State */
                <div
                    className="g-card"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--g-space-12)',
                        gap: 'var(--g-space-3)',
                    }}
                >
                    <Filter
                        style={{
                            width: '32px',
                            height: '32px',
                            color: 'var(--g-text-muted)',
                        }}
                    />
                    <span
                        style={{
                            fontSize: 'var(--g-text-body)',
                            fontWeight: 500,
                            color: 'var(--g-text-secondary)',
                        }}
                    >
                        No hay actividad registrada
                    </span>
                    <span
                        style={{
                            fontSize: 'var(--g-text-small)',
                            color: 'var(--g-text-muted)',
                        }}
                    >
                        {activeFilter !== 'todo'
                            ? 'Prueba cambiando el filtro para ver otra actividad'
                            : 'La actividad del proyecto aparecera aqui automaticamente'}
                    </span>
                </div>
            ) : (
                /* Timeline */
                <div style={{ position: 'relative' }}>
                    {groupKeys.map((dateLabel, groupIndex) => {
                        const groupEvents = grouped.get(dateLabel) ?? [];
                        return (
                            <div key={dateLabel} style={{ marginBottom: 'var(--g-space-6)' }}>
                                {/* Date Group Header */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--g-space-3)',
                                        marginBottom: 'var(--g-space-4)',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 'var(--g-text-small)',
                                            fontWeight: 700,
                                            color: 'var(--g-text-primary)',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {dateLabel}
                                    </span>
                                    <div
                                        style={{
                                            flex: 1,
                                            height: '1px',
                                            backgroundColor: 'var(--g-border-subtle)',
                                        }}
                                    />
                                </div>

                                {/* Events */}
                                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                                    {/* Vertical connector line */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: '15px',
                                            top: '0',
                                            bottom: '0',
                                            width: '2px',
                                            backgroundColor: 'var(--g-border-subtle)',
                                        }}
                                    />

                                    {groupEvents.map((event, eventIndex) => {
                                        const IconComponent = ICON_MAP[event.type] ?? Clock;
                                        const iconColor = ICON_COLOR_MAP[event.type] ?? 'var(--g-text-muted)';
                                        const borderColor =
                                            CATEGORY_BORDER_MAP[event.category] ?? 'var(--g-border-default)';
                                        const isExpanded = expandedIds.has(event.id);
                                        const isLast =
                                            eventIndex === groupEvents.length - 1 &&
                                            groupIndex === groupKeys.length - 1;

                                        return (
                                            <div
                                                key={event.id}
                                                className="animate-fade-in"
                                                style={{
                                                    position: 'relative',
                                                    marginBottom:
                                                        eventIndex < groupEvents.length - 1
                                                            ? 'var(--g-space-3)'
                                                            : '0',
                                                    animationDelay: `${eventIndex * 30}ms`,
                                                }}
                                            >
                                                {/* Icon circle on the timeline */}
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: '-24px',
                                                        top: '12px',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-surface-card)',
                                                        border: `2px solid ${iconColor}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 1,
                                                    }}
                                                >
                                                    <IconComponent
                                                        style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            color: iconColor,
                                                        }}
                                                    />
                                                </div>

                                                {/* Event Card */}
                                                <div
                                                    className="g-card"
                                                    style={{
                                                        marginLeft: 'var(--g-space-4)',
                                                        padding: 'var(--g-space-3) var(--g-space-4)',
                                                        borderLeft: `3px solid ${borderColor}`,
                                                        cursor: event.details ? 'pointer' : 'default',
                                                        transition: 'box-shadow var(--g-transition-fast)',
                                                    }}
                                                    onClick={() => {
                                                        if (event.details) toggleExpand(event.id);
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (event.details)
                                                            e.currentTarget.style.boxShadow =
                                                                'var(--g-shadow-card-hover)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.boxShadow = 'var(--g-shadow-card)';
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            justifyContent: 'space-between',
                                                            gap: 'var(--g-space-3)',
                                                        }}
                                                    >
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            {/* Title */}
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 'var(--g-space-2)',
                                                                    marginBottom: '2px',
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        fontSize: 'var(--g-text-small)',
                                                                        fontWeight: 600,
                                                                        color: 'var(--g-text-primary)',
                                                                    }}
                                                                >
                                                                    {event.title}
                                                                </span>
                                                                {event.details && (
                                                                    <ChevronDown
                                                                        style={{
                                                                            width: '14px',
                                                                            height: '14px',
                                                                            color: 'var(--g-text-muted)',
                                                                            transform: isExpanded
                                                                                ? 'rotate(180deg)'
                                                                                : 'rotate(0deg)',
                                                                            transition:
                                                                                'transform var(--g-transition-fast)',
                                                                            flexShrink: 0,
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>

                                                            {/* Description */}
                                                            <p
                                                                style={{
                                                                    fontSize: 'var(--g-text-caption)',
                                                                    color: 'var(--g-text-secondary)',
                                                                    lineHeight: 'var(--g-leading-normal)',
                                                                    margin: 0,
                                                                }}
                                                            >
                                                                {event.description}
                                                            </p>

                                                            {/* Expanded Details */}
                                                            {isExpanded && event.details && (
                                                                <div
                                                                    className="animate-fade-in"
                                                                    style={{
                                                                        marginTop: 'var(--g-space-2)',
                                                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                                                        backgroundColor: 'var(--g-surface-page)',
                                                                        borderRadius: 'var(--g-radius-sm)',
                                                                        fontSize: 'var(--g-text-caption)',
                                                                        color: 'var(--g-text-secondary)',
                                                                        lineHeight: 'var(--g-leading-relaxed)',
                                                                        whiteSpace: 'pre-wrap',
                                                                    }}
                                                                >
                                                                    {event.details}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Right side: time + user avatar */}
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'flex-end',
                                                                gap: '4px',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize: '10px',
                                                                    color: 'var(--g-text-muted)',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {formatTime(event.created_at)}
                                                            </span>
                                                            {event.user_initials && (
                                                                <div
                                                                    title={event.user_name ?? ''}
                                                                    style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        borderRadius: 'var(--g-radius-full)',
                                                                        backgroundColor: 'var(--g-brand-3308)',
                                                                        color: 'var(--g-text-inverse)',
                                                                        fontSize: '9px',
                                                                        fontWeight: 700,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        letterSpacing: '0.03em',
                                                                    }}
                                                                >
                                                                    {event.user_initials}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Load More */}
                    {hasMore && (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: 'var(--g-space-6)',
                            }}
                        >
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--g-space-2)',
                                    padding: 'var(--g-space-2) var(--g-space-6)',
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 500,
                                    color: 'var(--g-brand-3308)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    border: '1px solid var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                                    opacity: loadingMore ? 0.6 : 1,
                                    transition: 'all var(--g-transition-fast)',
                                    boxShadow: 'var(--g-shadow-sm)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!loadingMore)
                                        e.currentTarget.style.boxShadow = 'var(--g-shadow-card)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = 'var(--g-shadow-sm)';
                                }}
                            >
                                {loadingMore ? (
                                    <Loader2
                                        style={{
                                            width: '14px',
                                            height: '14px',
                                            animation: 'spin 1s linear infinite',
                                        }}
                                    />
                                ) : (
                                    <ChevronDown style={{ width: '14px', height: '14px' }} />
                                )}
                                Cargar mas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
