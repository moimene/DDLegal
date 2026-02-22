// ============================================================
// Workflow Spec v1 — Template Types
// Mirrors DB schema from 202602270002_workflow_templates.sql
// ============================================================

// --- Enums / Unions ---

/** 6 DD phases matching dd_workflow_phase enum (+ legacy 'tratamiento') */
export type WorkflowPhase =
  | 'obtencion'
  | 'gestion'
  | 'analisis'
  | 'valoracion'
  | 'informe'
  | 'propuesta_transaccional'
  | 'tratamiento'; // legacy — kept for backward compat with existing seed

/** Workflow template categories */
export type TemplateCategory =
  | 'transactional'
  | 'compliance'
  | 'operational'
  | 'transversal'
  | 'area'
  | 'area_multi'
  | 'synthesis'
  | 'deliverable'
  | 'negotiation';

/** Workflow instance status */
export type WorkflowInstanceStatus =
  | 'created'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Phase status within an instance */
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

/** Task group status */
export type TaskGroupStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** Negotiation action types */
export type NegotiationActionType =
  | 'condition_precedent'
  | 'indemnity'
  | 'price_adjustment'
  | 'warranty'
  | 'covenant'
  | 'escrow'
  | 'cap_basket'
  | 'carve_out'
  | 'disclosure'
  | 'remediation'
  | 'insurance'
  | 'other';

/** Negotiation action status */
export type NegotiationActionStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'counter'
  | 'deferred'
  | 'withdrawn';

/** Gateway routing mode */
export type GatewayGroundingMode = 'vault_rag' | 'direct' | 'none';

// --- Phase Definition (inside template version) ---

export interface DoRDoDCriteria {
  check: string;
  label: string;
  required: boolean;
}

export interface PhaseGatewayConfig {
  route: 'completion' | 'none';
  grounding_mode: GatewayGroundingMode;
  max_prompt_chars?: number;
}

export interface PhaseDefinition {
  phase: WorkflowPhase;
  name: string;
  description: string;
  inputs_required: string[];
  skills: string[];
  artifacts: string[];
  dod_criteria: DoRDoDCriteria[];
  dor_criteria: DoRDoDCriteria[];
  kanban_start_state: string;
  kanban_end_state: string;
  hitl_required: boolean;
  estimated_duration_hours: number;
  gateway_config: PhaseGatewayConfig;
}

// --- HITL Policy ---

export interface HITLPolicy {
  required_areas: string[];
  auto_approve_below_severity: string;
  reviewer_role?: string;
  escalation_after_hours?: number;
}

// --- DB Row Types ---

/** dd_workflow_templates row */
export interface WorkflowTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  area_codes: string[];
  category: TemplateCategory;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** dd_workflow_template_versions row */
export interface WorkflowTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  phases: PhaseDefinition[];
  hitl_policy: HITLPolicy;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  evidence_requirements: Array<{ type: string; required: boolean; description?: string }>;
  report_template_key: string | null;
  feature_flag_key: string | null;
  is_published: boolean;
  published_at: string | null;
  changelog: string | null;
  created_at: string;
}

/** dd_workflow_instances row */
export interface WorkflowInstance {
  id: string;
  project_id: string;
  template_id: string;
  template_version_id: string;
  status: WorkflowInstanceStatus;
  current_phase: WorkflowPhase;
  project_overrides: Record<string, unknown>;
  phase_status: Record<WorkflowPhase, PhaseStatus>;
  phase_started_at: Partial<Record<WorkflowPhase, string>>;
  phase_completed_at: Partial<Record<WorkflowPhase, string>>;
  findings_count: number;
  red_flags_count: number;
  hitl_pending_count: number;
  initiated_by: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** dd_workflow_task_groups row */
export interface WorkflowTaskGroup {
  id: string;
  workflow_instance_id: string;
  phase: WorkflowPhase;
  title: string;
  description: string | null;
  sort_order: number;
  status: TaskGroupStatus;
  created_at: string;
}

/** dd_negotiation_actions row */
export interface NegotiationAction {
  id: string;
  project_id: string;
  workflow_instance_id: string | null;
  finding_ref: string | null;
  contingency_id: string | null;
  action_type: NegotiationActionType;
  title: string;
  description: string | null;
  spa_clause_id: string | null;
  proposed_text: string | null;
  status: NegotiationActionStatus;
  owner: string | null;
  counterparty_position: string | null;
  economic_impact_amount: number | null;
  economic_impact_currency: string;
  evidence_refs: Array<{ source_id: string; snippet?: string }>;
  war_room_decision_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Composite / Loaded Types ---

/** Template with its latest published version attached */
export interface WorkflowTemplateWithVersion extends WorkflowTemplate {
  latest_version: WorkflowTemplateVersion;
}

/** Instance with template info and task groups */
export interface WorkflowInstanceDetail extends WorkflowInstance {
  template: WorkflowTemplate;
  version: WorkflowTemplateVersion;
  task_groups: WorkflowTaskGroup[];
}

/** Phase advancement request */
export interface PhaseAdvanceRequest {
  instance_id: string;
  phase: WorkflowPhase;
  results?: Record<string, unknown>;
  dod_checks?: Record<string, boolean>;
}

/** Phase advancement result */
export interface PhaseAdvanceResult {
  success: boolean;
  instance: WorkflowInstance;
  next_phase: WorkflowPhase | null;
  tasks_created: number;
  hitl_required: boolean;
  hitl_decisions_created?: number;
  dod_failures?: DoRDoDCriteria[];
  dor_failures?: DoRDoDCriteria[];
  evidence_linked?: number;
}

/** Instantiation request */
export interface WorkflowInstantiateRequest {
  project_id: string;
  template_key: string;
  overrides?: Record<string, unknown>;
  initiated_by?: string;
}

/** Instantiation result */
export interface WorkflowInstantiateResult {
  success: boolean;
  instance: WorkflowInstance;
  task_groups: WorkflowTaskGroup[];
  kanban_tasks_created: number;
}

// --- Feature Flag ---

export const WORKFLOW_TEMPLATES_FEATURE_FLAG = 'WORKFLOW_TEMPLATES_V1';

/** All 6 DD phases in order */
export const WORKFLOW_PHASES: readonly WorkflowPhase[] = [
  'obtencion',
  'gestion',
  'analisis',
  'valoracion',
  'informe',
  'propuesta_transaccional',
] as const;

/** Legacy phases (for backward compat with 5-phase templates) */
export const WORKFLOW_PHASES_LEGACY: readonly WorkflowPhase[] = [
  'obtencion',
  'gestion',
  'analisis',
  'valoracion',
  'tratamiento',
] as const;
