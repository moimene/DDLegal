export interface WorkflowSkillContext {
  skill_key: string;
  prompt_template: string | null;
  expected_output_schema?: unknown;
  evidence_requirements?: unknown;
}

export interface WorkflowIterationContext {
  loop_number?: number;
  phase_loop_number?: number;
  workflow_instance_id?: string;
  workflow_phase?: string;
  previous_loops?: Array<{
    phase?: string;
    status?: string;
    loop_number?: number;
    phase_loop_number?: number;
    message?: string;
  }>;
}

export interface BuildHarveyWorkflowPromptParams {
  workflow_key: string;
  project_id: string;
  input: Record<string, unknown>;
  phase?: string;
  skills: WorkflowSkillContext[];
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

/**
 * Reads loop/iteration info from input payload.
 * Prefers `workflow_iteration` object and falls back to top-level workflow fields.
 */
export function extractIterationContext(
  input: Record<string, unknown>,
): WorkflowIterationContext {
  const nested = toObject(input.workflow_iteration) ?? {};

  const workflow_instance_id =
    toNonEmptyString(nested.workflow_instance_id) ??
    toNonEmptyString(input.workflow_instance_id);
  const workflow_phase =
    toNonEmptyString(nested.workflow_phase) ??
    toNonEmptyString(input.workflow_phase);
  const loop_number =
    toPositiveInteger(nested.loop_number) ??
    toPositiveInteger(input.loop_number);
  const phase_loop_number =
    toPositiveInteger(nested.phase_loop_number) ??
    toPositiveInteger(input.phase_loop_number);

  const rawLoops = Array.isArray(nested.previous_loops)
    ? nested.previous_loops
    : [];
  const previous_loops = rawLoops
    .slice(-3)
    .map((entry) => {
      const obj = toObject(entry) ?? {};
      return {
        phase: toNonEmptyString(obj.phase),
        status: toNonEmptyString(obj.status),
        loop_number: toPositiveInteger(obj.loop_number),
        phase_loop_number: toPositiveInteger(obj.phase_loop_number),
        message: toNonEmptyString(obj.message),
      };
    });

  return {
    workflow_instance_id,
    workflow_phase,
    loop_number,
    phase_loop_number,
    previous_loops,
  };
}

function sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const cloned = { ...input };
  delete cloned.workflow_iteration;
  return cloned;
}

function buildSkillInstructions(skills: WorkflowSkillContext[]): string {
  return skills
    .map((skill, index) => {
      const expectedOutput =
        skill.expected_output_schema === undefined
          ? 'n/a'
          : safeStringify(skill.expected_output_schema);
      const evidenceRequirements =
        skill.evidence_requirements === undefined
          ? 'n/a'
          : safeStringify(skill.evidence_requirements);

      return [
        `[SKILL ${index + 1}] ${skill.skill_key}`,
        'prompt_template:',
        skill.prompt_template || '',
        'expected_output_schema:',
        expectedOutput,
        'evidence_requirements:',
        evidenceRequirements,
      ].join('\n');
    })
    .join('\n\n');
}

function buildIterationSection(
  phase: string | undefined,
  iteration: WorkflowIterationContext,
): string {
  const lines: string[] = [];
  if (iteration.workflow_instance_id) {
    lines.push(`workflow_instance_id: ${iteration.workflow_instance_id}`);
  }
  lines.push(`workflow_phase: ${iteration.workflow_phase || phase || 'n/a'}`);
  if (iteration.loop_number) lines.push(`loop_number: ${iteration.loop_number}`);
  if (iteration.phase_loop_number) {
    lines.push(`phase_loop_number: ${iteration.phase_loop_number}`);
  }
  if (iteration.previous_loops && iteration.previous_loops.length > 0) {
    lines.push(`recent_loops: ${safeStringify(iteration.previous_loops)}`);
  }
  return lines.join('\n');
}

export function buildHarveyWorkflowPrompt(
  params: BuildHarveyWorkflowPromptParams,
): string {
  const iteration = extractIterationContext(params.input);
  const cleanInput = sanitizeInput(params.input);

  const sections = [
    [
      'WORKFLOW CONTEXT',
      `workflow_key: ${params.workflow_key}`,
      `project_id: ${params.project_id}`,
    ].join('\n'),
    ['ITERATION CONTEXT', buildIterationSection(params.phase, iteration)].join(
      '\n',
    ),
    [
      'ACTIVE SKILLS FOR THIS ITERATION',
      'Execute all skills below and synthesize a single JSON response.',
      buildSkillInstructions(params.skills),
    ].join('\n'),
    ['INPUT PAYLOAD', safeStringify(cleanInput)].join('\n'),
  ];

  return sections.join('\n\n---\n\n');
}

export interface BuildN8nPayloadParams {
  workflow_key: string;
  project_id: string;
  input: Record<string, unknown>;
  phase?: string;
  skills: WorkflowSkillContext[];
}

export function buildN8nExecutionPayload(
  params: BuildN8nPayloadParams,
): Record<string, unknown> {
  const iteration = extractIterationContext(params.input);
  const cleanInput = sanitizeInput(params.input);

  return {
    ...cleanInput,
    project_id: params.project_id,
    workflow_key: params.workflow_key,
    workflow_phase: params.phase || iteration.workflow_phase || null,
    skill_keys: params.skills.map((s) => s.skill_key),
    skills: params.skills.map((s) => ({
      skill_key: s.skill_key,
      expected_output_schema: s.expected_output_schema ?? null,
      evidence_requirements: s.evidence_requirements ?? null,
    })),
    workflow_iteration: {
      workflow_instance_id: iteration.workflow_instance_id ?? null,
      workflow_phase: iteration.workflow_phase ?? params.phase ?? null,
      loop_number: iteration.loop_number ?? null,
      phase_loop_number: iteration.phase_loop_number ?? null,
      previous_loops: iteration.previous_loops ?? [],
    },
  };
}
