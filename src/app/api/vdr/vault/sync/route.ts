import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface VaultSyncRequest {
  project_id: string;
  document_ids?: string[];
  duplicate_mode?: 'skip' | 'replace';
}

interface VaultSyncStatus {
  status: 'synced' | 'pending' | 'failed';
  synced_at: string | null;
  chunks_uploaded: number;
  error?: string;
}

interface SyncDetail {
  document_id: string;
  name: string;
  status: 'synced' | 'pending' | 'failed' | 'skipped';
  chunks: number;
  error?: string;
}

// ────────────────────────────────────────────────────────────
// POST — Sync VDR documents to Harvey Vault
// ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VaultSyncRequest;
    const { project_id, document_ids, duplicate_mode = 'skip' } = body;

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: 'project_id required' },
        { status: 400 }
      );
    }

    // 1. Permission check
    const { authorized, error: authError } = await requirePermission(
      req,
      project_id,
      'can_edit_tasks'
    );
    if (!authorized) return authError!;

    // 2. Fetch VDR documents
    let docsQuery = supabaseAdmin
      .from('vdr_documents')
      .select('id, name, metadata')
      .eq('project_id', project_id);

    if (document_ids && document_ids.length > 0) {
      docsQuery = docsQuery.in('id', document_ids);
    } else {
      docsQuery = docsQuery.eq('status', 'indexed');
    }

    const { data: documents, error: docsError } = await docsQuery;
    if (docsError) {
      return NextResponse.json(
        { success: false, error: docsError.message },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        failed: 0,
        skipped: 0,
        details: [],
      });
    }

    // Derive vault upload endpoint from completion endpoint
    const vaultEndpoint =
      process.env.HARVEY_ENDPOINT_V1?.replace('/completion', '/vault/upload') || '';
    const harveyToken = process.env.HARVEY_TOKEN || '';

    let synced = 0;
    let failed = 0;
    let skipped = 0;
    const details: SyncDetail[] = [];

    for (const doc of documents) {
      const existingMeta = (doc.metadata as Record<string, unknown>) || {};
      const existingSync = existingMeta.vault_sync as VaultSyncStatus | undefined;

      // Skip already-synced documents when duplicate_mode is 'skip'
      if (duplicate_mode === 'skip' && existingSync?.status === 'synced') {
        skipped++;
        details.push({
          document_id: doc.id,
          name: doc.name,
          status: 'skipped',
          chunks: 0,
        });
        continue;
      }

      // 3. Fetch chunks for this document ordered by chunk_index
      const { data: chunks, error: chunksError } = await supabaseAdmin
        .from('vdr_chunks')
        .select('content, chunk_index')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        // No chunks available — mark as failed
        const vaultSync: VaultSyncStatus = {
          status: 'failed',
          synced_at: null,
          chunks_uploaded: 0,
          error: chunksError?.message || 'No chunks found for document',
        };
        await supabaseAdmin
          .from('vdr_documents')
          .update({ metadata: { ...existingMeta, vault_sync: vaultSync } })
          .eq('id', doc.id);

        failed++;
        details.push({
          document_id: doc.id,
          name: doc.name,
          status: 'failed',
          chunks: 0,
          error: vaultSync.error,
        });
        continue;
      }

      // 4. Build combined text content from chunks
      const combinedText = chunks.map((c) => c.content).join('\n\n');

      // 5. Attempt Harvey Vault upload
      try {
        if (!vaultEndpoint || !harveyToken) {
          throw new Error('Harvey Vault endpoint or token not configured');
        }

        const formData = new FormData();
        formData.append(
          'file',
          new Blob([combinedText], { type: 'text/plain' }),
          doc.name
        );
        formData.append('client_matter_id', project_id);
        formData.append('duplicate_mode', duplicate_mode);

        const response = await fetch(vaultEndpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${harveyToken}` },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(
            `Harvey Vault API error: ${response.status} ${response.statusText}`
          );
        }

        // 6. Update metadata — success
        const vaultSync: VaultSyncStatus = {
          status: 'synced',
          synced_at: new Date().toISOString(),
          chunks_uploaded: chunks.length,
        };
        await supabaseAdmin
          .from('vdr_documents')
          .update({ metadata: { ...existingMeta, vault_sync: vaultSync } })
          .eq('id', doc.id);

        synced++;
        details.push({
          document_id: doc.id,
          name: doc.name,
          status: 'synced',
          chunks: chunks.length,
        });
      } catch (uploadErr) {
        // Upload failed — mark as pending_sync
        const vaultSync: VaultSyncStatus = {
          status: 'pending',
          synced_at: null,
          chunks_uploaded: 0,
          error: (uploadErr as Error).message,
        };
        await supabaseAdmin
          .from('vdr_documents')
          .update({ metadata: { ...existingMeta, vault_sync: vaultSync } })
          .eq('id', doc.id);

        failed++;
        details.push({
          document_id: doc.id,
          name: doc.name,
          status: 'failed',
          chunks: chunks.length,
          error: (uploadErr as Error).message,
        });
      }
    }

    // 7. Return summary
    return NextResponse.json({
      success: true,
      synced,
      failed,
      skipped,
      details,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// GET — Check vault sync status for project documents
// ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'project_id required' },
        { status: 400 }
      );
    }

    // 1. Permission check
    const { authorized, error: authError } = await requirePermission(
      req,
      projectId,
      'can_view_contingencies'
    );
    if (!authorized) return authError!;

    // 2. Fetch all VDR documents for project with metadata
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('vdr_documents')
      .select('id, name, status, area_code, metadata')
      .eq('project_id', projectId)
      .order('name', { ascending: true });

    if (docsError) {
      return NextResponse.json(
        { success: false, error: docsError.message },
        { status: 500 }
      );
    }

    // 3. Extract vault_sync status from metadata
    const results = (documents || []).map((doc) => {
      const meta = (doc.metadata as Record<string, unknown>) || {};
      const vaultSync = (meta.vault_sync as VaultSyncStatus | undefined) || null;

      return {
        document_id: doc.id,
        name: doc.name,
        document_status: doc.status,
        area_code: doc.area_code,
        vault_sync: vaultSync,
      };
    });

    return NextResponse.json({
      success: true,
      project_id: projectId,
      total: results.length,
      documents: results,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
