import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { buildEvidencePack } from '@/lib/reporting/report-engine';
import type { ReportTemplate } from '@/lib/reporting/report-engine';

/**
 * Shape stored in dd_kanban_tasks.evidence_refs for VDR chunk references.
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
 * POST /api/evidence/pack
 *
 * Generates an Evidence Pack v2 from a kanban task's evidence_refs.
 * Resolves VDR chunk references, builds the pack via report-engine,
 * and returns it ready for Harvey completion.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, task_id, template_type } = body as {
      project_id: string;
      task_id: string;
      template_type?: string;
    };

    // ── Validate required fields ──────────────────────────────
    if (!project_id || !task_id) {
      return NextResponse.json(
        { success: false, error: 'project_id and task_id are required' },
        { status: 400 }
      );
    }

    // ── Permission check ──────────────────────────────────────
    const { authorized, error: authError } = await requirePermission(
      req,
      project_id,
      'can_view_contingencies'
    );
    if (!authorized) return authError!;

    // ── Fetch task and its evidence_refs ───────────────────────
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('dd_kanban_tasks')
      .select('id, title, description, area_code, evidence_refs')
      .eq('id', task_id)
      .eq('project_id', project_id)
      .single();

    if (taskErr || !task) {
      return NextResponse.json(
        { success: false, error: 'Task not found in project' },
        { status: 404 }
      );
    }

    const evidenceRefs = (task.evidence_refs || []) as VdrChunkRef[];
    const chunkRefs = evidenceRefs.filter((r) => r.type === 'vdr_chunk');

    if (chunkRefs.length === 0) {
      return NextResponse.json({
        success: true,
        evidence_pack: null,
        message: 'No VDR chunk evidence refs found on this task. Link chunks first via /api/evidence/link-chunks.',
      });
    }

    // ── Resolve chunks with full document data ────────────────
    const chunkIds = chunkRefs.map((r) => r.chunk_id);

    const { data: chunks, error: chunkErr } = await supabaseAdmin
      .from('vdr_chunks')
      .select('id, content, page_number, section_title, document_id, vdr_documents!inner(id, name, project_id)')
      .in('id', chunkIds)
      .eq('vdr_documents.project_id', project_id);

    if (chunkErr) {
      return NextResponse.json(
        { success: false, error: `Failed to resolve chunks: ${chunkErr.message}` },
        { status: 500 }
      );
    }

    // Build a lookup of resolved chunk data keyed by chunk id
    const resolvedMap = new Map(
      (chunks || []).map((c) => {
        const doc = c.vdr_documents as unknown as { id: string; name: string };
        return [
          c.id as string,
          {
            content: c.content as string,
            page_number: c.page_number as number | null,
            section_title: c.section_title as string | null,
            document_id: doc.id,
            document_name: doc.name,
          },
        ];
      })
    );

    // ── Map to evidence sources ───────────────────────────────
    const now = new Date().toISOString();

    const sources = chunkRefs
      .filter((ref) => resolvedMap.has(ref.chunk_id))
      .map((ref) => {
        const resolved = resolvedMap.get(ref.chunk_id)!;
        return {
          type: 'document' as const,
          url: `/vdr/documents/${resolved.document_id}`,
          date: now,
          snippet: resolved.content.slice(0, 500),
          metadata: {
            chunk_id: ref.chunk_id,
            document_name: resolved.document_name,
            page_number: resolved.page_number,
            section_title: resolved.section_title,
            similarity: ref.similarity,
          },
        };
      });

    // ── Build minimal ReportTemplate ──────────────────────────
    const reportType = template_type || 'general_report';

    const template: ReportTemplate = {
      report_type: reportType,
      family: 'transactional',
      title_template: `Evidence Pack - ${task.title || 'Finding'}`,
      required_sections: ['Summary', 'Evidence', 'Conclusion'],
      evidence_pack_version: '2.0',
      grounding_required: true,
      export_formats: ['pdf', 'json'],
      cadencia: 'on_demand',
      audience: ['equipo', 'pm'],
    };

    // ── Build Evidence Pack ───────────────────────────────────
    const evidencePack = buildEvidencePack({
      sources,
      snapshot: {
        task_id,
        task_title: task.title,
        task_area_code: task.area_code,
        total_chunk_refs: chunkRefs.length,
        resolved_chunks: sources.length,
      },
      template,
      additionalInstructions: [
        'Each source references a VDR document chunk. Use page numbers and section titles for precise citations.',
        `Task context: "${task.title}"${task.description ? ` - ${(task.description as string).slice(0, 200)}` : ''}.`,
      ],
    });

    return NextResponse.json({
      success: true,
      evidence_pack: evidencePack,
      task_id,
      template_type: reportType,
      chunks_resolved: sources.length,
      chunks_total: chunkRefs.length,
    });
  } catch (error) {
    console.error('Evidence pack build error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
