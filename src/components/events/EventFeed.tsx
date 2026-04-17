'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCachedDateTimeFormat } from '@/lib/utils';
import {
  Play,
  CheckCircle2,
  XCircle,
  FileCheck,
  FileText,
  FilePlus2,
  MessageSquare,
  MessageCircle,
  AlertTriangle,
  Brain,
  UserCheck,
  Shield,
  Flag,
  Bell,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface EventRecord {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  project_id: string | null;
  description: string | null;
  severity: string | null;
  created_at: string;
}

interface EventFeedProps {
  projectId?: string;
  maxEvents?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ────────────────────────────────────────────────────────────
// Icon mapping
// ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  tool_execution_started: Play,
  tool_execution_completed: CheckCircle2,
  tool_execution_failed: XCircle,
  report_generated: FileCheck,
  document_uploaded: FileText,
  document_version_created: FilePlus2,
  qa_thread_created: MessageSquare,
  qa_thread_answered: MessageCircle,
  qa_sla_breached: AlertTriangle,
  hitl_decision_required: Brain,
  hitl_decision_made: UserCheck,
  contingency_updated: Shield,
  project_milestone: Flag,
};

function getEventIcon(eventType: string): React.ComponentType<{ style?: React.CSSProperties }> {
  return ICON_MAP[eventType] || Bell;
}

// ────────────────────────────────────────────────────────────
// Severity → color mapping
// ────────────────────────────────────────────────────────────

function getSeverityColor(severity: string | null): string {
  switch (severity) {
    case 'success': return 'var(--status-success)';
    case 'warning': return 'var(--status-warning)';
    case 'error': return 'var(--status-error)';
    case 'info':
    default: return 'var(--status-info)';
  }
}

function getSeverityBg(severity: string | null): string {
  switch (severity) {
    case 'success': return 'rgba(0, 154, 119, 0.08)';
    case 'warning': return 'rgba(230, 168, 23, 0.08)';
    case 'error': return 'rgba(220, 38, 38, 0.08)';
    case 'info':
    default: return 'rgba(59, 130, 246, 0.08)';
  }
}

// ────────────────────────────────────────────────────────────
// Relative time ("Hace X minutos") in Spanish
// ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Hace unos segundos';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} ${days === 1 ? 'dia' : 'dias'}`;

  return getCachedDateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ────────────────────────────────────────────────────────────
// Event item label helper
// ────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  tool_execution_started: 'Herramienta',
  tool_execution_completed: 'Herramienta',
  tool_execution_failed: 'Error',
  report_generated: 'Informe',
  document_uploaded: 'Documento',
  document_version_created: 'Version',
  qa_thread_created: 'Q&A',
  qa_thread_answered: 'Q&A',
  qa_sla_breached: 'SLA',
  hitl_decision_required: 'HITL',
  hitl_decision_made: 'HITL',
  contingency_updated: 'Contingencia',
  project_milestone: 'Hito',
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function EventFeed({
  projectId,
  maxEvents = 50,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: EventFeedProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const seenIdsRef = useRef(new Set<string>());

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => !prev);
    }
  }, [onToggleCollapse]);

  // ── Load initial events ─────────────────────────────────
  const loadInitialEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(maxEvents) });
      if (projectId) params.set('project_id', projectId);

      const resp = await fetch(`/api/events?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        const evts: EventRecord[] = data.events || [];
        setEvents(evts);

        seenIdsRef.current = new Set(evts.map(e => e.id));
      }
    } catch (err) {
      console.error('[EventFeed] Failed to load initial events:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, maxEvents]);

  // ── SSE connection ──────────────────────────────────────
  useEffect(() => {
    loadInitialEvents();

    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);

    const url = `/api/events/stream${params.toString() ? '?' + params.toString() : ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('dd_event', (e: MessageEvent) => {
      try {
        const eventData: EventRecord = JSON.parse(e.data);

        // Deduplicate
        if (seenIdsRef.current.has(eventData.id)) return;
        seenIdsRef.current.add(eventData.id);

        setEvents(prev => {
          const updated = [eventData, ...prev];
          // Trim to maxEvents
          if (updated.length > maxEvents) {
            const removed = updated.slice(maxEvents);
            for (const r of removed) {
              seenIdsRef.current.delete(r.id);
            }
            return updated.slice(0, maxEvents);
          }
          return updated;
        });

        // If not auto-scrolling, show badge
        if (!isAutoScroll) {
          setNewCount(prev => prev + 1);
        }
      } catch {
        console.error('[EventFeed] Failed to parse SSE event');
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [projectId, maxEvents, loadInitialEvents, isAutoScroll]);

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isAutoScroll]);

  // ── Scroll detection ────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const el = feedRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAutoScroll(atBottom);
    if (atBottom) setNewCount(0);
  }, []);

  // ── Jump to latest ──────────────────────────────────────
  const jumpToLatest = useCallback(() => {
    setNewCount(0);
    setIsAutoScroll(true);
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, []);

  // ── Render ──────────────────────────────────────────────
  return (
    <div
      className="g-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'var(--g-transition-smooth)',
      }}
    >
      {/* Header */}
      <button
        onClick={toggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--g-space-2)',
          padding: 'var(--g-space-3) var(--g-space-4)',
          borderBottom: collapsed ? 'none' : '1px solid var(--g-border-subtle)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {collapsed ? (
          <ChevronRight style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} />
        ) : (
          <ChevronDown style={{ width: 14, height: 14, color: 'var(--g-text-muted)' }} />
        )}
        <Bell style={{ width: 14, height: 14, color: 'var(--g-brand-3308)' }} />
        <span
          style={{
            fontWeight: 700,
            fontSize: 'var(--g-text-caption)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--g-brand-3308)',
          }}
        >
          Actividad en Tiempo Real
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--g-text-caption)',
            color: 'var(--g-text-muted)',
          }}
        >
          {events.length} eventos
        </span>
        {loading && (
          <Loader2
            style={{
              width: 12,
              height: 12,
              color: 'var(--g-text-muted)',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
      </button>

      {/* Feed body */}
      {!collapsed && (
        <div style={{ position: 'relative' }}>
          {/* New events badge */}
          {newCount > 0 && (
            <button
              onClick={jumpToLatest}
              style={{
                position: 'absolute',
                top: 'var(--g-space-2)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--g-space-1)',
                padding: 'var(--g-space-1) var(--g-space-3)',
                background: 'var(--g-brand-3308)',
                color: 'var(--g-text-inverse)',
                fontSize: 'var(--g-text-caption)',
                fontWeight: 600,
                borderRadius: 'var(--g-radius-full)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--g-shadow-dropdown)',
              }}
            >
              <RefreshCw style={{ width: 10, height: 10 }} />
              {newCount} {newCount === 1 ? 'nuevo evento' : 'nuevos eventos'}
            </button>
          )}

          {/* Scrollable event list */}
          <div
            ref={feedRef}
            onScroll={handleScroll}
            style={{
              maxHeight: 420,
              overflowY: 'auto',
              padding: 'var(--g-space-2) 0',
            }}
          >
            {loading && events.length === 0 ? (
              <div style={{ padding: 'var(--g-space-6)', textAlign: 'center' }}>
                <Loader2
                  style={{
                    width: 20,
                    height: 20,
                    color: 'var(--g-text-muted)',
                    margin: '0 auto',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: 'var(--g-space-2)' }}>
                  Cargando eventos...
                </p>
              </div>
            ) : events.length === 0 ? (
              <div style={{ padding: 'var(--g-space-6)', textAlign: 'center' }}>
                <Bell style={{ width: 24, height: 24, color: 'var(--g-text-muted)', margin: '0 auto' }} />
                <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)', marginTop: 'var(--g-space-2)' }}>
                  Sin eventos recientes
                </p>
              </div>
            ) : (
              events.map((event, idx) => {
                const IconComponent = getEventIcon(event.event_type);
                const color = getSeverityColor(event.severity);
                const bg = getSeverityBg(event.severity);
                const label = EVENT_TYPE_LABELS[event.event_type] || 'Evento';

                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--g-space-3)',
                      padding: 'var(--g-space-2) var(--g-space-4)',
                      transition: 'var(--g-transition-fast)',
                      borderLeft: idx === 0 ? `3px solid ${color}` : '3px solid transparent',
                      background: idx === 0 ? bg : 'transparent',
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--g-radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: bg,
                        marginTop: 2,
                      }}
                    >
                      <IconComponent style={{ width: 14, height: 14, color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--g-space-2)',
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 'var(--g-text-caption)',
                            fontWeight: 600,
                            color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--g-text-caption)',
                            color: 'var(--g-text-muted)',
                          }}
                        >
                          {timeAgo(event.created_at)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 'var(--g-text-small)',
                          color: 'var(--g-text-primary)',
                          margin: 0,
                          lineHeight: 'var(--g-leading-normal)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {event.description || event.event_type}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Footer with load more */}
          {events.length >= maxEvents && (
            <div
              style={{
                padding: 'var(--g-space-2) var(--g-space-4)',
                borderTop: '1px solid var(--g-border-subtle)',
                textAlign: 'center',
              }}
            >
              <button
                onClick={loadInitialEvents}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--g-link)',
                  fontSize: 'var(--g-text-caption)',
                  fontWeight: 500,
                  padding: 'var(--g-space-1) var(--g-space-2)',
                }}
              >
                Cargar mas eventos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Spin keyframe (injected once) */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
