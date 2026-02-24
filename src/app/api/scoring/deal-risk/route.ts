import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { calculateDealRiskScore, type ScoringInput } from '@/lib/scoring';
import { isFindingsFirstEnabled, getFindingsForScoring } from '@/lib/findings';

// ---------------------------------------------------------------------------
// POST /api/scoring/deal-risk
// Calculate deal risk score for a project and persist results.
// Body: { project_id: string, area_weights?: Record<string, number> }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, area_weights: requestAreaWeights } = body as {
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
    // 0. Load scoring config from DB (fallback to hardcoded defaults)
    // -----------------------------------------------------------------------
    const { data: configData } = await supabaseAdmin
      .from('dd_scoring_config')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    // Use request-provided weights, or DB config, or hardcoded defaults
    const area_weights = requestAreaWeights ??
      (configData?.area_weights as Record<string, number> | null) ??
      { MERC: 1.0, CONT: 1.2, LAB: 0.8, FISC: 1.0, PI: 0.7, LIT: 1.1, ADM: 0.9, GENERAL: 0.5 };

    // -----------------------------------------------------------------------
    // 1. Load findings — FINDINGS_FIRST or legacy path
    // -----------------------------------------------------------------------
    let findings: ScoringInput[];

    if (isFindingsFirstEnabled()) {
      // ---- FINDINGS_FIRST: read from dd_findings ----
      const ffFindings = await getFindingsForScoring(project_id);
      findings = ffFindings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        probability: f.probability,
        economic_impact_amount: f.economic_impact_amount,
        area_code: f.area_code,
        hitl_decision: f.hitl_decision,
      }));
      console.log(`[Scoring] FINDINGS_FIRST: loaded ${findings.length} findings from dd_findings`);
    } else {
      // ---- LEGACY: read from dd_contingencies + dd_negotiation_alerts ----
      findings = await loadLegacyFindings(project_id);
    }

    // -----------------------------------------------------------------------
    // 2. Calculate deal risk score
    // -----------------------------------------------------------------------
    const result = calculateDealRiskScore(findings, area_weights);

    // -----------------------------------------------------------------------
    // 3. Persist to dd_deal_risk_scores
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
    // 4. Update individual findings/contingencies with risk_score + is_deal_breaker
    // -----------------------------------------------------------------------
    if (isFindingsFirstEnabled()) {
      // Update dd_findings rows with weighted_score from scoring engine
      const updatePromises: Promise<unknown>[] = [];
      for (const sf of result.scored_findings) {
        updatePromises.push(
          Promise.resolve(
            supabaseAdmin
              .from('dd_findings')
              .update({
                weighted_score: sf.weighted_score,
                is_deal_breaker: sf.is_deal_breaker,
              })
              .eq('id', sf.id),
          ),
        );
      }
      await Promise.allSettled(updatePromises);
    } else {
      // Legacy: update dd_contingencies
      const contingencyIds = new Set(
        findings
          .filter((f) => !f.id.startsWith('alert_'))
          .map((f) => f.id),
      );
      const updatePromises: Promise<unknown>[] = [];
      for (const sf of result.scored_findings) {
        if (!contingencyIds.has(sf.id)) continue;
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
      await Promise.allSettled(updatePromises);
    }

    return NextResponse.json({
      success: true,
      score_id: scoreRecord?.id || null,
      source: isFindingsFirstEnabled() ? 'dd_findings' : 'legacy',
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
// Legacy path: load from dd_contingencies + dd_negotiation_alerts + HITL filter
// ---------------------------------------------------------------------------

async function loadLegacyFindings(projectId: string): Promise<ScoringInput[]> {
  const { data: contingencies, error: contErr } = await supabaseAdmin
    .from('dd_contingencies')
    .select('id, title, severity, probability, estimated_amount, status, area_id')
    .eq('project_id', projectId);

  if (contErr) {
    console.error('Failed to load contingencies:', contErr.message);
    return [];
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

  // Load negotiation alerts
  const { data: alerts } = await supabaseAdmin
    .from('dd_negotiation_alerts')
    .select('id, titulo, severity, area_code, recomendacion, status, impacto_negociacion')
    .eq('project_id', projectId);

  // Load HITL decisions to filter out rejected findings
  const { data: hitlDecisions } = await supabaseAdmin
    .from('dd_hitl_decisions')
    .select('task_id, decision, finding_title')
    .eq('project_id', projectId);

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

  const findings: ScoringInput[] = [];

  // From contingencies
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

  // From negotiation alerts
  if (alerts) {
    for (const a of alerts) {
      const hitlDecision = rejectedTitles.has(a.titulo?.toLowerCase()) ? 'rejected' : undefined;
      findings.push({
        id: a.id,
        title: a.titulo,
        severity: a.severity,
        probability: 'possible',
        area_code: a.area_code || 'GENERAL',
        hitl_decision: hitlDecision,
      });
    }
  }

  return findings;
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
