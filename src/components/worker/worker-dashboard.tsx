'use client';

/**
 * WorkerDashboard — Main dashboard for DD Worker monitoring and control
 *
 * Features:
 * - Worker status display with appropriate icons
 * - Start/Pause/Resume controls
 * - Coverage visualization
 * - Metrics cards
 * - Phase progress indicator
 * - Error display
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Loader2,
  CheckCircle,
  Pause,
  AlertCircle,
  Play,
  RefreshCw,
  Activity,
  FileText,
  Target,
  Zap,
  BarChart3,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCachedDateTimeFormatter } from '@/lib/utils';
import { useWorkerStatus } from '@/hooks/use-worker-status';
import { CoverageChart } from '@/components/worker/coverage-chart';
import type { WorkerStatus } from '@/lib/worker/worker-controller';

// ============================================================================
// Types & Config
// ============================================================================

interface WorkerDashboardProps {
  projectId: string;
}

const STATUS_CONFIG: Record<
  WorkerStatus | 'not_started',
  { label: string; color: string; bgColor: string; Icon: typeof Clock }
> = {
  not_started: {
    label: 'Sin iniciar',
    color: 'var(--g-text-secondary)',
    bgColor: 'var(--g-surface-muted)',
    Icon: Clock,
  },
  idle: {
    label: 'Inactivo',
    color: 'var(--g-text-secondary)',
    bgColor: 'var(--g-surface-muted)',
    Icon: Clock,
  },
  sensing: {
    label: 'Detectando',
    color: 'var(--status-info)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    Icon: Loader2,
  },
  normalizing: {
    label: 'Normalizando',
    color: 'var(--status-info)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    Icon: Loader2,
  },
  evaluating: {
    label: 'Evaluando',
    color: 'var(--status-info)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    Icon: Loader2,
  },
  concluding: {
    label: 'Concluyendo',
    color: 'var(--status-info)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    Icon: Loader2,
  },
  completed: {
    label: 'Completado',
    color: 'var(--status-success)',
    bgColor: 'rgba(0, 154, 119, 0.1)',
    Icon: CheckCircle,
  },
  paused: {
    label: 'Pausado',
    color: 'var(--status-warning)',
    bgColor: 'rgba(230, 168, 23, 0.1)',
    Icon: Pause,
  },
  error: {
    label: 'Error',
    color: 'var(--status-error)',
    bgColor: 'var(--g-priority-p0-bg)',
    Icon: AlertCircle,
  },
};

const PHASE_LABELS: Record<string, string> = {
  sense: 'Deteccion',
  normalize: 'Normalizacion',
  evaluate: 'Evaluacion',
  conclude: 'Conclusion',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  return getCachedDateTimeFormatter('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// ============================================================================
// WorkerDashboard Component
// ============================================================================

export function WorkerDashboard({ projectId }: WorkerDashboardProps) {
  const {
    status,
    loading,
    error,
    notStarted,
    refetch,
    startWorker,
    pauseWorker,
    resumeWorker,
  } = useWorkerStatus({
    projectId,
    pollInterval: 5000,
    enabled: true,
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Determine current status key for config lookup
  const statusKey: WorkerStatus | 'not_started' = notStarted
    ? 'not_started'
    : status?.status || 'idle';
  const statusConfig = STATUS_CONFIG[statusKey];
  const StatusIcon = statusConfig.Icon;
  const isSpinning = ['sensing', 'normalizing', 'evaluating', 'concluding'].includes(statusKey);

  // Action handlers
  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startWorker({ mode: 'continuous' });
      toast.success('Worker iniciado correctamente');
    } catch (err) {
      toast.error((err as Error).message || 'Error al iniciar el worker');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await pauseWorker('User requested pause');
      toast.success('Worker pausado');
    } catch (err) {
      toast.error((err as Error).message || 'Error al pausar el worker');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await resumeWorker();
      toast.success('Worker reanudado');
    } catch (err) {
      toast.error((err as Error).message || 'Error al reanudar el worker');
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state
  if (loading && !status && !notStarted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
        <Header projectId={projectId} />
        <div
          className="flex items-center justify-center py-20"
          style={{
            backgroundColor: 'var(--g-surface-card)',
            borderRadius: 'var(--g-radius-lg)',
            border: '1px solid var(--g-border-default)',
          }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !status && !notStarted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
        <Header projectId={projectId} />
        <div
          className="flex flex-col items-center justify-center py-20"
          style={{
            backgroundColor: 'var(--g-surface-card)',
            borderRadius: 'var(--g-radius-lg)',
            border: '1px solid var(--g-border-default)',
          }}
        >
          <AlertCircle className="h-10 w-10 mb-3" style={{ color: 'var(--status-error)' }} />
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--g-text-primary)' }}>
            Error al cargar el estado del worker
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--g-text-secondary)' }}>
            {error}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
            style={{
              borderRadius: 'var(--g-radius-md)',
              backgroundColor: 'var(--g-brand-3308)',
              color: 'var(--g-text-inverse)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Not started state
  if (notStarted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
        <Header projectId={projectId} />
        <div
          className="flex flex-col items-center justify-center py-20"
          style={{
            backgroundColor: 'var(--g-surface-card)',
            borderRadius: 'var(--g-radius-lg)',
            border: '1px solid var(--g-border-default)',
          }}
        >
          <Activity className="h-16 w-16 mb-4" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--g-text-primary)' }}>
            Worker no iniciado
          </p>
          <p
            className="text-sm mb-6 text-center"
            style={{ color: 'var(--g-text-secondary)', maxWidth: 400 }}
          >
            El DD Worker aun no ha sido ejecutado para este proyecto.
            Inicie el worker para comenzar el analisis automatizado de documentos.
          </p>
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{
              borderRadius: 'var(--g-radius-md)',
              backgroundColor: 'var(--g-brand-3308)',
              color: 'var(--g-text-inverse)',
            }}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {actionLoading ? 'Iniciando...' : 'Iniciar Worker'}
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard with status data
  return (
    <div
      className="animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm mb-3"
            style={{ color: 'var(--g-link)' }}
          >
            <ArrowLeft className="h-4 w-4" /> Proyecto
          </Link>
          <h1
            className="font-bold"
            style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
          >
            DD Worker
          </h1>
          {status?.timing.started_at && (
            <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
              Iniciado: {formatDate(status.timing.started_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            style={{
              borderRadius: 'var(--g-radius-md)',
              border: '1px solid var(--g-border-default)',
              backgroundColor: 'var(--g-surface-card)',
              color: 'var(--g-text-primary)',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Status Card with Controls */}
      <div className="grid grid-cols-12 gap-5">
        {/* Status */}
        <div className="col-span-12 lg:col-span-4">
          <div
            style={{
              backgroundColor: 'var(--g-surface-card)',
              borderRadius: 'var(--g-radius-lg)',
              border: '1px solid var(--g-border-default)',
              padding: 'var(--g-space-5)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--g-space-4)',
            }}
          >
            {/* Status Icon */}
            <div
              className="p-4"
              style={{
                borderRadius: '50%',
                backgroundColor: statusConfig.bgColor,
              }}
            >
              <StatusIcon
                className={`h-12 w-12 ${isSpinning ? 'animate-spin' : ''}`}
                style={{ color: statusConfig.color }}
              />
            </div>

            {/* Status Label */}
            <div className="text-center">
              <p className="text-xl font-bold mb-1" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </p>
              {status?.current_phase && (
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                  Fase: {PHASE_LABELS[status.current_phase] || status.current_phase}
                </p>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2 mt-2">
              {(statusKey === 'idle' || statusKey === 'completed' || statusKey === 'error') && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--g-brand-3308)',
                    color: 'var(--g-text-inverse)',
                  }}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Iniciar
                </button>
              )}

              {['sensing', 'normalizing', 'evaluating', 'concluding'].includes(statusKey) && (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--status-warning)',
                    color: 'var(--g-text-inverse)',
                  }}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  Pausar
                </button>
              )}

              {statusKey === 'paused' && (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: 'var(--status-success)',
                    color: 'var(--g-text-inverse)',
                  }}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Reanudar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="col-span-12 lg:col-span-8">
          <div
            style={{
              backgroundColor: 'var(--g-surface-card)',
              borderRadius: 'var(--g-radius-lg)',
              border: '1px solid var(--g-border-default)',
              padding: 'var(--g-space-5)',
              height: '100%',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                Progreso de Fase
              </h2>
            </div>

            {status?.phase_progress ? (
              <div>
                {/* Progress Bar */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                    {status.phase_progress.items_done} / {status.phase_progress.items_total} elementos
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                    {status.phase_progress.percentage}%
                  </span>
                </div>
                <div
                  className="w-full h-2 mb-4"
                  style={{
                    borderRadius: 'var(--g-radius-full)',
                    backgroundColor: 'var(--g-surface-muted)',
                  }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${status.phase_progress.percentage}%`,
                      borderRadius: 'var(--g-radius-full)',
                      backgroundColor: 'var(--g-brand-3308)',
                    }}
                  />
                </div>

                {status.phase_progress.items_error > 0 && (
                  <p className="text-xs" style={{ color: 'var(--status-error)' }}>
                    {status.phase_progress.items_error} elementos con error
                  </p>
                )}

                {/* Phase Indicators */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--g-border-default)' }}>
                  {['sense', 'normalize', 'evaluate', 'conclude'].map((phase, idx) => {
                    const isActive = status.current_phase === phase;
                    const isPast =
                      status.current_phase &&
                      ['sense', 'normalize', 'evaluate', 'conclude'].indexOf(phase) <
                        ['sense', 'normalize', 'evaluate', 'conclude'].indexOf(status.current_phase);

                    return (
                      <div key={phase} className="flex items-center">
                        <div
                          className="flex items-center justify-center w-8 h-8 text-xs font-bold"
                          style={{
                            borderRadius: '50%',
                            backgroundColor: isActive
                              ? 'var(--g-brand-3308)'
                              : isPast
                              ? 'var(--status-success)'
                              : 'var(--g-surface-muted)',
                            color: isActive || isPast ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                          }}
                        >
                          {isPast ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                        </div>
                        {idx < 3 && (
                          <div
                            className="w-12 lg:w-20 h-0.5 mx-1"
                            style={{
                              backgroundColor: isPast
                                ? 'var(--status-success)'
                                : 'var(--g-border-default)',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2">
                  {['Deteccion', 'Normalizacion', 'Evaluacion', 'Conclusion'].map((label) => (
                    <span
                      key={label}
                      className="text-xs w-16 text-center"
                      style={{ color: 'var(--g-text-secondary)' }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                  Sin datos de progreso disponibles
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      {status?.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            icon={<RefreshCw className="h-4 w-4" />}
            label="Ciclos"
            value={status.cycle_count}
          />
          <MetricCard
            icon={<FileText className="h-4 w-4" />}
            label="Docs Normalizados"
            value={status.metrics.docs_normalized}
          />
          <MetricCard
            icon={<Target className="h-4 w-4" />}
            label="FOs Evaluados"
            value={status.metrics.fos_evaluated}
          />
          <MetricCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Findings Creados"
            value={status.metrics.findings_created}
          />
          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label="AI Calls"
            value={status.metrics.ai_calls_total}
            subvalue={`${status.ai_budget.remaining} restantes`}
          />
          <MetricCard
            icon={<Timer className="h-4 w-4" />}
            label="Duracion Total"
            value={formatDuration(status.metrics.duration_ms)}
          />
        </div>
      )}

      {/* Coverage Chart */}
      {status?.coverage && <CoverageChart coverage={status.coverage} />}

      {/* Error Message */}
      {status?.error_message && (
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--g-priority-p0-bg)',
            borderRadius: 'var(--g-radius-lg)',
            border: '1px solid var(--status-error)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--status-error)' }} />
            <div>
              <p className="font-medium text-sm mb-1" style={{ color: 'var(--status-error)' }}>
                Error del Worker
              </p>
              <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                {status.error_message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timing Information */}
      {status?.timing && (
        <div
          style={{
            backgroundColor: 'var(--g-surface-card)',
            borderRadius: 'var(--g-radius-lg)',
            border: '1px solid var(--g-border-default)',
            padding: 'var(--g-space-4)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Timer className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--g-text-primary)' }}>
              Tiempos
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                Iniciado
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                {formatDate(status.timing.started_at)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                Ultimo heartbeat
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                {formatDate(status.timing.last_heartbeat_at)}
              </p>
            </div>
            {status.timing.completed_at && (
              <div>
                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                  Completado
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--status-success)' }}>
                  {formatDate(status.timing.completed_at)}
                </p>
              </div>
            )}
            {status.timing.paused_at && (
              <div>
                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                  Pausado
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--status-warning)' }}>
                  {formatDate(status.timing.paused_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Header({ projectId }: { projectId: string }) {
  return (
    <div>
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm mb-3"
        style={{ color: 'var(--g-link)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Proyecto
      </Link>
      <h1
        className="font-bold"
        style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}
      >
        DD Worker
      </h1>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subvalue?: string;
}

function MetricCard({ icon, label, value, subvalue }: MetricCardProps) {
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: 'var(--g-surface-card)',
        borderRadius: 'var(--g-radius-md)',
        border: '1px solid var(--g-border-default)',
      }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--g-brand-3308)' }}>
        {icon}
        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>
          {label}
        </span>
      </div>
      <p className="text-xl font-bold" style={{ color: 'var(--g-text-primary)' }}>
        {value}
      </p>
      {subvalue && (
        <p className="text-xs mt-1" style={{ color: 'var(--g-text-muted)' }}>
          {subvalue}
        </p>
      )}
    </div>
  );
}

export default WorkerDashboard;
