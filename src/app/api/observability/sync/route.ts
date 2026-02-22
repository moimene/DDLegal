import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { getHarveyGateway } from '@/lib/harvey';
import { emitEvent } from '@/lib/events';
import type { HarveyHistoryEntry } from '@/lib/harvey';

/**
 * POST /api/observability/sync
 *
 * Trigger a sync of Harvey audit history into dd_gateway_telemetry.
 * Fetches the last 24h of history from Harvey and inserts entries
 * that don't already exist (de-duplicated by request_id).
 *
 * Body (optional):
 *   - project_id (required) — for permission check
 *   - hours      — lookback window in hours (default 24, max 168)
 *
 * Requires: can_manage_roles (clo, pm_transaccion only)
 */
export async function POST(req: NextRequest) {
  let body: { project_id?: string; hours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const projectId = body.project_id;
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id is required' },
      { status: 400 }
    );
  }

  // Permission check — only roles with can_manage_roles (clo, pm_transaccion)
  const auth = await requirePermission(req, projectId, 'can_manage_roles');
  if (!auth.authorized) {
    return auth.error!;
  }

  const hours = Math.min(body.hours ?? 24, 168);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const gateway = getHarveyGateway();
    const result = await gateway.queryHistory({
      start_date: since,
      end_date: new Date().toISOString(),
      limit: 500,
    });

    if (result.entries.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No entries found in the requested period',
      });
    }

    // Collect all entry IDs to check for existing records
    const entryIds = result.entries.map((e: HarveyHistoryEntry) => e.id);

    // Find which entries already exist in dd_gateway_telemetry
    const { data: existing } = await supabaseAdmin
      .from('dd_gateway_telemetry')
      .select('request_id')
      .in('request_id', entryIds);

    const existingIds = new Set((existing || []).map((r: { request_id: string }) => r.request_id));

    // Filter to only new entries
    const newEntries = result.entries.filter(
      (e: HarveyHistoryEntry) => !existingIds.has(e.id)
    );

    if (newEntries.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'All entries already synced',
      });
    }

    // Map Harvey history entries to dd_gateway_telemetry rows
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
      console.error('[Sync] Insert failed:', insertError.message);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced: newEntries.length,
      total_fetched: result.entries.length,
      already_existed: existingIds.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sync] Harvey history sync failed:', message);

    // Emit failure event for alerting
    await emitEvent({
      type: 'tool_execution_failed',
      payload: {
        execution_id: `sync-${Date.now()}`,
        tool_slug: 'harvey-history-sync',
        error: message,
      },
    });

    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    );
  }
}
