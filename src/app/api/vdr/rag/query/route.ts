import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { semanticSearch } from '@/lib/vdr/semantic-search';
import { getHarveyGateway } from '@/lib/harvey';

const SYSTEM_PROMPT =
  'You are a legal due diligence analyst for DD Legal. Answer questions using ONLY the provided document excerpts. If the excerpts don\'t contain enough information, say so. Always cite which document and section your answer comes from. Respond in the same language as the question.';

const DEFAULT_LIMIT = 5;
const DEFAULT_THRESHOLD = 0.65;

type Confidence = 'high' | 'medium' | 'low';

function calculateConfidence(avgSimilarity: number): Confidence {
  if (avgSimilarity >= 0.85) return 'high';
  if (avgSimilarity >= 0.7) return 'medium';
  return 'low';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { project_id, question, area_code, limit, threshold } = body as {
      project_id?: string;
      question?: string;
      area_code?: string;
      limit?: number;
      threshold?: number;
    };

    // ── Validation ──────────────────────────────────────────────
    if (!project_id || !question) {
      return NextResponse.json(
        { success: false, error: 'project_id and question are required' },
        { status: 400 },
      );
    }

    // ── Permission check ────────────────────────────────────────
    const { authorized, error: authError } = await requirePermission(
      req,
      project_id,
      'can_view_contingencies',
    );
    if (!authorized) return authError!;

    // ── Semantic search ─────────────────────────────────────────
    const chunks = await semanticSearch(project_id, question, {
      threshold: threshold ?? DEFAULT_THRESHOLD,
      limit: limit ?? DEFAULT_LIMIT,
      areaCode: area_code,
    });

    // ── No results ──────────────────────────────────────────────
    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        answer:
          'No se encontraron documentos relevantes en el Data Room para esta consulta.',
        confidence: 'low' as Confidence,
        sources: [],
        metadata: {
          chunks_found: 0,
          avg_similarity: 0,
          model_used: 'none',
          duration_ms: Date.now() - startTime,
        },
      });
    }

    // ── Build context for LLM ───────────────────────────────────
    const contextBlock = chunks
      .map(
        (c, i) =>
          `[Documento ${i + 1}: "${c.document_name}"${c.section_title ? ` | Seccion: ${c.section_title}` : ''}${c.page_number != null ? ` | Pag. ${c.page_number}` : ''}]\n${c.content}`,
      )
      .join('\n\n---\n\n');

    const prompt = `Pregunta del usuario:\n${question}\n\n--- EXTRACTOS DEL DATA ROOM ---\n\n${contextBlock}`;

    // ── Similarity stats ────────────────────────────────────────
    const avgSimilarity =
      chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;

    // ── Source summaries ────────────────────────────────────────
    const sources = chunks.map((c) => ({
      document_name: c.document_name,
      chunk_id: c.chunk_id,
      content_preview: c.content.slice(0, 200),
      similarity: c.similarity,
      page_number: c.page_number,
      section_title: c.section_title,
    }));

    // ── Harvey completion ───────────────────────────────────────
    let answer: string;
    let modelUsed: string;

    try {
      const harvey = getHarveyGateway();
      const completion = await harvey.completion({
        prompt,
        system_prompt: SYSTEM_PROMPT,
        client_matter_id: project_id,
      });

      answer = completion.text;
      modelUsed = completion.model;
    } catch {
      // Harvey failed — return raw chunks with fallback message
      answer =
        'Error al generar respuesta. Los fragmentos relevantes se muestran abajo.';
      modelUsed = 'error';
    }

    return NextResponse.json({
      success: true,
      answer,
      confidence: calculateConfidence(avgSimilarity),
      sources,
      metadata: {
        chunks_found: chunks.length,
        avg_similarity: Math.round(avgSimilarity * 10000) / 10000,
        model_used: modelUsed,
        duration_ms: Date.now() - startTime,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
