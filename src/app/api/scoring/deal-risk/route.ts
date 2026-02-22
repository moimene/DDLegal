import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { calculateDealRiskScore, type ScoringInput } from '@/lib/scoring';

// ---------------------------------------------------------------------------
// POST /api/scoring/deal-risk
// Calculate deal risk score for a project and persist results.
// Body: { project_id: string, area_weights?: Record<string, number> }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, area_weights } = body as {
      project_id?: string;
      area_weights?: Record<string, number>;
    };

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: 'project_id is required' },
        { status: 400 },
      );
    }

    // Only CLO / PM can trigger scoring (uses can_manage_contingencies or can_edit_contingencies)
    const { authorized, context, error: authError } = await requirePermission(
      req,
      project_id,
      'can_edit_contingencies',
    );
    if (!authorized) return authError!;

    // -----------------------------------------------------------------------
    // 1. Load all contingencies for the project (with area code via join)
    // -----------------------------------------------------------------------
    const { data: contingencies, error: contErr } = await supabaseAdmin
      .from('dd_contingencies')
      .select('id, title, severity, probability, estimated_amount, status, area_id')
      .eq('project_id', project_id);

    if (contErr) {
      return NextResponse.json(
        { success: false, error: 'Failed to load contingencies', details: contErr.message },
        { status: 500 },
      );
    }

    // Load areas to resolve area_id -> area code
    const { data: areas } = await supabaseAdmin
      .from('dd_areas')
      .select('id, code');

    const areaMap = new Map<string, string>();
    if (areas) {
      for (const a of areas) {
        areaMap.set(a.id, a.code);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Load negotiation alerts for the project
    // -----------------------------------------------------------------------
    const { data: alerts, error: alertErr } = await supabaseAdmin
      .from('dd_negotiation_alerts')
      .select('id, titulo, severity, area_code, recomendacion, status, impacto_negociacion')
      .eq('project_id', project_id);

    if (alertErr) {
      return NextResponse.json(
        { success: false, error: 'Failed to load negotiation alerts', details: alertErr.message },
        { status: 500 },
      );
    }

    // -----------------------------------------------------------------------
    // 3. Load HITL decisions to filter out rejected findings
    //    We look for decisions linked to tasks whose titles match contingency/alert titles,
    //    or decisions that have a specific finding reference.
    // -----------------------------------------------------------------------
    const { data: hitlDecisions } = await supabaseAdmin
      .from('dd_hitl_decisions')
      .select('task_id, decision, finding_title')
      .eq('project_id', project_id);

    // Build a set of rejected finding titles for exclusion
    const rejectedTitles = new Set<string>();
    if (hitlDecisions) {
      for (const d of hitlDecisions) {
        if (d.decision === 'reject' || d.decision === 'rejected') {
          if (d.finding_title) {
            rejectedTitles.add(d.finding_title.toLowerCase());
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Map to ScoringInput[]
    // -----------------------------------------------------------------------
    const findings: ScoringInput[] = [];

    // Contingencies
    if (contingencies) {
      for (const c of contingencies) {
        const areaCode = c.area_id ? (areaMap.get(c.area_id) || 'GENERAL') : 'GENERAL';
        const hitlDecision = rejectedTitles.has(c.title?.toLowerCase()) ? 'rejected' : undefined;
        findings.push({
          id: c.id,
          title: c.title,
          severity: c.severity,
          probability: c.probability,
          economic_impact_amount: c.estimated_amount ? Number(c.estimated_amount) : undefined,
          area_code: areaCode,
          hitl_decision: hitlDecision,
        });
      }
    }

    // Negotiation alerts (map titulo -> title, impacto_negociacion as supplementary)
    if (alerts) {
      for (const a of alerts) {
        const hitlDecision = rejectedTitles.has(a.titulo?.toLowerCase()) ? 'rejected' : undefined;
        findings.push({
          id: a.id,
          title: a.titulo,
          severity: a.severity,
          probability: 'possible', // alerts don't have probability; default to possible
          area_code: a.area_code || 'GENERAL',
          hitl_decision: hitlDecision,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 5. Calculate deal risk score
    // -----------------------------------------------------------------------
    const result = calculateDealRiskScore(findings, area_weights);

    // -----------------------------------------------------------------------
    // 6. Persist to dd_deal_risk_scores
    // -----------------------------------------------------------------------
    const { data: scoreRecord, error: insertErr } = await supabaseAdmin
      .from('dd_deal_risk_scores')
      .insert({
        project_id,
        overall_score: result.overall_score,
        recommendation: result.recommendation,
        area_scores: result.area_scores,
        deal_breakers: result.deal_breakers,
        top_risks: result.top_risks,
        sensitivity: result.sensitivity,
        total_economic_exposure: result.total_economic_exposure,
        scored_by: context?.userId || null,
        area_weights: area_weights || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Failed to persist deal risk score:', insertErr.message);
      // Still return the calculated score even if persistence fails
    }

    // -----------------------------------------------------------------------
    // 7. Update individual contingencies with risk_score + is_deal_breaker
    // -----------------------------------------------------------------------
    const contingencyIds = new Set((contingencies || []).map((c) => c.id));
    const updatePromises: Promise<unknown>[] = [];

    for (const sf of result.scored_findings) {
      if (!contingencyIds.has(sf.id)) continue; // skip alerts

      const recommendation = sf.weighted_score < 30 ? 'go'
        : sf.weighted_score <= 65 ? 'conditional_go'
        : 'no_go';

      updatePromises.push(
        Promise.resolve(
          supabaseAdmin
            .from('dd_contingencies')
            .update({
              risk_score: sf.weighted_score,
              go_no_go: recommendation,
              is_deal_breaker: sf.is_deal_breaker,
            })
            .eq('id', sf.id),
        ),
      );
    }

    // Fire-and-forget updates (best effort)
    await Promise.allSettled(updatePromises);

    return NextResponse.json({
      success: true,
      score_id: scoreRecord?.id || null,
      ...result,
    });
  } catch (error) {
    console.error('Deal risk score API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/scoring/deal-risk?project_id=xxx
// Get the latest deal risk score for a project.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: 'project_id query parameter is required' },
        { status: 400 },
      );
    }

    // Permission check — any project member can view
    const { authorized, error: authError } = await requirePermission(
      req,
      project_id,
      'can_view_contingencies',
    );
    if (!authorized) return authError!;

    // Fetch the most recent score
    const { data: score, error: fetchErr } = await supabaseAdmin
      .from('dd_deal_risk_scores')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !score) {
      return NextResponse.json(
        { success: false, error: 'No deal risk score found for this project' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, ...score });
  } catch (error) {
    console.error('Deal risk score GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
