import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { getHarveyGateway } from '@/lib/harvey';
import type { HarveyHistoryEntry } from '@/lib/harvey';

/**
 * GET /api/observability/history
 *
 * Query Harvey audit/usage history, split by type:
 *   - type=usage  -> entries where HarveyHistoryEntry.type === 'completion'
 *   - type=query  -> entries where HarveyHistoryEntry.type === 'query' | 'rag'
 *
 * Query params:
 *   - project_id (required) — for permission check
 *   - type       — 'usage' | 'query' (default: 'usage')
 *   - start_date — ISO date string
 *   - end_date   — ISO date string
 *   - limit      — max entries (default 50, max 200)
 *
 * Requires: can_view_all_areas (clo, pm_transaccion)
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id is required' },
      { status: 400 }
    );
  }

  // Permission check — only clo and pm_transaccion have can_view_all_areas
  const auth = await requirePermission(req, projectId, 'can_view_all_areas');
  if (!auth.authorized) {
    return auth.error!;
  }

  const viewType = req.nextUrl.searchParams.get('type') || 'usage';
  if (viewType !== 'usage' && viewType !== 'query') {
    return NextResponse.json(
      { success: false, error: 'type must be "usage" or "query"' },
      { status: 400 }
    );
  }

  const startDate = req.nextUrl.searchParams.get('start_date') || undefined;
  const endDate = req.nextUrl.searchParams.get('end_date') || undefined;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') || '50', 10),
    200
  );

  try {
    const gateway = getHarveyGateway();
    const result = await gateway.queryHistory({
      start_date: startDate,
      end_date: endDate,
      limit,
    });

    // Split by type field:
    //   'completion' -> usage view
    //   'query' | 'rag' -> query view
    const filtered = result.entries.filter((entry: HarveyHistoryEntry) => {
      if (viewType === 'usage') {
        return entry.type === 'completion';
      }
      return entry.type === 'query' || entry.type === 'rag';
    });

    return NextResponse.json({
      success: true,
      entries: filtered,
      total: filtered.length,
      type: viewType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[History] Failed to query Harvey history:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    );
  }
}
