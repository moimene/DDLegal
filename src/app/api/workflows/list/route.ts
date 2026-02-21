import { NextResponse } from 'next/server';
import { WORKFLOW_DEFINITIONS } from '@/lib/workflows';

export async function GET() {
  const workflows = Object.values(WORKFLOW_DEFINITIONS).map(w => ({
    key: w.key,
    name: w.name,
    area_codes: w.area_codes,
    description: w.description,
    hitl_required: w.hitl_required,
  }));

  return NextResponse.json({ success: true, workflows });
}
