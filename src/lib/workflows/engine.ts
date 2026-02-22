import { getHarveyGateway } from '@/lib/harvey';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WORKFLOW_DEFINITIONS } from './constants';
import { loadWorkflowTemplate } from './template-loader';
import { WORKFLOW_TEMPLATES_FEATURE_FLAG } from './template-types';
import type { WorkflowTemplateWithVersion } from './template-types';
import type {
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  WorkflowFinding,
} from './types';

// ---------------------------------------------------------------------------
// DD area definitions for backlog generation
// ---------------------------------------------------------------------------

const DD_AREAS: { code: string; label: string }[] = [
  { code: 'MERC', label: 'Societario/Mercantil' },
  { code: 'CONT', label: 'Contratos' },
  { code: 'LAB', label: 'Laboral' },
  { code: 'FISC', label: 'Fiscal' },
  { code: 'PI', label: 'Propiedad Intelectual' },
  { code: 'GENERAL', label: 'General' },
];

const STARTER_TASK_TEMPLATES = [
  'Revisar documentación',
  'Analizar contingencias',
  'Verificar cumplimiento',
];

// Map finding area hints to canonical area codes
const AREA_HINT_MAP: Record<string, string> = {
  societario: 'MERC',
  mercantil: 'MERC',
  corporate: 'MERC',
  contratos: 'CONT',
  contracts: 'CONT',
  laboral: 'LAB',
  labor: 'LAB',
  employment: 'LAB',
  fiscal: 'FISC',
  tax: 'FISC',
  'propiedad intelectual': 'PI',
  ip: 'PI',
  intellectual: 'PI',
  general: 'GENERAL',
};

/**
 * Infer the DD area code from a finding's title or content.
 * Falls back to 'GENERAL' when no clear match is found.
 */
function inferAreaCode(finding: WorkflowFinding): string {
  const text = finding.title.toLowerCase();
  for (const [hint, code] of Object.entries(AREA_HINT_MAP)) {
    if (text.includes(hint)) return code;
  }
  return 'GENERAL';
}

/**
 * After an `arranque_dd` workflow completes, generates the initial Kanban
 * backlog: standard starter tasks per DD area plus additional tasks derived
 * from Harvey findings.
 *
 * Returns the total number of backlog items inserted.
 */
async function generateDDBacklog(
  projectId: string,
  findings: WorkflowFinding[],
): Promise<number> {
  // 1. Standard starter tasks for every DD area
  const starterTasks = DD_AREAS.flatMap(area =>
    STARTER_TASK_TEMPLATES.map(template => ({
      project_id: projectId,
      area_code: area.code,
      title: `${template} ${area.label}`,
      description: `Tarea estándar de arranque DD: ${template.toLowerCase()} del área ${area.label}.`,
      state: 'backlog' as const,
      priority: 'medium' as const,
      hitl_required: false,
      workflow_key: 'arranque_dd',
      ai_status: 'pending' as const,
    })),
  );

  // 2. Additional tasks from Harvey findings
  const findingTasks = findings.map(f => ({
    project_id: projectId,
    area_code: inferAreaCode(f),
    title: f.title,
    description: f.mitigation || `Hallazgo detectado: ${f.title}`,
    state: 'backlog' as const,
    priority: (f.severity === 'critical' || f.severity === 'high'
      ? f.severity
      : 'medium') as 'critical' | 'high' | 'medium' | 'low',
    hitl_required: f.severity === 'critical' || f.severity === 'high',
    workflow_key: 'arranque_dd',
    ai_status: 'done' as const,
  }));

  const allTasks = [...starterTasks, ...findingTasks];

  if (allTasks.length > 0) {
    await supabaseAdmin.from('dd_kanban_tasks').insert(allTasks);
  }

  return allTasks.length;
}

// ---------------------------------------------------------------------------
// Template-based executor (feature flag: WORKFLOW_TEMPLATES_V1)
// ---------------------------------------------------------------------------

/**
 * Execute a workflow using the template system.
 * Falls back to legacy execution if no template is found for the given key.
 */
async function executeWithTemplate(
  req: WorkflowExecutionRequest
): Promise<WorkflowExecutionResult> {
  const template: WorkflowTemplateWithVersion | null =
    await loadWorkflowTemplate(req.workflow_key);

  // Fallback to legacy if template not found
  if (!template) {
    console.warn(
      `[WFv1] Template not found for "${req.workflow_key}", falling back to legacy engine`
    );
    return executeLegacy(req);
  }

  // Extract all skill keys from all phases in the template version
  const templateSkillKeys = template.latest_version.phases.flatMap(
    (p) => p.skills
  );

  if (templateSkillKeys.length === 0) {
    console.warn(
      `[WFv1] Template "${req.workflow_key}" has no skills defined, falling back to legacy engine`
    );
    return executeLegacy(req);
  }

  // Determine HITL requirement from template's hitl_policy + phase-level flags
  const hitlRequired =
    template.latest_version.hitl_policy.required_areas.length > 0 ||
    template.latest_version.phases.some((p) => p.hitl_required);

  // Query skills from catalog using template-derived keys
  const { data: skills } = await supabaseAdmin
    .from('dd_skills_catalog')
    .select(
      'skill_key, prompt_template, expected_output_schema, evidence_requirements'
    )
    .in('skill_key', templateSkillKeys)
    .eq('is_active', true);

  const combinedPrompt = (skills || [])
    .map((s) => s.prompt_template)
    .filter(Boolean)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a legal due diligence analyst. Analyze the following for ${template.name}.
Return findings in JSON format with: title, severity (critical/high/medium/low/informational),
probability (alta/media/baja), economic_impact, timing (blocking/post_closing),
mitigation, verifiability (verified/partially/not_verifiable), evidence_refs.`;

  // Determine routing: check per-workflow flag, then global flag
  const legacyDef = WORKFLOW_DEFINITIONS[req.workflow_key];
  const featureFlag = legacyDef
    ? process.env[`HARVEY_FF_${legacyDef.feature_flag_key}`] ||
      process.env.HARVEY_FEATURE_FLAG ||
      'gateway'
    : process.env.HARVEY_FEATURE_FLAG || 'gateway';

  // --- n8n route ---
  if (featureFlag === 'n8n') {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const webhookPath = `/dd-workflow-${req.workflow_key.replace(/_/g, '-')}`;
    const res = await fetch(`${n8nUrl}${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.input, project_id: req.project_id }),
    });
    const data = await res.json();

    const n8nFindings = (data.findings || []) as WorkflowFinding[];

    // Post-execution: generate DD backlog for arranque_dd
    let backlogGenerated: number | undefined;
    if (req.workflow_key === 'arranque_dd') {
      backlogGenerated = await generateDDBacklog(req.project_id, n8nFindings);
    }

    return {
      success: true,
      workflow_key: req.workflow_key,
      report_section: data.report_section || '',
      findings: n8nFindings,
      evidence_refs: data.evidence_refs || [],
      hitl_required: hitlRequired,
      source: 'n8n',
      backlog_generated: backlogGenerated,
    };
  }

  // --- Gateway route ---
  const gateway = getHarveyGateway();
  const prompt = `${combinedPrompt}\n\n---\nProject: ${req.project_id}\nInput: ${JSON.stringify(req.input)}`;

  const result = await gateway.completion({
    prompt,
    system_prompt: systemPrompt,
    client_matter_id: `${req.project_id}:${req.workflow_key}`,
  });

  let parsed: {
    report_section?: string;
    findings?: unknown[];
    evidence_refs?: unknown[];
  } = {};
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = { report_section: result.text, findings: [], evidence_refs: [] };
  }

  const gatewayFindings = (parsed.findings ||
    []) as WorkflowExecutionResult['findings'];

  // Post-execution: generate DD backlog for arranque_dd
  let backlogGenerated: number | undefined;
  if (req.workflow_key === 'arranque_dd') {
    backlogGenerated = await generateDDBacklog(req.project_id, gatewayFindings);
  }

  return {
    success: true,
    workflow_key: req.workflow_key,
    report_section: parsed.report_section || result.text,
    findings: gatewayFindings,
    evidence_refs: (parsed.evidence_refs ||
      []) as WorkflowExecutionResult['evidence_refs'],
    hitl_required: hitlRequired,
    source: 'gateway',
    backlog_generated: backlogGenerated,
  };
}

// ---------------------------------------------------------------------------
// Legacy executor (called when template flag is off or template not found)
// ---------------------------------------------------------------------------

async function executeLegacy(
  req: WorkflowExecutionRequest
): Promise<WorkflowExecutionResult> {
  const definition = WORKFLOW_DEFINITIONS[req.workflow_key];
  if (!definition) {
    throw new Error(`Unknown workflow: ${req.workflow_key}`);
  }

  const featureFlag =
    process.env[`HARVEY_FF_${definition.feature_flag_key}`] ||
    process.env.HARVEY_FEATURE_FLAG ||
    'gateway';

  const { data: skills } = await supabaseAdmin
    .from('dd_skills_catalog')
    .select(
      'skill_key, prompt_template, expected_output_schema, evidence_requirements'
    )
    .in('skill_key', definition.skill_keys)
    .eq('is_active', true);

  const combinedPrompt = (skills || [])
    .map((s) => s.prompt_template)
    .filter(Boolean)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a legal due diligence analyst. Analyze the following for ${definition.name}.
Return findings in JSON format with: title, severity (critical/high/medium/low/informational),
probability (alta/media/baja), economic_impact, timing (blocking/post_closing),
mitigation, verifiability (verified/partially/not_verifiable), evidence_refs.`;

  if (featureFlag === 'n8n') {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const webhookPath = `/dd-workflow-${req.workflow_key.replace(/_/g, '-')}`;
    const res = await fetch(`${n8nUrl}${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.input, project_id: req.project_id }),
    });
    const data = await res.json();

    const n8nFindings = (data.findings || []) as WorkflowFinding[];

    let backlogGenerated: number | undefined;
    if (req.workflow_key === 'arranque_dd') {
      backlogGenerated = await generateDDBacklog(req.project_id, n8nFindings);
    }

    return {
      success: true,
      workflow_key: req.workflow_key,
      report_section: data.report_section || '',
      findings: n8nFindings,
      evidence_refs: data.evidence_refs || [],
      hitl_required: definition.hitl_required,
      source: 'n8n',
      backlog_generated: backlogGenerated,
    };
  }

  const gateway = getHarveyGateway();
  const prompt = `${combinedPrompt}\n\n---\nProject: ${req.project_id}\nInput: ${JSON.stringify(req.input)}`;

  const result = await gateway.completion({
    prompt,
    system_prompt: systemPrompt,
    client_matter_id: `${req.project_id}:${req.workflow_key}`,
  });

  let parsed: {
    report_section?: string;
    findings?: unknown[];
    evidence_refs?: unknown[];
  } = {};
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = { report_section: result.text, findings: [], evidence_refs: [] };
  }

  const gatewayFindings = (parsed.findings ||
    []) as WorkflowExecutionResult['findings'];

  let backlogGenerated: number | undefined;
  if (req.workflow_key === 'arranque_dd') {
    backlogGenerated = await generateDDBacklog(req.project_id, gatewayFindings);
  }

  return {
    success: true,
    workflow_key: req.workflow_key,
    report_section: parsed.report_section || result.text,
    findings: gatewayFindings,
    evidence_refs: (parsed.evidence_refs ||
      []) as WorkflowExecutionResult['evidence_refs'],
    hitl_required: definition.hitl_required,
    source: 'gateway',
    backlog_generated: backlogGenerated,
  };
}

// ---------------------------------------------------------------------------
// Main workflow executor (public entry point)
// ---------------------------------------------------------------------------

export async function executeWorkflow(
  req: WorkflowExecutionRequest
): Promise<WorkflowExecutionResult> {
  // --- Template-based execution (v1) ---
  const templateEnabled = ['1', 'true', 'enabled'].includes(
    (process.env[WORKFLOW_TEMPLATES_FEATURE_FLAG] || '').toLowerCase()
  );

  if (templateEnabled) {
    return executeWithTemplate(req);
  }

  // --- Legacy execution ---
  return executeLegacy(req);
}
