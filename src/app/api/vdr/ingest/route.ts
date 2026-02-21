import { NextRequest, NextResponse } from 'next/server';
import { startIngestion } from '@/lib/vdr/ingest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { document_id, version_id } = body;
    if (!document_id) return NextResponse.json({ success: false, error: 'document_id required' }, { status: 400 });
    const jobId = await startIngestion(document_id, version_id);
    return NextResponse.json({ success: true, job_id: jobId, message: 'Ingestion started' });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
