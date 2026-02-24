import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { isFindingsFirstEnabled, getRedFlagFindings } from '@/lib/findings';

export async function GET(req: NextRequest, { params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;
  const severity = req.nextUrl.searchParams.get('severity');

  // Permission check
  const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_contingencies');
  if (!authorized) return authError!;

  try {
    let redFlags: {
      id: string;
      source: 'alert' | 'contingency' | 'finding';
      title: string;
      severity: string;
      area_code: string | null;
      status: string;
      impact: string | null;
      evidence: string[];
      recommendation: string | null;
      created_at?: string;
      actions: string[];
    }[];

    if (isFindingsFirstEnabled()) {
      // ---- FINDINGS_FIRST: read from dd_findings ----
      const findings = await getRedFlagFindings(project_id);
      redFlags = findings
        .filter((f) => !severity || f.severity === severity)
        .map((f) => ({
          id: f.id,
          source: 'finding' as const,
          title: f.title,
          severity: f.severity,
          area_code: f.area_code,
          status: f.status,
          impact: f.mitigation || null,
          evidence: [],
          recommendation: f.mitigation || null,
          actions: f.is_deal_breaker ? ['deal_breaker'] : [],
        }));
    } else {
      // ---- LEGACY: read from dd_negotiation_alerts + dd_contingencies ----
      let alertQuery = supabaseAdmin.from('dd_negotiation_alerts').select('*').eq('project_id', project_id).order('severity', { ascending: true }).order('created_at', { ascending: false });
      if (severity) alertQuery = alertQuery.eq('severity', severity);

      const [alertsRes, contingenciesRes] = await Promise.all([
        alertQuery,
        supabaseAdmin.from('dd_contingencies').select('*, dd_contingencies_ext(*)').eq('project_id', project_id).in('severity', ['critical', 'high']).order('severity', { ascending: true }),
      ]);

      redFlags = [
        ...(alertsRes.data || []).map(a => ({
          id: a.id, source: 'alert' as const, title: a.titulo, severity: a.severity, area_code: a.area_code, status: a.status,
          impact: a.impacto_negociacion, evidence: a.evidencia || [], recommendation: a.recomendacion, created_at: a.created_at, actions: [] as string[],
        })),
        ...(contingenciesRes.data || []).map((c: Record<string, unknown>) => ({
          id: c.id as string, source: 'contingency' as const, title: c.title as string, severity: c.severity as string,
          area_code: null as string | null, status: c.status as string, impact: c.description as string,
          evidence: [] as string[], recommendation: c.recommendation as string | null, created_at: c.created_at as string,
          actions: (c.dd_contingencies_ext as Record<string, unknown> | null) ? [(c.dd_contingencies_ext as Record<string, unknown>).treatment, (c.dd_contingencies_ext as Record<string, unknown>).negotiation_status].filter(Boolean) as string[] : [],
        })),
      ];
    }

    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    redFlags.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    return NextResponse.json({ success: true, red_flags: redFlags, count: redFlags.length, source: isFindingsFirstEnabled() ? 'dd_findings' : 'legacy' });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
