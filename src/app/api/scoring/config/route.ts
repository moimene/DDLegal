import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// GET /api/scoring/config
// Returns scoring configuration (weights, thresholds)
// Query params: deal_type, jurisdiction (for specific config lookup)
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  config_key: string;
  severity_weights: Record<string, number>;
  probability_weights: Record<string, number>;
  timing_multipliers: Record<string, number>;
  area_weights: Record<string, number>;
  recommendation_thresholds: { go_below: number; no_go_above: number };
  deal_breaker_rules: Record<string, string>;
}

export async function GET(request: NextRequest) {
  // Simple auth check
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deal_type = searchParams.get('deal_type');
  const jurisdiction = searchParams.get('jurisdiction');

  // Try to find specific config, fallback to default
  if (deal_type || jurisdiction) {
    // Try specific first
    let specificQuery = supabaseAdmin
      .from('dd_scoring_config')
      .select('*')
      .eq('is_default', false);

    if (deal_type) {
      specificQuery = specificQuery.contains('deal_types', [deal_type]);
    }
    if (jurisdiction) {
      specificQuery = specificQuery.contains('jurisdictions', [jurisdiction]);
    }

    const { data: specific } = await specificQuery.limit(1).maybeSingle();

    if (specific) {
      return NextResponse.json({ config: specific, source: 'specific' });
    }
  }

  // Fallback to default
  const { data: defaultConfig, error } = await supabaseAdmin
    .from('dd_scoring_config')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: defaultConfig, source: 'default' });
}
