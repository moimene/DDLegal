import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const format = body.format || 'json';

    const [alertsRes, contingenciesRes, decisionsRes] = await Promise.all([
      supabaseAdmin.from('dd_negotiation_alerts').select('*').eq('project_id', project_id).order('severity'),
      supabaseAdmin.from('dd_contingencies').select('*, dd_contingencies_ext(*)').eq('project_id', project_id).in('severity', ['critical', 'high']),
      supabaseAdmin.from('dd_war_room_decisions').select('*').eq('project_id', project_id).order('decided_at', { ascending: false }),
    ]);

    const exportData = { exported_at: new Date().toISOString(), project_id, red_flags: alertsRes.data || [], contingencies: contingenciesRes.data || [], decisions: decisionsRes.data || [] };

    if (format === 'csv') {
      const rows = (alertsRes.data || []).map(a => [a.severity, a.area_code, a.titulo, a.impacto_negociacion, a.recomendacion, a.status].join('\t'));
      const csv = 'Severity\tArea\tTitle\tImpact\tRecommendation\tStatus\n' + rows.join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/tab-separated-values', 'Content-Disposition': `attachment; filename="war-room-${project_id}.tsv"` } });
    }

    return NextResponse.json({ success: true, export: exportData });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
