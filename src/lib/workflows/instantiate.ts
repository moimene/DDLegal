// ============================================================
// Workflow Spec v1 — Instantiation Engine
// Creates a new workflow instance from a template and seeds
// the initial Kanban tasks for the first phase (obtencion).
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadWorkflowTemplate } from './template-loader';
import type {
  WorkflowInstantiateRequest,
  WorkflowInstantiateResult,
  WorkflowInstance,
  WorkflowTaskGroup,
  WorkflowPhase,
  PhaseStatus,
  PhaseDefinition,
  WorkflowTemplateWithVersion,
} from './template-types';
import { WORKFLOW_TEMPLATES_FEATURE_FLAG } from './template-types';

// ---------------------------------------------------------------------------
// Feature flag check
// ---------------------------------------------------------------------------

function isFeatureFlagEnabled(): boolean {
  const value = process.env[WORKFLOW_TEMPLATES_FEATURE_FLAG];
  if (!value || value.trim().length === 0) {
    return true;
  }
  return ['1', 'true', 'enabled', 'on'].includes(value.toLowerCase());
}

// ---------------------------------------------------------------------------
// Build initial phase_status map — driven by the template's phase list
// ---------------------------------------------------------------------------

function buildInitialPhaseStatus(
  phases: PhaseDefinition[]
): Record<string, PhaseStatus> {
  const status: Record<string, PhaseStatus> = {};
  for (const p of phases) {
    status[p.phase] = 'pending';
  }
  return status;
}

function normalizeInitiatedBy(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidLike.test(trimmed) ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Main instantiation function
// ---------------------------------------------------------------------------

/**
 * Instantiate a new workflow from a template.
 *
 * 1. Load template + latest published version via template-loader
 * 2. Check WORKFLOW_TEMPLATES_V1 feature flag
 * 3. Insert dd_workflow_instances row
 * 4. Insert dd_workflow_task_groups (one per phase)
 * 5. Insert dd_kanban_tasks for the first phase (obtencion)
 * 6. Return instance, task_groups, and kanban task count
 */
export async function instantiateWorkflow(
  request: WorkflowInstantiateRequest
): Promise<WorkflowInstantiateResult> {
  // --- 1. Feature flag gate ---
  if (!isFeatureFlagEnabled()) {
    throw new Error(
      `Feature flag ${WORKFLOW_TEMPLATES_FEATURE_FLAG} is not enabled. ` +
        'Workflow template instantiation is disabled.'
    );
  }

  // --- 2. Load template ---
  const template: WorkflowTemplateWithVersion | null =
    await loadWorkflowTemplate(request.template_key);

  if (!template) {
    throw new Error(
      `Workflow template "${request.template_key}" not found or has no published version.`
    );
  }

  const version = template.latest_version;
  const phases: PhaseDefinition[] = version.phases;

  if (!phases || phases.length === 0) {
    throw new Error(
      `Workflow template "${request.template_key}" version ${version.version_number} has no phases defined.`
    );
  }

  // --- 3. Create workflow instance ---
  const instancePayload = {
    project_id: request.project_id,
    template_id: template.id,
    template_version_id: version.id,
    status: 'created' as const,
    current_phase: 'obtencion' as const,
    phase_status: buildInitialPhaseStatus(phases),
    project_overrides: request.overrides ?? {},
    initiated_by: normalizeInitiatedBy(request.initiated_by),
    phase_started_at: {},
    phase_completed_at: {},
    findings_count: 0,
    red_flags_count: 0,
    hitl_pending_count: 0,
    metadata: {},
  };

  const { data: instanceRow, error: instanceErr } = await supabaseAdmin
    .from('dd_workflow_instances')
    .insert(instancePayload)
    .select('*')
    .single();

  if (instanceErr || !instanceRow) {
    throw new Error(
      `Failed to create workflow instance: ${instanceErr?.message ?? 'Unknown error'}`
    );
  }

  const instance = instanceRow as unknown as WorkflowInstance;

  // --- 4. Create task groups (one per phase) ---
  const taskGroupPayloads = phases.map((phaseDef, index) => ({
    workflow_instance_id: instance.id,
    phase: phaseDef.phase,
    title: phaseDef.name,
    description: phaseDef.description || null,
    sort_order: index,
    status: 'pending' as const,
  }));

  const { data: taskGroupRows, error: taskGroupErr } = await supabaseAdmin
    .from('dd_workflow_task_groups')
    .insert(taskGroupPayloads)
    .select('*');

  if (taskGroupErr || !taskGroupRows) {
    throw new Error(
      `Failed to create task groups: ${taskGroupErr?.message ?? 'Unknown error'}`
    );
  }

  const taskGroups = taskGroupRows as unknown as WorkflowTaskGroup[];

  // --- 5. Create initial Kanban tasks for first phase (obtencion) ---
  const firstPhase = phases.find((p) => p.phase === 'obtencion');
  const firstPhaseTaskGroup = taskGroups.find((tg) => tg.phase === 'obtencion');
  const areaCode = template.area_codes?.[0] ?? 'GENERAL';

  let kanbanTasksCreated = 0;

  if (firstPhase && firstPhaseTaskGroup) {
    // Create one Kanban task per phase definition for the first phase.
    // Each task represents the work item for this phase.
    const kanbanPayloads = buildKanbanTasksForPhase({
      phaseDef: firstPhase,
      projectId: request.project_id,
      instanceId: instance.id,
      taskGroupId: firstPhaseTaskGroup.id,
      templateVersionId: version.id,
      templateKey: request.template_key,
      areaCode,
    });

    if (kanbanPayloads.length > 0) {
      const { data: kanbanRows, error: kanbanErr } = await supabaseAdmin
        .from('dd_kanban_tasks')
        .insert(kanbanPayloads)
        .select('id');

      if (kanbanErr) {
        throw new Error(
          `Failed to create Kanban tasks: ${kanbanErr.message}`
        );
      }

      kanbanTasksCreated = kanbanRows?.length ?? 0;
    }
  }

  // --- 6. Return result ---
  return {
    success: true,
    instance,
    task_groups: taskGroups,
    kanban_tasks_created: kanbanTasksCreated,
  };
}

// ---------------------------------------------------------------------------
// Kanban task builder for a single phase
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
    // One task per skill — enables granular AI execution + HITL tracking
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
    // One task per artifact — deliverable tracking
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

  // Fallback: single task for the phase
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
