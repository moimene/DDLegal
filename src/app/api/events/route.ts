import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Events API — List recent events with filters
 * GET /api/events?project_id=&type=&since=&limit=20
 *
 * Reconstructs a unified event stream from:
 *   - dd_event_log (primary, if table exists)
 *   - dd_tool_executions (fallback / merge)
 *   - vdr_documents (recent uploads)
 *   - qa_threads (recent activity)
 *
 * Returns: { events: DDEventRecord[], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const eventType = searchParams.get('type');
    const since = searchParams.get('since');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Permission check
    if (projectId) {
      const { authorized, error: authError } = await requirePermission(request, projectId, 'can_view_contingencies');
      if (!authorized) return authError!;
    } else {
      const userId = request.headers.get('x-user-id');
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ── 1. Try dd_event_log first (canonical source) ──────────
    let eventLogEvents: Array<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      project_id: string | null;
      description: string | null;
      severity: string | null;
      created_at: string;
    }> = [];

    {
      let query = supabaseAdmin
        .from('dd_event_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (projectId) query = query.eq('project_id', projectId);
      if (eventType) query = query.eq('event_type', eventType);
      if (since) query = query.gte('created_at', since);

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        eventLogEvents = data;
      }
    }

    // ── 2. Reconstruct from source tables if event_log is sparse ──
    const reconstructed: typeof eventLogEvents = [];

    if (eventLogEvents.length < limit) {
      const remaining = limit - eventLogEvents.length;
      const eventLogIds = new Set(eventLogEvents.map(e => e.id));

      // 2a. Tool executions → tool_execution_completed / failed / started
      if (!eventType || eventType.startsWith('tool_execution')) {
        let execQuery = supabaseAdmin
          .from('dd_tool_executions')
          .select('id, tool_id, project_id, status, error_message, duration_ms, started_at, completed_at, created_at')
          .order('created_at', { ascending: false })
          .limit(remaining);

        if (projectId) execQuery = execQuery.eq('project_id', projectId);
        if (since) execQuery = execQuery.gte('created_at', since);

        const { data: execs } = await execQuery;

        if (execs) {
          for (const exec of execs) {
            const syntheticId = `exec_${exec.id}`;
            if (eventLogIds.has(syntheticId)) continue;

            let type = 'tool_execution_started';
            if (exec.status === 'completed') type = 'tool_execution_completed';
            else if (exec.status === 'error') type = 'tool_execution_failed';

            if (eventType && eventType !== type) continue;

            reconstructed.push({
              id: syntheticId,
              event_type: type,
              payload: {
                execution_id: exec.id,
                tool_id: exec.tool_id,
                project_id: exec.project_id,
                duration_ms: exec.duration_ms,
                error: exec.error_message,
              },
              project_id: exec.project_id,
              description: type === 'tool_execution_completed'
                ? `Herramienta completada en ${exec.duration_ms}ms`
                : type === 'tool_execution_failed'
                  ? `Error en herramienta: ${exec.error_message}`
                  : 'Herramienta iniciada',
              severity: type === 'tool_execution_completed' ? 'success'
                : type === 'tool_execution_failed' ? 'error' : 'info',
              created_at: exec.completed_at || exec.started_at || exec.created_at,
            });
          }
        }
      }

      // 2b. VDR Documents → document_uploaded
      if (!eventType || eventType === 'document_uploaded') {
        let docQuery = supabaseAdmin
          .from('vdr_documents')
          .select('id, project_id, folder_id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(remaining);

        if (projectId) docQuery = docQuery.eq('project_id', projectId);
        if (since) docQuery = docQuery.gte('created_at', since);

        const { data: docs } = await docQuery;

        if (docs) {
          for (const doc of docs) {
            const syntheticId = `doc_${doc.id}`;
            if (eventLogIds.has(syntheticId)) continue;

            reconstructed.push({
              id: syntheticId,
              event_type: 'document_uploaded',
              payload: {
                document_id: doc.id,
                project_id: doc.project_id,
                folder_id: doc.folder_id,
                name: doc.name,
              },
              project_id: doc.project_id,
              description: `Documento subido: ${doc.name}`,
              severity: 'info',
              created_at: doc.created_at,
            });
          }
        }
      }

      // 2c. QA Threads → qa_thread_created
      if (!eventType || eventType.startsWith('qa_')) {
        let qaQuery = supabaseAdmin
          .from('qa_threads')
          .select('id, project_id, subject, priority, status, sla_breached, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(remaining);

        if (projectId) qaQuery = qaQuery.eq('project_id', projectId);
        if (since) qaQuery = qaQuery.gte('created_at', since);

        const { data: threads } = await qaQuery;

        if (threads) {
          for (const thread of threads) {
            const syntheticId = `qa_${thread.id}`;
            if (eventLogIds.has(syntheticId)) continue;

            let type = 'qa_thread_created';
            let description = `Nuevo hilo Q&A: ${thread.subject}`;
            let severity = 'info';

            if (thread.status === 'answered') {
              type = 'qa_thread_answered';
              description = `Hilo Q&A respondido: ${thread.subject}`;
              severity = 'success';
            } else if (thread.sla_breached) {
              type = 'qa_sla_breached';
              description = `SLA incumplido: ${thread.subject}`;
              severity = 'error';
            }

            if (eventType && eventType !== type) continue;

            reconstructed.push({
              id: syntheticId,
              event_type: type,
              payload: {
                thread_id: thread.id,
                project_id: thread.project_id,
                priority: thread.priority,
                subject: thread.subject,
              },
              project_id: thread.project_id,
              description,
              severity,
              created_at: thread.updated_at || thread.created_at,
            });
          }
        }
      }
    }

    // ── 3. Merge & sort ──────────────────────────────────────────
    const allEvents = [...eventLogEvents, ...reconstructed]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return NextResponse.json({
      events: allEvents,
      total: allEvents.length,
    });
  } catch (error) {
    console.error('[Events API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno al obtener eventos' },
      { status: 500 }
    );
  }
}
