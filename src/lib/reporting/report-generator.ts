// ============================================================
// H.5: Workflow Report Section Generator
// Generates structured report sections from workflow instance
// phase results, findings, and evidence.
//
// Fase C: When FINDINGS_FIRST is enabled, reads findings from
// dd_findings (by source_workflow_instance_id + source_phase)
// instead of instance metadata JSONB.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WorkflowInstance } from '@/lib/workflows/template-types';
import { isFindingsFirstEnabled, getFindingsByWorkflowInstance } from '@/lib/findings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSection {
  phase: string;
  title: string;
  summary: string;
  findings: ReportFinding[];
  evidence_count: number;
  hitl_status: 'approved' | 'pending' | 'rejected' | 'not_required';
}

export interface ReportFinding {
  title: string;
  severity: string;
  probability: string;
  timing: string;
  mitigation: string;
  evidence_refs: Array<{ source_id: string; snippet?: string; document_name?: string }>;
  hitl_decision?: string;
}

export interface WorkflowReportOutput {
  workflow_key: string;
  project_id: string;
  instance_id: string;
  generated_at: string;
  sections: ReportSection[];
  total_findings: number;
  critical_count: number;
  high_count: number;
  hitl_pending: number;
  evidence_coverage_pct: number;
  source: 'dd_findings' | 'legacy';
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate structured report sections from a completed (or in-progress)
 * workflow instance. Aggregates phase results stored in instance metadata,
 * evidence from kanban tasks, and HITL decisions.
 *
 * FINDINGS_FIRST: reads from dd_findings instead of metadata JSONB.
 */
export async function generateWorkflowReport(
  instanceId: string,
): Promise<WorkflowReportOutput> {
  // Load instance
  const { data: instanceRow, error: instanceErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceErr || !instanceRow) {
    throw new Error(`Instance not found: ${instanceErr?.message}`);
  }

  const instance = instanceRow as unknown as WorkflowInstance;
  const metadata = (instance.metadata ?? {}) as Record<string, unknown>;

  // Load template for phase names
  const { data: templateRow } = await supabaseAdmin
    .from('dd_workflow_templates')
    .select('template_key, name')
    .eq('id', instance.template_id)
    .single();

  const workflowKey = templateRow?.template_key ?? 'unknown';

  // Load template version for phase definitions
  const { data: versionRow } = await supabaseAdmin
    .from('dd_workflow_template_versions')
    .select('phases')
    .eq('id', instance.template_version_id)
    .single();

  const phases = (versionRow?.phases ?? []) as Array<{
    phase: string; name: string; hitl_required: boolean;
  }>;

  // Load kanban tasks with evidence
  const { data: kanbanTasks } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select('workflow_phase, evidence_refs, hitl_required, hitl_decision, ai_output')
    .eq('workflow_instance_id', instanceId);

  // Load HITL decisions
  const { data: hitlDecisions } = await supabaseAdmin
    .from('dd_hitl_decisions')
    .select('phase, status, finding_title')
    .eq('workflow_instance_id', instanceId);

  // FINDINGS_FIRST: pre-load all findings for this instance
  const useFindingsFirst = isFindingsFirstEnabled();
  const ffFindingsByPhase = new Map<string, Array<{
    title: string; severity: string; probability: string;
    timing: string; mitigation_recommended: string | null;
  }>>();

  if (useFindingsFirst) {
    const allFindings = await getFindingsByWorkflowInstance(instanceId);
    for (const f of allFindings) {
      const phase = (f as Record<string, unknown>).source_phase as string ?? 'unknown';
      if (!ffFindingsByPhase.has(phase)) ffFindingsByPhase.set(phase, []);
      ffFindingsByPhase.get(phase)!.push({
        title: f.title,
        severity: f.severity,
        probability: f.probability,
        timing: f.timing,
        mitigation_recommended: (f as Record<string, unknown>).mitigation_recommended as string | null,
      });
    }
  }

  // Build sections per phase
  const sections: ReportSection[] = [];
  let totalFindings = 0;
  let criticalCount = 0;
  let highCount = 0;
  let hitlPending = 0;
  let totalEvidence = 0;
  let findingsWithEvidence = 0;

  for (const phaseDef of phases) {
    // Get findings for this phase
    let phaseFindings: Array<{
      title: string; severity: string; probability: string;
      timing: string; mitigation: string; evidence_refs?: string[];
    }>;

    if (useFindingsFirst) {
      // FINDINGS_FIRST: read from pre-loaded dd_findings
      const ffFindings = ffFindingsByPhase.get(phaseDef.phase) ?? [];
      phaseFindings = ffFindings.map((f) => ({
        title: f.title,
        severity: f.severity,
        probability: f.probability,
        timing: f.timing,
        mitigation: f.mitigation_recommended ?? '',
      }));
    } else {
      // LEGACY: read from metadata JSONB
      const phaseResults = metadata[`phase_results_${phaseDef.phase}`] as Record<string, unknown> | undefined;
      phaseFindings = (phaseResults?.findings ?? []) as Array<{
        title: string; severity: string; probability: string;
        timing: string; mitigation: string; evidence_refs?: string[];
      }>;
    }

    const phaseTasks = (kanbanTasks ?? []).filter(t => t.workflow_phase === phaseDef.phase);
    const phaseHitl = (hitlDecisions ?? []).filter(h => h.phase === phaseDef.phase);

    // Determine HITL status for this phase
    let hitlStatus: ReportSection['hitl_status'] = 'not_required';
    if (phaseDef.hitl_required) {
      const allApproved = phaseHitl.length > 0 && phaseHitl.every(h => h.status === 'approved');
      const anyPending = phaseHitl.some(h => h.status === 'pending_review');
      const anyRejected = phaseHitl.some(h => h.status === 'rejected');
      hitlStatus = anyRejected ? 'rejected' : anyPending ? 'pending' : allApproved ? 'approved' : 'pending';
    }

    const sharedEvidenceRefs = phaseTasks
      .flatMap(t => (t.evidence_refs ?? []) as Array<{ source_id: string; snippet?: string; document_name?: string }>)
      .slice(0, 10);

    const hitlDecisionsByTitle = new Map<string, string>();
    for (const h of phaseHitl) {
      if (!hitlDecisionsByTitle.has(h.finding_title)) {
        hitlDecisionsByTitle.set(h.finding_title, h.status);
      }
    }

    // Build report findings with evidence
    const reportFindings: ReportFinding[] = phaseFindings.map(f => {
      if (sharedEvidenceRefs.length > 0) findingsWithEvidence++;

      const hitlDecisionStatus = hitlDecisionsByTitle.get(f.title);

      return {
        title: f.title,
        severity: f.severity,
        probability: f.probability,
        timing: f.timing,
        mitigation: f.mitigation,
        evidence_refs: sharedEvidenceRefs,
        hitl_decision: hitlDecisionStatus,
      };
    });

    // Count totals
    totalFindings += reportFindings.length;
    criticalCount += reportFindings.filter(f => f.severity === 'critical').length;
    highCount += reportFindings.filter(f => f.severity === 'high').length;
    hitlPending += phaseHitl.filter(h => h.status === 'pending_review').length;
    totalEvidence += phaseTasks.reduce((acc, t) => acc + ((t.evidence_refs as unknown[])?.length ?? 0), 0);

    // Build summary
    const phaseResults = metadata[`phase_results_${phaseDef.phase}`] as Record<string, unknown> | undefined;
    const summary = phaseResults
      ? (phaseResults.report_section as string ?? `Fase completada con ${reportFindings.length} hallazgo(s).`)
      : `Fase ${phaseDef.name}: ${instance.phase_status[phaseDef.phase as keyof typeof instance.phase_status] ?? 'pending'}`;

    sections.push({
      phase: phaseDef.phase,
      title: phaseDef.name,
      summary,
      findings: reportFindings,
      evidence_count: phaseTasks.reduce((acc, t) => acc + ((t.evidence_refs as unknown[])?.length ?? 0), 0),
      hitl_status: hitlStatus,
    });
  }

  const evidenceCoverage = totalFindings > 0
    ? Math.round((findingsWithEvidence / totalFindings) * 100)
    : 100;

  return {
    workflow_key: workflowKey,
    project_id: instance.project_id,
    instance_id: instanceId,
    generated_at: new Date().toISOString(),
    sections,
    total_findings: totalFindings,
    critical_count: criticalCount,
    high_count: highCount,
    hitl_pending: hitlPending,
    evidence_coverage_pct: evidenceCoverage,
    source: useFindingsFirst ? 'dd_findings' : 'legacy',
  };
}
