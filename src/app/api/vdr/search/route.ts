import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface SearchResult {
    id: string;
    name: string;
    description: string | null;
    area_code: string | null;
    category: string | null;
    status: string;
    tags: string[];
    folder_id: string | null;
    created_at: string;
    matched_fields: string[];
    highlights: Record<string, string>;
}

function highlightMatch(text: string, keyword: string): string {
    if (!text || !keyword) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<<$1>>');
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        const projectId = searchParams.get('project_id');

        if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });
        if (!q || q.trim().length === 0) return NextResponse.json({ error: 'q (search keyword) required' }, { status: 400 });

        const keyword = q.trim();
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

        // Search across name, description, tags (as text), and change_notes in versions
        // Supabase doesn't support OR across ILIKE easily, so we use .or() filter
        let query = supabaseAdmin
            .from('vdr_documents')
            .select('*')
            .eq('project_id', projectId)
            .not('status', 'eq', 'archived')
            .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,tags.cs.{"${keyword}"}`);

        // --- Optional filters ---
        const areaCode = searchParams.get('area_code');
        if (areaCode) query = query.eq('area_code', areaCode);

        const status = searchParams.get('status');
        if (status) query = query.eq('status', status);

        const category = searchParams.get('category');
        if (category) query = query.eq('category', category);

        const { data: docs, error } = await query
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Also search in version change_notes for additional matches
        const { data: versionMatches } = await supabaseAdmin
            .from('vdr_document_versions')
            .select('document_id, change_notes')
            .ilike('change_notes', `%${keyword}%`);

        const versionDocIds = new Set((versionMatches || []).map((v) => v.document_id));
        const changeNotesMap: Record<string, string> = {};
        for (const v of versionMatches || []) {
            if (!changeNotesMap[v.document_id]) {
                changeNotesMap[v.document_id] = v.change_notes;
            }
        }

        // Fetch any extra docs matched only via change_notes that aren't already in our result set
        const docIds = new Set((docs || []).map((d) => d.id));
        const missingIds = Array.from(versionDocIds).filter((id) => !docIds.has(id));
        let extraDocs: typeof docs = [];

        if (missingIds.length > 0) {
            let extraQuery = supabaseAdmin
                .from('vdr_documents')
                .select('*')
                .eq('project_id', projectId)
                .not('status', 'eq', 'archived')
                .in('id', missingIds);

            if (areaCode) extraQuery = extraQuery.eq('area_code', areaCode);
            if (status) extraQuery = extraQuery.eq('status', status);
            if (category) extraQuery = extraQuery.eq('category', category);

            const { data: extra } = await extraQuery;
            extraDocs = extra || [];
        }

        // Combine and build ranked results
        const allDocs = [...(docs || []), ...extraDocs];
        const lowerKeyword = keyword.toLowerCase();

        const results: SearchResult[] = allDocs.map((doc) => {
            const matched_fields: string[] = [];
            const highlights: Record<string, string> = {};

            if (doc.name && doc.name.toLowerCase().includes(lowerKeyword)) {
                matched_fields.push('name');
                highlights.name = highlightMatch(doc.name, keyword);
            }
            if (doc.description && doc.description.toLowerCase().includes(lowerKeyword)) {
                matched_fields.push('description');
                highlights.description = highlightMatch(doc.description, keyword);
            }
            if (doc.tags && Array.isArray(doc.tags)) {
                const matchedTag = doc.tags.find((t: string) => t.toLowerCase().includes(lowerKeyword));
                if (matchedTag) {
                    matched_fields.push('tags');
                    highlights.tags = highlightMatch(matchedTag, keyword);
                }
            }
            if (versionDocIds.has(doc.id) && changeNotesMap[doc.id]) {
                matched_fields.push('change_notes');
                highlights.change_notes = highlightMatch(changeNotesMap[doc.id], keyword);
            }

            return {
                id: doc.id,
                name: doc.name,
                description: doc.description,
                area_code: doc.area_code,
                category: doc.category,
                status: doc.status,
                tags: doc.tags || [],
                folder_id: doc.folder_id,
                created_at: doc.created_at,
                matched_fields,
                highlights,
            };
        });

        // Rank: more matched fields = higher rank; name match ranks highest
        results.sort((a, b) => {
            const aNameMatch = a.matched_fields.includes('name') ? 10 : 0;
            const bNameMatch = b.matched_fields.includes('name') ? 10 : 0;
            const aScore = a.matched_fields.length + aNameMatch;
            const bScore = b.matched_fields.length + bNameMatch;
            return bScore - aScore;
        });

        return NextResponse.json({
            success: true,
            query: keyword,
            total: results.length,
            results,
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
