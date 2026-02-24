'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WorkerStatus, WorkerPhase, ExecutionMode, CycleMetrics, CoverageSnapshot } from '@/lib/worker/worker-controller';

// ============================================================================
// Types
// ============================================================================

export interface PhaseProgress {
  items_total: number;
  items_done: number;
  items_error: number;
  percentage: number;
}

export interface WorkerStatusData {
  run_id: string;
  project_id: string;
  status: WorkerStatus;
  current_phase: WorkerPhase | null;
  phase_progress: PhaseProgress;
  cycle_count: number;
  ai_budget: {
    total: number;
    used: number;
    remaining: number;
  };
  coverage: CoverageSnapshot;
  execution_mode: ExecutionMode;
  execution_config: {
    target_area?: string;
    target_fo?: string;
    coverage_threshold: number;
    docs_per_cycle: number;
  };
  work_queue_size: number;
  pending_items: number;
  metrics: CycleMetrics;
  timing: {
    started_at: string | null;
    last_heartbeat_at: string | null;
    completed_at: string | null;
    paused_at: string | null;
  };
  error_message: string | null;
}

export interface WorkerStatusResponse {
  success: boolean;
  data: WorkerStatusData | { status: 'not_started'; message: string };
  error?: string;
}

export interface UseWorkerStatusOptions {
  projectId: string;
  pollInterval?: number; // ms, default 5000
  enabled?: boolean;
}

export interface UseWorkerStatusReturn {
  status: WorkerStatusData | null;
  loading: boolean;
  error: string | null;
  notStarted: boolean;
  refetch: () => Promise<void>;
  startWorker: (options?: StartWorkerOptions) => Promise<void>;
  pauseWorker: (reason?: string) => Promise<void>;
  resumeWorker: () => Promise<void>;
}

export interface StartWorkerOptions {
  mode?: ExecutionMode;
  ai_budget_per_cycle?: number;
  docs_per_cycle?: number;
  coverage_threshold?: number;
  target_area?: string;
  target_objective_key?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dd_session_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkerStatus({
  projectId,
  pollInterval = 5000,
  enabled = true,
}: UseWorkerStatusOptions): UseWorkerStatusReturn {
  const [status, setStatus] = useState<WorkerStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notStarted, setNotStarted] = useState(false);

  // Fetch worker status
  const fetchStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await fetch(`/api/worker/status?project_id=${projectId}`, {
        headers: authHeaders(),
      });

      const json: WorkerStatusResponse = await res.json();

      if (!res.ok) {
        setError(json.error || 'Error fetching worker status');
        return;
      }

      if (json.success && json.data) {
        if ('status' in json.data && json.data.status === 'not_started') {
          setNotStarted(true);
          setStatus(null);
        } else {
          setNotStarted(false);
          setStatus(json.data as WorkerStatusData);
        }
        setError(null);
      }
    } catch (err) {
      console.error('[useWorkerStatus] Fetch error:', err);
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      setLoading(true);
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Polling
  useEffect(() => {
    if (!enabled || !pollInterval) return;

    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [enabled, pollInterval, fetchStatus]);

  // Start worker
  const startWorker = useCallback(
    async (options: StartWorkerOptions = {}) => {
      try {
        setLoading(true);
        const res = await fetch('/api/worker/start', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            project_id: projectId,
            mode: options.mode || 'continuous',
            ai_budget_per_cycle: options.ai_budget_per_cycle,
            docs_per_cycle: options.docs_per_cycle,
            coverage_threshold: options.coverage_threshold,
            target_area: options.target_area,
            target_objective_key: options.target_objective_key,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Error starting worker');
        }

        // Refetch status after starting
        await fetchStatus();
      } catch (err) {
        console.error('[useWorkerStatus] Start error:', err);
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId, fetchStatus]
  );

  // Pause worker
  const pauseWorker = useCallback(
    async (reason: string = 'User requested pause') => {
      try {
        setLoading(true);
        const res = await fetch('/api/worker/pause', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            project_id: projectId,
            reason,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Error pausing worker');
        }

        // Refetch status after pausing
        await fetchStatus();
      } catch (err) {
        console.error('[useWorkerStatus] Pause error:', err);
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId, fetchStatus]
  );

  // Resume worker
  const resumeWorker = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/worker/resume', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          project_id: projectId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error resuming worker');
      }

      // Refetch status after resuming
      await fetchStatus();
    } catch (err) {
      console.error('[useWorkerStatus] Resume error:', err);
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchStatus]);

  return {
    status,
    loading,
    error,
    notStarted,
    refetch: fetchStatus,
    startWorker,
    pauseWorker,
    resumeWorker,
  };
}
