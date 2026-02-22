import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import type { NegotiationActionType } from '@/lib/workflows/template-types';

const VALID_ACTION_TYPES: NegotiationActionType[] = [
  'condition_precedent',
  'indemnity',
  'price_adjustment',
  'warranty',
  'covenant',
  'escrow',
  'cap_basket',
  'carve_out',
  'disclosure',
  'remediation',
  'insurance',
  'other',
];

/**
 * POST /api/war-room/[project_id]/negotiation-actions
 * Creates a negotiation action (tratamiento/propuesta phase).
 * Body: { workflow_instance_id?, finding_ref?, action_type, title, description?,
 *         spa_clause_id?, proposed_text?, economic_impact_amount?, economic_impact_currency? }
 * Auth: requirePermission(req, project_id, 'can_manage_qa')
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;
  const userId = req.headers.get('x-user-id');

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_manage_qa'
  );
  if (!authorized) return authError!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const {
    workflow_instance_id,
    finding_ref,
    action_type,
    title,
    description,
    spa_clause_id,
    proposed_text,
    economic_impact_amount,
    economic_impact_currency,
  } = body as {
    workflow_instance_id?: string;
    finding_ref?: string;
    action_type?: string;
    title?: string;
    description?: string;
    spa_clause_id?: string;
    proposed_text?: string;
    economic_impact_amount?: number;
    economic_impact_currency?: string;
  };

  if (!action_type || !title) {
    return NextResponse.json(
      { success: false, error: 'action_type and title are required' },
      { status: 400 }
    );
  }

  if (!VALID_ACTION_TYPES.includes(action_type as NegotiationActionType)) {
    return NextResponse.json(
      {
        success: false,
        error: `action_type must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('dd_negotiation_actions')
      .insert({
        project_id,
        workflow_instance_id: workflow_instance_id || null,
        finding_ref: finding_ref || null,
        action_type,
        title,
        description: description || null,
        spa_clause_id: spa_clause_id || null,
        proposed_text: proposed_text || null,
        economic_impact_amount: economic_impact_amount ?? null,
        economic_impact_currency: economic_impact_currency || 'EUR',
        owner: userId || null,
        status: 'proposed',
        evidence_refs: [],
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, action: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/war-room/[project_id]/negotiation-actions?workflow_instance_id=X
 * Lists negotiation actions for a project, with optional workflow_instance_id filter.
 * Auth: requirePermission(req, project_id, 'can_view_war_room')
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    project_id,
    'can_view_war_room'
  );
  if (!authorized) return authError!;

  try {
    const { searchParams } = new URL(req.url);
    const workflowInstanceId = searchParams.get('workflow_instance_id');

    let query = supabaseAdmin
      .from('dd_negotiation_actions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (workflowInstanceId) {
      query = query.eq('workflow_instance_id', workflowInstanceId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, actions: data || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
