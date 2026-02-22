import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

interface EvidenceRef {
  source_id: string;
  document_name: string;
  snippet?: string;
}

/**
 * POST /api/war-room/[project_id]/decision-resolution
 * O.3: Decision -> Evidence -> Resolution Loop
 *
 * Links a War Room decision to evidence and marks resolution status.
 * Body: {
 *   decision_id:       UUID of the decision
 *   evidence_refs:     [{ source_id, document_name, snippet? }]
 *   resolution_status: 'resolved' | 'partially_resolved' | 'unresolved'
 *   resolution_notes:  string
 * }
 *
 * Updates dd_war_room_decisions.metadata with resolution data,
 * preserving any existing metadata fields via spread.
 */
export async function POST(
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
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { decision_id, evidence_refs, resolution_status, resolution_notes } =
      body as {
        decision_id?: string;
        evidence_refs?: EvidenceRef[];
        resolution_status?: string;
        resolution_notes?: string;
      };

    // Validate required fields
    if (!decision_id) {
      return NextResponse.json(
        { success: false, error: 'decision_id is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['resolved', 'partially_resolved', 'unresolved'];
    if (resolution_status && !validStatuses.includes(resolution_status)) {
      return NextResponse.json(
        {
          success: false,
          error: `resolution_status must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 1. Verify decision exists and belongs to this project
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('dd_war_room_decisions')
      .select('id, project_id, metadata')
      .eq('id', decision_id)
      .eq('project_id', project_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Decision not found or does not belong to this project',
        },
        { status: 404 }
      );
    }

    // 2. Build updated metadata preserving existing fields
    const existingMetadata =
      (existing.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      evidence_refs: evidence_refs || existingMetadata.evidence_refs || [],
      resolution_status:
        resolution_status ||
        existingMetadata.resolution_status ||
        'unresolved',
      resolution_notes:
        resolution_notes ?? existingMetadata.resolution_notes ?? null,
      resolved_at:
        resolution_status === 'resolved'
          ? new Date().toISOString()
          : (existingMetadata.resolved_at as string) || null,
      last_updated_at: new Date().toISOString(),
    };

    // 3. Update decision metadata
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('dd_war_room_decisions')
      .update({ metadata: updatedMetadata })
      .eq('id', decision_id)
      .eq('project_id', project_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      decision: updated,
      resolution: {
        status: updatedMetadata.resolution_status,
        evidence_count: Array.isArray(updatedMetadata.evidence_refs)
          ? updatedMetadata.evidence_refs.length
          : 0,
        resolved_at: updatedMetadata.resolved_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/war-room/[project_id]/decision-resolution
 * O.3: Get all decisions with their resolution status
 *
 * Query params:
 *   ?status=resolved|partially_resolved|unresolved  — filter by resolution status
 *
 * Returns decisions enriched with resolution data from metadata,
 * plus summary counts: { total, resolved, partially_resolved, unresolved }
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
    const statusFilter = req.nextUrl.searchParams.get('status');

    const { data: decisions, error } = await supabaseAdmin
      .from('dd_war_room_decisions')
      .select('*')
      .eq('project_id', project_id)
      .order('decided_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const allDecisions = decisions || [];

    // Enrich decisions with resolution data from metadata
    const enriched = allDecisions.map((d) => {
      const meta = (d.metadata as Record<string, unknown>) || {};
      return {
        ...d,
        resolution: {
          status: (meta.resolution_status as string) || 'unresolved',
          evidence_refs: (meta.evidence_refs as EvidenceRef[]) || [],
          evidence_count: Array.isArray(meta.evidence_refs)
            ? meta.evidence_refs.length
            : 0,
          resolution_notes: (meta.resolution_notes as string) || null,
          resolved_at: (meta.resolved_at as string) || null,
        },
      };
    });

    // Apply filter if provided
    let filtered = enriched;
    if (statusFilter) {
      filtered = enriched.filter(
        (d) => d.resolution.status === statusFilter
      );
    }

    // Build summary
    const summary = {
      total: allDecisions.length,
      resolved: 0,
      partially_resolved: 0,
      unresolved: 0,
    };
    for (const d of enriched) {
      const rs = d.resolution.status;
      if (rs === 'resolved') summary.resolved++;
      else if (rs === 'partially_resolved') summary.partially_resolved++;
      else summary.unresolved++;
    }

    return NextResponse.json({
      success: true,
      project_id,
      decisions: filtered,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
