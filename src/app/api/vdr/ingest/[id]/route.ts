import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: job, error } = await supabaseAdmin.from('vdr_ingestion_jobs').select('*').eq('id', id).single();
  if (error || !job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });

  // Fetch document to get project_id for permission check
  const { data: doc } = await supabaseAdmin
    .from('vdr_documents')
    .select('project_id')
    .eq('id', job.document_id)
    .single();

  if (doc) {
    // Permission check
    const { authorized, error: authError } = await requirePermission(req, doc.project_id, 'can_upload_vdr');
    if (!authorized) return authError!;
  } else {
    // If document not found, fall back to basic auth check
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ success: true, job });
}
