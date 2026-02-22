import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// In-memory read-state store (per-process; no DB table needed yet)
// ---------------------------------------------------------------------------

const readIds = new Set<string>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DDNotification {
    id: string;
    type: string;
    category: string;
    title: string;
    description: string;
    details: string | null;
    is_read: boolean;
    action_url: string | null;
    project_id: string;
    created_at: string;
    user_name: string | null;
    user_initials: string | null;
    metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Category mapper
// ---------------------------------------------------------------------------

function typeToCategory(type: string): string {
    switch (type) {
        case 'document_uploaded':
            return 'documentos';
        case 'qa_new':
        case 'qa_answer':
        case 'qa_sla':
            return 'qa';
        case 'tool_completed':
        case 'tool_failed':
        case 'hitl_required':
        case 'report_ready':
            return 'ia';
        case 'milestone':
        case 'task_completed':
            return 'tareas';
        default:
            return 'general';
    }
}

// ---------------------------------------------------------------------------
// GET — List notifications for a project
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
    // Verify authenticated user
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) {
        return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
    const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);
    const typeFilter = searchParams.get('type'); // category filter: documentos, qa, ia, tareas
    const isTimeline = searchParams.get('timeline') === 'true';
    const limit = Math.min(Math.max(1, limitParam), 100);
    const offset = Math.max(0, offsetParam);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const notifications: DDNotification[] = [];

    try {
        // ---------------------------------------------------------------
        // 1. Tool Executions → tool_completed / tool_failed
        // ---------------------------------------------------------------
        const { data: executions } = await supabaseAdmin
            .from('dd_tool_executions')
            .select('id, tool_id, project_id, status, error_message, started_at, completed_at, created_at')
            .eq('project_id', projectId)
            .gte('created_at', since)
            .in('status', ['completed', 'error'])
            .order('created_at', { ascending: false })
            .limit(50);

        if (executions) {
            for (const exec of executions) {
                const isError = exec.status === 'error';
                notifications.push({
                    id: `exec-${exec.id}`,
                    type: isError ? 'tool_failed' : 'tool_completed',
                    category: 'ia',
                    title: isError ? 'Ejecucion de herramienta fallida' : 'Herramienta ejecutada',
                    description: isError
                        ? `Error: ${exec.error_message ?? 'Error desconocido'}`
                        : 'La herramienta ha completado su ejecucion correctamente.',
                    details: exec.error_message ?? null,
                    is_read: readIds.has(`exec-${exec.id}`),
                    action_url: `/projects/${projectId}`,
                    project_id: projectId,
                    created_at: exec.completed_at ?? exec.created_at,
                    user_name: null,
                    user_initials: null,
                    metadata: { tool_id: exec.tool_id },
                });
            }
        }

        // ---------------------------------------------------------------
        // 2. VDR Documents → document_uploaded
        // ---------------------------------------------------------------
        const { data: documents } = await supabaseAdmin
            .from('vdr_documents')
            .select('id, name, status, category, uploaded_by, created_at, updated_at')
            .eq('project_id', projectId)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(50);

        if (documents) {
            for (const doc of documents) {
                notifications.push({
                    id: `doc-${doc.id}`,
                    type: 'document_uploaded',
                    category: 'documentos',
                    title: 'Documento subido',
                    description: `"${doc.name}" se ha anadido al Data Room.`,
                    details: `Categoria: ${doc.category ?? 'General'} | Estado: ${doc.status}`,
                    is_read: readIds.has(`doc-${doc.id}`),
                    action_url: `/projects/${projectId}/vdr`,
                    project_id: projectId,
                    created_at: doc.created_at,
                    user_name: null,
                    user_initials: null,
                    metadata: { document_id: doc.id, category: doc.category },
                });
            }
        }

        // ---------------------------------------------------------------
        // 3. QA Threads → qa_new / qa_answer / qa_sla
        // ---------------------------------------------------------------
        const { data: qaThreads } = await supabaseAdmin
            .from('qa_threads')
            .select('id, subject, status, priority, sla_breached, thread_number, created_at, updated_at')
            .eq('project_id', projectId)
            .gte('updated_at', since)
            .order('updated_at', { ascending: false })
            .limit(50);

        if (qaThreads) {
            for (const thread of qaThreads) {
                let type: string;
                let title: string;
                let description: string;

                if (thread.sla_breached) {
                    type = 'qa_sla';
                    title = 'SLA incumplido';
                    description = `La pregunta #${thread.thread_number} "${thread.subject}" ha excedido el plazo de respuesta.`;
                } else if (thread.status === 'answered') {
                    type = 'qa_answer';
                    title = 'Pregunta respondida';
                    description = `Se ha recibido respuesta a la pregunta #${thread.thread_number}: "${thread.subject}".`;
                } else {
                    type = 'qa_new';
                    title = 'Nueva pregunta Q&A';
                    description = `Pregunta #${thread.thread_number}: "${thread.subject}".`;
                }

                notifications.push({
                    id: `qa-${thread.id}`,
                    type,
                    category: 'qa',
                    title,
                    description,
                    details: `Prioridad: ${thread.priority} | Estado: ${thread.status}`,
                    is_read: readIds.has(`qa-${thread.id}`),
                    action_url: `/projects/${projectId}/qa`,
                    project_id: projectId,
                    created_at: thread.updated_at ?? thread.created_at,
                    user_name: null,
                    user_initials: null,
                    metadata: { thread_id: thread.id, priority: thread.priority },
                });
            }
        }

        // ---------------------------------------------------------------
        // 4. Tasks with HITL required
        // ---------------------------------------------------------------
        const { data: hitlTasks } = await supabaseAdmin
            .from('dd_tasks')
            .select('id, process_id, ai_status, status, notes, updated_at, created_at')
            .eq('project_id', projectId)
            .gte('updated_at', since)
            .in('ai_status', ['completed', 'error'])
            .eq('status', 'review')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (hitlTasks) {
            for (const task of hitlTasks) {
                if (task.ai_status === 'completed' && task.status === 'review') {
                    notifications.push({
                        id: `hitl-${task.id}`,
                        type: 'hitl_required',
                        category: 'ia',
                        title: 'Revision humana requerida',
                        description: 'Una tarea completada por IA necesita revision de un abogado.',
                        details: task.notes ?? null,
                        is_read: readIds.has(`hitl-${task.id}`),
                        action_url: `/projects/${projectId}/hitl`,
                        project_id: projectId,
                        created_at: task.updated_at ?? task.created_at,
                        user_name: null,
                        user_initials: null,
                        metadata: { task_id: task.id },
                    });
                }
            }
        }

        // ---------------------------------------------------------------
        // 5. Reports → report_ready
        // ---------------------------------------------------------------
        const { data: reports } = await supabaseAdmin
            .from('dd_reports')
            .select('id, report_type, status, created_at, updated_at')
            .gte('created_at', since)
            .eq('status', 'done')
            .order('created_at', { ascending: false })
            .limit(20);

        if (reports) {
            for (const report of reports) {
                notifications.push({
                    id: `report-${report.id}`,
                    type: 'report_ready',
                    category: 'ia',
                    title: 'Informe generado',
                    description: `El informe de tipo "${report.report_type}" esta listo para revision.`,
                    details: null,
                    is_read: readIds.has(`report-${report.id}`),
                    action_url: `/reports`,
                    project_id: projectId,
                    created_at: report.updated_at ?? report.created_at,
                    user_name: null,
                    user_initials: null,
                    metadata: { report_id: report.id, report_type: report.report_type },
                });
            }
        }

        // ---------------------------------------------------------------
        // Sort all notifications by created_at DESC
        // ---------------------------------------------------------------
        notifications.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // ---------------------------------------------------------------
        // Apply category filter if present
        // ---------------------------------------------------------------
        let filtered = notifications;
        if (typeFilter && typeFilter !== 'todo') {
            filtered = notifications.filter((n) => n.category === typeFilter);
        }

        // ---------------------------------------------------------------
        // Paginate
        // ---------------------------------------------------------------
        const paginated = filtered.slice(offset, offset + limit);

        return NextResponse.json({
            success: true,
            notifications: paginated,
            total: filtered.length,
            has_more: offset + limit < filtered.length,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// PATCH — Mark notifications as read
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
    try {
        // Verify authenticated user
        const patchUserId = req.headers.get('x-user-id');
        if (!patchUserId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const ids: string[] = body.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'ids array required' }, { status: 400 });
        }

        let updated = 0;
        for (const id of ids) {
            if (!readIds.has(id)) {
                readIds.add(id);
                updated++;
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
