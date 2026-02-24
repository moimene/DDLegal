// src/app/api/fo/coverage/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

// ---------------------------------------------------------------------------
// GET /api/fo/coverage?project_id=xxx
// Returns FO analysis coverage stats for a project
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    request,
    project_id,
    'can_view_findings',
  );
  if (!authorized) return authError!;

  // Get coverage stats
  const { data: stats, error } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select('status, objective_id, finding_generated')
    .eq('project_id', project_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = stats?.length ?? 0;
  const analyzed = stats?.filter(s => s.status === 'analyzed').length ?? 0;
  const pending = stats?.filter(s => s.status === 'pending').length ?? 0;
  const analyzing = stats?.filter(s => s.status === 'analyzing').length ?? 0;
  const withFindings = stats?.filter(s => s.finding_generated).length ?? 0;
  const errors = stats?.filter(s => s.status === 'error').length ?? 0;
  const skipped = stats?.filter(s => s.status === 'skipped').length ?? 0;

  // Get by objective
  const byObjective: Record<string, { total: number; analyzed: number; findings: number }> = {};
  for (const s of stats ?? []) {
    const oid = s.objective_id;
    if (!byObjective[oid]) {
      byObjective[oid] = { total: 0, analyzed: 0, findings: 0 };
    }
    byObjective[oid].total++;
    if (s.status === 'analyzed') byObjective[oid].analyzed++;
    if (s.finding_generated) byObjective[oid].findings++;
  }

  // Load objective keys for better readability
  const objectiveIds = Object.keys(byObjective);
  let objectiveKeyMap: Record<string, string> = {};

  if (objectiveIds.length > 0) {
    const { data: objectives } = await supabaseAdmin
      .from('dd_finding_objectives')
      .select('id, objective_key')
      .in('id', objectiveIds);

    if (objectives) {
      for (const obj of objectives) {
        objectiveKeyMap[obj.id] = obj.objective_key;
      }
    }
  }

  // Transform byObjective to use objective_key
  const byObjectiveKey: Record<string, { total: number; analyzed: number; findings: number }> = {};
  for (const [id, data] of Object.entries(byObjective)) {
    const key = objectiveKeyMap[id] || id;
    byObjectiveKey[key] = data;
  }

  return NextResponse.json({
    project_id,
    summary: {
      total,
      analyzed,
      pending,
      analyzing,
      skipped,
      errors,
      with_findings: withFindings,
      coverage_pct: total > 0 ? Math.round((analyzed / total) * 100) : 0,
    },
    by_objective: byObjectiveKey,
  });
}
