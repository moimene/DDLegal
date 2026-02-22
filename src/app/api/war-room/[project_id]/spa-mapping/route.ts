import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * GET /api/war-room/[project_id]/spa-mapping
 * N.3: SPA Clause Mapping Dashboard
 *
 * Maps contingencies/findings to proposed SPA clauses and negotiation actions.
 * Provides two views:
 *   - "SPA view": grouped by spa_clause_id
 *   - "findings view": grouped by finding_ref
 * Calculates coverage metrics and economic exposure.
 *
 * Returns:
 *   spa_clauses[]       — clauses with linked actions and findings
 *   uncovered_findings[] — contingencies without negotiation actions
 *   coverage_pct        — % of contingencies covered by at least one action
 *   total_economic_exposure   — sum of contingency estimated_amount
 *   total_proposed_mitigation — sum of action economic_impact_amount
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_view_war_room'
  );
  if (!authorized) return authError!;

  try {
    // 1. Load negotiation actions, contingencies, and SPA clause library in parallel
    const [actionsRes, contingenciesRes, clauseLibraryRes, clauseMapRes] =
      await Promise.all([
        supabaseAdmin
          .from('dd_negotiation_actions')
          .select('*')
          .eq('project_id', project_id)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('dd_contingencies')
          .select('*, dd_areas(code, name)')
          .eq('project_id', project_id)
          .order('severity', { ascending: true }),
        supabaseAdmin
          .from('dd_spa_clause_library')
          .select('*')
          .eq('is_active', true),
        supabaseAdmin
          .from('dd_contingency_clause_map')
          .select('*'),
      ]);

    const actions = actionsRes.data || [];
    const contingencies = contingenciesRes.data || [];
    const clauseLibrary = clauseLibraryRes.data || [];
    const clauseMaps = clauseMapRes.data || [];

    // 2. Build a lookup: contingency_id -> contingency
    const contingencyById = new Map<string, Record<string, unknown>>();
    for (const c of contingencies) {
      contingencyById.set(c.id, c);
    }

    // 3. Build SPA clause view: group actions by spa_clause_id
    //    Also track which contingencies have coverage
    const coveredContingencyIds = new Set<string>();
    const clauseActionMap = new Map<
      string,
      {
        clause_id: string;
        clause_key: string | null;
        clause_title: string | null;
        clause_type: string | null;
        actions: Array<{
          id: string;
          action_type: string;
          title: string;
          status: string;
          economic_impact_amount: number | null;
          economic_impact_currency: string;
          finding_ref: string | null;
          contingency_id: string | null;
        }>;
        linked_contingency_ids: Set<string>;
      }
    >();

    // Also build a lookup for clause library by id
    const clauseLibraryById = new Map<string, Record<string, unknown>>();
    for (const cl of clauseLibrary) {
      clauseLibraryById.set(cl.id, cl);
    }

    for (const action of actions) {
      // Track coverage: any contingency linked via contingency_id or finding_ref
      if (action.contingency_id) {
        coveredContingencyIds.add(action.contingency_id);
      }

      const clauseId = action.spa_clause_id || '__unassigned__';
      if (!clauseActionMap.has(clauseId)) {
        const clauseInfo = clauseId !== '__unassigned__'
          ? clauseLibraryById.get(clauseId)
          : null;
        clauseActionMap.set(clauseId, {
          clause_id: clauseId,
          clause_key: (clauseInfo?.clause_key as string) || null,
          clause_title: (clauseInfo?.title as string) || (clauseId === '__unassigned__' ? 'Sin clausula asignada' : null),
          clause_type: (clauseInfo?.clause_type as string) || null,
          actions: [],
          linked_contingency_ids: new Set(),
        });
      }

      const entry = clauseActionMap.get(clauseId)!;
      entry.actions.push({
        id: action.id,
        action_type: action.action_type,
        title: action.title,
        status: action.status,
        economic_impact_amount: action.economic_impact_amount,
        economic_impact_currency: action.economic_impact_currency || 'EUR',
        finding_ref: action.finding_ref,
        contingency_id: action.contingency_id,
      });

      if (action.contingency_id) {
        entry.linked_contingency_ids.add(action.contingency_id);
      }
    }

    // Also consider contingencies mapped to clauses via dd_contingency_clause_map
    for (const cm of clauseMaps) {
      coveredContingencyIds.add(cm.contingency_id);
    }

    // 4. Build spa_clauses response
    const spa_clauses = Array.from(clauseActionMap.values()).map((entry) => {
      const linkedFindings = Array.from(entry.linked_contingency_ids)
        .map((cid) => {
          const c = contingencyById.get(cid);
          if (!c) return null;
          const area = c.dd_areas as Record<string, unknown> | null;
          return {
            id: c.id,
            title: c.title,
            severity: c.severity,
            area_code: area?.code || null,
            estimated_amount: c.estimated_amount,
          };
        })
        .filter(Boolean);

      // Determine coverage status for this clause
      const actionStatuses = entry.actions.map((a) => a.status);
      const allAccepted = actionStatuses.length > 0 && actionStatuses.every((s) => s === 'accepted');
      const someAccepted = actionStatuses.some((s) => s === 'accepted');
      const coverage_status: 'fully_covered' | 'partially_covered' | 'uncovered' =
        allAccepted
          ? 'fully_covered'
          : someAccepted
            ? 'partially_covered'
            : entry.actions.length > 0
              ? 'partially_covered'
              : 'uncovered';

      return {
        clause_id: entry.clause_id,
        clause_key: entry.clause_key,
        clause_title: entry.clause_title,
        clause_type: entry.clause_type,
        actions: entry.actions,
        linked_findings: linkedFindings,
        coverage_status,
      };
    });

    // 5. Uncovered findings: contingencies with no negotiation action
    const uncovered_findings = contingencies
      .filter((c) => !coveredContingencyIds.has(c.id))
      .map((c) => {
        const area = c.dd_areas as Record<string, unknown> | null;
        return {
          id: c.id,
          title: c.title,
          severity: c.severity,
          area_code: area?.code || null,
          probability: c.probability,
          estimated_amount: c.estimated_amount,
          status: c.status,
        };
      });

    // 6. Coverage metrics
    const totalContingencies = contingencies.length;
    const coveredCount = coveredContingencyIds.size;
    const coverage_pct =
      totalContingencies > 0
        ? Math.round((coveredCount / totalContingencies) * 100)
        : 0;

    // 7. Economic summaries
    const total_economic_exposure = contingencies.reduce(
      (sum, c) => sum + (Number(c.estimated_amount) || 0),
      0
    );
    const total_proposed_mitigation = actions.reduce(
      (sum, a) => sum + (Number(a.economic_impact_amount) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      project_id,
      spa_clauses,
      uncovered_findings,
      coverage_pct,
      total_contingencies: totalContingencies,
      covered_contingencies: coveredCount,
      total_economic_exposure,
      total_proposed_mitigation,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
