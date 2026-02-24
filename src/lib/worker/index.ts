/**
 * Worker Module — Worker Architecture v1.0
 *
 * Autonomous DD Worker that executes the SENSE → NORMALIZE → EVALUATE → CONCLUDE loop.
 * Central module for all worker-related operations.
 */

// F.1.2: Fact Extractor (NORMALIZE phase)
export {
  extractDocumentFacts,
  extractDocumentFactsBatch,
  getDocumentFacts,
  type DocumentFacts,
  type Party,
  type KeyDate,
  type Amount,
  type Clause,
  type Obligation,
  type ExtractionResult,
  type ExtractionOptions,
} from './fact-extractor';

// F.1.3: Document Classifier (NORMALIZE phase - Step 1)
export {
  classifyDocument,
  classifyDocumentsBatch,
  type ClassificationResult,
  type DocumentType,
  type AreaCode,
  type Jurisdiction,
} from './document-classifier';

// F.2.2: Worker Controller (State Machine)
export {
  startWorker,
  runWorkerCycle,
  pauseWorker,
  resumeWorker,
  getWorkerStatus,
  type WorkerStatus,
  type WorkerPhase,
  type ExecutionMode,
  type WorkerConfig,
  type WorkerRunState,
  type WorkerCycleResult,
  type CoverageSnapshot,
  type WorkItem,
  type CycleMetrics,
} from './worker-controller';

// F.2.3: Sense Phase
export {
  runSensePhase,
  detectGaps,
} from './sense-phase';

// F.2.4: Normalize Phase
export {
  runNormalizePhase,
  normalizeDocumentsBatch,
  getPendingNormalization,
} from './normalize-phase';

// F.3: Evaluate Phase (Enhanced Evaluation)
export {
  runEvaluatePhase,
  evaluateCriterionWithFacts,
} from './evaluate-phase';

// F.3: Dependency Resolver
export {
  resolveEvaluationOrder,
  getDependents,
  areDependenciesResolved,
  getMaxDependencyDepth,
  type EvaluationWave,
  type ResolutionResult,
} from './dependency-resolver';

// F.4: Conclude Phase (Conclusions Engine)
export {
  runConcludePhase,
} from './conclude-phase';

// F.5: Observability & Alerts
export {
  checkWorkerAlerts,
  getActiveAlerts,
  acknowledgeAlert,
  getAlertSummary,
  type WorkerAlert,
  type AlertType,
  type AlertSeverity,
  type AlertCheckResult,
} from './alerts';

// G-19: Completeness Validator (Facts vs FO.data_required)
export {
  validateFactsCompleteness,
  batchValidateCompleteness,
  getDocumentCompleteness,
  getFOCompleteness,
  type DataRequirement,
  type CompletenessResult,
} from './completeness-validator';
