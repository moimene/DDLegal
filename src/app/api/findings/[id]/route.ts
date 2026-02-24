import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  getFindingDetail,
  transitionFindingStatus,
  overrideFindingTier,
  linkFindingToContingency,
  type FindingStatus,
} from '@/lib/findings/findings-service';
import { emitEvent } from '@/lib/events';

// Fields that can be updated via PATCH
const UPDATABLE_FIELDS = [
  'description',
  'mitigation_recommended',
  'is_red_flag',
  'is_deal_breaker',
  'hitl_required',
  'metadata',
] as const;

// ---------------------------------------------------------------------------
// GET /api/findings/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch finding to get project_id for permission check
  const { data: finding, error: fetchErr } = await supabaseAdmin
    .from('dd_findings')
    .select('id, project_id')
    .eq('id', id)
    .single();

  if (fetchErr || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    finding.project_id,
    'can_view_findings',
  );
  if (!authorized) return authError!;

  // Return full detail via RPC
  const detail = await getFindingDetail(id);

  return NextResponse.json({ success: true, data: detail });
}

// ---------------------------------------------------------------------------
// PATCH /api/findings/[id]
// Supports: field updates, status transitions, tier overrides, contingency linking
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json();

  // Fetch finding to get project_id for permission check
  const { data: finding, error: fetchErr } = await supabaseAdmin
    .from('dd_findings')
    .select('id, project_id, status, relevance_tier')
    .eq('id', id)
    .single();

  if (fetchErr || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 },
    );
  }

  const projectId = finding.project_id as string;

  // --- Status transition ---
  if (body.status) {
    const { authorized, error: authError } = await requirePermission(
      req,
      projectId,
      body.status === 'resolved' || body.status === 'dismissed'
        ? 'can_resolve_findings'
        : 'can_edit_findings',
    );
    if (!authorized) return authError!;

    const updated = await transitionFindingStatus(
      id,
      body.status as FindingStatus,
      body.transitioned_by,
    );

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition: ${finding.status} → ${body.status}`,
        },
        { status: 422 },
      );
    }

    await emitEvent({
      type: 'finding_status_changed',
      payload: {
        finding_id: id,
        project_id: projectId,
        old_status: finding.status as string,
        new_status: body.status as string,
        transitioned_by: body.transitioned_by,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  }

  // --- Tier override ---
  if (body.relevance_tier !== undefined) {
    const { authorized, error: authError } = await requirePermission(
      req,
      projectId,
      'can_change_finding_tier',
    );
    if (!authorized) return authError!;

    const newTier = body.relevance_tier as 1 | 2 | 3;
    if (![1, 2, 3].includes(newTier)) {
      return NextResponse.json(
        { success: false, error: 'relevance_tier must be 1, 2, or 3' },
        { status: 400 },
      );
    }

    const updated = await overrideFindingTier(
      id,
      newTier,
      body.overridden_by || null,
      body.tier_justification,
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Tier override failed' },
        { status: 500 },
      );
    }

    await emitEvent({
      type: 'finding_tier_changed',
      payload: {
        finding_id: id,
        project_id: projectId,
        old_tier: finding.relevance_tier as number,
        new_tier: newTier,
        overridden_by: body.overridden_by,
        justification: body.tier_justification,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  }

  // --- Link to contingency ---
  if (body.contingency_id) {
    const { authorized, error: authError } = await requirePermission(
      req,
      projectId,
      'can_edit_findings',
    );
    if (!authorized) return authError!;

    const linked = await linkFindingToContingency(id, body.contingency_id);
    if (!linked) {
      return NextResponse.json(
        { success: false, error: 'Failed to link finding to contingency' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, linked: true });
  }

  // --- General field updates ---
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_edit_findings',
  );
  if (!authorized) return authError!;

  const updatePayload: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      updatePayload[field] = body[field];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields to update' },
      { status: 400 },
    );
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('dd_findings')
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

  await emitEvent({
    type: 'finding_updated',
    payload: {
      finding_id: id,
      project_id: projectId,
      updated_fields: Object.keys(updatePayload),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: updated });
}
