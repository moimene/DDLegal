import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'dd-legal-harvey-gateway',
    version: '1.0.0',
    endpoint: process.env.HARVEY_ENDPOINT_V1 ? 'configured' : 'missing',
    history_endpoint: process.env.HARVEY_ENDPOINT_HISTORY ? 'configured' : 'missing',
    feature_flag: process.env.HARVEY_FEATURE_FLAG || 'gateway',
    region: 'EU',
  });
}
