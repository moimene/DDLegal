export type WorkflowKey =
  | 'arranque_dd'
  | 'data_room_gap'
  | 'societario'
  | 'contratos_materiales'
  | 'ip_titularidad'
  | 'laboral_fiscal';

export interface WorkflowDefinition {
  key: WorkflowKey;
  name: string;
  area_codes: string[];
  description: string;
  hitl_required: boolean;
  skill_keys: string[];
  input_schema: Record<string, unknown>;
  feature_flag_key: string;
}

export interface WorkflowExecutionRequest {
  workflow_key: WorkflowKey;
  project_id: string;
  input: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  workflow_key: WorkflowKey;
  report_section: string;
  findings: WorkflowFinding[];
  evidence_refs: Array<{ source_id: string; snippet?: string }>;
  hitl_required: boolean;
  source: 'gateway' | 'n8n';
}

export interface WorkflowFinding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  probability: 'alta' | 'media' | 'baja';
  economic_impact?: {
    amount: number;
    currency: string;
    type: 'contingency' | 'liability' | 'loss' | 'operational_cost';
  };
  timing: 'blocking' | 'post_closing';
  mitigation: string;
  verifiability: 'verified' | 'partially' | 'not_verifiable';
  evidence_refs: string[];
}
