import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  getProjectFindings,
  getProjectFindingsSummary,
  type FindingStatus,
} from '@/lib/findings/findings-service';
import { generateFindingSummary } from '@/lib/findings/summary-generator';
import { emitEvent } from '@/lib/events';

interface CreateFindingInput {
  project_id: string;
  area_code: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  probability: 'certain' | 'alta' | 'probable' | 'media' | 'possible' | 'baja' | 'remote';
  objective_id?: string | null;
  summary?: string | null;
  description?: string | null;
  timing?: string | null;
  mitigation_recommended?: string | null;
  economic_impact_amount?: number | null;
  economic_impact_currency?: string | null;
  economic_impact_type?: string | null;
  metadata?: Record<string, unknown>;
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);
const VALID_PROBABILITIES = new Set(['certain', 'alta', 'probable', 'media', 'possible', 'baja', 'remote']);
const VALID_TIMINGS = new Set(['blocking', 'post_closing', 'pre_closing', 'pre-close', 'post-close', 'ongoing', 'immediate']);
const VALID_IMPACT_TYPES = new Set(['contingency', 'liability', 'loss', 'operational_cost', 'direct', 'indirect', 'reputational']);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function calculateTierForManualFinding(input: CreateFindingInput): number {
  if (input.severity === 'critical') return 1;
  if (input.severity === 'high' && ['certain', 'alta', 'probable'].includes(input.probability)) return 1;
  if (input.severity === 'high') return 2;
  if (input.severity === 'medium' && (input.economic_impact_amount || 0) > 0) return 2;
  if (input.timing === 'blocking') return 2;
  return 3;
}

// ⚡ Bolt: Optimize performance by replacing multiple O(N) array loops (.filter().length)
// with a single O(N) pass to calculate all metrics, reducing iterations from ~23x to 1x.
function buildSummaryFromRows(
  rows: Array<{
    relevance_tier: number;
    status: string;
    severity: string;
    area_code: string | null;
    is_deal_breaker: boolean | null;
    is_red_flag: boolean | null;
    economic_impact_amount: number | null;
    hitl_required: boolean | null;
    hitl_decision: string | null;
  }>,
) {
  let totalEconomicExposure = 0;
  let deal_breakers_count = 0;
  let red_flags_count = 0;
  let pending_hitl = 0;
  let active_count = 0;

  const by_tier = { '1': 0, '2': 0, '3': 0 };
  const by_status = {
    identified: 0,
    under_review: 0,
    validated: 0,
    contested: 0,
    accepted: 0,
    mitigated: 0,
    reported: 0,
    negotiated: 0,
    resolved: 0,
    dismissed: 0,
  };
  const by_severity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  const by_area: Record<string, number> = {};

  for (const r of rows) {
    const isDismissed = r.status === 'dismissed';
    const isResolved = r.status === 'resolved';

    // Total Economic Exposure
    if (!isDismissed && !isResolved && (r.relevance_tier === 1 || r.relevance_tier === 2)) {
      totalEconomicExposure += Number(r.economic_impact_amount || 0);
    }

    // By Area
    if (!isDismissed) {
      const area = r.area_code || 'GENERAL';
      by_area[area] = (by_area[area] || 0) + 1;
    }

    // By Tier
    if (r.relevance_tier === 1) by_tier['1']++;
    else if (r.relevance_tier === 2) by_tier['2']++;
    else if (r.relevance_tier === 3) by_tier['3']++;

    // By Status
    switch (r.status) {
      case 'identified': by_status.identified++; break;
      case 'under_review': by_status.under_review++; break;
      case 'validated': by_status.validated++; break;
      case 'contested': by_status.contested++; break;
      case 'accepted': by_status.accepted++; break;
      case 'mitigated': by_status.mitigated++; break;
      case 'reported': by_status.reported++; break;
      case 'negotiated': by_status.negotiated++; break;
      case 'resolved': by_status.resolved++; break;
      case 'dismissed': by_status.dismissed++; break;
    }

    // By Severity
    switch (r.severity) {
      case 'critical': by_severity.critical++; break;
      case 'high': by_severity.high++; break;
      case 'medium': by_severity.medium++; break;
      case 'low': by_severity.low++; break;
      case 'informational': by_severity.informational++; break;
    }

    // Additional metrics
    if (r.is_deal_breaker && !isDismissed) deal_breakers_count++;
    if (r.is_red_flag && !isDismissed) red_flags_count++;
    if (r.hitl_required && !r.hitl_decision && !isDismissed) pending_hitl++;
    if (!isDismissed && !isResolved) active_count++;
  }

  return {
    total: rows.length,
    by_tier,
    by_status,
    by_severity,
    by_area,
    deal_breakers_count,
    red_flags_count,
    total_economic_exposure: totalEconomicExposure,
    pending_hitl,
    active_count,
  };
}

// ---------------------------------------------------------------------------
// GET /api/findings?project_id=...&tier=1,2&status=identified,validated&area_code=MERC&summary=true
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 },
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_view_findings',
  );
  if (!authorized) return authError!;

  const isSummary = searchParams.get('summary') === 'true';
  const includeInactive = searchParams.get('include_inactive') === 'true';

  if (isSummary && includeInactive) {
    const summary = await getProjectFindingsSummary(projectId);
    return NextResponse.json({ success: true, data: summary });
  }

  // List mode: return paginated findings
  const tierParam = searchParams.get('tier');
  const statusParam = searchParams.get('status');
  const severityParam = searchParams.get('severity');
  const areaCode = searchParams.get('area_code');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (isSummary && !includeInactive) {
    const { data, error } = await supabaseAdmin
      .from('dd_findings')
      .select('relevance_tier, status, severity, area_code, is_deal_breaker, is_red_flag, economic_impact_amount, hitl_required, hitl_decision')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: buildSummaryFromRows(data || []),
    });
  }

  const findings = await getProjectFindings(projectId, {
    tier: tierParam ? tierParam.split(',').map(Number).filter(n => [1, 2, 3].includes(n)) : undefined,
    status: statusParam ? statusParam.split(',') as FindingStatus[] : undefined,
    severity: severityParam ? severityParam.split(',') : undefined,
    area_code: areaCode || undefined,
    include_inactive: includeInactive,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: findings,
    pagination: { limit, offset, count: findings.length },
  });
}

// ---------------------------------------------------------------------------
// POST /api/findings
// Creates a manual finding for a project.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: CreateFindingInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.project_id || !body.area_code || !body.title || !body.severity || !body.probability) {
    return NextResponse.json(
      { success: false, error: 'project_id, area_code, title, severity and probability are required' },
      { status: 400 },
    );
  }

  if (!VALID_SEVERITIES.has(body.severity)) {
    return NextResponse.json(
      { success: false, error: 'Invalid severity value' },
      { status: 400 },
    );
  }

  if (!VALID_PROBABILITIES.has(body.probability)) {
    return NextResponse.json(
      { success: false, error: 'Invalid probability value' },
      { status: 400 },
    );
  }

  if (body.timing && !VALID_TIMINGS.has(body.timing)) {
    return NextResponse.json(
      { success: false, error: 'Invalid timing value' },
      { status: 400 },
    );
  }

  if (body.economic_impact_type && !VALID_IMPACT_TYPES.has(body.economic_impact_type)) {
    return NextResponse.json(
      { success: false, error: 'Invalid economic_impact_type value' },
      { status: 400 },
    );
  }

  const { authorized, error: authError, context } = await requirePermission(
    req,
    body.project_id,
    'can_edit_findings',
  );
  if (!authorized) return authError!;

  const normalizedAreaCode = body.area_code.trim().toUpperCase();
  if (context?.role === 'abogado_area' && context.areaCode && context.areaCode !== normalizedAreaCode) {
    return NextResponse.json(
      { success: false, error: `abogado_area can only create findings in area ${context.areaCode}` },
      { status: 403 },
    );
  }

  if (body.objective_id) {
    const { data: objective, error } = await supabaseAdmin
      .from('dd_finding_objectives')
      .select('id, area_code, is_active')
      .eq('id', body.objective_id)
      .single();

    if (error || !objective || objective.is_active !== true) {
      return NextResponse.json(
        { success: false, error: 'objective_id is invalid or inactive' },
        { status: 400 },
      );
    }

    if (objective.area_code !== normalizedAreaCode) {
      return NextResponse.json(
        { success: false, error: `objective area (${objective.area_code}) does not match finding area (${normalizedAreaCode})` },
        { status: 400 },
      );
    }
  }

  const manualTier = calculateTierForManualFinding({
    ...body,
    area_code: normalizedAreaCode,
  });

  const normalizedSummary = body.summary?.trim() || null;
  const findingSummary = normalizedSummary || await generateFindingSummary({
    title: body.title.trim(),
    description: body.description || null,
    severity: body.severity,
    area_code: normalizedAreaCode,
    probability: body.probability,
    timing: body.timing || null,
    mitigation: body.mitigation_recommended || null,
  });

  const externalRef = `manual:${body.project_id}:${Date.now()}:${slugify(body.title)}:${randomUUID().slice(0, 8)}`;
  const isRedFlag = body.severity === 'critical' || body.severity === 'high';

  const insertPayload: Record<string, unknown> = {
    project_id: body.project_id,
    external_ref: externalRef,
    source_type: 'manual_entry',
    area_code: normalizedAreaCode,
    title: body.title.trim(),
    summary: findingSummary,
    description: body.description || null,
    severity: body.severity,
    probability: body.probability,
    timing: body.timing || null,
    status: 'identified',
    relevance_tier: manualTier,
    tier_auto_calculated: manualTier,
    objective_id: body.objective_id || null,
    economic_impact_amount: body.economic_impact_amount ?? null,
    economic_impact_currency: body.economic_impact_currency || 'EUR',
    economic_impact_type: body.economic_impact_type || null,
    mitigation_recommended: body.mitigation_recommended || null,
    is_red_flag: isRedFlag,
    hitl_required: isRedFlag,
    created_by: context?.userId || null,
    metadata: body.metadata || {},
    is_active: true,
  };

  const { data: created, error: insertError } = await supabaseAdmin
    .from('dd_findings')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 },
    );
  }

  await emitEvent({
    type: 'finding_created',
    payload: {
      finding_id: created.id,
      project_id: body.project_id,
      area_code: normalizedAreaCode,
      source_type: 'manual_entry',
      created_by: context?.userId,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
