import { supabaseAdmin } from '@/lib/supabase-admin';
import type { GatewayTelemetry } from '@/lib/harvey';

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
let buffer: GatewayTelemetry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function recordTelemetry(entry: GatewayTelemetry): void {
  buffer.push(entry);
  if (buffer.length >= BATCH_SIZE) {
    flushTelemetry();
  }
  if (!flushTimer) {
    flushTimer = setInterval(flushTelemetry, FLUSH_INTERVAL_MS);
  }
}

export async function flushTelemetry(): Promise<void> {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0, BATCH_SIZE);

  const rows = batch.map(entry => ({
    request_id: entry.request_id,
    endpoint: entry.endpoint,
    method: 'POST',
    status_code: entry.status_code,
    duration_ms: entry.duration_ms,
    retries: entry.retries,
    client_matter_id: entry.client_matter_id || null,
    feature_flag: process.env.HARVEY_FEATURE_FLAG || 'gateway',
    error_message: entry.status_code >= 400 ? `HTTP ${entry.status_code}` : null,
  }));

  const { error } = await supabaseAdmin
    .from('dd_gateway_telemetry')
    .insert(rows);

  if (error) {
    console.error('[Telemetry] Write failed:', error.message);
  }
}

export function stopTelemetryWriter(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushTelemetry();
}
