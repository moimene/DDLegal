import { supabaseAdmin } from '@/lib/supabase-admin';
import { persistFindings, type PersistFindingInput } from '@/lib/findings/findings-service';
import { generateWorkflowReport } from '@/lib/reporting/report-generator';
import {
  getDDReportsColumnSet,
  hasDDReportsColumns,
} from '@/lib/reports/schema-compat';
import { emitWarRoomNotification } from '@/lib/war-room/notifications';
import { executeWorkflow } from './engine';
import { advancePhase } from './phase-engine';
import type {
  NegotiationActionType,
  PhaseAdvanceResult,
  PhaseDefinition,
  WorkflowInstance,
  WorkflowTemplate,
  WorkflowTemplateVersion,
} from './template-types';
import type { WorkflowExecutionResult, WorkflowFinding } from './types';

export interface RunWorkflowInstanceRequest {
  instanceId: string;
  input?: Record<string, unknown>;
}

export interface WorkflowInformationGate {
  reason: 'missing_required_inputs' | 'missing_vdr_documents';
  missing_inputs: string[];
  required_inputs: string[];
  current_phase: string;
  phase_name: string;
  message: string;
}

export interface RunWorkflowInstanceResult {
  success: boolean;
  code?: 'information_required' | 'phase_gate_failed' | 'execution_error';
  message?: string;
  instance?: WorkflowInstance;
  execution?: WorkflowExecutionResult;
  phase_advance?: PhaseAdvanceResult;
  information_gate?: WorkflowInformationGate;
  side_effects?: {
    war_room_notifications: number;
    negotiation_actions_created: number;
    workflow_report_created: boolean;
    workflow_report_id?: string;
    workflow_report_version?: number;
    loop_number?: number;
    phase_loop_number?: number;
  };
}

function findPhaseDefinition(
  phases: PhaseDefinition[],
  phase: string,
): PhaseDefinition | undefined {
  return phases.find((p) => p.phase === phase);
}

function resolveMissingInputs(
  requiredInputs: string[],
  input: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string[] {
  return requiredInputs.filter((key) => {
    const inInput = input[key] !== undefined && input[key] !== null && input[key] !== '';
    const inMetadata = metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '';
    return !inInput && !inMetadata;
  });
}

function buildAutoDodChecks(
  phaseDef: PhaseDefinition,
  executionSucceeded: boolean,
): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  for (const criterion of (phaseDef.dod_criteria ?? [])) {
    if (criterion.required) {
      checks[criterion.check] = executionSucceeded;
    }
  }
  return checks;
}

async function countProjectVdrDocuments(projectId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('vdr_documents')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  return count ?? 0;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildWorkflowReportType(templateKey: string, instanceId: string): string {
  return `workflow_${templateKey}_${instanceId}`;
}

type WorkflowLoopStatus =
  | 'information_required'
  | 'phase_gate_failed'
  | 'execution_error'
  | 'completed';

interface WorkflowLoopEntryInput {
  phase: string;
  status: WorkflowLoopStatus;
  template_key?: string;
  next_phase?: string | null;
  information_reason?: string;
  missing_inputs?: string[];
  message?: string;
  findings_count?: number;
  red_flags_count?: number;
  workflow_report_id?: string;
  workflow_report_version?: number;
}

interface WorkflowLoopCounters {
  loop_number: number;
  phase_loop_number: number;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function appendWorkflowLoopEntry(
  instanceId: string,
  entry: WorkflowLoopEntryInput,
): Promise<WorkflowLoopCounters | null> {
  try {
    const { data: instanceRow, error: instanceErr } = await supabaseAdmin
      .from('dd_workflow_instances')
      .select('metadata')
      .eq('id', instanceId)
      .single();

    if (instanceErr || !instanceRow) {
      console.error('[WorkflowRunner] Unable to load metadata for loop append:', instanceErr?.message);
      return null;
    }

    const metadata = toRecord(instanceRow.metadata);
    const loopCount = toNumber(metadata.execution_loop_count) ?? 0;
    const phaseLoopCounts = toRecord(metadata.phase_loop_counts);
    const phaseLoopCount = toNumber(phaseLoopCounts[entry.phase]) ?? 0;

    const nextLoopNumber = loopCount + 1;
    const nextPhaseLoopNumber = phaseLoopCount + 1;

    const newEntry: Record<string, unknown> = {
      loop_number: nextLoopNumber,
      phase_loop_number: nextPhaseLoopNumber,
      phase: entry.phase,
      status: entry.status,
      template_key: entry.template_key ?? null,
      next_phase: entry.next_phase ?? null,
      information_reason: entry.information_reason ?? null,
      missing_inputs: entry.missing_inputs ?? [],
      message: entry.message ?? null,
      findings_count: entry.findings_count ?? 0,
      red_flags_count: entry.red_flags_count ?? 0,
      workflow_report_id: entry.workflow_report_id ?? null,
      workflow_report_version: entry.workflow_report_version ?? null,
      created_at: new Date().toISOString(),
    };

    const previousLoops = toArray(metadata.execution_loops);
    const nextLoops = [...previousLoops, newEntry].slice(-200);

    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      execution_loop_count: nextLoopNumber,
      phase_loop_counts: {
        ...phaseLoopCounts,
        [entry.phase]: nextPhaseLoopNumber,
      },
      execution_loops: nextLoops,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('dd_workflow_instances')
      .update({ metadata: nextMetadata })
      .eq('id', instanceId);

    if (updateErr) {
      console.error('[WorkflowRunner] Failed to append workflow loop entry:', updateErr.message);
      return null;
    }

    return {
      loop_number: nextLoopNumber,
      phase_loop_number: nextPhaseLoopNumber,
    };
  } catch (err) {
    console.error('[WorkflowRunner] Unexpected loop append error:', err);
    return null;
  }
}

async function archiveWorkflowReportVersion(params: {
  instance: WorkflowInstance;
  template: WorkflowTemplate;
  phaseDef: PhaseDefinition;
  execution: WorkflowExecutionResult;
  phaseAdvance: PhaseAdvanceResult;
}): Promise<{ created: boolean; report_id?: string; version_number?: number }> {
  try {
    const workflowReport = await generateWorkflowReport(params.instance.id);
    const reportType = buildWorkflowReportType(params.template.template_key, params.instance.id);
    const reportColumns = await getDDReportsColumnSet();
    const hasVersionNumber = hasDDReportsColumns(reportColumns, ['version_number']);

    let nextVersion = 1;
    if (hasVersionNumber) {
      const { data: existingRows } = await supabaseAdmin
        .from('dd_reports')
        .select('version_number')
        .eq('report_type', reportType)
        .order('version_number', { ascending: false })
        .limit(1);
      nextVersion = (toNumber(existingRows?.[0]?.version_number) ?? 0) + 1;
    } else {
      const { count } = await supabaseAdmin
        .from('dd_reports')
        .select('id', { head: true, count: 'exact' })
        .eq('report_type', reportType);
      nextVersion = (count ?? 0) + 1;
    }

    const insertPayload: Record<string, unknown> = {
      report_type: reportType,
      prompt_used: [
        `Workflow report auto-generated for ${params.template.template_key}.`,
        `Instance: ${params.instance.id}.`,
        `Phase completed: ${params.phaseDef.phase}.`,
        `Next phase: ${params.phaseAdvance.next_phase ?? 'none'}.`,
        `Execution source: ${params.execution.source}.`,
      ].join(' '),
      evidence_pack: {
        auto_generated: true,
        source: 'workflow_instance_runner',
        workflow_instance_id: params.instance.id,
        workflow_template_key: params.template.template_key,
        workflow_phase: params.phaseDef.phase,
        generated_at: new Date().toISOString(),
      },
      harvey_response: workflowReport as unknown as Record<string, unknown>,
      grounding_score: workflowReport.evidence_coverage_pct,
      grounding_issues: [],
      status: 'done',
    };

    if (reportColumns.has('report_category')) {
      insertPayload.report_category = 'workstream';
    }
    if (reportColumns.has('visibility')) {
      insertPayload.visibility = 'internal';
    }
    if (reportColumns.has('version_number')) {
      insertPayload.version_number = nextVersion;
    }
    if (reportColumns.has('is_frozen')) {
      insertPayload.is_frozen = false;
    }
    if (reportColumns.has('frozen_at')) {
      insertPayload.frozen_at = null;
    }
    if (reportColumns.has('frozen_by')) {
      insertPayload.frozen_by = null;
    }

    const { data: insertedRow, error: insertErr } = await supabaseAdmin
      .from('dd_reports')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr || !insertedRow) {
      console.error('[WorkflowRunner] Failed to archive workflow report version:', insertErr?.message);
      return { created: false };
    }

    const insertedRecord = insertedRow as unknown as Record<string, unknown>;

    return {
      created: true,
      report_id: String(insertedRecord.id),
      version_number: hasVersionNumber
        ? (toNumber(insertedRecord.version_number) ?? nextVersion)
        : nextVersion,
    };
  } catch (err) {
    console.error('[WorkflowRunner] Unexpected error archiving workflow report:', err);
    return { created: false };
  }
}

function isHighPriorityFinding(finding: WorkflowFinding): boolean {
  return finding.severity === 'critical' || finding.severity === 'high';
}

function normalizeFindingSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'finding';
}

function buildFindingRef(
  instanceId: string,
  phase: string,
  finding: WorkflowFinding,
): string {
  return `${instanceId}:${phase}:${finding.severity}:${normalizeFindingSlug(finding.title || 'finding')}`;
}

function inferNegotiationActionType(finding: WorkflowFinding): NegotiationActionType {
  const text = `${finding.title} ${finding.mitigation}`.toLowerCase();

  if (text.includes('escrow')) return 'escrow';
  if (text.includes('indemn')) return 'indemnity';
  if (text.includes('price') || text.includes('precio') || text.includes('ajuste')) return 'price_adjustment';
  if (text.includes('warranty') || text.includes('garantia')) return 'warranty';
  if (text.includes('covenant') || text.includes('obligacion')) return 'covenant';
  if (text.includes('cap') || text.includes('basket')) return 'cap_basket';
  if (text.includes('carve')) return 'carve_out';
  if (finding.timing === 'blocking') return 'condition_precedent';
  return 'other';
}

/**
 * Resolve dd_findings IDs for a set of findings using the external_ref pattern.
 * Returns a map of finding_ref → dd_findings.id (for linking to negotiation actions).
 */
async function resolveFindingIds(
  instanceId: string,
  phase: string,
  findings: WorkflowFinding[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (findings.length === 0) return result;

  // Build the external_ref patterns that match how persistFindings generates them
  // and precompute a map of normalized title slug to the finding for O(1) lookups
  // This eliminates the N+1 regex executions during the iteration of dd_finding rows below.
  const slugs: string[] = [];
  const slugToFinding = new Map<string, WorkflowFinding>();

  for (const f of findings) {
    const titleSlug = f.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'untitled';
    slugs.push(`${instanceId}:${phase}:${titleSlug}`);
    if (!slugToFinding.has(titleSlug)) {
      slugToFinding.set(titleSlug, f);
    }
  }

  const { data: rows } = await supabaseAdmin
    .from('dd_findings')
    .select('id, external_ref')
    .in('external_ref', slugs);

  if (rows) {
    for (const row of rows) {
      // Map finding_ref (instance:phase:severity:slug) → dd_findings.id
      // We need to map via title slug which is shared between external_ref and finding_ref
      const extRef = row.external_ref as string;
      // external_ref = instance:phase:titleSlug
      // finding_ref  = instance:phase:severity:titleSlug
      // Match by finding any finding_ref that ends with the same titleSlug
      const parts = extRef.split(':');
      const titleSlug = parts.slice(2).join(':');
      // Look up matching finding via precomputed O(1) map
      const matchingFinding = slugToFinding.get(titleSlug);
      if (matchingFinding) {
        const findingRef = buildFindingRef(instanceId, phase, matchingFinding);
        result.set(findingRef, row.id as string);
      }
    }
  }

  return result;
}

async function createNegotiationActionsFromFindings(params: {
  projectId: string;
  workflowInstanceId: string;
  workflowKey: string;
  phase: string;
  findings: WorkflowFinding[];
}): Promise<number> {
  try {
    const highPriorityFindings = params.findings.filter(isHighPriorityFinding);

    // Resolve dd_findings IDs for linking
    const findingIdMap = await resolveFindingIds(
      params.workflowInstanceId,
      params.phase,
      highPriorityFindings,
    );

    const candidates = highPriorityFindings
      .map((finding) => {
        const findingRef = buildFindingRef(params.workflowInstanceId, params.phase, finding);
        return {
          project_id: params.projectId,
          workflow_instance_id: params.workflowInstanceId,
          finding_ref: findingRef,
          finding_id: findingIdMap.get(findingRef) || null,  // Link to dd_findings
          action_type: inferNegotiationActionType(finding),
          title: `[Auto] ${finding.title}`,
          description: finding.mitigation || `Hallazgo ${finding.severity} detectado en fase ${params.phase}.`,
          proposed_text: finding.mitigation || null,
          status: 'proposed',
          evidence_refs: (finding.evidence_refs || []).map((sourceId) => ({ source_id: sourceId })),
          economic_impact_amount: finding.economic_impact?.amount ?? null,
          economic_impact_currency: finding.economic_impact?.currency || 'EUR',
          metadata: {
            auto_generated: true,
            source: 'workflow_instance_runner',
            workflow_key: params.workflowKey,
            workflow_phase: params.phase,
            severity: finding.severity,
            probability: finding.probability,
            timing: finding.timing,
            verifiability: finding.verifiability,
            generated_at: new Date().toISOString(),
          },
        };
      });

    if (candidates.length === 0) return 0;

    const findingRefs = candidates.map((row) => row.finding_ref);
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from('dd_negotiation_actions')
      .select('finding_ref')
      .eq('project_id', params.projectId)
      .eq('workflow_instance_id', params.workflowInstanceId)
      .in('finding_ref', findingRefs);

    if (existingErr) {
      console.error('[WorkflowRunner] Unable to query existing negotiation actions:', existingErr.message);
      return 0;
    }

    const existingRefs = new Set(
      (existingRows || [])
        .map((row) => row.finding_ref)
        .filter((value): value is string => typeof value === 'string'),
    );

    const rowsToInsert = candidates.filter((row) => !existingRefs.has(row.finding_ref));
    if (rowsToInsert.length === 0) return 0;

    const { data: insertedRows, error: insertErr } = await supabaseAdmin
      .from('dd_negotiation_actions')
      .insert(rowsToInsert)
      .select('id');

    if (insertErr) {
      console.error('[WorkflowRunner] Failed to create negotiation actions:', insertErr.message);
      return 0;
    }

    return insertedRows?.length ?? 0;
  } catch (err) {
    console.error('[WorkflowRunner] Unexpected error creating negotiation actions:', err);
    return 0;
  }
}

async function runPostPhaseSideEffects(params: {
  instance: WorkflowInstance;
  template: WorkflowTemplate;
  phaseDef: PhaseDefinition;
  execution: WorkflowExecutionResult;
  phaseAdvance: PhaseAdvanceResult;
}): Promise<{
  war_room_notifications: number;
  negotiation_actions_created: number;
  workflow_report_created: boolean;
  workflow_report_id?: string;
  workflow_report_version?: number;
}> {
  const sideEffects = {
    war_room_notifications: 0,
    negotiation_actions_created: 0,
    workflow_report_created: false,
    workflow_report_id: undefined as string | undefined,
    workflow_report_version: undefined as number | undefined,
  };

  try {
    const archivedReport = await archiveWorkflowReportVersion(params);
    if (archivedReport.created) {
      sideEffects.workflow_report_created = true;
      sideEffects.workflow_report_id = archivedReport.report_id;
      sideEffects.workflow_report_version = archivedReport.version_number;
    }

    const findings = params.execution.findings || [];
    if (findings.length === 0) return sideEffects;

    const criticalCount = findings.filter((finding) => finding.severity === 'critical').length;
    const highCount = findings.filter((finding) => finding.severity === 'high').length;
    const summarySeverity = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium';
    const summaryType = criticalCount > 0 || highCount > 0 ? 'red_flag_new' : 'decision_required';
    const nextPhaseText = params.phaseAdvance.next_phase
      ? `Siguiente fase: ${params.phaseAdvance.next_phase}.`
      : 'Workflow completado.';

    await emitWarRoomNotification({
      project_id: params.instance.project_id,
      notification_type: summaryType,
      title: `WF ${params.template.template_key} · ${params.phaseDef.name}: ${findings.length} hallazgo(s)`,
      description: `${criticalCount} criticos, ${highCount} altos. ${nextPhaseText}`,
      severity: summarySeverity,
      source_type: 'workflow_phase',
      source_id: params.instance.id,
    });
    sideEffects.war_room_notifications += 1;

    const negotiationActionsCreated = await createNegotiationActionsFromFindings({
      projectId: params.instance.project_id,
      workflowInstanceId: params.instance.id,
      workflowKey: params.template.template_key,
      phase: params.phaseDef.phase,
      findings,
    });

    sideEffects.negotiation_actions_created = negotiationActionsCreated;

    if (negotiationActionsCreated > 0) {
      await emitWarRoomNotification({
        project_id: params.instance.project_id,
        notification_type: 'decision_required',
        title: `Negociacion: ${negotiationActionsCreated} acciones propuestas`,
        description: `Se generaron acciones automaticas desde la fase ${params.phaseDef.name}.`,
        severity: summarySeverity,
        source_type: 'workflow_negotiation',
        source_id: params.instance.id,
      });
      sideEffects.war_room_notifications += 1;
    }
  } catch (err) {
    console.error('[WorkflowRunner] Post-phase side effects failed (non-fatal):', err);
  }

  return sideEffects;
}

export async function runWorkflowInstance(
  request: RunWorkflowInstanceRequest,
): Promise<RunWorkflowInstanceResult> {
  const input = request.input ?? {};

  const { data: instanceRow, error: instanceErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('*')
    .eq('id', request.instanceId)
    .single();

  if (instanceErr || !instanceRow) {
    return {
      success: false,
      code: 'execution_error',
      message: `Workflow instance "${request.instanceId}" not found.`,
    };
  }

  const instance = instanceRow as unknown as WorkflowInstance;

  if (instance.status !== 'created' && instance.status !== 'in_progress') {
    return {
      success: false,
      code: 'execution_error',
      message: `Instance status "${instance.status}" does not allow execution.`,
      instance,
    };
  }

  const { data: templateRow, error: templateErr } = await supabaseAdmin
    .from('dd_workflow_templates')
    .select('*')
    .eq('id', instance.template_id)
    .single();

  if (templateErr || !templateRow) {
    return {
      success: false,
      code: 'execution_error',
      message: `Template "${instance.template_id}" not found.`,
      instance,
    };
  }

  const template = templateRow as unknown as WorkflowTemplate;

  const { data: versionRow, error: versionErr } = await supabaseAdmin
    .from('dd_workflow_template_versions')
    .select('*')
    .eq('id', instance.template_version_id)
    .single();

  if (versionErr || !versionRow) {
    return {
      success: false,
      code: 'execution_error',
      message: `Template version "${instance.template_version_id}" not found.`,
      instance,
    };
  }

  const version = versionRow as unknown as WorkflowTemplateVersion;
  const phaseDef = findPhaseDefinition(version.phases, instance.current_phase);

  if (!phaseDef) {
    return {
      success: false,
      code: 'execution_error',
      message: `Phase "${instance.current_phase}" is not defined in template version.`,
      instance,
    };
  }

  const metadata = (instance.metadata ?? {}) as Record<string, unknown>;
  const currentLoopNumber = toNumber(metadata.execution_loop_count) ?? 0;
  const phaseLoopCounts = toRecord(metadata.phase_loop_counts);
  const currentPhaseLoopNumber =
    toNumber(phaseLoopCounts[instance.current_phase]) ?? 0;
  const previousLoops = toArray(metadata.execution_loops)
    .slice(-5)
    .map((entry) => {
      const loop = toRecord(entry);
      return {
        phase: typeof loop.phase === 'string' ? loop.phase : undefined,
        status: typeof loop.status === 'string' ? loop.status : undefined,
        loop_number: toNumber(loop.loop_number) ?? undefined,
        phase_loop_number: toNumber(loop.phase_loop_number) ?? undefined,
        message: typeof loop.message === 'string' ? loop.message : undefined,
      };
    });

  const executionInput: Record<string, unknown> = {
    ...input,
    project_id: instance.project_id,
    workflow_instance_id: instance.id,
    workflow_phase: instance.current_phase,
    workflow_iteration: {
      workflow_instance_id: instance.id,
      workflow_phase: instance.current_phase,
      loop_number: currentLoopNumber + 1,
      phase_loop_number: currentPhaseLoopNumber + 1,
      previous_loops: previousLoops,
    },
  };

  const missingInputs = resolveMissingInputs(
    phaseDef.inputs_required ?? [],
    executionInput,
    metadata,
  );

  if (missingInputs.length > 0) {
    const loopCounters = await appendWorkflowLoopEntry(instance.id, {
      phase: phaseDef.phase,
      status: 'information_required',
      template_key: template.template_key,
      information_reason: 'missing_required_inputs',
      missing_inputs: missingInputs,
      message: 'Falta informacion requerida para ejecutar la fase.',
    });

    return {
      success: false,
      code: 'information_required',
      message: 'Falta informacion requerida para ejecutar la fase.',
      instance,
      information_gate: {
        reason: 'missing_required_inputs',
        missing_inputs: missingInputs,
        required_inputs: phaseDef.inputs_required ?? [],
        current_phase: phaseDef.phase,
        phase_name: phaseDef.name,
        message: `Faltan inputs requeridos: ${missingInputs.join(', ')}`,
      },
      side_effects: {
        war_room_notifications: 0,
        negotiation_actions_created: 0,
        workflow_report_created: false,
        loop_number: loopCounters?.loop_number,
        phase_loop_number: loopCounters?.phase_loop_number,
      },
    };
  }

  if (phaseDef.gateway_config?.grounding_mode === 'vault_rag') {
    const docsCount = await countProjectVdrDocuments(instance.project_id);
    if (docsCount === 0) {
      const loopCounters = await appendWorkflowLoopEntry(instance.id, {
        phase: phaseDef.phase,
        status: 'information_required',
        template_key: template.template_key,
        information_reason: 'missing_vdr_documents',
        missing_inputs: ['vdr_documents_uploaded'],
        message: 'No hay documentos en VDR para grounding de esta fase.',
      });

      return {
        success: false,
        code: 'information_required',
        message: 'No hay documentos en VDR para grounding de esta fase.',
        instance,
        information_gate: {
          reason: 'missing_vdr_documents',
          missing_inputs: ['vdr_documents_uploaded'],
          required_inputs: phaseDef.inputs_required ?? [],
          current_phase: phaseDef.phase,
          phase_name: phaseDef.name,
          message: 'Sube al menos un documento al VDR para continuar.',
        },
        side_effects: {
          war_room_notifications: 0,
          negotiation_actions_created: 0,
          workflow_report_created: false,
          loop_number: loopCounters?.loop_number,
          phase_loop_number: loopCounters?.phase_loop_number,
        },
      };
    }
  }

  try {
    const execution = await executeWorkflow({
      workflow_key: template.template_key,
      project_id: instance.project_id,
      input: executionInput,
      phase: instance.current_phase,
    });

    const dodChecks = buildAutoDodChecks(phaseDef, execution.success);
    const phaseResults: Record<string, unknown> = {
      report_section: execution.report_section,
      findings: execution.findings,
      evidence_refs: execution.evidence_refs,
      source: execution.source,
      executed_at: new Date().toISOString(),
    };

    const phaseAdvance = await advancePhase({
      instance_id: instance.id,
      phase: instance.current_phase,
      dod_checks: dodChecks,
      results: phaseResults,
    });

    if (!phaseAdvance.success) {
      const failedFindings = execution.findings || [];
      const failedRedFlags = failedFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high');
      const loopCounters = await appendWorkflowLoopEntry(instance.id, {
        phase: phaseDef.phase,
        status: 'phase_gate_failed',
        template_key: template.template_key,
        next_phase: phaseAdvance.next_phase ?? null,
        message: 'La ejecucion finalizo pero la fase no pudo avanzar por DoR/DoD.',
        findings_count: failedFindings.length,
        red_flags_count: failedRedFlags.length,
      });

      return {
        success: false,
        code: 'phase_gate_failed',
        message: 'La ejecucion finalizo pero la fase no pudo avanzar por DoR/DoD.',
        instance: phaseAdvance.instance,
        execution,
        phase_advance: phaseAdvance,
        side_effects: {
          war_room_notifications: 0,
          negotiation_actions_created: 0,
          workflow_report_created: false,
          loop_number: loopCounters?.loop_number,
          phase_loop_number: loopCounters?.phase_loop_number,
        },
      };
    }

    const sideEffects = await runPostPhaseSideEffects({
      instance: phaseAdvance.instance,
      template,
      phaseDef,
      execution,
      phaseAdvance,
    });

    const findings = execution.findings || [];
    const redFlags = findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high');
    const loopCounters = await appendWorkflowLoopEntry(instance.id, {
      phase: phaseDef.phase,
      status: 'completed',
      template_key: template.template_key,
      next_phase: phaseAdvance.next_phase ?? null,
      message: phaseAdvance.next_phase
        ? `Fase completada y avance a ${phaseAdvance.next_phase}.`
        : 'Workflow completado.',
      findings_count: findings.length,
      red_flags_count: redFlags.length,
      workflow_report_id: sideEffects.workflow_report_id,
      workflow_report_version: sideEffects.workflow_report_version,
    });

    return {
      success: true,
      instance: phaseAdvance.instance,
      execution,
      phase_advance: phaseAdvance,
      side_effects: {
        ...sideEffects,
        loop_number: loopCounters?.loop_number,
        phase_loop_number: loopCounters?.phase_loop_number,
      },
    };
  } catch (err) {
    const loopCounters = await appendWorkflowLoopEntry(instance.id, {
      phase: phaseDef.phase,
      status: 'execution_error',
      template_key: template.template_key,
      message: (err as Error).message,
    });

    return {
      success: false,
      code: 'execution_error',
      message: (err as Error).message,
      instance,
      side_effects: {
        war_room_notifications: 0,
        negotiation_actions_created: 0,
        workflow_report_created: false,
        loop_number: loopCounters?.loop_number,
        phase_loop_number: loopCounters?.phase_loop_number,
      },
    };
  }
}
