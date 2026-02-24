// src/lib/findings/objective-types.ts

export interface EvaluationCriterion {
  criterion: string;
  weight: number;
  eval_type: 'document_review' | 'semantic_analysis' | 'threshold_calculation' |
             'litigation_review' | 'compliance_check' | 'document_verification' |
             'jurisdiction_mapping' | 'procedure_analysis' | 'registry_check' | 'timeline_verification';
}

export interface DataRequirement {
  doc_type: string;
  sample: 'all' | 'material';
  extractions: string[];
}

export interface SeverityModifier {
  condition: string;
  action: 'upgrade_to_critical' | 'upgrade_to_high' | 'downgrade_to_medium' |
          'downgrade_to_low' | 'maintain_critical' | 'downgrade_to_informational';
  justification: string;
}

export interface FindingObjective {
  id: string;
  objective_key: string;
  version: string;
  title: string;
  description: string | null;
  area_code: string;
  skill_key: string | null;
  risk_category: string | null;
  dd_phase: string | null;
  deal_types: string[];
  jurisdictions: string[];
  materiality_threshold_amount: number | null;
  materiality_threshold_currency: string;
  applies_when: unknown[];
  evaluation_criteria: EvaluationCriterion[];
  data_required: DataRequirement[];
  severity_if_positive: string;
  severity_modifiers: SeverityModifier[];
  positive_examples: string[];
  negative_examples: string[];
  false_positive_examples: string[];
  source_standard: string | null;
  regulatory_basis: string | null;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** FO dependency keys - these FOs must be evaluated first (Worker Architecture v1.0) */
  depends_on?: string[];
}
