'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  Clock,
  Brain,
  BarChart3,
  FolderOpen,
  ShieldAlert,
  Shield,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  action_url: string;
  icon: string;
  category: string;
}

interface SmartSuggestionsProps {
  projectId: string;
  context?: 'dashboard' | 'vdr' | 'qa' | 'tasks';
  refreshInterval?: number; // ms, default 60000
}

// ────────────────────────────────────────────────────────────
// Icon mapping
// ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  AlertTriangle,
  MessageSquare,
  Clock,
  Brain,
  BarChart3,
  FolderOpen,
  ShieldAlert,
  Shield,
};

function getSuggestionIcon(iconName: string): React.ComponentType<{ style?: React.CSSProperties }> {
  return ICON_MAP[iconName] || Lightbulb;
}

// ────────────────────────────────────────────────────────────
// Priority config
// ────────────────────────────────────────────────────────────

interface PriorityConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  P0: {
    label: 'Critico',
    color: 'var(--status-error)',
    bg: 'rgba(220, 38, 38, 0.08)',
    border: 'var(--status-error)',
  },
  P1: {
    label: 'Alto',
    color: 'var(--g-severity-high)',
    bg: 'rgba(234, 88, 12, 0.08)',
    border: 'var(--g-severity-high)',
  },
  P2: {
    label: 'Medio',
    color: 'var(--status-info)',
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'var(--status-info)',
  },
  P3: {
    label: 'Bajo',
    color: 'var(--g-text-muted)',
    bg: 'var(--g-surface-muted)',
    border: 'var(--g-border-subtle)',
  },
};

function getPriorityConfig(priority: string): PriorityConfig {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.P3;
}

// ────────────────────────────────────────────────────────────
// Skeleton loader
// ────────────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', padding: 'var(--g-space-3) var(--g-space-4)' }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--g-space-3)',
            padding: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-md)',
            background: 'var(--g-surface-muted)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--g-radius-sm)',
              background: 'var(--g-border-subtle)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: 10,
                width: '60%',
                borderRadius: 'var(--g-radius-sm)',
                background: 'var(--g-border-subtle)',
                marginBottom: 6,
              }}
            />
            <div
              style={{
                height: 8,
                width: '90%',
                borderRadius: 'var(--g-radius-sm)',
                background: 'var(--g-border-subtle)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function SmartSuggestions({
  projectId,
  context = 'dashboard',
  refreshInterval = 60000,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch suggestions ───────────────────────────────────
  const fetchSuggestions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, context }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('[SmartSuggestions] Failed to fetch:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, context]);

  // ── Initial load + interval ─────────────────────────────
  useEffect(() => {
    fetchSuggestions(false);

    intervalRef.current = setInterval(() => {
      fetchSuggestions(true);
    }, refreshInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSuggestions, refreshInterval]);

  // ── Dismiss a suggestion ────────────────────────────────
  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // ── Visible suggestions ─────────────────────────────────
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.id));

  // ── Render ──────────────────────────────────────────────
  return (
    <div
      className="g-card"
      style={{
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
          gap: 'var(--g-space-2)',
          padding: 'var(--g-space-3) var(--g-space-4)',
          borderBottom: '1px solid var(--g-border-subtle)',
        }}
      >
        <Lightbulb style={{ width: 14, height: 14, color: 'var(--status-warning)' }} />
        <span
          style={{
            fontWeight: 700,
            fontSize: 'var(--g-text-caption)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--g-brand-3308)',
          }}
        >
          Sugerencias IA
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--g-text-caption)',
            color: 'var(--g-text-muted)',
          }}
        >
          {visibleSuggestions.length > 0 ? `${visibleSuggestions.length} activas` : ''}
        </span>
        <button
          onClick={() => fetchSuggestions(true)}
          disabled={refreshing}
          aria-label="Actualizar sugerencias"
          style={{
            background: 'none',
            border: 'none',
            cursor: refreshing ? 'default' : 'pointer',
            padding: 'var(--g-space-1)',
            display: 'flex',
            alignItems: 'center',
            opacity: refreshing ? 0.5 : 1,
          }}
          title="Actualizar sugerencias"
        >
          <RefreshCw
            style={{
              width: 12,
              height: 12,
              color: 'var(--g-text-muted)',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Body */}
      {loading && suggestions.length === 0 ? (
        <SuggestionSkeleton />
      ) : visibleSuggestions.length === 0 ? (
        <div
          style={{
            padding: 'var(--g-space-6)',
            textAlign: 'center',
          }}
        >
          <Lightbulb
            style={{
              width: 24,
              height: 24,
              color: 'var(--g-text-muted)',
              margin: '0 auto',
              opacity: 0.5,
            }}
          />
          <p
            style={{
              color: 'var(--g-text-muted)',
              fontSize: 'var(--g-text-small)',
              marginTop: 'var(--g-space-2)',
            }}
          >
            {dismissed.size > 0
              ? 'Todas las sugerencias han sido descartadas'
              : 'Sin sugerencias pendientes'}
          </p>
          {dismissed.size > 0 && (
            <button
              onClick={() => setDismissed(new Set())}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--g-link)',
                fontSize: 'var(--g-text-caption)',
                fontWeight: 500,
                marginTop: 'var(--g-space-2)',
              }}
            >
              Mostrar descartadas
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--g-space-1)',
            padding: 'var(--g-space-2)',
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {visibleSuggestions.map(suggestion => {
            const IconComp = getSuggestionIcon(suggestion.icon);
            const pConfig = getPriorityConfig(suggestion.priority);

            return (
              <div
                key={suggestion.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--g-space-3)',
                  padding: 'var(--g-space-3)',
                  borderRadius: 'var(--g-radius-md)',
                  background: pConfig.bg,
                  borderLeft: `3px solid ${pConfig.border}`,
                  transition: 'var(--g-transition-fast)',
                  position: 'relative',
                }}
              >
                {/* Priority indicator + icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--g-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--g-surface-card)',
                    border: `1px solid ${pConfig.border}`,
                    marginTop: 2,
                  }}
                >
                  <IconComp style={{ width: 16, height: 16, color: pConfig.color }} />
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
                    {/* Priority badge */}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: pConfig.color,
                        background: 'var(--g-surface-card)',
                        border: `1px solid ${pConfig.border}`,
                        borderRadius: 'var(--g-radius-full)',
                        padding: '1px 6px',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {suggestion.priority}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--g-text-small)',
                        fontWeight: 600,
                        color: 'var(--g-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {suggestion.title}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--g-text-caption)',
                      color: 'var(--g-text-secondary)',
                      margin: 0,
                      lineHeight: 'var(--g-leading-normal)',
                    }}
                  >
                    {suggestion.description}
                  </p>

                  {/* Action link */}
                  <a
                    href={suggestion.action_url}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--g-space-1)',
                      marginTop: 'var(--g-space-2)',
                      fontSize: 'var(--g-text-caption)',
                      fontWeight: 600,
                      color: 'var(--g-link)',
                      textDecoration: 'none',
                      transition: 'var(--g-transition-fast)',
                    }}
                  >
                    Ir
                    <ChevronRight style={{ width: 12, height: 12 }} />
                  </a>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  aria-label="Descartar sugerencia"
                  style={{
                    position: 'absolute',
                    top: 'var(--g-space-2)',
                    right: 'var(--g-space-2)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 'var(--g-space-1)',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.4,
                    transition: 'var(--g-transition-fast)',
                  }}
                  title="Descartar sugerencia"
                >
                  <X style={{ width: 12, height: 12, color: 'var(--g-text-muted)' }} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading overlay during refresh */}
      {refreshing && visibleSuggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: 'var(--g-space-1)',
          }}
        >
          <Loader2
            style={{
              width: 12,
              height: 12,
              color: 'var(--g-text-muted)',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
