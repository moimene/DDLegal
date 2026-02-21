import { NextResponse } from 'next/server';
import { getHarveyGateway } from '@/lib/harvey';

export async function GET() {
  try {
    const gateway = getHarveyGateway();
    const health = gateway.getHealth();
    const status = health.status === 'down' ? 503 : 200;
    return NextResponse.json(health, { status });
  } catch {
    return NextResponse.json({ status: 'down', error: 'Gateway not initialized' }, { status: 503 });
  }
}
