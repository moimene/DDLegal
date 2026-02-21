import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { DDTask } from '@/lib/supabase';

type HitlDecision = 'approve' | 'correct' | 'reject';
type QuickDecision = 'approved' | 'rejected' | 'needs_evidence';

const DECISION_STATUS_MAP: Record<HitlDecision, { status: DDTask['status']; ai_status: DDTask['ai_status'] }> = {
    approve: { status: 'completed', ai_status: 'completed' },
    correct: { status: 'in_progress', ai_status: 'completed' },
    reject: { status: 'blocked', ai_status: 'error' },
};

const QUICK_DECISION_STATUS_MAP: Record<QuickDecision, { status: DDTask['status']; ai_status: DDTask['ai_status'] }> = {
    approved: { status: 'completed', ai_status: 'completed' },
    rejected: { status: 'blocked', ai_status: 'error' },
    needs_evidence: { status: 'review', ai_status: 'completed' },
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { task_id, decision, note, decided_by } = body as {
            task_id?: string;
            decision?: HitlDecision;
            note?: string;
            decided_by?: string;
        };

        if (!task_id || !decision || !DECISION_STATUS_MAP[decision]) {
            return NextResponse.json(
                { error: 'Missing or invalid fields. Required: task_id, decision (approve|correct|reject).' },
                { status: 400 }
            );
        }

        const { data: task, error: taskError } = await supabaseAdmin
            .from('dd_tasks')
            .select('*')
            .eq('id', task_id)
            .single();

        if (taskError || !task) {
            return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
        }

        const statusPatch = DECISION_STATUS_MAP[decision];
        const trimmedNote = note?.trim();
        const notePrefix = trimmedNote
            ? `[HITL ${decision.toUpperCase()} ${new Date().toISOString().slice(0, 10)}] ${trimmedNote}`
            : null;
        const mergedNote = notePrefix
            ? (task.notes ? `${task.notes}\n${notePrefix}` : notePrefix)
            : task.notes;

        const { data: updatedTask, error: updateError } = await supabaseAdmin
            .from('dd_tasks')
            .update({
                status: statusPatch.status,
                ai_status: statusPatch.ai_status,
                notes: mergedNote,
                updated_at: new Date().toISOString(),
            })
            .eq('id', task_id)
            .select('*')
            .single();

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update task status.', details: updateError.message }, { status: 500 });
        }

        // Best effort audit insert. If migration is not applied yet, do not break the HITL flow.
        const { error: auditError } = await supabaseAdmin.from('dd_hitl_decisions').insert({
            task_id,
            project_id: task.project_id,
            decision,
            note: trimmedNote || null,
            previous_status: task.status,
            new_status: statusPatch.status,
            previous_ai_status: task.ai_status,
            new_ai_status: statusPatch.ai_status,
            decided_by: decided_by || null,
            decided_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            task: updatedTask,
            warnings: auditError ? ['Decision applied but audit log could not be stored in dd_hitl_decisions.'] : [],
        });
    } catch (error) {
        console.error('HITL decision API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/hitl/decision — Quick action decisions (approved | rejected | needs_evidence)
 * Body: { task_id, decision, decided_by? }
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { task_id, decision, decided_by } = body as {
            task_id?: string;
            decision?: QuickDecision;
            decided_by?: string;
        };

        if (!task_id || !decision || !QUICK_DECISION_STATUS_MAP[decision]) {
            return NextResponse.json(
                { error: 'Missing or invalid fields. Required: task_id, decision (approved|rejected|needs_evidence).' },
                { status: 400 }
            );
        }

        const { data: task, error: taskError } = await supabaseAdmin
            .from('dd_tasks')
            .select('*')
            .eq('id', task_id)
            .single();

        if (taskError || !task) {
            return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
        }

        const statusPatch = QUICK_DECISION_STATUS_MAP[decision];
        const autoNote = `[HITL QUICK ${decision.toUpperCase()} ${new Date().toISOString().slice(0, 10)}]`;
        const mergedNote = task.notes ? `${task.notes}\n${autoNote}` : autoNote;

        const updatePayload: Record<string, unknown> = {
            status: statusPatch.status,
            ai_status: statusPatch.ai_status,
            notes: mergedNote,
            updated_at: new Date().toISOString(),
        };

        // Mark HITL review timestamp when approving or rejecting
        if (decision === 'approved' || decision === 'rejected') {
            updatePayload.hitl_reviewed_at = new Date().toISOString();
            updatePayload.hitl_reviewed_by = decided_by || 'manual_reviewer';
        }

        const { data: updatedTask, error: updateError } = await supabaseAdmin
            .from('dd_tasks')
            .update(updatePayload)
            .eq('id', task_id)
            .select('*')
            .single();

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update task status.', details: updateError.message }, { status: 500 });
        }

        // Best-effort audit insert
        await supabaseAdmin.from('dd_hitl_decisions').insert({
            task_id,
            project_id: task.project_id,
            decision,
            note: autoNote,
            previous_status: task.status,
            new_status: statusPatch.status,
            previous_ai_status: task.ai_status,
            new_ai_status: statusPatch.ai_status,
            decided_by: decided_by || null,
            decided_at: new Date().toISOString(),
        }).then(() => {});

        return NextResponse.json({
            success: true,
            task: updatedTask,
        });
    } catch (error) {
        console.error('HITL quick decision PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

