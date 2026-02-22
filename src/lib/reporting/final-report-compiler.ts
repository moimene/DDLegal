// ============================================================
// N.2: WF-16 Final Report Compiler
// Compiles a consolidated final DD report across all completed
// workflow instances for a project, incorporating red flags,
// negotiation actions, and war room decisions.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateWorkflowReport } from './report-generator';
import type { WorkflowReportOutput } from './report-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinalReportSection {
  area_code: string;
  area_name: string;
  workflow_key: string;
  status: 'completed' | 'in_progress' | 'pending';
  findings_count: number;
  critical_count: number;
  high_count: number;
  report_text: string;
  evidence_coverage_pct: number;
  hitl_pending: number;
}

export interface FinalReportOutput {
  project_id: string;
  project_name: string;
  generated_at: string;
  sections: FinalReportSection[];
  executive_summary: string;
  total_findings: number;
  total_critical: number;
  total_high: number;
  overall_evidence_coverage_pct: number;
  overall_hitl_pending: number;
  red_flags_digest: {
    total: number;
    deal_breakers: number;
    critical: number;
  };
  negotiation_actions_summary: {
    total: number;
    by_status: Record<string, number>;
  };
  war_room_decisions_summary: {
    total: number;
    by_type: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve area_codes from a template to the primary area name */
function resolveAreaName(
  areaCodes: string[],
  areasMap: Map<string, string>,
): { code: string; name: string } {
  const primary = areaCodes[0] ?? 'GENERAL';
  return {
    code: primary,
    name: areasMap.get(primary) ?? primary,
  };
}

/** Build a report text summary from workflow report sections */
function buildReportText(report: WorkflowReportOutput): string {
  if (report.sections.length === 0) {
    return 'Sin hallazgos reportados.';
  }
  const parts: string[] = [];
  for (const section of report.sections) {
    const findingCount = section.findings.length;
    if (findingCount > 0) {
      parts.push(`${section.title}: ${findingCount} hallazgo(s)`);
    }
  }
  return parts.length > 0
    ? parts.join('. ') + '.'
    : 'Analisis completado sin hallazgos significativos.';
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

/**
 * Compile a consolidated Final DD Report (WF-16) for a project.
 *
 * Steps:
 *   1. Load project info
 *   2. Load all workflow instances (all statuses, filter in code)
 *   3. For each completed instance, call generateWorkflowReport()
 *   4. Map instances to FinalReportSection with area info from template
 *   5. Load negotiation actions, war room decisions, red flags
 *   6. Build executive summary and aggregate totals
 */
export async function compileFinalReport(
  projectId: string,
): Promise<FinalReportOutput> {
  // --- 1. Load project info ---
  const { data: project, error: projErr } = await supabaseAdmin
    .from('dd_projects')
    .select('id, name, target_company')
    .eq('id', projectId)
    .single();

  if (projErr || !project) {
    throw new Error(`Project not found: ${projErr?.message ?? projectId}`);
  }

  const projectName = project.name ?? project.target_company ?? projectId;

  // --- 2. Load areas lookup ---
  const { data: areas } = await supabaseAdmin
    .from('dd_areas')
    .select('code, name');

  const areasMap = new Map<string, string>();
  for (const a of (areas ?? [])) {
    areasMap.set(a.code, a.name);
  }

  // --- 3. Load all workflow instances for project ---
  const { data: instances } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('id, template_id, status, current_phase')
    .eq('project_id', projectId);

  // --- 4. Load template info for area_codes mapping ---
  const templateIds = Array.from(
    new Set((instances ?? []).map(i => i.template_id).filter(Boolean)),
  );

  const templateMap = new Map<string, { template_key: string; area_codes: string[] }>();
  if (templateIds.length > 0) {
    const { data: templates } = await supabaseAdmin
      .from('dd_workflow_templates')
      .select('id, template_key, area_codes')
      .in('id', templateIds);

    for (const t of (templates ?? [])) {
      templateMap.set(t.id, {
        template_key: t.template_key,
        area_codes: t.area_codes ?? ['GENERAL'],
      });
    }
  }

  // --- 5. Generate per-instance reports for completed instances ---
  const sections: FinalReportSection[] = [];
  let totalFindings = 0;
  let totalCritical = 0;
  let totalHigh = 0;
  let totalEvidenceCoveragePctSum = 0;
  let totalHitlPending = 0;
  let completedCount = 0;

  for (const inst of (instances ?? [])) {
    const tmpl = templateMap.get(inst.template_id);
    const area = resolveAreaName(tmpl?.area_codes ?? ['GENERAL'], areasMap);
    const instanceStatus = inst.status as 'completed' | 'in_progress' | 'pending' | string;

    // Determine section status
    let sectionStatus: FinalReportSection['status'] = 'pending';
    if (instanceStatus === 'completed') {
      sectionStatus = 'completed';
    } else if (instanceStatus === 'in_progress') {
      sectionStatus = 'in_progress';
    }

    if (sectionStatus === 'completed') {
      // Generate full workflow report for completed instances
      try {
        const report = await generateWorkflowReport(inst.id);

        sections.push({
          area_code: area.code,
          area_name: area.name,
          workflow_key: tmpl?.template_key ?? 'unknown',
          status: 'completed',
          findings_count: report.total_findings,
          critical_count: report.critical_count,
          high_count: report.high_count,
          report_text: buildReportText(report),
          evidence_coverage_pct: report.evidence_coverage_pct,
          hitl_pending: report.hitl_pending,
        });

        totalFindings += report.total_findings;
        totalCritical += report.critical_count;
        totalHigh += report.high_count;
        totalEvidenceCoveragePctSum += report.evidence_coverage_pct;
        totalHitlPending += report.hitl_pending;
        completedCount++;
      } catch {
        // If report generation fails, include section with zero data
        sections.push({
          area_code: area.code,
          area_name: area.name,
          workflow_key: tmpl?.template_key ?? 'unknown',
          status: 'completed',
          findings_count: 0,
          critical_count: 0,
          high_count: 0,
          report_text: 'Error al generar el informe de este workflow.',
          evidence_coverage_pct: 0,
          hitl_pending: 0,
        });
        completedCount++;
      }
    } else {
      // Non-completed: include stub section
      sections.push({
        area_code: area.code,
        area_name: area.name,
        workflow_key: tmpl?.template_key ?? 'unknown',
        status: sectionStatus,
        findings_count: 0,
        critical_count: 0,
        high_count: 0,
        report_text: sectionStatus === 'in_progress'
          ? 'Analisis en progreso.'
          : 'Pendiente de ejecucion.',
        evidence_coverage_pct: 0,
        hitl_pending: 0,
      });
    }
  }

  const overallEvidenceCoverage = completedCount > 0
    ? Math.round(totalEvidenceCoveragePctSum / completedCount)
    : 0;

  // --- 6. Load negotiation actions ---
  const { data: negActions } = await supabaseAdmin
    .from('dd_negotiation_actions')
    .select('id, status')
    .eq('project_id', projectId);

  const negByStatus: Record<string, number> = {};
  for (const a of (negActions ?? [])) {
    const st = a.status ?? 'proposed';
    negByStatus[st] = (negByStatus[st] ?? 0) + 1;
  }

  // --- 7. Load war room decisions ---
  const { data: decisions } = await supabaseAdmin
    .from('dd_war_room_decisions')
    .select('id, decision_type')
    .eq('project_id', projectId);

  const decByType: Record<string, number> = {};
  for (const d of (decisions ?? [])) {
    const dt = d.decision_type ?? 'other';
    decByType[dt] = (decByType[dt] ?? 0) + 1;
  }

  // --- 8. Load red flags digest (contingencies critical + high) ---
  const { data: critContingencies } = await supabaseAdmin
    .from('dd_contingencies')
    .select('id, severity, probability')
    .eq('project_id', projectId)
    .in('severity', ['critical', 'high']);

  const dealBreakers = (critContingencies ?? []).filter(
    c => c.severity === 'critical' && c.probability === 'certain',
  ).length;
  const criticalRedFlags = (critContingencies ?? []).filter(
    c => c.severity === 'critical',
  ).length;

  // --- 9. Build executive summary ---
  const totalInstances = (instances ?? []).length;
  const completedInstances = (instances ?? []).filter(i => i.status === 'completed').length;
  const areasAnalyzed = new Set(sections.map(s => s.area_code));

  const summaryParts: string[] = [
    `Informe de Due Diligence para ${projectName}.`,
    `Se analizaron ${areasAnalyzed.size} area(s) a traves de ${totalInstances} workflow(s) (${completedInstances} completado(s)).`,
  ];

  if (totalFindings > 0) {
    summaryParts.push(
      `Se identificaron ${totalFindings} hallazgo(s): ${totalCritical} critico(s) y ${totalHigh} alto(s).`,
    );
  } else {
    summaryParts.push('No se identificaron hallazgos significativos.');
  }

  if (dealBreakers > 0) {
    summaryParts.push(
      `ATENCION: ${dealBreakers} deal breaker(s) detectado(s).`,
    );
  }

  if (totalHitlPending > 0) {
    summaryParts.push(
      `${totalHitlPending} revision(es) HITL pendiente(s).`,
    );
  }

  if ((negActions ?? []).length > 0) {
    summaryParts.push(
      `${(negActions ?? []).length} accion(es) de negociacion registrada(s).`,
    );
  }

  const executiveSummary = summaryParts.join(' ');

  // --- 10. Return final report ---
  return {
    project_id: projectId,
    project_name: projectName,
    generated_at: new Date().toISOString(),
    sections,
    executive_summary: executiveSummary,
    total_findings: totalFindings,
    total_critical: totalCritical,
    total_high: totalHigh,
    overall_evidence_coverage_pct: overallEvidenceCoverage,
    overall_hitl_pending: totalHitlPending,
    red_flags_digest: {
      total: (critContingencies ?? []).length,
      deal_breakers: dealBreakers,
      critical: criticalRedFlags,
    },
    negotiation_actions_summary: {
      total: (negActions ?? []).length,
      by_status: negByStatus,
    },
    war_room_decisions_summary: {
      total: (decisions ?? []).length,
      by_type: decByType,
    },
  };
}
