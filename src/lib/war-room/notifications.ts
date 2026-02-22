/**
 * War Room Notifications — write path
 *
 * Inserts rows into `dd_war_room_notifications` so the War Room dashboard
 * surfaces them in real-time. Called from the Event Bus and can also be
 * invoked directly from any server-side code.
 *
 * DB CHECK constraint on notification_type:
 *   'severity_change' | 'new_blocker' | 'request_overdue' | 'decision_required' | 'red_flag_new'
 *
 * This module NEVER throws — all errors are logged to stderr.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Valid notification_type values matching the DB CHECK constraint. */
export type WarRoomNotificationType =
  | 'severity_change'
  | 'new_blocker'
  | 'request_overdue'
  | 'decision_required'
  | 'red_flag_new';

/** Valid severity values matching the DB CHECK constraint. */
export type WarRoomSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface WarRoomNotificationParams {
  project_id: string;
  notification_type: WarRoomNotificationType;
  title: string;
  description?: string;
  severity?: WarRoomSeverity;
  /** e.g. 'contingency', 'tool_execution', 'hitl_task', 'project' */
  source_type?: string;
  /** UUID of the originating record (contingency_id, execution_id, etc.) */
  source_id?: string;
}

// ────────────────────────────────────────────────────────────
// Core function
// ────────────────────────────────────────────────────────────

/**
 * Insert a notification into `dd_war_room_notifications`.
 *
 * This function is intentionally fire-and-forget safe: it catches all
 * errors internally so it never breaks the caller.
 */
export async function emitWarRoomNotification(
  params: WarRoomNotificationParams,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('dd_war_room_notifications')
      .insert({
        project_id: params.project_id,
        notification_type: params.notification_type,
        title: params.title,
        description: params.description ?? null,
        severity: params.severity ?? 'medium',
        source_type: params.source_type ?? null,
        source_id: params.source_id ?? null,
      });

    if (error) {
      console.error(
        '[WarRoom] Failed to insert notification:',
        error.message,
        { notification_type: params.notification_type, project_id: params.project_id },
      );
    }
  } catch (err) {
    console.error('[WarRoom] Unexpected error emitting notification:', err);
  }
}
