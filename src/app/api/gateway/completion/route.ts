import { NextRequest, NextResponse } from 'next/server';
import { getHarveyGateway, HarveyGatewayError } from '@/lib/harvey';
import { requirePermission } from '@/lib/auth/require-permission';

export async function POST(req: NextRequest) {
  try {
    // We need to clone the request to read body twice
    const clonedReq = req.clone();
    const bodyForAuth = await clonedReq.json().catch(() => ({}));
    const projectId = bodyForAuth.project_id;

    // Permission check
    if (projectId) {
      const { authorized, error: authError } = await requirePermission(req, projectId, 'can_edit_tasks');
      if (!authorized) return authError!;
    } else {
      const userId = req.headers.get('x-user-id');
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const featureFlag = process.env.HARVEY_FEATURE_FLAG || 'gateway';
    const gateway = getHarveyGateway();

    if (gateway.shouldFallbackToN8n(featureFlag)) {
      const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
      if (!n8nUrl) {
        return NextResponse.json({ success: false, error: 'N8N fallback not configured' }, { status: 503 });
      }
      const body = await req.json();
      const n8nRes = await fetch(`${n8nUrl}/dd-harvey-invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const n8nData = await n8nRes.json();
      return NextResponse.json({ success: true, source: 'n8n', data: n8nData });
    }

    const body = await req.json();
    const { prompt, system_prompt, client_matter_id, knowledge_sources } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    const result = await gateway.completion({
      prompt,
      system_prompt,
      client_matter_id,
      knowledge_sources,
    });

    return NextResponse.json({ success: true, source: 'gateway', data: result });
  } catch (err) {
    if (err instanceof HarveyGatewayError) {
      return NextResponse.json(
        { success: false, error: err.message, request_id: err.requestId },
        { status: err.statusCode >= 500 ? 502 : err.statusCode }
      );
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
