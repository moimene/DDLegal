import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

interface TimelineEvent {
  timestamp: string;
  event_type:
    | 'decision'
    | 'action_proposed'
    | 'action_status_change'
    | 'notification'
    | 'severity_change';
  title: string;
  description: string | null;
  severity: string | null;
  actor: string | null;
  linked_finding: string | null;
  linked_action: string | null;
  linked_decision: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/war-room/[project_id]/timeline
 * O.1: Negotiation Timeline
 *
 * Returns a chronological timeline of all negotiation events:
 *   - War Room decisions
 *   - Negotiation actions (proposed, status changes)
 *   - War Room notifications
 *   - Severity change events from dd_event_log
 *
 * Query params:
 *   ?limit=N    — max events to return (default 200)
 *   ?type=X     — filter by event_type
 *   ?since=ISO  — only events after this timestamp
 *
 * Returns: { success, timeline, total_events }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_view_war_room'
  );
  if (!authorized) return authError!;

  try {
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get('limit')) || 200,
      1000
    );
    const typeFilter = req.nextUrl.searchParams.get('type');
    const sinceFilter = req.nextUrl.searchParams.get('since');

    // 1. Load all data sources in parallel
    const [decisionsRes, actionsRes, notifsRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from('dd_war_room_decisions')
        .select('*')
        .eq('project_id', project_id)
        .order('decided_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('dd_negotiation_actions')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('dd_war_room_notifications')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('dd_event_log')
        .select('*')
        .eq('project_id', project_id)
        .eq('event_type', 'severity_change')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const timeline: TimelineEvent[] = [];

    // 2. Map decisions to timeline events
    for (const d of decisionsRes.data || []) {
      timeline.push({
        timestamp: d.decided_at || d.created_at,
        event_type: 'decision',
        title: `Decision: ${d.title}`,
        description: d.rationale || null,
        severity: null,
        actor: d.decided_by || null,
        linked_finding: null,
        linked_action: null,
        linked_decision: d.id,
        metadata: {
          decision_type: d.decision_type,
          client_visible: d.client_visible,
        },
      });
    }

    // 3. Map negotiation actions to timeline events
    for (const a of actionsRes.data || []) {
      // Initial proposal event
      timeline.push({
        timestamp: a.created_at,
        event_type: 'action_proposed',
        title: `Accion propuesta: ${a.title}`,
        description: a.description || null,
        severity: null,
        actor: a.owner || null,
        linked_finding: a.finding_ref || null,
        linked_action: a.id,
        linked_decision: a.war_room_decision_id || null,
        metadata: {
          action_type: a.action_type,
          status: a.status,
          economic_impact_amount: a.economic_impact_amount,
          economic_impact_currency: a.economic_impact_currency,
        },
      });

      // If action has been resolved (status changed from proposed), add status change event
      if (a.status !== 'proposed' && a.updated_at !== a.created_at) {
        timeline.push({
          timestamp: a.updated_at,
          event_type: 'action_status_change',
          title: `Accion ${a.status}: ${a.title}`,
          description: a.counterparty_position || null,
          severity: null,
          actor: null,
          linked_finding: a.finding_ref || null,
          linked_action: a.id,
          linked_decision: a.war_room_decision_id || null,
          metadata: {
            action_type: a.action_type,
            previous_status: 'proposed',
            new_status: a.status,
          },
        });
      }
    }

    // 4. Map notifications to timeline events
    for (const n of notifsRes.data || []) {
      timeline.push({
        timestamp: n.created_at,
        event_type: 'notification',
        title: n.title,
        description: n.description || null,
        severity: n.severity,
        actor: null,
        linked_finding: n.source_id || null,
        linked_action: null,
        linked_decision: null,
        metadata: {
          notification_type: n.notification_type,
          source_type: n.source_type,
          is_read: n.is_read,
        },
      });
    }

    // 5. Map severity change events
    for (const e of eventsRes.data || []) {
      const payload = (e.payload as Record<string, unknown>) || {};
      timeline.push({
        timestamp: e.created_at,
        event_type: 'severity_change',
        title: e.description || `Cambio de severidad`,
        description: `${(payload.old_severity as string) || '?'} -> ${(payload.new_severity as string) || '?'}`,
        severity: (payload.new_severity as string) || e.severity,
        actor: null,
        linked_finding: (payload.contingency_id as string) || (payload.source_id as string) || null,
        linked_action: null,
        linked_decision: null,
        metadata: payload,
      });
    }

    // 6. Sort by timestamp descending
    timeline.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 7. Apply filters
    let filtered = timeline;

    if (typeFilter) {
      filtered = filtered.filter((e) => e.event_type === typeFilter);
    }

    if (sinceFilter) {
      const sinceDate = new Date(sinceFilter).getTime();
      if (!isNaN(sinceDate)) {
        filtered = filtered.filter(
          (e) => new Date(e.timestamp).getTime() >= sinceDate
        );
      }
    }

    const total_events = filtered.length;
    const paginated = filtered.slice(0, limit);

    return NextResponse.json({
      success: true,
      project_id,
      timeline: paginated,
      total_events,
      has_more: total_events > limit,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
