/**
 * Findings Module — Finding-Centric Architecture
 *
 * Central module for all finding-related operations.
 * Re-exports the findings service for convenience.
 */

export {
  // Core functions
  persistFindings,
  transitionFindingStatus,
  overrideFindingTier,
  linkFindingToContingency,
  getProjectFindings,
  getFindingDetail,
  getProjectFindingsSummary,

  // Fase C: FINDINGS_FIRST read helpers
  getFindingsForScoring,
  getRedFlagFindings,
  getFindingsByWorkflowInstance,
  getRedFlagsDigest,

  // Feature flag
  isFindingsFirstEnabled,

  // Types
  type FindingSourceType,
  type FindingStatus,
  type PersistFindingInput,
  type PersistFindingsResult,
  type FindingRow,
} from './findings-service';

// Fase E.1-E.2.5: Finding Objectives
export type {
  FindingObjective,
  EvaluationCriterion,
  DataRequirement,
  SeverityModifier,
} from './objective-types';

export {
  resolveApplicableObjectives,
  getObjectivesForSkill,
  getObjectiveByKey,
  type DealContext,
  type ResolvedObjective,
} from './objective-resolver';

export {
  evaluateObjective,
  recordRuleExecution,
  type EvaluationFacts,
  type CriterionResult,
  type RuleEvaluationResult,
} from './rule-evaluator';

export {
  runFOAnalysisWorker,
  type WorkerConfig,
  type WorkerResult,
} from './fo-analysis-worker';
