import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { emitWarRoomNotification } from '@/lib/war-room/notifications';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface AlertItem {
  task_id: string;
  title: string;
  state: string;
  area_code: string;
  priority: string;
  assigned_to: string | null;
  days_in_state: number;
  entered_state_at: string;
  hitl_required: boolean;
}

interface AlertsResponse {
  success: true;
  alerts: {
    critical: AlertItem[];
    warning: AlertItem[];
    info: AlertItem[];
  };
  summary: {
    total_alerts: number;
    critical_count: number;
    warning_count: number;
    oldest_task_days: number;
    avg_days_in_state: number;
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD_DAYS = 3;
const CRITICAL_THRESHOLD_DAYS = 7;

function computeDaysInState(enteredStateAt: string): number {
  return Math.floor(
    (Date.now() - new Date(enteredStateAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function buildAlertItem(task: {
  id: string;
  title: string;
  state: string;
  area_code: string;
  priority: string;
  assigned_to: string | null;
  hitl_required: boolean;
  entered_state_at: string;
}): AlertItem {
  return {
    task_id: task.id,
    title: task.title,
    state: task.state,
    area_code: task.area_code,
    priority: task.priority,
    assigned_to: task.assigned_to,
    days_in_state: computeDaysInState(task.entered_state_at),
    entered_state_at: task.entered_state_at,
    hitl_required: task.hitl_required,
  };
}

// ────────────────────────────────────────────────────────────
// GET — Returns current aging alerts
// ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id required' },
      { status: 400 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_view_contingencies',
  );
  if (!authorized) return authError!;

  const thresholdDays = Math.max(
    1,
    parseInt(req.nextUrl.searchParams.get('threshold_days') ?? '', 10) ||
      DEFAULT_THRESHOLD_DAYS,
  );

  const { data: tasks, error: queryError } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select(
      'id, title, state, area_code, priority, assigned_to, hitl_required, entered_state_at',
    )
    .eq('project_id', projectId);

  if (queryError) {
    return NextResponse.json(
      { success: false, error: queryError.message },
      { status: 500 },
    );
  }

  if (!tasks || tasks.length === 0) {
    const emptyResponse: AlertsResponse = {
      success: true,
      alerts: { critical: [], warning: [], info: [] },
      summary: {
        total_alerts: 0,
        critical_count: 0,
        warning_count: 0,
        oldest_task_days: 0,
        avg_days_in_state: 0,
      },
    };
    return NextResponse.json(emptyResponse);
  }

  // Classify each task into alert buckets
  const critical: AlertItem[] = [];
  const warning: AlertItem[] = [];
  const info: AlertItem[] = [];

  let totalDays = 0;
  let maxDays = 0;

  for (const task of tasks) {
    const days = computeDaysInState(task.entered_state_at);
    totalDays += days;
    if (days > maxDays) maxDays = days;

    if (days > CRITICAL_THRESHOLD_DAYS) {
      critical.push(buildAlertItem(task));
    } else if (days > thresholdDays) {
      warning.push(buildAlertItem(task));
    } else if (days > thresholdDays - 1) {
      info.push(buildAlertItem(task));
    }
  }

  const totalAlerts = critical.length + warning.length + info.length;

  const response: AlertsResponse = {
    success: true,
    alerts: { critical, warning, info },
    summary: {
      total_alerts: totalAlerts,
      critical_count: critical.length,
      warning_count: warning.length,
      oldest_task_days: maxDays,
      avg_days_in_state: Math.round((totalDays / tasks.length) * 100) / 100,
    },
  };

  return NextResponse.json(response);
}

// ────────────────────────────────────────────────────────────
// POST — Trigger alert notifications for stale tasks
// ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { project_id?: string; threshold_days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const projectId = body.project_id;
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id required' },
      { status: 400 },
    );
  }

  // Admin-level permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_manage_roles',
  );
  if (!authorized) return authError!;

  const thresholdDays = Math.max(1, body.threshold_days ?? DEFAULT_THRESHOLD_DAYS);

  const { data: tasks, error: queryError } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select(
      'id, title, state, area_code, priority, assigned_to, hitl_required, entered_state_at',
    )
    .eq('project_id', projectId);

  if (queryError) {
    return NextResponse.json(
      { success: false, error: queryError.message },
      { status: 500 },
    );
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({
      success: true,
      notifications_sent: 0,
      message: 'No tasks found for this project',
    });
  }

  // Find all stale tasks (> thresholdDays)
  const staleTasks = tasks.filter(
    (t) => computeDaysInState(t.entered_state_at) > thresholdDays,
  );

  let notificationsSent = 0;

  for (const task of staleTasks) {
    const days = computeDaysInState(task.entered_state_at);
    const isCritical = days > CRITICAL_THRESHOLD_DAYS;

    await emitWarRoomNotification({
      project_id: projectId,
      notification_type: 'request_overdue',
      severity: isCritical ? 'high' : 'medium',
      title: `Tarea estancada: ${task.title}`,
      description: `La tarea lleva ${days} días en estado "${task.state}"`,
      source_type: 'kanban_task',
      source_id: task.id,
    });

    notificationsSent++;
  }

  return NextResponse.json({
    success: true,
    notifications_sent: notificationsSent,
    stale_tasks: staleTasks.length,
    threshold_days: thresholdDays,
  });
}
