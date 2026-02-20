'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  RefreshCw,
  Database,
  Wifi,
  Bot,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import StatusIndicator from '@/components/configuracion/status-indicator';

interface HealthData {
  success: boolean;
  timestamp: string;
  response_time_ms: number;
  supabase: {
    connected: boolean;
    latency_ms: number;
    error: string | null;
    url: string | null;
  };
  database: {
    tables: { table: string; count: number; error: string | null }[];
    total_rows: number;
    migrations: { version: string; name: string }[];
  };
  n8n: {
    configured: boolean;
    url: string | null;
    reachable: boolean;
    latency_ms: number;
    error: string | null;
  };
  environment: { key: string; configured: boolean; category: string }[];
  api_routes: { path: string; method: string; description: string }[];
  tools: {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
  }[];
  skills: {
    id: string;
    skill_key: string;
    name: string;
    is_active: boolean;
    version: number;
    category: string;
  }[];
  executions: { total: number; by_status: Record<string, number> };
  system: { node_env: string };
}

export default function ConfiguracionPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: HealthData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const envConfigured = data
    ? data.environment.filter((e) => e.configured).length
    : 0;

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (error && !data) {
    return (
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--g-space-4)',
          padding: 'var(--g-space-12)',
        }}
      >
        <XCircle
          size={40}
          style={{ color: 'var(--status-error)' }}
          aria-hidden="true"
        />
        <p
          style={{
            color: 'var(--g-text-primary)',
            fontSize: 'var(--g-text-body-lg)',
            fontWeight: 600,
          }}
        >
          No se pudo conectar con el sistema
        </p>
        <p style={{ color: 'var(--g-text-secondary)', fontSize: 'var(--g-text-body)' }}>
          {error}
        </p>
        <button
          onClick={fetchHealth}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-2)',
            padding: 'var(--g-space-2) var(--g-space-5)',
            borderRadius: 'var(--g-radius-md)',
            backgroundColor: 'var(--g-brand-3308)',
            color: 'var(--g-text-inverse)',
            fontSize: 'var(--g-text-body)',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
          <Settings size={22} style={{ color: 'var(--g-brand-3308)' }} aria-hidden="true" />
          <div>
            <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
              Estado del Sistema
            </h1>
            <p
              style={{
                color: 'var(--g-text-secondary)',
                fontSize: 'var(--g-text-body)',
                marginTop: '2px',
              }}
            >
              Monitoreo de servicios, base de datos y configuracion
            </p>
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-2)',
            padding: 'var(--g-space-2) var(--g-space-5)',
            borderRadius: 'var(--g-radius-md)',
            backgroundColor: 'var(--g-brand-3308)',
            color: 'var(--g-text-inverse)',
            fontSize: 'var(--g-text-body)',
            fontWeight: 500,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity var(--g-transition-fast)',
          }}
        >
          <RefreshCw
            size={14}
            className={loading ? 'animate-spin' : undefined}
            aria-hidden="true"
          />
          Actualizar
        </button>
      </div>

      {/* ── KPI Strip ── */}
      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--g-space-4)',
          }}
        >
          {/* Supabase */}
          <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
            <p
              style={{
                color: 'var(--g-text-muted)',
                fontSize: 'var(--g-text-small)',
                marginBottom: 'var(--g-space-2)',
              }}
            >
              Supabase
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--g-radius-full)',
                  backgroundColor: data.supabase.connected
                    ? 'var(--status-success)'
                    : 'var(--status-error)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                {data.supabase.latency_ms} ms
              </span>
            </div>
          </div>

          {/* n8n Webhooks */}
          <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
            <p
              style={{
                color: 'var(--g-text-muted)',
                fontSize: 'var(--g-text-small)',
                marginBottom: 'var(--g-space-2)',
              }}
            >
              n8n Webhooks
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--g-radius-full)',
                  backgroundColor: data.n8n.reachable
                    ? 'var(--status-success)'
                    : 'var(--status-error)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
                {data.n8n.reachable ? 'Alcanzable' : 'Inalcanzable'}
              </span>
            </div>
          </div>

          {/* Base de Datos */}
          <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
            <p
              style={{
                color: 'var(--g-text-muted)',
                fontSize: 'var(--g-text-small)',
                marginBottom: 'var(--g-space-2)',
              }}
            >
              Base de Datos
            </p>
            <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
              {data.database.total_rows.toLocaleString()} filas
            </span>
          </div>

          {/* Entorno */}
          <div className="g-card" style={{ padding: 'var(--g-space-5)' }}>
            <p
              style={{
                color: 'var(--g-text-muted)',
                fontSize: 'var(--g-text-small)',
                marginBottom: 'var(--g-space-2)',
              }}
            >
              Entorno
            </p>
            <span style={{ fontSize: 'var(--g-text-h3)', fontWeight: 600, color: 'var(--g-text-primary)' }}>
              {envConfigured}/{data.environment.length} configuradas
            </span>
          </div>
        </div>
      )}

      {/* ── Main Content: 2-column grid ── */}
      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr',
            gap: 'var(--g-space-5)',
          }}
        >
          {/* ── Left Column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Servicios Principales */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Servicios Principales
              </div>
              <div>
                {/* Supabase row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                    gap: 'var(--g-space-3)',
                  }}
                >
                  <Database size={18} style={{ color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                      Supabase
                    </p>
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)' }}>
                      {data.supabase.url || 'URL no configurada'}
                    </p>
                  </div>
                  <StatusIndicator
                    status={data.supabase.connected ? 'ok' : 'error'}
                    detail={`${data.supabase.latency_ms}ms`}
                  />
                </div>

                {/* n8n row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    borderBottom: '1px solid var(--g-border-subtle)',
                    gap: 'var(--g-space-3)',
                  }}
                >
                  <Wifi size={18} style={{ color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                      n8n
                    </p>
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)' }}>
                      {data.n8n.url || 'URL no configurada'}
                    </p>
                  </div>
                  <StatusIndicator
                    status={
                      !data.n8n.configured
                        ? 'unconfigured'
                        : data.n8n.reachable
                          ? 'ok'
                          : 'error'
                    }
                    detail={data.n8n.reachable ? `${data.n8n.latency_ms}ms` : undefined}
                  />
                </div>

                {/* Harvey AI row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--g-space-4) var(--g-space-5)',
                    gap: 'var(--g-space-3)',
                  }}
                >
                  <Bot size={18} style={{ color: 'var(--g-brand-3308)', flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--g-text-primary)', fontSize: 'var(--g-text-body)' }}>
                      Harvey AI
                    </p>
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-small)' }}>
                      Modelo de IA legal
                    </p>
                  </div>
                  <StatusIndicator
                    status={
                      data.environment.find((e) => e.key === 'HARVEY_API_KEY')?.configured
                        ? 'ok'
                        : 'unconfigured'
                    }
                  />
                </div>
              </div>
            </div>

            {/* Variables de Entorno */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Variables de Entorno
              </div>
              <div>
                {data.environment.map((env, i) => (
                  <div
                    key={env.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--g-space-3) var(--g-space-5)',
                      borderBottom:
                        i < data.environment.length - 1
                          ? '1px solid var(--g-border-subtle)'
                          : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--g-text-small)',
                        color: 'var(--g-text-primary)',
                      }}
                    >
                      {env.key}
                    </span>
                    {env.configured ? (
                      <CheckCircle2
                        size={16}
                        style={{ color: 'var(--status-success)' }}
                        aria-label="Configurada"
                      />
                    ) : (
                      <XCircle
                        size={16}
                        style={{ color: 'var(--status-error)' }}
                        aria-label="No configurada"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rutas API */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Rutas API
              </div>
              <div>
                {data.api_routes.map((route, i) => (
                  <div
                    key={`${route.method}-${route.path}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--g-space-3)',
                      padding: 'var(--g-space-3) var(--g-space-5)',
                      borderBottom:
                        i < data.api_routes.length - 1
                          ? '1px solid var(--g-border-subtle)'
                          : 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '44px',
                        padding: '2px 8px',
                        borderRadius: 'var(--g-radius-full)',
                        fontSize: 'var(--g-text-caption)',
                        fontWeight: 600,
                        backgroundColor:
                          route.method === 'GET'
                            ? 'hsla(217, 91%, 60%, 0.12)'
                            : 'hsla(160, 100%, 30%, 0.12)',
                        color:
                          route.method === 'GET'
                            ? 'var(--status-info)'
                            : 'var(--status-success)',
                      }}
                    >
                      {route.method}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--g-text-small)',
                        color: 'var(--g-text-primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {route.path}
                    </span>
                    <span
                      style={{
                        color: 'var(--g-text-muted)',
                        fontSize: 'var(--g-text-small)',
                        flex: 1,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {route.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
            {/* Base de Datos */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Base de Datos
              </div>
              <div>
                {data.database.tables.map((t, i) => (
                  <div
                    key={t.table}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--g-space-3) var(--g-space-5)',
                      borderBottom:
                        i < data.database.tables.length - 1
                          ? '1px solid var(--g-border-subtle)'
                          : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--g-text-small)',
                        color: 'var(--g-text-primary)',
                      }}
                    >
                      {t.table}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--g-text-small)',
                        fontWeight: 500,
                        color: t.count > 0 ? 'var(--g-text-primary)' : 'var(--g-text-muted)',
                      }}
                    >
                      {t.count.toLocaleString()}
                    </span>
                  </div>
                ))}
                {/* Total row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--g-space-3) var(--g-space-5)',
                    borderTop: '1px solid var(--g-border-default)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--g-text-small)',
                      fontWeight: 600,
                      color: 'var(--g-text-primary)',
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--g-text-small)',
                      fontWeight: 600,
                      color: 'var(--g-text-primary)',
                    }}
                  >
                    {data.database.total_rows.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Migraciones */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Migraciones
              </div>
              <div>
                {data.database.migrations.length === 0 ? (
                  <div style={{ padding: 'var(--g-space-5)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--g-text-muted)', fontSize: 'var(--g-text-body)' }}>
                      Sin migraciones registradas
                    </p>
                  </div>
                ) : (
                  data.database.migrations.map((m, i) => (
                    <div
                      key={m.version}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-3)',
                        padding: 'var(--g-space-3) var(--g-space-5)',
                        borderBottom:
                          i < data.database.migrations.length - 1
                            ? '1px solid var(--g-border-subtle)'
                            : 'none',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          fontFamily: 'monospace',
                          fontSize: 'var(--g-text-caption)',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--g-radius-md)',
                          backgroundColor: 'var(--g-surface-muted)',
                          color: 'var(--g-text-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.version}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--g-text-small)',
                          color: 'var(--g-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ejecuciones */}
            <div className="g-card">
              <div
                className="g-section-label"
                style={{
                  padding: 'var(--g-space-4) var(--g-space-5)',
                  borderBottom: '1px solid var(--g-border-subtle)',
                }}
              >
                Ejecuciones
              </div>
              <div style={{ padding: 'var(--g-space-4) var(--g-space-5)' }}>
                <p
                  style={{
                    fontSize: 'var(--g-text-h3)',
                    fontWeight: 600,
                    color: 'var(--g-text-primary)',
                    marginBottom: 'var(--g-space-3)',
                  }}
                >
                  {data.executions.total.toLocaleString()} total
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                  {Object.entries(data.executions.by_status).map(([status, count]) => (
                    <div
                      key={status}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: getExecutionStatusColor(status),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 'var(--g-text-small)', color: 'var(--g-text-secondary)', textTransform: 'capitalize' }}>
                          {status}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--g-text-small)',
                          fontWeight: 500,
                          color: 'var(--g-text-primary)',
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getExecutionStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'success':
      return 'var(--status-success)';
    case 'error':
    case 'failed':
      return 'var(--status-error)';
    case 'running':
    case 'in_progress':
      return 'var(--status-info)';
    case 'pending':
    case 'queued':
      return 'var(--status-warning)';
    default:
      return 'var(--g-text-muted)';
  }
}

function LoadingSkeleton() {
  return (
    <div
      className="animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-8)' }}
    >
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
          <div className="skeleton" style={{ height: '28px', width: '240px', borderRadius: 'var(--g-radius-md)' }} />
          <div className="skeleton" style={{ height: '16px', width: '320px', borderRadius: 'var(--g-radius-md)' }} />
        </div>
        <div className="skeleton" style={{ height: '36px', width: '120px', borderRadius: 'var(--g-radius-md)' }} />
      </div>

      {/* KPI strip skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--g-space-4)' }}>
        <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--g-radius-lg)' }} />
        <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--g-radius-lg)' }} />
        <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--g-radius-lg)' }} />
        <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--g-radius-lg)' }} />
      </div>

      {/* Main content skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--g-space-5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
          <div className="skeleton" style={{ height: '220px', borderRadius: 'var(--g-radius-lg)' }} />
          <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--g-radius-lg)' }} />
          <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--g-radius-lg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)' }}>
          <div className="skeleton" style={{ height: '280px', borderRadius: 'var(--g-radius-lg)' }} />
          <div className="skeleton" style={{ height: '160px', borderRadius: 'var(--g-radius-lg)' }} />
        </div>
      </div>
    </div>
  );
}
