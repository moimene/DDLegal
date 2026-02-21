import { getHarveyGateway } from '@/lib/harvey';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WORKFLOW_DEFINITIONS } from './constants';
import type {
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
} from './types';

export async function executeWorkflow(
  req: WorkflowExecutionRequest
): Promise<WorkflowExecutionResult> {
  const definition = WORKFLOW_DEFINITIONS[req.workflow_key];
  if (!definition) {
    throw new Error(`Unknown workflow: ${req.workflow_key}`);
  }

  const featureFlag = process.env[`HARVEY_FF_${definition.feature_flag_key}`] || process.env.HARVEY_FEATURE_FLAG || 'gateway';

  const { data: skills } = await supabaseAdmin
    .from('dd_skills_catalog')
    .select('skill_key, prompt_template, expected_output_schema, evidence_requirements')
    .in('skill_key', definition.skill_keys)
    .eq('is_active', true);

  const combinedPrompt = (skills || [])
    .map(s => s.prompt_template)
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
    return {
      success: true,
      workflow_key: req.workflow_key,
      report_section: data.report_section || '',
      findings: data.findings || [],
      evidence_refs: data.evidence_refs || [],
      hitl_required: definition.hitl_required,
      source: 'n8n',
    };
  }

  const gateway = getHarveyGateway();
  const prompt = `${combinedPrompt}\n\n---\nProject: ${req.project_id}\nInput: ${JSON.stringify(req.input)}`;

  const result = await gateway.completion({
    prompt,
    system_prompt: systemPrompt,
    client_matter_id: `${req.project_id}:${req.workflow_key}`,
  });

  let parsed: { report_section?: string; findings?: unknown[]; evidence_refs?: unknown[] } = {};
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = { report_section: result.text, findings: [], evidence_refs: [] };
  }

  return {
    success: true,
    workflow_key: req.workflow_key,
    report_section: parsed.report_section || result.text,
    findings: (parsed.findings || []) as WorkflowExecutionResult['findings'],
    evidence_refs: (parsed.evidence_refs || []) as WorkflowExecutionResult['evidence_refs'],
    hitl_required: definition.hitl_required,
    source: 'gateway',
  };
}
