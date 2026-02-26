import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const OBJECTIVE_MUTABLE_FIELDS = [
  'objective_key',
  'version',
  'title',
  'description',
  'area_code',
  'skill_key',
  'risk_category',
  'dd_phase',
  'deal_types',
  'jurisdictions',
  'materiality_threshold_amount',
  'materiality_threshold_currency',
  'applies_when',
  'evaluation_criteria',
  'data_required',
  'severity_if_positive',
  'severity_modifiers',
  'positive_examples',
  'negative_examples',
  'false_positive_examples',
  'source_standard',
  'regulatory_basis',
  'is_active',
  'reviewed_by',
  'reviewed_at',
] as const;

type ObjectiveMutableField = (typeof OBJECTIVE_MUTABLE_FIELDS)[number];

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminRole } = await supabaseAdmin
    .from('dd_project_user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['clo', 'pm_transaccion'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!adminRole) {
    return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 });
  }

  return null;
}

function pickObjectiveFields(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of OBJECTIVE_MUTABLE_FIELDS) {
    if (field in input) {
      output[field as ObjectiveMutableField] = input[field];
    }
  }

  if (typeof output.area_code === 'string') {
    output.area_code = output.area_code.trim().toUpperCase();
  }

  return output;
}

// ---------------------------------------------------------------------------
// GET /api/finding-objectives
// Returns catalog of Finding Objectives (not project-scoped)
// Query params: area_code, deal_type, jurisdiction, skill_key, include_inactive
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
  const includeInactive = searchParams.get('include_inactive') === 'true';

  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .order('area_code')
    .order('objective_key');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

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
    filters: { area_code, deal_type, jurisdiction, skill_key, include_inactive: includeInactive }
  });
}

// ---------------------------------------------------------------------------
// POST /api/finding-objectives
// Creates a new Finding Objective in the global catalog.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminErr = await requireAdmin(request);
  if (adminErr) return adminErr;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const createPayload = pickObjectiveFields(body);
  const required = ['objective_key', 'title', 'area_code', 'evaluation_criteria', 'data_required'];
  for (const key of required) {
    if (!createPayload[key]) {
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }

  if (!('is_active' in createPayload)) {
    createPayload.is_active = true;
  }

  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .insert(createPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, objective: data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/finding-objectives
// Updates an existing Finding Objective.
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const adminErr = await requireAdmin(request);
  if (adminErr) return adminErr;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updatePayload = pickObjectiveFields(body);
  delete updatePayload.id;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, objective: data });
}

// ---------------------------------------------------------------------------
// DELETE /api/finding-objectives
// Soft-delete objective (is_active=false) to preserve traceability.
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const adminErr = await requireAdmin(request);
  if (adminErr) return adminErr;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, objective: data });
}
