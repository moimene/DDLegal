import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_contingencies');
        if (!authorized) return authError!;

        // --- Pagination params ---
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

        // --- Sort params ---
        const sortField = searchParams.get('sort') || 'created_at';
        const sortOrder = searchParams.get('order') || 'desc';
        const ascending = sortOrder.toLowerCase() === 'asc';
        const allowedSortFields = ['name', 'created_at', 'updated_at', 'category', 'status', 'area_code', 'file_type'];
        const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';

        // --- Count query (for total) ---
        let countQuery = supabaseAdmin
            .from('vdr_documents')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);

        // --- Data query ---
        let query = supabaseAdmin
            .from('vdr_documents')
            .select('*')
            .eq('project_id', projectId);

        // --- Filter: folder_id ---
        const folderId = searchParams.get('folder_id');
        if (folderId) {
            query = query.eq('folder_id', folderId);
            countQuery = countQuery.eq('folder_id', folderId);
        }

        // --- Filter: area_code ---
        const areaCode = searchParams.get('area_code');
        if (areaCode) {
            query = query.eq('area_code', areaCode);
            countQuery = countQuery.eq('area_code', areaCode);
        }

        // --- Filter: status ---
        const status = searchParams.get('status');
        if (status) {
            query = query.eq('status', status);
            countQuery = countQuery.eq('status', status);
        }

        // --- Filter: file_type ---
        const fileType = searchParams.get('file_type');
        if (fileType) {
            query = query.eq('file_type', fileType);
            countQuery = countQuery.eq('file_type', fileType);
        }

        // --- Filter: is_confidential ---
        const isConfidential = searchParams.get('is_confidential');
        if (isConfidential !== null && isConfidential !== '') {
            const boolVal = isConfidential === 'true';
            query = query.eq('is_confidential', boolVal);
            countQuery = countQuery.eq('is_confidential', boolVal);
        }

        // --- Filter: category ---
        const category = searchParams.get('category');
        if (category) {
            query = query.eq('category', category);
            countQuery = countQuery.eq('category', category);
        }

        // --- Filter: date_from / date_to ---
        const dateFrom = searchParams.get('date_from');
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
            countQuery = countQuery.gte('created_at', dateFrom);
        }
        const dateTo = searchParams.get('date_to');
        if (dateTo) {
            query = query.lte('created_at', dateTo);
            countQuery = countQuery.lte('created_at', dateTo);
        }

        // --- Search: name ILIKE ---
        const search = searchParams.get('search');
        if (search) {
            query = query.ilike('name', `%${search}%`);
            countQuery = countQuery.ilike('name', `%${search}%`);
        }

        // --- Execute count ---
        const { count, error: countError } = await countQuery;
        if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

        // --- Execute data query with sort + pagination ---
        const { data, error } = await query
            .order(safeSortField, { ascending })
            .range(offset, offset + limit - 1);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const totalCount = count ?? 0;
        const response = NextResponse.json({
            success: true,
            documents: data || [],
            pagination: {
                total: totalCount,
                limit,
                offset,
                has_more: offset + limit < totalCount,
            },
        });

        response.headers.set('X-Total-Count', String(totalCount));
        return response;
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, folder_id, area_code, name, description, category, is_confidential, tags } = body;
        if (!project_id || !name) return NextResponse.json({ error: 'project_id and name required' }, { status: 400 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, project_id, 'can_upload_vdr');
        if (!authorized) return authError!;

        const { data, error } = await supabaseAdmin
            .from('vdr_documents')
            .insert({
                project_id,
                folder_id: folder_id || null,
                area_code: area_code || null,
                name,
                description: description || null,
                category: category || 'general',
                is_confidential: is_confidential || false,
                tags: tags || [],
                status: 'draft',
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, document: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
