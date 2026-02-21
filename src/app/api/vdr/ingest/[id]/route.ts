import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: job, error } = await supabaseAdmin.from('vdr_ingestion_jobs').select('*').eq('id', id).single();
  if (error || !job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ success: true, job });
}
