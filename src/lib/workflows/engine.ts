import { getHarveyGateway } from '@/lib/harvey';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { semanticSearch } from '@/lib/vdr/semantic-search';
import { WORKFLOW_DEFINITIONS } from './constants';
import {
  buildHarveyWorkflowPrompt,
  buildN8nExecutionPayload,
  type WorkflowSkillContext,
} from './prompt-builder';
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

type CatalogSkillRow = WorkflowSkillContext;

function uniqueSkillKeys(keys: string[]): string[] {
  return Array.from(new Set(keys));
}

function sortSkillsByKeyOrder(
  skills: CatalogSkillRow[],
  preferredKeys: string[],
): CatalogSkillRow[] {
  const byKey = new Map(skills.map((skill) => [skill.skill_key, skill]));
  const sorted: CatalogSkillRow[] = [];
  const seen = new Set<string>();

  for (const key of preferredKeys) {
    const row = byKey.get(key);
    if (!row) continue;
    sorted.push(row);
    seen.add(key);
  }

  for (const skill of skills) {
    if (seen.has(skill.skill_key)) continue;
    sorted.push(skill);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// H.3: Evidence auto-linking via VDR semantic retrieval
// ---------------------------------------------------------------------------

/**
 * After workflow execution, search VDR for relevant chunks and link them
 * to the workflow's kanban tasks. Returns the count of evidence refs linked.
 */
async function linkEvidenceToWorkflowTasks(
  projectId: string,
  workflowKey: string,
  findings: WorkflowFinding[],
): Promise<number> {
  if (findings.length === 0) return 0;

  // Get kanban tasks created for this workflow
  const { data: tasks } = await supabaseAdmin
    .from('dd_kanban_tasks')
    .select('id, title, skill_key, evidence_refs')
    .eq('project_id', projectId)
    .eq('workflow_key', workflowKey)
    .in('state', ['backlog', 'en_analisis', 'ia_propuesta', 'hitl_revision']);

  if (!tasks || tasks.length === 0) return 0;

  let totalLinked = 0;

  for (const finding of findings) {
    // Semantic search for chunks related to this finding
    try {
      const chunks = await semanticSearch(projectId, finding.title, {
        threshold: 0.65,
        limit: 5,
        areaCode: inferAreaCode(finding),
      });

      if (chunks.length === 0) continue;

      // Find the best matching task for this finding
      const matchingTask = tasks.find(t =>
        t.title.toLowerCase().includes(finding.title.toLowerCase().slice(0, 30))
      ) || tasks[0];

      // Build new evidence refs
      const existingRefs = (matchingTask.evidence_refs ?? []) as Array<{ source_id: string }>;
      const existingIds = new Set(existingRefs.map(r => r.source_id));

      const newRefs = chunks
        .filter(c => !existingIds.has(c.chunk_id))
        .map(c => ({
          source_id: c.chunk_id,
          snippet: c.content.slice(0, 200),
          similarity: c.similarity,
          document_name: c.document_name,
        }));

      if (newRefs.length > 0) {
        const mergedRefs = [...existingRefs, ...newRefs];

        await supabaseAdmin
          .from('dd_kanban_tasks')
          .update({ evidence_refs: mergedRefs })
          .eq('id', matchingTask.id);

        totalLinked += newRefs.length;
      }
    } catch {
      // Semantic search may fail if no embeddings exist — skip silently
    }
  }

  return totalLinked;
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

function noAutomationResult(
  req: WorkflowExecutionRequest,
  hitlRequired: boolean,
): WorkflowExecutionResult {
  const scope = req.phase ? `fase "${req.phase}"` : 'workflow';
  return {
    success: true,
    workflow_key: req.workflow_key,
    report_section: `No hay skills automatizadas activas para ${scope}. Avance manual requerido.`,
    findings: [],
    evidence_refs: [],
    hitl_required: hitlRequired,
    source: 'gateway',
  };
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

  // Determine HITL requirement from template's hitl_policy + phase-level flags
  const hitlRequired =
    template.latest_version.hitl_policy.required_areas.length > 0 ||
    template.latest_version.phases.some((p) => p.hitl_required);

  const selectedPhases = req.phase
    ? template.latest_version.phases.filter((p) => p.phase === req.phase)
    : template.latest_version.phases;

  // Extract skill keys from selected phases
  const templateSkillKeys = uniqueSkillKeys(selectedPhases.flatMap(
    (p) => p.skills
  ));

  if (templateSkillKeys.length === 0) {
    return noAutomationResult(req, hitlRequired);
  }

  // Query skills from catalog using template-derived keys
  const { data: skills } = await supabaseAdmin
    .from('dd_skills_catalog')
    .select(
      'skill_key, prompt_template, expected_output_schema, evidence_requirements'
    )
    .in('skill_key', templateSkillKeys)
    .eq('is_active', true);

  if (!skills || skills.length === 0) {
    return noAutomationResult(req, hitlRequired);
  }

  const orderedSkills = sortSkillsByKeyOrder(
    skills as CatalogSkillRow[],
    templateSkillKeys,
  );

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
    const payload = buildN8nExecutionPayload({
      workflow_key: req.workflow_key,
      project_id: req.project_id,
      input: req.input,
      phase: req.phase,
      skills: orderedSkills,
    });
    const res = await fetch(`${n8nUrl}${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  const prompt = buildHarveyWorkflowPrompt({
    workflow_key: req.workflow_key,
    project_id: req.project_id,
    input: req.input,
    phase: req.phase,
    skills: orderedSkills,
  });

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

  // H.3: Auto-link VDR evidence to workflow tasks
  let evidenceLinked: number | undefined;
  if (gatewayFindings.length > 0) {
    evidenceLinked = await linkEvidenceToWorkflowTasks(
      req.project_id, req.workflow_key, gatewayFindings
    );
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
    evidence_linked: evidenceLinked,
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

  const orderedSkills = sortSkillsByKeyOrder(
    (skills || []) as CatalogSkillRow[],
    definition.skill_keys,
  );

  const systemPrompt = `You are a legal due diligence analyst. Analyze the following for ${definition.name}.
Return findings in JSON format with: title, severity (critical/high/medium/low/informational),
probability (alta/media/baja), economic_impact, timing (blocking/post_closing),
mitigation, verifiability (verified/partially/not_verifiable), evidence_refs.`;

  if (featureFlag === 'n8n') {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const webhookPath = `/dd-workflow-${req.workflow_key.replace(/_/g, '-')}`;
    const payload = buildN8nExecutionPayload({
      workflow_key: req.workflow_key,
      project_id: req.project_id,
      input: req.input,
      phase: req.phase,
      skills: orderedSkills,
    });
    const res = await fetch(`${n8nUrl}${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  const prompt = buildHarveyWorkflowPrompt({
    workflow_key: req.workflow_key,
    project_id: req.project_id,
    input: req.input,
    phase: req.phase,
    skills: orderedSkills,
  });

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
  const flagValue = (process.env[WORKFLOW_TEMPLATES_FEATURE_FLAG] || '').toLowerCase();

  // --- Template-based execution (v1) ---
  const templateEnabled =
    flagValue.length === 0
      ? true
      : ['1', 'true', 'enabled', 'on'].includes(flagValue);

  if (templateEnabled) {
    return executeWithTemplate(req);
  }

  // --- Legacy execution ---
  return executeLegacy(req);
}
