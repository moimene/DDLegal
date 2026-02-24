/**
 * VDR Full-Text Search API — GET /api/vdr/search/fulltext
 *
 * BM25-based full-text search for VDR documents.
 * Uses the existing bm25_search_vdr_chunks RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Escape a raw user query so it is safe inside a Postgres `to_tsquery` call.
 * Each word is converted to a lexeme joined with `&` (AND).
 */
function sanitiseTsQuery(query: string): string {
  return query
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.toLowerCase())
    .join(' & ');
}

interface BM25Result {
  id: string;
  content: string;
  bm25_rank: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  category: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const projectId = searchParams.get('project_id');
  const areaCode = searchParams.get('area_code');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id required' },
      { status: 400 }
    );
  }

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  // Auth check - use can_view_contingencies like other VDR search routes
  const { authorized, error: authError } = await requirePermission(request, projectId, 'can_view_contingencies');
  if (!authorized) {
    return authError!;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Sanitize query for Postgres full-text search
    const tsQuery = sanitiseTsQuery(query.trim());
    if (!tsQuery) {
      return NextResponse.json({
        query,
        results: [],
        count: 0,
        offset,
        limit,
      });
    }

    // Call BM25 search RPC with correct parameter names
    const { data: results, error } = await supabase.rpc('bm25_search_vdr_chunks', {
      search_query: tsQuery,
      filter_project_id: projectId,
      filter_area_code: areaCode || null,
      match_count: limit + offset, // Fetch extra for offset pagination
      ts_config: 'spanish',
    });

    if (error) {
      throw new Error(error.message);
    }

    // Apply offset pagination
    const paginatedResults = (results || []).slice(offset, offset + limit) as BM25Result[];

    // Format results with document metadata already included from RPC
    const formattedResults = paginatedResults.map((r: BM25Result) => ({
      chunk_id: r.id,
      bm25_rank: r.bm25_rank,
      content: r.content,
      page_number: r.page_number,
      section_title: r.section_title,
      document: {
        id: r.document_id,
        name: r.document_name,
        category: r.category,
        area_code: r.category, // RPC returns category which maps to area_code
      },
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      count: formattedResults.length,
      total: (results || []).length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[vdr/search/fulltext] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
