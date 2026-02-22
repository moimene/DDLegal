import { NextResponse } from 'next/server';
import { getHarveyGateway, GatewayHealth } from '@/lib/harvey';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// SLO computation helper (shared logic, avoids duplication with /api/observability/slo)
// ---------------------------------------------------------------------------

interface SloMetrics {
  total: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  error_rate_pct: number;
}

interface TelemetryRow {
  duration_ms: number;
  status_code: number;
  retries: number;
  created_at: string;
}

function computeSloMetrics(entries: TelemetryRow[]): SloMetrics {
  const total = entries.length;

  if (total === 0) {
    return { total: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0, error_rate_pct: 0 };
  }

  const latencies = entries
    .map((e) => e.duration_ms)
    .sort((a: number, b: number) => a - b);

  const p50 = latencies[Math.floor(total * 0.5)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const p99 = latencies[Math.floor(total * 0.99)];

  const countErrors = entries.filter((e) => e.status_code >= 400).length;
  const error_rate_pct = Math.round((countErrors / total) * 10000) / 100;

  return { total, p50_ms: p50, p95_ms: p95, p99_ms: p99, error_rate_pct };
}

// ---------------------------------------------------------------------------
// SLO thresholds
// ---------------------------------------------------------------------------

const P95_TARGET_MS = 30000;
const ERROR_RATE_TARGET_PCT = 5;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface SloThresholds {
  p95_target_ms: number;
  error_rate_target_pct: number;
  p95_ok: boolean;
  error_rate_ok: boolean;
}

type HealthResponse = (GatewayHealth | { status: 'down'; error: string }) & {
  slo: { last_hour: SloMetrics; last_24h: SloMetrics } | null;
  thresholds: SloThresholds | null;
};

// ---------------------------------------------------------------------------
// GET /api/gateway/health
// ---------------------------------------------------------------------------

export async function GET() {
  // 1. Existing gateway health check
  let health: GatewayHealth | { status: 'down'; error: string };
  let httpStatus: number;

  try {
    const gateway = getHarveyGateway();
    health = gateway.getHealth();
    httpStatus = health.status === 'down' ? 503 : 200;
  } catch {
    health = { status: 'down', error: 'Gateway not initialized' };
    httpStatus = 503;
  }

  // 2. Real-time SLO metrics from dd_gateway_telemetry
  let slo: { last_hour: SloMetrics; last_24h: SloMetrics } | null = null;
  let thresholds: SloThresholds | null = null;

  try {
    const now = Date.now();
    const since1h = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Fetch last 24h of telemetry (superset that covers both windows)
    const { data: telemetry, error } = await supabaseAdmin
      .from('dd_gateway_telemetry')
      .select('duration_ms, status_code, retries, created_at')
      .gte('created_at', since24h)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const allEntries: TelemetryRow[] = (telemetry as TelemetryRow[]) || [];

    // Split into 1h and 24h windows
    const entries1h = allEntries.filter((e) => e.created_at >= since1h);

    const last_hour = computeSloMetrics(entries1h);
    const last_24h = computeSloMetrics(allEntries);

    slo = { last_hour, last_24h };
    thresholds = {
      p95_target_ms: P95_TARGET_MS,
      error_rate_target_pct: ERROR_RATE_TARGET_PCT,
      p95_ok: last_hour.p95_ms <= P95_TARGET_MS,
      error_rate_ok: last_hour.error_rate_pct <= ERROR_RATE_TARGET_PCT,
    };
  } catch {
    // Telemetry query failed — degrade gracefully
    slo = null;
    thresholds = null;
  }

  const response: HealthResponse = { ...health, slo, thresholds };
  return NextResponse.json(response, { status: httpStatus });
}
