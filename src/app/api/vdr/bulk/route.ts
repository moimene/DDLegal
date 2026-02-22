import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

type BulkAction = 'archive' | 'move' | 'delete' | 'tag';

interface BulkRequestBody {
    action: BulkAction;
    document_ids: string[];
    target_folder_id?: string;
    tags?: string[];
}

export async function POST(req: NextRequest) {
    try {
        const body: BulkRequestBody = await req.json();
        const { action, document_ids, target_folder_id, tags } = body;

        if (!action || !document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
            return NextResponse.json({
                error: 'action and document_ids (non-empty array) required',
            }, { status: 400 });
        }

        const validActions: BulkAction[] = ['archive', 'move', 'delete', 'tag'];
        if (!validActions.includes(action)) {
            return NextResponse.json({
                error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
            }, { status: 400 });
        }

        if (action === 'move' && !target_folder_id) {
            return NextResponse.json({
                error: 'target_folder_id is required for move action',
            }, { status: 400 });
        }

        if (action === 'tag' && (!tags || !Array.isArray(tags) || tags.length === 0)) {
            return NextResponse.json({
                error: 'tags (non-empty array) required for tag action',
            }, { status: 400 });
        }

        // Fetch first document to get project_id for permission check
        const { data: firstDoc, error: docError } = await supabaseAdmin
            .from('vdr_documents')
            .select('project_id')
            .eq('id', document_ids[0])
            .single();

        if (docError || !firstDoc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, firstDoc.project_id, 'can_upload_vdr');
        if (!authorized) return authError!;

        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (const docId of document_ids) {
            try {
                switch (action) {
                    case 'archive': {
                        const { error } = await supabaseAdmin
                            .from('vdr_documents')
                            .update({ status: 'archived', updated_at: new Date().toISOString() })
                            .eq('id', docId);
                        if (error) throw new Error(error.message);
                        break;
                    }

                    case 'move': {
                        const { error } = await supabaseAdmin
                            .from('vdr_documents')
                            .update({ folder_id: target_folder_id, updated_at: new Date().toISOString() })
                            .eq('id', docId);
                        if (error) throw new Error(error.message);
                        break;
                    }

                    case 'delete': {
                        // Soft-delete: set status to 'deleted'
                        const { error } = await supabaseAdmin
                            .from('vdr_documents')
                            .update({ status: 'deleted', updated_at: new Date().toISOString() })
                            .eq('id', docId);
                        if (error) throw new Error(error.message);
                        break;
                    }

                    case 'tag': {
                        // Fetch current tags, then merge
                        const { data: doc, error: fetchErr } = await supabaseAdmin
                            .from('vdr_documents')
                            .select('tags')
                            .eq('id', docId)
                            .single();
                        if (fetchErr) throw new Error(fetchErr.message);

                        const currentTags: string[] = doc?.tags || [];
                        const mergedTags = Array.from(new Set([...currentTags, ...(tags || [])]));

                        const { error } = await supabaseAdmin
                            .from('vdr_documents')
                            .update({ tags: mergedTags, updated_at: new Date().toISOString() })
                            .eq('id', docId);
                        if (error) throw new Error(error.message);
                        break;
                    }
                }
                successCount++;
            } catch (err: unknown) {
                failedCount++;
                const message = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`Document ${docId}: ${message}`);
            }
        }

        return NextResponse.json({
            success: successCount,
            failed: failedCount,
            errors,
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
