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

        const includeCounts = searchParams.get('include_counts') === 'true';

        const { data, error } = await supabaseAdmin
            .from('vdr_folders')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        let folders = data || [];

        // Optionally attach document_count per folder
        if (includeCounts && folders.length > 0) {
            const folderIds = folders.map((f) => f.id);

            // Fetch counts for all folders in one query using group-by via RPC or
            // individual counts. Supabase JS doesn't natively support GROUP BY, so
            // we fetch minimal doc rows filtered to these folders and count in JS.
            const { data: docs, error: docsErr } = await supabaseAdmin
                .from('vdr_documents')
                .select('folder_id')
                .eq('project_id', projectId)
                .in('folder_id', folderIds)
                .not('status', 'eq', 'archived');

            if (!docsErr && docs) {
                const countMap: Record<string, number> = {};
                for (const doc of docs) {
                    if (doc.folder_id) {
                        countMap[doc.folder_id] = (countMap[doc.folder_id] || 0) + 1;
                    }
                }
                folders = folders.map((f) => ({
                    ...f,
                    document_count: countMap[f.id] || 0,
                }));
            }
        }

        return NextResponse.json({ success: true, folders });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_id, parent_id, name, area_code, sort_order } = body;
        if (!project_id || !name) return NextResponse.json({ error: 'project_id and name required' }, { status: 400 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, project_id, 'can_upload_vdr');
        if (!authorized) return authError!;

        const { data, error } = await supabaseAdmin
            .from('vdr_folders')
            .insert({ project_id, parent_id: parent_id || null, name, area_code: area_code || null, sort_order: sort_order || 0 })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, folder: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, area_code, sort_order, parent_id } = body;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        // Fetch folder to get project_id for permission check
        const { data: folder, error: folderError } = await supabaseAdmin
            .from('vdr_folders')
            .select('project_id')
            .eq('id', id)
            .single();

        if (folderError || !folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, folder.project_id, 'can_upload_vdr');
        if (!authorized) return authError!;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (area_code !== undefined) updates.area_code = area_code;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (parent_id !== undefined) updates.parent_id = parent_id;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('vdr_folders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, folder: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get('id');
        if (!folderId) return NextResponse.json({ error: 'id required' }, { status: 400 });

        // Fetch folder to get project_id for permission check
        const { data: folder, error: folderError } = await supabaseAdmin
            .from('vdr_folders')
            .select('project_id')
            .eq('id', folderId)
            .single();

        if (folderError || !folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, folder.project_id, 'can_upload_vdr');
        if (!authorized) return authError!;

        // Check for documents inside this folder
        const { count: docCount, error: countErr } = await supabaseAdmin
            .from('vdr_documents')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folderId)
            .not('status', 'eq', 'archived');

        if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

        // Check for child folders
        const { count: childCount, error: childErr } = await supabaseAdmin
            .from('vdr_folders')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', folderId);

        if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 });

        const hasDocuments = (docCount ?? 0) > 0;
        const hasChildren = (childCount ?? 0) > 0;

        // If force=true is passed, proceed with delete regardless
        const force = searchParams.get('force') === 'true';

        if ((hasDocuments || hasChildren) && !force) {
            return NextResponse.json({
                success: false,
                warning: 'Folder is not empty',
                document_count: docCount ?? 0,
                child_folder_count: childCount ?? 0,
                message: 'This folder contains documents or sub-folders. Pass ?force=true to delete anyway (documents will be unlinked, not deleted).',
            }, { status: 409 });
        }

        // Unlink documents from this folder (set folder_id to null)
        if (hasDocuments) {
            await supabaseAdmin
                .from('vdr_documents')
                .update({ folder_id: null })
                .eq('folder_id', folderId);
        }

        // Unlink child folders (set parent_id to null)
        if (hasChildren) {
            await supabaseAdmin
                .from('vdr_folders')
                .update({ parent_id: null })
                .eq('parent_id', folderId);
        }

        const { error } = await supabaseAdmin
            .from('vdr_folders')
            .delete()
            .eq('id', folderId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, deleted_id: folderId });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
