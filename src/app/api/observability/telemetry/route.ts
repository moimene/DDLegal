import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200);
  const statusFilter = req.nextUrl.searchParams.get('status');

  let query = supabaseAdmin
    .from('dd_gateway_telemetry')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq('status_code', parseInt(statusFilter, 10));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, telemetry: data });
}
