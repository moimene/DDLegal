/**
 * GET /api/worker/coverage
 *
 * Get detailed coverage metrics for a project's worker.
 * Query params: project_id (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface AreaCoverage {
  area_code: string;
  area_name: string;
  fos_applicable: number;
  fos_evaluated: number;
  fos_pending: number;
  fos_with_findings: number;
  coverage_pct: number;
}

interface CoverageResponse {
  project_id: string;
  overall_coverage: number;
  by_area: AreaCoverage[];
  gaps: Array<{
    objective_key: string;
    area_code: string;
    reason: string;
  }>;
  last_updated: string;
}

const AREA_NAMES: Record<string, string> = {
  MERC: 'Mercantil y Societario',
  CONT: 'Contractual',
  FISC: 'Fiscal y Tributario',
  LAB: 'Laboral',
  PI: 'Propiedad Intelectual',
  LIT: 'Litigios',
  ADM: 'Administrativo',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id query parameter is required' },
        { status: 400 }
      );
    }

    // Check authorization
    const { authorized, error: authError } = await requirePermission(
      request,
      projectId,
      'can_view_reports'
    );
    if (!authorized) return authError!;

    // Get FO document status by area
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('dd_fo_document_status')
      .select(`
        status,
        dd_finding_objectives!inner(objective_key, area_code)
      `)
      .eq('project_id', projectId);

    if (statusError) {
      console.error('[api/worker/coverage] Status query error:', statusError);
      return NextResponse.json(
        { error: 'Failed to fetch coverage data' },
        { status: 500 }
      );
    }

    // Get findings count by area
    const { data: findingsData } = await supabaseAdmin
      .from('dd_findings')
      .select('area_code')
      .eq('project_id', projectId)
      .neq('status', 'dismissed');

    const findingsByArea: Record<string, number> = {};
    for (const f of findingsData || []) {
      const area = f.area_code || 'OTROS';
      findingsByArea[area] = (findingsByArea[area] || 0) + 1;
    }

    // Calculate coverage by area
    const areaStats: Record<string, {
      applicable: number;
      evaluated: number;
      pending: number;
    }> = {};

    for (const row of statusData || []) {
      const foData = row.dd_finding_objectives;
      const areaCode = Array.isArray(foData)
        ? (foData[0] as { area_code: string })?.area_code
        : (foData as { area_code: string })?.area_code;

      if (!areaCode) continue;

      if (!areaStats[areaCode]) {
        areaStats[areaCode] = { applicable: 0, evaluated: 0, pending: 0 };
      }

      areaStats[areaCode].applicable++;

      if (row.status === 'analyzed') {
        areaStats[areaCode].evaluated++;
      } else if (row.status === 'pending') {
        areaStats[areaCode].pending++;
      }
    }

    // Build response
    const byArea: AreaCoverage[] = Object.entries(areaStats).map(([code, stats]) => ({
      area_code: code,
      area_name: AREA_NAMES[code] || code,
      fos_applicable: stats.applicable,
      fos_evaluated: stats.evaluated,
      fos_pending: stats.pending,
      fos_with_findings: findingsByArea[code] || 0,
      coverage_pct: stats.applicable > 0
        ? Math.round((stats.evaluated / stats.applicable) * 100)
        : 0,
    }));

    // Calculate overall
    const totalApplicable = byArea.reduce((sum, a) => sum + a.fos_applicable, 0);
    const totalEvaluated = byArea.reduce((sum, a) => sum + a.fos_evaluated, 0);
    const overallCoverage = totalApplicable > 0
      ? Math.round((totalEvaluated / totalApplicable) * 100)
      : 0;

    // Get gaps (FOs that can't be evaluated due to missing data)
    const { data: gapsData } = await supabaseAdmin
      .from('dd_fo_document_status')
      .select(`
        dd_finding_objectives!inner(objective_key, area_code)
      `)
      .eq('project_id', projectId)
      .eq('status', 'skipped');

    const gaps = (gapsData || []).map(row => {
      const foData = row.dd_finding_objectives;
      const fo = Array.isArray(foData) ? foData[0] : foData;
      return {
        objective_key: (fo as { objective_key: string })?.objective_key || 'unknown',
        area_code: (fo as { area_code: string })?.area_code || 'unknown',
        reason: 'Insufficient data to evaluate',
      };
    });

    const response: CoverageResponse = {
      project_id: projectId,
      overall_coverage: overallCoverage,
      by_area: byArea.sort((a, b) => a.area_code.localeCompare(b.area_code)),
      gaps: gaps.slice(0, 20), // Limit to 20
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[api/worker/coverage] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
