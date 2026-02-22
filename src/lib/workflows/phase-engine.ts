// ============================================================
// Workflow Spec v1 — Phase Advancement Engine
// Validates DoD criteria, completes the current phase, advances
// to the next phase, and creates Kanban tasks for it.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  PhaseAdvanceRequest,
  PhaseAdvanceResult,
  WorkflowInstance,
  WorkflowTaskGroup,
  WorkflowPhase,
  PhaseDefinition,
  DoRDoDCriteria,
  WorkflowTemplateVersion,
  WorkflowTemplate,
  PhaseStatus,
} from './template-types';
// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

/**
 * Return the next phase after `current` within the template's phase list,
 * or null if it is the last phase.
 */
function getNextPhase(
  current: WorkflowPhase,
  templatePhases: PhaseDefinition[]
): WorkflowPhase | null {
  const phaseOrder = templatePhases.map((p) => p.phase);
  const idx = phaseOrder.indexOf(current);
  if (idx === -1 || idx === phaseOrder.length - 1) return null;
  return phaseOrder[idx + 1];
}

/**
 * Find the PhaseDefinition for a given phase within a template version.
 */
function findPhaseDefinition(
  phases: PhaseDefinition[],
  phase: WorkflowPhase
): PhaseDefinition | undefined {
  return phases.find((p) => p.phase === phase);
}

// ---------------------------------------------------------------------------
// DoD Validation
// ---------------------------------------------------------------------------

/**
 * Validate Definition-of-Done criteria for a phase.
 * Returns the list of unmet *required* criteria, or an empty array if all pass.
 */
function validateDoD(
  phaseDef: PhaseDefinition,
  dodChecks: Record<string, boolean> | undefined
): DoRDoDCriteria[] {
  const criteria = phaseDef.dod_criteria ?? [];
  const requiredCriteria = criteria.filter((c) => c.required);

  if (requiredCriteria.length === 0) return [];
  if (!dodChecks) return requiredCriteria;

  const failures: DoRDoDCriteria[] = [];
  for (const criterion of requiredCriteria) {
    if (!dodChecks[criterion.check]) {
      failures.push(criterion);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// DoR Validation (Definition of Ready for next phase)
// ---------------------------------------------------------------------------

/**
 * Validate Definition-of-Ready criteria for the next phase.
 * DoR checks are evaluated against the completed phase's DoD checks +
 * any additional context from instance metadata.
 * Returns the list of unmet *required* criteria, or an empty array if all pass.
 */
function validateDoR(
  nextPhaseDef: PhaseDefinition,
  dodChecks: Record<string, boolean> | undefined,
  instanceMetadata: Record<string, unknown>
): DoRDoDCriteria[] {
  const criteria = nextPhaseDef.dor_criteria ?? [];
  const requiredCriteria = criteria.filter((c) => c.required);

  if (requiredCriteria.length === 0) return [];

  // Merge DoD checks with any accumulated checks from previous phases
  const allChecks: Record<string, boolean> = {
    ...(instanceMetadata._accumulated_checks as Record<string, boolean> || {}),
    ...(dodChecks || {}),
  };

  const failures: DoRDoDCriteria[] = [];
  for (const criterion of requiredCriteria) {
    if (!allChecks[criterion.check]) {
      failures.push(criterion);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Kanban task builder (mirrored from instantiate.ts)
// ---------------------------------------------------------------------------

interface BuildKanbanParams {
  phaseDef: PhaseDefinition;
  projectId: string;
  instanceId: string;
  taskGroupId: string;
  templateVersionId: string;
  templateKey: string;
  areaCode: string;
}

function buildKanbanTasksForPhase(params: BuildKanbanParams) {
  const {
    phaseDef,
    projectId,
    instanceId,
    taskGroupId,
    templateVersionId,
    templateKey,
    areaCode,
  } = params;

  const skills = phaseDef.skills ?? [];
  const artifacts = phaseDef.artifacts ?? [];

  // Strategy: AP-level task generation
  // 1. If phase has skills → one task per skill (AI execution units)
  // 2. Else if phase has artifacts → one task per artifact (deliverable tracking)
  // 3. Else → single task for the phase

  if (skills.length > 0) {
    return skills.map((skill) => ({
      project_id: projectId,
      area_code: areaCode,
      title: `${phaseDef.name}: ${skill}`,
      description: `Skill "${skill}" de la fase ${phaseDef.name}. ${phaseDef.description || ''}`.trim(),
      state: phaseDef.kanban_start_state ?? 'backlog',
      priority: 'medium' as const,
      workflow_instance_id: instanceId,
      workflow_phase: phaseDef.phase,
      task_group_id: taskGroupId,
      template_version_id: templateVersionId,
      workflow_key: templateKey,
      skill_key: skill,
      ai_status: 'pending' as const,
      hitl_required: phaseDef.hitl_required,
    }));
  }

  if (artifacts.length > 0) {
    return artifacts.map((artifact) => ({
      project_id: projectId,
      area_code: areaCode,
      title: `${phaseDef.name}: ${artifact}`,
      description: `Artefacto "${artifact}" de la fase ${phaseDef.name}.`,
      state: phaseDef.kanban_start_state ?? 'backlog',
      priority: 'medium' as const,
      workflow_instance_id: instanceId,
      workflow_phase: phaseDef.phase,
      task_group_id: taskGroupId,
      template_version_id: templateVersionId,
      workflow_key: templateKey,
      skill_key: null,
    }));
  }

  return [
    {
      project_id: projectId,
      area_code: areaCode,
      title: phaseDef.name,
      description: phaseDef.description || `Fase: ${phaseDef.name}`,
      state: phaseDef.kanban_start_state ?? 'backlog',
      priority: 'medium' as const,
      workflow_instance_id: instanceId,
      workflow_phase: phaseDef.phase,
      task_group_id: taskGroupId,
      template_version_id: templateVersionId,
      workflow_key: templateKey,
      skill_key: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Main phase advancement function
// ---------------------------------------------------------------------------

/**
 * Advance a workflow instance from one phase to the next.
 *
 * 1. Load & validate instance (must be in_progress or created)
 * 2. Validate that request.phase matches current_phase
 * 3. Load template version for phase definitions
 * 4. Validate DoD criteria — abort if required checks fail
 * 5. Mark current phase as completed
 * 6. If next phase exists: advance to it, create Kanban tasks
 * 7. If last phase: mark instance as completed
 * 8. Return result with task count, hitl flag, failures
 */
export async function advancePhase(
  request: PhaseAdvanceRequest
): Promise<PhaseAdvanceResult> {
  const now = new Date().toISOString();

  // --- 1. Load instance ---
  const { data: instanceRow, error: instanceErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .select('*')
    .eq('id', request.instance_id)
    .single();

  if (instanceErr || !instanceRow) {
    throw new Error(
      `Workflow instance "${request.instance_id}" not found: ${instanceErr?.message ?? 'Unknown error'}`
    );
  }

  const instance = instanceRow as unknown as WorkflowInstance;

  // Verify status allows advancement
  if (instance.status !== 'in_progress' && instance.status !== 'created') {
    throw new Error(
      `Cannot advance instance "${instance.id}": status is "${instance.status}" ` +
        '(must be "created" or "in_progress").'
    );
  }

  // --- 2. Validate phase matches current_phase ---
  if (request.phase !== instance.current_phase) {
    throw new Error(
      `Phase mismatch: requested phase "${request.phase}" but instance ` +
        `current_phase is "${instance.current_phase}".`
    );
  }

  // --- 3. Load template version ---
  const { data: versionRow, error: versionErr } = await supabaseAdmin
    .from('dd_workflow_template_versions')
    .select('*')
    .eq('id', instance.template_version_id)
    .single();

  if (versionErr || !versionRow) {
    throw new Error(
      `Template version "${instance.template_version_id}" not found: ` +
        `${versionErr?.message ?? 'Unknown error'}`
    );
  }

  const version = versionRow as unknown as WorkflowTemplateVersion;
  const phases: PhaseDefinition[] = version.phases;

  // --- Also load template for area_codes and template_key ---
  const { data: templateRow, error: templateErr } = await supabaseAdmin
    .from('dd_workflow_templates')
    .select('*')
    .eq('id', instance.template_id)
    .single();

  if (templateErr || !templateRow) {
    throw new Error(
      `Workflow template "${instance.template_id}" not found: ` +
        `${templateErr?.message ?? 'Unknown error'}`
    );
  }

  const template = templateRow as unknown as WorkflowTemplate;

  // --- 4. Validate DoD ---
  const currentPhaseDef = findPhaseDefinition(phases, request.phase);
  if (!currentPhaseDef) {
    throw new Error(
      `Phase "${request.phase}" not found in template version phases.`
    );
  }

  const dodFailures = validateDoD(currentPhaseDef, request.dod_checks);
  if (dodFailures.length > 0) {
    // Return failure without advancing
    return {
      success: false,
      instance,
      next_phase: getNextPhase(request.phase, phases),
      tasks_created: 0,
      hitl_required: false,
      dod_failures: dodFailures,
    };
  }

  // --- 5. Validate DoR for next phase (if exists) ---
  const nextPhaseCandidate = getNextPhase(request.phase, phases);
  if (nextPhaseCandidate) {
    const nextPhaseDef = findPhaseDefinition(phases, nextPhaseCandidate);
    if (nextPhaseDef) {
      const dorFailures = validateDoR(
        nextPhaseDef,
        request.dod_checks,
        (instance.metadata ?? {}) as Record<string, unknown>
      );
      if (dorFailures.length > 0) {
        return {
          success: false,
          instance,
          next_phase: nextPhaseCandidate,
          tasks_created: 0,
          hitl_required: false,
          dor_failures: dorFailures,
        };
      }
    }
  }

  // --- 6. Complete current phase ---
  const phaseStatus: Record<string, PhaseStatus> = {
    ...(instance.phase_status as Record<string, PhaseStatus>),
  };
  const phaseStartedAt: Record<string, string> = {
    ...(instance.phase_started_at as Record<string, string>),
  };
  const phaseCompletedAt: Record<string, string> = {
    ...(instance.phase_completed_at as Record<string, string>),
  };

  phaseStatus[request.phase] = 'completed';
  phaseCompletedAt[request.phase] = now;

  // Accumulate checks in metadata for future DoR validation
  const accumulatedChecks: Record<string, boolean> = {
    ...((instance.metadata as Record<string, unknown>)?._accumulated_checks as Record<string, boolean> || {}),
    ...(request.dod_checks || {}),
  };

  // --- 7. Determine next phase ---
  const nextPhase = nextPhaseCandidate;

  // Build the instance update payload
  const updatePayload: Record<string, unknown> = {
    phase_status: phaseStatus,
    phase_completed_at: phaseCompletedAt,
    phase_started_at: phaseStartedAt,
    updated_at: now,
  };

  let tasksCreated = 0;
  let hitlRequired = false;
  let hitlDecisionsCreated = 0;

  if (nextPhase) {
    // --- 7a. Advance to next phase ---
    phaseStatus[nextPhase] = 'in_progress';
    phaseStartedAt[nextPhase] = now;

    updatePayload.current_phase = nextPhase;
    updatePayload.phase_status = phaseStatus;
    updatePayload.phase_started_at = phaseStartedAt;

    // Transition from 'created' to 'in_progress' if needed
    if (instance.status === 'created') {
      updatePayload.status = 'in_progress';
    }

    // Check HITL requirement for next phase
    const nextPhaseDef = findPhaseDefinition(phases, nextPhase);
    hitlRequired = nextPhaseDef?.hitl_required ?? false;
  } else {
    // --- 7b. Complete instance (last phase done) ---
    updatePayload.status = 'completed';
    updatePayload.completed_at = now;
  }

  // --- Persist instance update ---
  const { data: updatedRow, error: updateErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .update(updatePayload)
    .eq('id', instance.id)
    .select('*')
    .single();

  if (updateErr || !updatedRow) {
    throw new Error(
      `Failed to update workflow instance: ${updateErr?.message ?? 'Unknown error'}`
    );
  }

  const updatedInstance = updatedRow as unknown as WorkflowInstance;

  // --- Store phase results and accumulated checks in metadata ---
  const metadataUpdate: Record<string, unknown> = {
    ...(updatedInstance.metadata ?? {}),
    _accumulated_checks: accumulatedChecks,
  };
  if (request.results && Object.keys(request.results).length > 0) {
    metadataUpdate[`phase_results_${request.phase}`] = request.results;
  }

  await supabaseAdmin
    .from('dd_workflow_instances')
    .update({ metadata: metadataUpdate })
    .eq('id', instance.id);

  // --- 8. Create Kanban tasks for next phase ---
  if (nextPhase) {
    const nextPhaseDef = findPhaseDefinition(phases, nextPhase);

    // Find the task group for the next phase
    const { data: taskGroupRows, error: taskGroupErr } = await supabaseAdmin
      .from('dd_workflow_task_groups')
      .select('*')
      .eq('workflow_instance_id', instance.id)
      .eq('phase', nextPhase)
      .limit(1)
      .single();

    if (taskGroupErr || !taskGroupRows) {
      throw new Error(
        `Task group for phase "${nextPhase}" not found on instance ` +
          `"${instance.id}": ${taskGroupErr?.message ?? 'Unknown error'}`
      );
    }

    const taskGroup = taskGroupRows as unknown as WorkflowTaskGroup;
    const areaCode = template.area_codes?.[0] ?? 'GENERAL';

    // Update task group status to in_progress
    await supabaseAdmin
      .from('dd_workflow_task_groups')
      .update({ status: 'in_progress' })
      .eq('id', taskGroup.id);

    if (nextPhaseDef) {
      const kanbanPayloads = buildKanbanTasksForPhase({
        phaseDef: nextPhaseDef,
        projectId: instance.project_id,
        instanceId: instance.id,
        taskGroupId: taskGroup.id,
        templateVersionId: version.id,
        templateKey: template.template_key,
        areaCode,
      });

      if (kanbanPayloads.length > 0) {
        const { data: kanbanRows, error: kanbanErr } = await supabaseAdmin
          .from('dd_kanban_tasks')
          .insert(kanbanPayloads)
          .select('id');

        if (kanbanErr) {
          throw new Error(
            `Failed to create Kanban tasks for phase "${nextPhase}": ${kanbanErr.message}`
          );
        }

        tasksCreated = kanbanRows?.length ?? 0;
      }
    }

    // --- H.4: HITL auto-creation for phases that require it ---
    if (hitlRequired && request.results) {
      const findings = (request.results.findings ?? []) as Array<{
        title?: string;
        severity?: string;
        mitigation?: string;
      }>;

      const hitlPayloads = findings
        .filter(f => f.severity === 'critical' || f.severity === 'high')
        .map(f => ({
          project_id: instance.project_id,
          workflow_instance_id: instance.id,
          phase: nextPhase,
          finding_title: f.title || 'Finding sin titulo',
          finding_severity: f.severity || 'high',
          ai_output: f as unknown as Record<string, unknown>,
          status: 'pending_review' as const,
        }));

      if (hitlPayloads.length > 0) {
        const { data: hitlRows } = await supabaseAdmin
          .from('dd_hitl_decisions')
          .insert(hitlPayloads)
          .select('id');

        hitlDecisionsCreated = hitlRows?.length ?? 0;

        // Update instance counters
        await supabaseAdmin
          .from('dd_workflow_instances')
          .update({ hitl_pending_count: hitlDecisionsCreated })
          .eq('id', instance.id);
      }
    }

    // Also mark the completed phase's task group as completed
    const { data: completedTaskGroup } = await supabaseAdmin
      .from('dd_workflow_task_groups')
      .select('id')
      .eq('workflow_instance_id', instance.id)
      .eq('phase', request.phase)
      .limit(1)
      .single();

    if (completedTaskGroup) {
      await supabaseAdmin
        .from('dd_workflow_task_groups')
        .update({ status: 'completed' })
        .eq('id', completedTaskGroup.id);
    }
  } else {
    // Last phase — mark the completed phase's task group as completed
    const { data: completedTaskGroup } = await supabaseAdmin
      .from('dd_workflow_task_groups')
      .select('id')
      .eq('workflow_instance_id', instance.id)
      .eq('phase', request.phase)
      .limit(1)
      .single();

    if (completedTaskGroup) {
      await supabaseAdmin
        .from('dd_workflow_task_groups')
        .update({ status: 'completed' })
        .eq('id', completedTaskGroup.id);
    }
  }

  // --- 10. Return result ---
  return {
    success: true,
    instance: updatedInstance,
    next_phase: nextPhase,
    tasks_created: tasksCreated,
    hitl_required: hitlRequired,
    hitl_decisions_created: hitlDecisionsCreated,
  };
}
