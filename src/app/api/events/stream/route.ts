import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Server-Sent Events (SSE) endpoint for real-time event updates.
 * GET /api/events/stream?project_id=
 *
 * Polls `dd_event_log` every 3 seconds for new events and streams them
 * as SSE-formatted messages to the client.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastSeen = new Date().toISOString();
      let isClosed = false;

      // Send an initial comment to keep the connection alive
      controller.enqueue(encoder.encode(': connected\n\n'));

      const interval = setInterval(async () => {
        if (isClosed) return;

        try {
          // Poll dd_event_log for events newer than lastSeen
          let query = supabaseAdmin
            .from('dd_event_log')
            .select('id, event_type, payload, project_id, description, severity, created_at')
            .gt('created_at', lastSeen)
            .order('created_at', { ascending: true })
            .limit(20);

          if (projectId) {
            query = query.eq('project_id', projectId);
          }

          const { data: events, error } = await query;

          if (error) {
            console.error('[SSE] Poll error:', error.message);
            return;
          }

          if (events && events.length > 0) {
            for (const event of events) {
              if (isClosed) break;

              const sseData = JSON.stringify({
                id: event.id,
                event_type: event.event_type,
                payload: event.payload,
                project_id: event.project_id,
                description: event.description,
                severity: event.severity,
                created_at: event.created_at,
              });

              controller.enqueue(
                encoder.encode(`event: dd_event\ndata: ${sseData}\n\n`)
              );
            }

            // Advance the cursor to the latest event
            lastSeen = events[events.length - 1].created_at;
          }

          // Also poll dd_tool_executions for recent status changes
          let execQuery = supabaseAdmin
            .from('dd_tool_executions')
            .select('id, tool_id, project_id, status, error_message, duration_ms, completed_at, created_at')
            .gt('created_at', lastSeen)
            .order('created_at', { ascending: true })
            .limit(10);

          if (projectId) {
            execQuery = execQuery.eq('project_id', projectId);
          }

          const { data: execs } = await execQuery;

          if (execs && execs.length > 0) {
            for (const exec of execs) {
              if (isClosed) break;

              let eventType = 'tool_execution_started';
              let description = 'Herramienta iniciada';
              let severity = 'info';

              if (exec.status === 'completed') {
                eventType = 'tool_execution_completed';
                description = `Herramienta completada en ${exec.duration_ms}ms`;
                severity = 'success';
              } else if (exec.status === 'error') {
                eventType = 'tool_execution_failed';
                description = `Error: ${exec.error_message}`;
                severity = 'error';
              }

              const sseData = JSON.stringify({
                id: `exec_${exec.id}`,
                event_type: eventType,
                payload: {
                  execution_id: exec.id,
                  tool_id: exec.tool_id,
                  project_id: exec.project_id,
                  duration_ms: exec.duration_ms,
                  error: exec.error_message,
                },
                project_id: exec.project_id,
                description,
                severity,
                created_at: exec.completed_at || exec.created_at,
              });

              controller.enqueue(
                encoder.encode(`event: dd_event\ndata: ${sseData}\n\n`)
              );
            }
          }

          // Send a keep-alive comment every cycle
          if ((!events || events.length === 0) && (!execs || execs.length === 0)) {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }
        } catch (err) {
          console.error('[SSE] Unexpected poll error:', err);
        }
      }, 3000);

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
