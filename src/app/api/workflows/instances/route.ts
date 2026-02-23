import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  buildDDReportsSelect,
  getDDReportsColumnSet,
  hasDDReportsColumns,
} from '@/lib/reports/schema-compat';
import type { WorkflowInstanceStatus } from '@/lib/workflows/template-types';

/**
 * GET /api/workflows/instances?project_id=X&status=in_progress
 * Lists workflow instances for a project.
 * Auth: requirePermission(req, project_id, 'can_view_contingencies')
 *       (proxy for project-level view access)
 */

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIso(value: unknown): string {
  return typeof value === 'string' ? value : new Date(0).toISOString();
}

function buildWorkflowReportType(templateKey: string, instanceId: string): string {
  return `workflow_${templateKey}_${instanceId}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status') as WorkflowInstanceStatus | null;

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'project_id query parameter is required' },
      { status: 400 }
    );
  }

  // Permission check
  const { authorized, error: authError } = await requirePermission(
    req,
    projectId,
    'can_view_contingencies'
  );
  if (!authorized) return authError!;

  try {
    let query = supabaseAdmin
      .from('dd_workflow_instances')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const instances = data || [];
    if (instances.length === 0) {
      return NextResponse.json({ success: true, instances });
    }

    const templateIds = Array.from(new Set(instances.map((instance) => instance.template_id)));
    const { data: templateRows, error: templateErr } = await supabaseAdmin
      .from('dd_workflow_templates')
      .select('id, template_key')
      .in('id', templateIds);

    if (templateErr) {
      return NextResponse.json(
        { success: false, error: templateErr.message },
        { status: 500 }
      );
    }

    const templateKeyById = new Map<string, string>();
    (templateRows || []).forEach((row) => {
      if (row.id && row.template_key) {
        templateKeyById.set(row.id, row.template_key);
      }
    });

    const reportTypeByInstanceId = new Map<string, string>();
    for (const instance of instances) {
      const templateKey = templateKeyById.get(instance.template_id);
      if (!templateKey) continue;
      reportTypeByInstanceId.set(instance.id, buildWorkflowReportType(templateKey, instance.id));
    }

    const reportTypes = Array.from(new Set(reportTypeByInstanceId.values()));
    if (reportTypes.length === 0) {
      return NextResponse.json({ success: true, instances });
    }

    const reportColumns = await getDDReportsColumnSet();
    const hasVersion = hasDDReportsColumns(reportColumns, ['version_number']);
    const reportSelect = buildDDReportsSelect(
      ['id', 'report_type', 'created_at'],
      ['version_number'],
      reportColumns,
    );

    const { data: reportRows, error: reportsErr } = await supabaseAdmin
      .from('dd_reports')
      .select(reportSelect)
      .in('report_type', reportTypes);

    if (reportsErr) {
      return NextResponse.json(
        { success: false, error: reportsErr.message },
        { status: 500 }
      );
    }

    const latestByReportType = new Map<string, Record<string, unknown>>();
    for (const row of (reportRows || [])) {
      const reportRow = row as unknown as Record<string, unknown>;
      const reportType = typeof reportRow.report_type === 'string' ? reportRow.report_type : '';
      if (!reportType) continue;

      const current = latestByReportType.get(reportType);
      if (!current) {
        latestByReportType.set(reportType, reportRow);
        continue;
      }

      const currentVersion = toNumber(reportRow.version_number) ?? 0;
      const savedVersion = toNumber(current.version_number) ?? 0;

      if (hasVersion) {
        if (currentVersion > savedVersion) {
          latestByReportType.set(reportType, reportRow);
          continue;
        }
        if (currentVersion < savedVersion) continue;
      }

      const currentCreatedAt = toIso(reportRow.created_at);
      const savedCreatedAt = toIso(current.created_at);
      if (currentCreatedAt > savedCreatedAt) {
        latestByReportType.set(reportType, reportRow);
      }
    }

    const enrichedInstances = instances.map((instance) => {
      const reportType = reportTypeByInstanceId.get(instance.id);
      if (!reportType) return instance;

      const latest = latestByReportType.get(reportType);
      if (!latest) return instance;

      return {
        ...instance,
        latest_report: {
          id: String(latest.id),
          version_number: hasVersion
            ? (toNumber(latest.version_number) ?? 1)
            : 1,
          created_at: toIso(latest.created_at),
        },
      };
    });

    return NextResponse.json({ success: true, instances: enrichedInstances });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
