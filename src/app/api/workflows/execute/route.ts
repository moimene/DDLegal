import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflows';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workflow_key, project_id, input } = body;

  if (!workflow_key || !project_id) {
    return NextResponse.json({ success: false, error: 'workflow_key and project_id required' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const result = await executeWorkflow({ workflow_key, project_id, input: input || {} });
    const duration = Date.now() - startTime;

    if (result.hitl_required && result.findings.length > 0) {
      const hitlTasks = result.findings
        .filter(f => f.severity === 'critical' || f.severity === 'high')
        .map(f => ({
          project_id,
          area_code: (input as Record<string, string>)?.area_code || 'GENERAL',
          title: `[HITL] ${f.title}`,
          description: f.mitigation,
          state: 'hitl_revision' as const,
          priority: f.severity === 'critical' ? 'critical' as const : 'high' as const,
          hitl_required: true,
          workflow_key,
          evidence_refs: f.evidence_refs.map((ref: string) => ({ source_id: ref })),
        }));

      if (hitlTasks.length > 0) {
        await supabaseAdmin.from('dd_kanban_tasks').insert(hitlTasks);
      }
    }

    return NextResponse.json({
      success: true,
      result,
      telemetry: { duration_ms: duration },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}
