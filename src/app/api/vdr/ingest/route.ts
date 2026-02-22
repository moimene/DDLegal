import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import { startIngestion } from '@/lib/vdr/ingest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { document_id, version_id } = body;
    if (!document_id) return NextResponse.json({ success: false, error: 'document_id required' }, { status: 400 });

    // Fetch document to get project_id for permission check
    const { data: doc, error: docError } = await supabaseAdmin
      .from('vdr_documents')
      .select('project_id')
      .eq('id', document_id)
      .single();

    if (docError || !doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });

    // Permission check
    const { authorized, error: authError } = await requirePermission(req, doc.project_id, 'can_upload_vdr');
    if (!authorized) return authError!;

    const jobId = await startIngestion(document_id, version_id);
    return NextResponse.json({ success: true, job_id: jobId, message: 'Ingestion started' });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
