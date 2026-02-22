import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { emitEvent } from '@/lib/events';

// Fields that are allowed to be updated via PATCH
const UPDATABLE_FIELDS = [
  'severity',
  'probability',
  'status',
  'description',
  'estimated_amount',
  'recommendation',
  'client_visible',
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// GET /api/contingencies/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch the contingency first to get project_id for permission check
  const { data: contingency, error: fetchErr } = await supabaseAdmin
    .from('dd_contingencies')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !contingency) {
    return NextResponse.json(
      { success: false, error: 'Contingency not found' },
      { status: 404 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    contingency.project_id,
    'can_view_contingencies',
  );
  if (!authorized) return authError!;

  return NextResponse.json({ success: true, contingency });
}

// ---------------------------------------------------------------------------
// PATCH /api/contingencies/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Build the update payload with only allowed fields
  const updatePayload: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      updatePayload[field] = body[field];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No updatable fields provided' },
      { status: 400 },
    );
  }

  // Fetch the CURRENT contingency before updating (for change detection)
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('dd_contingencies')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json(
      { success: false, error: 'Contingency not found' },
      { status: 404 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    current.project_id,
    'can_edit_contingencies',
  );
  if (!authorized) return authError!;

  // Perform the update
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('dd_contingencies')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json(
      { success: false, error: updateErr.message },
      { status: 500 },
    );
  }

  // Emit a contingency_updated event for EACH field that actually changed
  const changedFields: UpdatableField[] = [];
  for (const field of UPDATABLE_FIELDS) {
    if (!(field in updatePayload)) continue;

    const oldVal = current[field];
    const newVal = updatePayload[field];

    // Compare stringified values to handle numbers, booleans, and nulls uniformly
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changedFields.push(field);
      // Fire-and-forget — emitEvent never throws
      void emitEvent({
        type: 'contingency_updated',
        payload: {
          contingency_id: id,
          project_id: current.project_id,
          field,
          old_value: oldVal != null ? String(oldVal) : undefined,
          new_value: newVal != null ? String(newVal) : undefined,
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    contingency: updated,
    changed_fields: changedFields,
  });
}
