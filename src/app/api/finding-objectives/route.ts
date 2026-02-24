import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// GET /api/finding-objectives
// Returns catalog of Finding Objectives (not project-scoped)
// Query params: area_code, deal_type, jurisdiction, skill_key
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Simple auth check - require authenticated user
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const area_code = searchParams.get('area_code');
  const deal_type = searchParams.get('deal_type');
  const jurisdiction = searchParams.get('jurisdiction');
  const skill_key = searchParams.get('skill_key');

  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('is_active', true)
    .order('area_code')
    .order('objective_key');

  if (area_code) {
    query = query.eq('area_code', area_code);
  }

  if (skill_key) {
    query = query.eq('skill_key', skill_key);
  }

  if (deal_type) {
    query = query.contains('deal_types', [deal_type]);
  }

  if (jurisdiction) {
    query = query.contains('jurisdictions', [jurisdiction]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    objectives: data,
    count: data?.length ?? 0,
    filters: { area_code, deal_type, jurisdiction, skill_key }
  });
}
