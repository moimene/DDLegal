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
