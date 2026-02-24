/**
 * GET /api/worker/conclusions
 *
 * Get area conclusions for a project's worker.
 * Query params: project_id (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface KeyFinding {
  findingId: string;
  title: string;
  severity: string;
  economicImpact?: number;
}

interface Pattern {
  patternType: string;
  description: string;
  affectedFindings: string[];
  severityImpact: 'amplifying' | 'neutral' | 'mitigating';
}

interface Recommendation {
  type: 'mitigation' | 'negotiation' | 'condition_precedent' | 'indemnity';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedCost?: number;
  relatedFindings: string[];
}

interface AreaConclusionResponse {
  id: string;
  area_code: string;
  area_name: string;
  conclusion_narrative: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  risk_score: number;
  stats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    deal_breakers: number;
  };
  recommendations: Recommendation[];
  patterns: Pattern[];
  key_findings: KeyFinding[];
  review_status: 'pending' | 'reviewed' | 'approved';
  generated_at: string;
}

interface ConclusionsResponse {
  project_id: string;
  total_areas: number;
  areas_with_conclusions: number;
  overall_risk_level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  conclusions: AreaConclusionResponse[];
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

    // Get area conclusions
    const { data: conclusionsData, error: conclusionsError } = await supabaseAdmin
      .from('dd_area_conclusions')
      .select('*')
      .eq('project_id', projectId)
      .order('risk_score', { ascending: false });

    if (conclusionsError) {
      console.error('[api/worker/conclusions] Query error:', conclusionsError);
      return NextResponse.json(
        { error: 'Failed to fetch conclusions' },
        { status: 500 }
      );
    }

    // Get areas with findings to calculate coverage
    const { data: findingsData } = await supabaseAdmin
      .from('dd_findings')
      .select('area_code')
      .eq('project_id', projectId)
      .neq('status', 'dismissed');

    const areasWithFindings = new Set((findingsData || []).map(f => f.area_code));

    // Transform conclusions
    const conclusions: AreaConclusionResponse[] = (conclusionsData || []).map(row => ({
      id: row.id,
      area_code: row.area_code,
      area_name: AREA_NAMES[row.area_code] || row.area_code,
      conclusion_narrative: row.conclusion_narrative || '',
      risk_level: row.risk_level || 'minimal',
      risk_score: row.risk_score || 0,
      stats: {
        total: row.findings_total || 0,
        critical: row.findings_critical || 0,
        high: row.findings_high || 0,
        medium: row.findings_medium || 0,
        low: row.findings_low || 0,
        deal_breakers: row.deal_breakers || 0,
      },
      recommendations: (row.recommendations as Recommendation[]) || [],
      patterns: (row.patterns as Pattern[]) || [],
      key_findings: (row.key_findings as KeyFinding[]) || [],
      review_status: row.review_status || 'pending',
      generated_at: row.generated_at || row.created_at,
    }));

    // Determine overall risk level
    const overallRiskLevel = determineOverallRiskLevel(conclusions);

    // Find latest update
    const latestUpdate = conclusions.reduce(
      (latest, c) => {
        const cDate = new Date(c.generated_at).getTime();
        return cDate > latest ? cDate : latest;
      },
      0
    );

    const response: ConclusionsResponse = {
      project_id: projectId,
      total_areas: areasWithFindings.size,
      areas_with_conclusions: conclusions.length,
      overall_risk_level: overallRiskLevel,
      conclusions,
      last_updated: latestUpdate > 0 ? new Date(latestUpdate).toISOString() : new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[api/worker/conclusions] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Determine overall risk level from all area conclusions.
 */
function determineOverallRiskLevel(
  conclusions: AreaConclusionResponse[]
): 'critical' | 'high' | 'medium' | 'low' | 'minimal' {
  if (conclusions.length === 0) return 'minimal';

  // If any area is critical, overall is critical
  if (conclusions.some(c => c.risk_level === 'critical')) {
    return 'critical';
  }

  // If 2+ areas are high, overall is critical
  const highCount = conclusions.filter(c => c.risk_level === 'high').length;
  if (highCount >= 2) {
    return 'critical';
  }

  // If any area is high, overall is high
  if (highCount >= 1) {
    return 'high';
  }

  // If 2+ areas are medium, overall is high
  const mediumCount = conclusions.filter(c => c.risk_level === 'medium').length;
  if (mediumCount >= 2) {
    return 'high';
  }

  // If any area is medium, overall is medium
  if (mediumCount >= 1) {
    return 'medium';
  }

  // If any area is low, overall is low
  if (conclusions.some(c => c.risk_level === 'low')) {
    return 'low';
  }

  return 'minimal';
}
