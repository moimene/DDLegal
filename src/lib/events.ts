/**
 * DD Legal PMO — Event Bus System
 *
 * Centralized event system for the app. Events are:
 *   1. Written to `dd_event_log` table for persistence / audit
 *   2. Broadcast via Supabase Realtime channel `dd-events:{project_id}`
 *
 * Usage (server-side):
 *   import { emitEvent } from '@/lib/events';
 *   await emitEvent({ type: 'tool_execution_completed', payload: { ... } });
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { emitWarRoomNotification, type WarRoomSeverity } from '@/lib/war-room/notifications';

// ────────────────────────────────────────────────────────────
// Event Type Definitions
// ────────────────────────────────────────────────────────────

export type DDEvent =
  | { type: 'tool_execution_started'; payload: { execution_id: string; tool_slug: string; project_id: string } }
  | { type: 'tool_execution_completed'; payload: { execution_id: string; tool_slug: string; project_id: string; duration_ms: number; grounding_score?: number } }
  | { type: 'tool_execution_failed'; payload: { execution_id: string; tool_slug: string; error: string } }
  | { type: 'report_generated'; payload: { report_id: string; project_id: string; template_type: string; grounding_score: number } }
  | { type: 'document_uploaded'; payload: { document_id: string; project_id: string; folder_id?: string } }
  | { type: 'document_version_created'; payload: { document_id: string; version_id: string; version_number: number } }
  | { type: 'qa_thread_created'; payload: { thread_id: string; project_id: string; priority: string } }
  | { type: 'qa_thread_answered'; payload: { thread_id: string; message_id: string } }
  | { type: 'qa_sla_breached'; payload: { thread_id: string; sla_type: string } }
  | { type: 'hitl_decision_required'; payload: { task_id: string; project_id: string; confidence_score: number } }
  | { type: 'hitl_decision_made'; payload: { task_id: string; decision: string; decided_by: string } }
  | { type: 'contingency_updated'; payload: { contingency_id: string; project_id: string; field: string; old_value?: string; new_value?: string } }
  | { type: 'project_milestone'; payload: { project_id: string; milestone: string; coverage_pct: number } };

/** Serialized form stored in the DB and sent over SSE. */
export interface DDEventRecord {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  project_id: string | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Extract the project_id from any event payload (best-effort). */
function extractProjectId(event: DDEvent): string | null {
  const p = event.payload as Record<string, unknown>;
  if (typeof p.project_id === 'string') return p.project_id;
  return null;
}

// ────────────────────────────────────────────────────────────
// Human-readable descriptions (Spanish)
// ────────────────────────────────────────────────────────────

const EVENT_DESCRIPTIONS: Record<DDEvent['type'], (p: Record<string, unknown>) => string> = {
  tool_execution_started: (p) =>
    `Herramienta "${p.tool_slug}" iniciada`,
  tool_execution_completed: (p) =>
    `Herramienta "${p.tool_slug}" completada en ${p.duration_ms}ms` +
    (p.grounding_score != null ? ` (grounding: ${p.grounding_score}%)` : ''),
  tool_execution_failed: (p) =>
    `Error en herramienta "${p.tool_slug}": ${p.error}`,
  report_generated: (p) =>
    `Informe "${p.template_type}" generado (grounding: ${p.grounding_score}%)`,
  document_uploaded: (p) =>
    `Documento subido${p.folder_id ? ' a carpeta' : ''}`,
  document_version_created: (p) =>
    `Nueva version v${p.version_number} creada`,
  qa_thread_created: (p) =>
    `Nuevo hilo Q&A creado (prioridad: ${p.priority})`,
  qa_thread_answered: () =>
    `Hilo Q&A respondido`,
  qa_sla_breached: (p) =>
    `SLA incumplido (${p.sla_type})`,
  hitl_decision_required: (p) =>
    `Decision HITL requerida (confianza: ${p.confidence_score}%)`,
  hitl_decision_made: (p) =>
    `Decision HITL: ${p.decision} por ${p.decided_by}`,
  contingency_updated: (p) =>
    `Contingencia actualizada (campo: ${p.field})`,
  project_milestone: (p) =>
    `Hito alcanzado: ${p.milestone} (${p.coverage_pct}%)`,
};

/** Generate a human-readable description for an event. */
export function describeEvent(event: DDEvent): string {
  const fn = EVENT_DESCRIPTIONS[event.type];
  if (!fn) return event.type;
  return fn(event.payload as unknown as Record<string, unknown>);
}

/** Describe an event record from the database. */
export function describeEventRecord(record: DDEventRecord): string {
  const fn = EVENT_DESCRIPTIONS[record.event_type as DDEvent['type']];
  if (!fn) return record.event_type;
  return fn(record.payload);
}

// ────────────────────────────────────────────────────────────
// Event severity / category mapping
// ────────────────────────────────────────────────────────────

export type EventSeverity = 'success' | 'warning' | 'error' | 'info';

const EVENT_SEVERITY: Record<DDEvent['type'], EventSeverity> = {
  tool_execution_started: 'info',
  tool_execution_completed: 'success',
  tool_execution_failed: 'error',
  report_generated: 'success',
  document_uploaded: 'info',
  document_version_created: 'info',
  qa_thread_created: 'info',
  qa_thread_answered: 'success',
  qa_sla_breached: 'error',
  hitl_decision_required: 'warning',
  hitl_decision_made: 'success',
  contingency_updated: 'warning',
  project_milestone: 'success',
};

export function getEventSeverity(eventType: string): EventSeverity {
  return EVENT_SEVERITY[eventType as DDEvent['type']] ?? 'info';
}

// ────────────────────────────────────────────────────────────
// Icon mapping (lucide-react icon names)
// ────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<DDEvent['type'], string> = {
  tool_execution_started: 'Play',
  tool_execution_completed: 'CheckCircle2',
  tool_execution_failed: 'XCircle',
  report_generated: 'FileCheck',
  document_uploaded: 'FileText',
  document_version_created: 'FilePlus2',
  qa_thread_created: 'MessageSquare',
  qa_thread_answered: 'MessageCircle',
  qa_sla_breached: 'AlertTriangle',
  hitl_decision_required: 'Brain',
  hitl_decision_made: 'UserCheck',
  contingency_updated: 'Shield',
  project_milestone: 'Flag',
};

export function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType as DDEvent['type']] ?? 'Bell';
}

// ────────────────────────────────────────────────────────────
// War Room notification bridge
// ────────────────────────────────────────────────────────────

/**
 * Map specific bus events to War Room notifications.
 * Only events that have a project_id and a valid notification_type mapping
 * will produce a row in `dd_war_room_notifications`.
 *
 * Mapping (event_type -> notification_type):
 *   contingency_updated   -> severity_change
 *   tool_execution_failed -> red_flag_new   (always treated as critical)
 *   hitl_decision_made    -> decision_required
 *   project_milestone     -> (skipped — no matching DB CHECK value yet)
 */
async function maybeEmitWarRoomNotification(
  event: DDEvent,
  projectId: string | null,
): Promise<void> {
  // War Room notifications require a project_id (NOT NULL in the DB).
  if (!projectId) return;

  const p = event.payload as Record<string, unknown>;

  switch (event.type) {
    case 'contingency_updated': {
      const isSeverityChange = p.field === 'severity';
      const notifSeverity: WarRoomSeverity = isSeverityChange && typeof p.new_value === 'string'
        ? (p.new_value as WarRoomSeverity)
        : 'medium';
      const notifTitle = isSeverityChange
        ? `Contingencia — Severidad: ${p.old_value ?? '?'} \u2192 ${p.new_value ?? '?'}`
        : `Contingencia actualizada (${p.field ?? 'campo desconocido'})`;
      const notifDescription = isSeverityChange
        ? `Severidad cambiada de "${p.old_value ?? '?'}" a "${p.new_value ?? '?'}".`
        : `Campo "${p.field}" actualizado${p.old_value != null || p.new_value != null ? `: ${p.old_value ?? ''} \u2192 ${p.new_value ?? ''}` : ''}.`;

      await emitWarRoomNotification({
        project_id: projectId,
        notification_type: 'severity_change',
        title: notifTitle,
        description: notifDescription,
        severity: notifSeverity,
        source_type: 'contingency',
        source_id: typeof p.contingency_id === 'string' ? p.contingency_id : undefined,
      });
      break;
    }

    case 'tool_execution_failed':
      await emitWarRoomNotification({
        project_id: projectId,
        notification_type: 'red_flag_new',
        title: `Fallo critico en herramienta "${p.tool_slug}"`,
        description: typeof p.error === 'string' ? p.error : 'Error desconocido',
        severity: 'critical',
        source_type: 'tool_execution',
        source_id: typeof p.execution_id === 'string' ? p.execution_id : undefined,
      });
      break;

    case 'hitl_decision_made':
      await emitWarRoomNotification({
        project_id: projectId,
        notification_type: 'decision_required',
        title: `Decision HITL registrada: ${p.decision ?? ''}`,
        description: `Decidido por ${p.decided_by ?? 'desconocido'}`,
        severity: 'medium',
        source_type: 'hitl_task',
        source_id: typeof p.task_id === 'string' ? p.task_id : undefined,
      });
      break;

    // project_milestone is intentionally not mapped because the DB CHECK
    // constraint on notification_type does not include 'milestone_reached'.
    // To enable this, add 'milestone_reached' to the CHECK in a future migration.

    default:
      // No War Room notification for this event type.
      break;
  }
}

// ────────────────────────────────────────────────────────────
// Emit (write to DB + broadcast realtime)
// ────────────────────────────────────────────────────────────

/**
 * Emit an event:
 *  1. Insert into `dd_event_log` table
 *  2. Broadcast on Supabase Realtime channel `dd-events:{project_id}`
 *
 * Errors are logged but never thrown — event emission is non-blocking.
 */
export async function emitEvent(event: DDEvent): Promise<void> {
  const projectId = extractProjectId(event);

  try {
    // 1. Persist to dd_event_log
    const { error: insertError } = await supabaseAdmin
      .from('dd_event_log')
      .insert({
        event_type: event.type,
        payload: event.payload as Record<string, unknown>,
        project_id: projectId,
        description: describeEvent(event),
        severity: getEventSeverity(event.type),
      });

    if (insertError) {
      console.error('[EventBus] Failed to persist event:', insertError.message);
    }

    // 2. Broadcast via Supabase Realtime
    const channelName = projectId ? `dd-events:${projectId}` : 'dd-events:global';
    const channel = supabaseAdmin.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'dd_event',
      payload: {
        event_type: event.type,
        payload: event.payload,
        project_id: projectId,
        description: describeEvent(event),
        severity: getEventSeverity(event.type),
        icon: getEventIcon(event.type),
        created_at: new Date().toISOString(),
      },
    });

    supabaseAdmin.removeChannel(channel);

    // 3. War Room notifications — fire-and-forget for relevant events.
    //    Wrapped in its own try/catch so it never breaks event emission.
    try {
      await maybeEmitWarRoomNotification(event, projectId);
    } catch (wrErr) {
      console.error('[EventBus] War Room notification error (non-fatal):', wrErr);
    }
  } catch (err) {
    console.error('[EventBus] Unexpected error emitting event:', err);
  }
}

// ────────────────────────────────────────────────────────────
// Query helpers (server-side)
// ────────────────────────────────────────────────────────────

export interface EventQueryParams {
  project_id?: string;
  event_type?: string;
  since?: string;
  limit?: number;
}

/**
 * Fetch recent events from dd_event_log with optional filters.
 */
export async function queryEvents(params: EventQueryParams): Promise<{ events: DDEventRecord[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, 100);

  let query = supabaseAdmin
    .from('dd_event_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.project_id) {
    query = query.eq('project_id', params.project_id);
  }
  if (params.event_type) {
    query = query.eq('event_type', params.event_type);
  }
  if (params.since) {
    query = query.gte('created_at', params.since);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('[EventBus] queryEvents error:', error.message);
    return { events: [], total: 0 };
  }

  return {
    events: (data || []) as DDEventRecord[],
    total: count ?? 0,
  };
}
