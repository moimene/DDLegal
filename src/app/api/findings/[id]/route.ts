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
  'title',
  'summary',
  'area_code',
  'severity',
  'probability',
  'timing',
  'objective_id',
  'description',
  'mitigation_recommended',
  'economic_impact_amount',
  'economic_impact_currency',
  'economic_impact_type',
  'is_red_flag',
  'is_deal_breaker',
  'hitl_required',
  'metadata',
] as const;

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);
const VALID_PROBABILITIES = new Set(['certain', 'alta', 'probable', 'media', 'possible', 'baja', 'remote']);
const VALID_TIMINGS = new Set(['blocking', 'post_closing', 'pre_closing', 'pre-close', 'post-close', 'ongoing', 'immediate']);
const VALID_IMPACT_TYPES = new Set(['contingency', 'liability', 'loss', 'operational_cost', 'direct', 'indirect', 'reputational']);

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
    .select('id, project_id, status, relevance_tier, area_code')
    .eq('id', id)
    .single();

  if (fetchErr || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 },
    );
  }

  const projectId = finding.project_id as string;
  const findingArea = (finding.area_code as string | null) || null;

  // --- Status transition ---
  if (body.status) {
    const { authorized, error: authError, context } = await requirePermission(
      req,
      projectId,
      body.status === 'resolved' || body.status === 'dismissed'
        ? 'can_resolve_findings'
        : 'can_edit_findings',
    );
    if (!authorized) return authError!;

    if (context?.role === 'abogado_area' && context.areaCode && findingArea && context.areaCode !== findingArea) {
      return NextResponse.json(
        { success: false, error: `abogado_area can only edit findings in area ${context.areaCode}` },
        { status: 403 },
      );
    }

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
    const { authorized, error: authError, context } = await requirePermission(
      req,
      projectId,
      'can_change_finding_tier',
    );
    if (!authorized) return authError!;

    if (context?.role === 'abogado_area' && context.areaCode && findingArea && context.areaCode !== findingArea) {
      return NextResponse.json(
        { success: false, error: `abogado_area can only edit findings in area ${context.areaCode}` },
        { status: 403 },
      );
    }

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
    const { authorized, error: authError, context } = await requirePermission(
      req,
      projectId,
      'can_edit_findings',
    );
    if (!authorized) return authError!;

    if (context?.role === 'abogado_area' && context.areaCode && findingArea && context.areaCode !== findingArea) {
      return NextResponse.json(
        { success: false, error: `abogado_area can only edit findings in area ${context.areaCode}` },
        { status: 403 },
      );
    }

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
  const { authorized, error: authError, context } = await requirePermission(
    req,
    projectId,
    'can_edit_findings',
  );
  if (!authorized) return authError!;

  if (context?.role === 'abogado_area' && context.areaCode && findingArea && context.areaCode !== findingArea) {
    return NextResponse.json(
      { success: false, error: `abogado_area can only edit findings in area ${context.areaCode}` },
      { status: 403 },
    );
  }

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

  if (updatePayload.area_code && typeof updatePayload.area_code === 'string') {
    updatePayload.area_code = (updatePayload.area_code as string).trim().toUpperCase();
  }

  if (context?.role === 'abogado_area' && context.areaCode && updatePayload.area_code && context.areaCode !== updatePayload.area_code) {
    return NextResponse.json(
      { success: false, error: `abogado_area can only edit findings in area ${context.areaCode}` },
      { status: 403 },
    );
  }

  if (updatePayload.severity && !VALID_SEVERITIES.has(String(updatePayload.severity))) {
    return NextResponse.json(
      { success: false, error: 'Invalid severity value' },
      { status: 400 },
    );
  }

  if (updatePayload.probability && !VALID_PROBABILITIES.has(String(updatePayload.probability))) {
    return NextResponse.json(
      { success: false, error: 'Invalid probability value' },
      { status: 400 },
    );
  }

  if (updatePayload.timing && !VALID_TIMINGS.has(String(updatePayload.timing))) {
    return NextResponse.json(
      { success: false, error: 'Invalid timing value' },
      { status: 400 },
    );
  }

  if (updatePayload.economic_impact_type && !VALID_IMPACT_TYPES.has(String(updatePayload.economic_impact_type))) {
    return NextResponse.json(
      { success: false, error: 'Invalid economic_impact_type value' },
      { status: 400 },
    );
  }

  if (updatePayload.objective_id) {
    const { data: objective, error } = await supabaseAdmin
      .from('dd_finding_objectives')
      .select('id, area_code, is_active')
      .eq('id', updatePayload.objective_id as string)
      .single();

    if (error || !objective || objective.is_active !== true) {
      return NextResponse.json(
        { success: false, error: 'objective_id is invalid or inactive' },
        { status: 400 },
      );
    }

    const targetAreaCode = String(updatePayload.area_code || findingArea || '');
    if (targetAreaCode && objective.area_code !== targetAreaCode) {
      return NextResponse.json(
        { success: false, error: `objective area (${objective.area_code}) does not match finding area (${targetAreaCode})` },
        { status: 400 },
      );
    }
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

// ---------------------------------------------------------------------------
// DELETE /api/findings/[id]
// Soft-delete (archive) finding while preserving FK traceability.
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let archiveReason: string | null = null;
  try {
    const body = await req.json();
    if (body?.archive_reason && typeof body.archive_reason === 'string') {
      archiveReason = body.archive_reason;
    }
  } catch {
    // Body is optional in DELETE
  }

  const { data: finding, error: fetchErr } = await supabaseAdmin
    .from('dd_findings')
    .select('id, project_id, area_code, is_active')
    .eq('id', id)
    .single();

  if (fetchErr || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 },
    );
  }

  const { authorized, error: authError, context } = await requirePermission(
    req,
    finding.project_id as string,
    'can_edit_findings',
  );
  if (!authorized) return authError!;

  if (
    context?.role === 'abogado_area' &&
    context.areaCode &&
    finding.area_code &&
    context.areaCode !== finding.area_code
  ) {
    return NextResponse.json(
      { success: false, error: `abogado_area can only archive findings in area ${context.areaCode}` },
      { status: 403 },
    );
  }

  const { data: project, error: projectErr } = await supabaseAdmin
    .from('dd_projects')
    .select('status')
    .eq('id', finding.project_id)
    .single();

  if (projectErr || !project) {
    return NextResponse.json(
      { success: false, error: 'Project not found for finding' },
      { status: 404 },
    );
  }

  if (project.status !== 'closed') {
    return NextResponse.json(
      { success: false, error: 'Findings can only be archived when the project is closed' },
      { status: 409 },
    );
  }

  const { data: archived, error: archiveErr } = await supabaseAdmin
    .from('dd_findings')
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      archived_by: context?.userId || null,
      archive_reason: archiveReason,
    })
    .eq('id', id)
    .select()
    .single();

  if (archiveErr) {
    return NextResponse.json(
      { success: false, error: archiveErr.message },
      { status: 500 },
    );
  }

  await emitEvent({
    type: 'finding_archived',
    payload: {
      finding_id: id,
      project_id: finding.project_id,
      archived_by: context?.userId,
      archive_reason: archiveReason,
      already_inactive: finding.is_active === false,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: archived });
}
