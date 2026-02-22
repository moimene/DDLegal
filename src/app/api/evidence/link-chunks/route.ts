import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { semanticSearch } from '@/lib/vdr/semantic-search';

/**
 * Evidence Ref stored in dd_kanban_tasks.evidence_refs JSONB.
 */
interface VdrChunkRef {
  type: 'vdr_chunk';
  chunk_id: string;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  similarity: number;
  snippet: string;
}

/**
 * POST /api/evidence/link-chunks
 *
 * Links VDR chunks to a kanban task as evidence references.
 * If chunk_ids are provided, fetches those chunks directly.
 * Otherwise, runs semantic search using finding_title to auto-discover relevant chunks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, task_id, finding_title, chunk_ids, area_code } = body as {
      project_id: string;
      task_id: string;
      finding_title: string;
      chunk_ids?: string[];
      area_code?: string;
    };

    // ── Validate required fields ──────────────────────────────
    if (!project_id || !task_id || !finding_title) {
      return NextResponse.json(
        { success: false, error: 'project_id, task_id, and finding_title are required' },
        { status: 400 }
      );
    }

    // ── Permission check ──────────────────────────────────────
    const { authorized, error: authError } = await requirePermission(
      req,
      project_id,
      'can_edit_tasks'
    );
    if (!authorized) return authError!;

    // ── Resolve chunks ────────────────────────────────────────
    let refs: VdrChunkRef[] = [];

    if (chunk_ids && chunk_ids.length > 0) {
      // Explicit chunk IDs: fetch from vdr_chunks joined with vdr_documents
      const { data: chunks, error: chunkErr } = await supabaseAdmin
        .from('vdr_chunks')
        .select('id, content, page_number, section_title, document_id, vdr_documents!inner(id, name, project_id)')
        .in('id', chunk_ids)
        .eq('vdr_documents.project_id', project_id);

      if (chunkErr) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch chunks: ${chunkErr.message}` },
          { status: 500 }
        );
      }

      refs = (chunks || []).map((chunk) => {
        const doc = chunk.vdr_documents as unknown as { id: string; name: string };
        return {
          type: 'vdr_chunk' as const,
          chunk_id: chunk.id as string,
          document_id: doc.id,
          document_name: doc.name,
          page_number: chunk.page_number as number | null,
          section_title: chunk.section_title as string | null,
          similarity: 1.0, // exact match
          snippet: (chunk.content as string).slice(0, 200),
        };
      });
    } else {
      // Semantic search auto-discovery
      const results = await semanticSearch(project_id, finding_title, {
        limit: 5,
        threshold: 0.6,
        areaCode: area_code,
      });

      refs = results.map((r) => ({
        type: 'vdr_chunk' as const,
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        document_name: r.document_name,
        page_number: r.page_number,
        section_title: r.section_title,
        similarity: r.similarity,
        snippet: r.content.slice(0, 200),
      }));
    }

    if (refs.length === 0) {
      return NextResponse.json({
        success: true,
        linked: [],
        message: 'No matching chunks found',
      });
    }

    // ── Fetch existing evidence_refs and merge ────────────────
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('dd_kanban_tasks')
      .select('id, evidence_refs')
      .eq('id', task_id)
      .eq('project_id', project_id)
      .single();

    if (taskErr || !task) {
      return NextResponse.json(
        { success: false, error: 'Task not found in project' },
        { status: 404 }
      );
    }

    const existingRefs = (task.evidence_refs || []) as VdrChunkRef[];
    const existingChunkIds = new Set(
      existingRefs
        .filter((r) => r.type === 'vdr_chunk')
        .map((r) => r.chunk_id)
    );

    // Only add refs whose chunk_id is not already present
    const newRefs = refs.filter((r) => !existingChunkIds.has(r.chunk_id));
    const mergedRefs = [...existingRefs, ...newRefs];

    // ── Update kanban task ────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('dd_kanban_tasks')
      .update({ evidence_refs: mergedRefs, updated_at: new Date().toISOString() })
      .eq('id', task_id);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Failed to update task: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // ── Insert audit trail rows into dd_evidence ──────────────
    if (newRefs.length > 0) {
      const evidenceRows = newRefs.map((r) => ({
        project_id,
        task_id,
        source_type: 'ai_output' as const,
        source_reference: r.chunk_id,
        source_name: r.document_name,
        page_range: r.page_number != null ? String(r.page_number) : null,
        snippet: r.snippet,
        confidence_score: r.similarity,
        metadata: {
          linked_by: 'evidence_link_chunks',
          document_id: r.document_id,
          section_title: r.section_title,
        },
      }));

      const { error: evidenceErr } = await supabaseAdmin
        .from('dd_evidence')
        .insert(evidenceRows);

      if (evidenceErr) {
        console.error('Evidence audit trail insert error:', evidenceErr);
        // Non-fatal: the link itself succeeded
      }
    }

    return NextResponse.json({
      success: true,
      linked: newRefs,
      total_refs: mergedRefs.length,
      new_count: newRefs.length,
      skipped_duplicates: refs.length - newRefs.length,
    });
  } catch (error) {
    console.error('Evidence link-chunks error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
