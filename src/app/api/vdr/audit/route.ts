import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { randomUUID } from 'crypto';

type AuditActionType = 'upload' | 'delete' | 'version' | 'share' | 'view' | 'update' | 'move' | 'archive' | 'approve';

interface AuditEntry {
    id: string;
    actor: string;
    action: AuditActionType;
    target_type: 'document' | 'folder' | 'link';
    target_id: string;
    target_name: string;
    details: string;
    timestamp: string;
}

/**
 * Generate mock audit entries based on actual project data.
 * Since we don't have a real audit table yet, we reconstruct a plausible
 * audit trail from documents, versions, and links.
 */
async function generateAuditTrail(
    projectId: string,
    actionType: string | null,
    limit: number,
    offset: number,
): Promise<{ entries: AuditEntry[]; total: number }> {
    const entries: AuditEntry[] = [];

    // --- Pull document data for the project ---
    const { data: docs } = await supabaseAdmin
        .from('vdr_documents')
        .select('id, name, status, created_at, updated_at, approved_by, approved_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(200);

    // --- Pull version data ---
    const docIds = (docs || []).map((d) => d.id);
    let versions: Array<{ id: string; document_id: string; version_number: number; original_filename: string; uploaded_by: string | null; change_notes: string | null; created_at: string }> = [];
    if (docIds.length > 0) {
        const { data: vers } = await supabaseAdmin
            .from('vdr_document_versions')
            .select('id, document_id, version_number, original_filename, uploaded_by, change_notes, created_at')
            .in('document_id', docIds)
            .order('created_at', { ascending: false })
            .limit(200);
        versions = vers || [];
    }

    // --- Pull links data ---
    const { data: links } = await supabaseAdmin
        .from('vdr_links')
        .select('id, document_id, folder_id, permission, created_by, created_at')
        .or(docIds.length > 0 ? `document_id.in.(${docIds.join(',')})` : 'id.is.null')
        .order('created_at', { ascending: false })
        .limit(100);

    // Build a name map for documents
    const nameMap: Record<string, string> = {};
    for (const doc of docs || []) {
        nameMap[doc.id] = doc.name;
    }

    // --- Generate entries from document creation/updates ---
    for (const doc of docs || []) {
        // Upload entry (created)
        entries.push({
            id: randomUUID(),
            actor: 'system',
            action: 'upload',
            target_type: 'document',
            target_id: doc.id,
            target_name: doc.name,
            details: `Document "${doc.name}" created`,
            timestamp: doc.created_at,
        });

        // If status is archived, add archive entry
        if (doc.status === 'archived') {
            entries.push({
                id: randomUUID(),
                actor: 'system',
                action: 'archive',
                target_type: 'document',
                target_id: doc.id,
                target_name: doc.name,
                details: `Document "${doc.name}" archived`,
                timestamp: doc.updated_at || doc.created_at,
            });
        }

        // If status is deleted, add delete entry
        if (doc.status === 'deleted') {
            entries.push({
                id: randomUUID(),
                actor: 'system',
                action: 'delete',
                target_type: 'document',
                target_id: doc.id,
                target_name: doc.name,
                details: `Document "${doc.name}" deleted`,
                timestamp: doc.updated_at || doc.created_at,
            });
        }

        // If approved
        if (doc.approved_by && doc.approved_at) {
            entries.push({
                id: randomUUID(),
                actor: doc.approved_by,
                action: 'approve',
                target_type: 'document',
                target_id: doc.id,
                target_name: doc.name,
                details: `Document "${doc.name}" approved by ${doc.approved_by}`,
                timestamp: doc.approved_at,
            });
        }

        // If updated_at differs from created_at, add update entry
        if (doc.updated_at && doc.updated_at !== doc.created_at) {
            entries.push({
                id: randomUUID(),
                actor: 'system',
                action: 'update',
                target_type: 'document',
                target_id: doc.id,
                target_name: doc.name,
                details: `Document "${doc.name}" updated`,
                timestamp: doc.updated_at,
            });
        }
    }

    // --- Generate entries from versions ---
    for (const ver of versions) {
        entries.push({
            id: randomUUID(),
            actor: ver.uploaded_by || 'system',
            action: 'version',
            target_type: 'document',
            target_id: ver.document_id,
            target_name: nameMap[ver.document_id] || ver.original_filename,
            details: `Version ${ver.version_number} uploaded: "${ver.original_filename}"${ver.change_notes ? ` - ${ver.change_notes}` : ''}`,
            timestamp: ver.created_at,
        });
    }

    // --- Generate entries from links ---
    for (const link of links || []) {
        const targetId = link.document_id || link.folder_id || 'unknown';
        const targetName = link.document_id ? (nameMap[link.document_id] || 'Document') : 'Folder';
        entries.push({
            id: randomUUID(),
            actor: link.created_by || 'system',
            action: 'share',
            target_type: link.document_id ? 'document' : 'folder',
            target_id: targetId,
            target_name: targetName,
            details: `Shared ${targetName} with "${link.permission}" permission`,
            timestamp: link.created_at,
        });
    }

    // --- Filter by action_type if specified ---
    let filtered = entries;
    if (actionType) {
        const validActions: AuditActionType[] = ['upload', 'delete', 'version', 'share', 'view', 'update', 'move', 'archive', 'approve'];
        const requestedActions = actionType.split(',').filter((a) => validActions.includes(a as AuditActionType));
        if (requestedActions.length > 0) {
            filtered = entries.filter((e) => requestedActions.includes(e.action));
        }
    }

    // --- Sort by timestamp descending ---
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { entries: paginated, total };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_all_areas');
        if (!authorized) return authError!;

        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
        const actionType = searchParams.get('action_type');

        const { entries, total } = await generateAuditTrail(projectId, actionType, limit, offset);

        return NextResponse.json({
            success: true,
            audit_trail: entries,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + limit < total,
            },
            note: 'Audit trail is reconstructed from existing data. A dedicated audit table will be implemented in a future release.',
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
