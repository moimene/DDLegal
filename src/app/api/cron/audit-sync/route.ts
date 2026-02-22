import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getHarveyGateway } from '@/lib/harvey';
import type { GatewayTelemetry, HarveyHistoryEntry } from '@/lib/harvey';

/**
 * GET /api/cron/audit-sync
 *
 * Vercel Cron job (every 15 minutes) that syncs Harvey Gateway telemetry
 * to the `dd_gateway_telemetry` table. Two sync sources:
 *
 *   1. In-memory telemetry log from the HarveyGateway singleton
 *   2. Harvey audit history API (last 1 hour, de-duplicated by request_id)
 *
 * Protected by CRON_SECRET env var (Vercel injects Authorization header).
 */
export async function GET(req: NextRequest) {
  // ── Auth: verify CRON_SECRET ──────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CronSync] CRON_SECRET env var not configured');
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  let memSynced = 0;
  let historySynced = 0;
  const errors: string[] = [];

  // ── Source 1: In-memory telemetry log ─────────────────────
  try {
    const gateway = getHarveyGateway();
    const telemetryEntries = gateway.getTelemetry();

    if (telemetryEntries.length > 0) {
      // Collect request_ids to de-duplicate against DB
      const requestIds = telemetryEntries.map((e: GatewayTelemetry) => e.request_id);

      const { data: existing } = await supabaseAdmin
        .from('dd_gateway_telemetry')
        .select('request_id')
        .in('request_id', requestIds);

      const existingIds = new Set(
        (existing || []).map((r: { request_id: string }) => r.request_id)
      );

      const newEntries = telemetryEntries.filter(
        (e: GatewayTelemetry) => !existingIds.has(e.request_id)
      );

      if (newEntries.length > 0) {
        const rows = newEntries.map((entry: GatewayTelemetry) => ({
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

        const { error: insertError } = await supabaseAdmin
          .from('dd_gateway_telemetry')
          .insert(rows);

        if (insertError) {
          errors.push(`Memory sync insert failed: ${insertError.message}`);
        } else {
          memSynced = newEntries.length;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Memory sync error: ${message}`);
  }

  // ── Source 2: Harvey audit history API (last 1 hour) ──────
  try {
    const gateway = getHarveyGateway();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const result = await gateway.queryHistory({
      start_date: since,
      end_date: new Date().toISOString(),
      limit: 200,
    });

    if (result.entries.length > 0) {
      const entryIds = result.entries.map((e: HarveyHistoryEntry) => e.id);

      const { data: existing } = await supabaseAdmin
        .from('dd_gateway_telemetry')
        .select('request_id')
        .in('request_id', entryIds);

      const existingIds = new Set(
        (existing || []).map((r: { request_id: string }) => r.request_id)
      );

      const newEntries = result.entries.filter(
        (e: HarveyHistoryEntry) => !existingIds.has(e.id)
      );

      if (newEntries.length > 0) {
        const rows = newEntries.map((entry: HarveyHistoryEntry) => ({
          request_id: entry.id,
          endpoint: `harvey/${entry.type}`,
          method: 'POST',
          status_code: entry.status === 'success' ? 200 : entry.status === 'error' ? 500 : 0,
          duration_ms: entry.duration_ms,
          retries: 0,
          client_matter_id: entry.client_matter_id || null,
          feature_flag: 'gateway',
          error_message: entry.status !== 'success' ? `Harvey status: ${entry.status}` : null,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('dd_gateway_telemetry')
          .insert(rows);

        if (insertError) {
          errors.push(`History sync insert failed: ${insertError.message}`);
        } else {
          historySynced = newEntries.length;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Harvey history endpoint may not be configured — non-fatal
    errors.push(`History sync error: ${message}`);
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  console.log(
    `[CronSync] Completed in ${duration}ms — mem:${memSynced} history:${historySynced} errors:${errors.length}`
  );

  return NextResponse.json({
    success,
    synced: {
      memory: memSynced,
      history: historySynced,
      total: memSynced + historySynced,
    },
    duration_ms: duration,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}
