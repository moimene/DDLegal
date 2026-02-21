import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24', 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: telemetry } = await supabaseAdmin
    .from('dd_gateway_telemetry')
    .select('duration_ms, status_code, retries, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const entries = telemetry || [];
  const total = entries.length;

  if (total === 0) {
    return NextResponse.json({
      success: true,
      slo: { total: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0, rate_429_pct: 0, error_rate_pct: 0, retry_rate_pct: 0 },
    });
  }

  const latencies = entries.map(e => e.duration_ms).sort((a: number, b: number) => a - b);
  const p50 = latencies[Math.floor(total * 0.50)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const p99 = latencies[Math.floor(total * 0.99)];

  const count429 = entries.filter(e => e.status_code === 429).length;
  const countErrors = entries.filter(e => e.status_code >= 400).length;
  const countRetries = entries.filter(e => e.retries > 0).length;

  return NextResponse.json({
    success: true,
    slo: {
      total,
      period_hours: hours,
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
      rate_429_pct: Math.round((count429 / total) * 10000) / 100,
      error_rate_pct: Math.round((countErrors / total) * 10000) / 100,
      retry_rate_pct: Math.round((countRetries / total) * 10000) / 100,
    },
  });
}
