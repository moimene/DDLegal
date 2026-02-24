/**
 * Normalize Phase — Worker Architecture v1.0
 *
 * Responsibility: Transform VDR documents into structured facts.
 *
 * Pipeline:
 * 1. CLASSIFY: document_type, area_codes, jurisdiction, language
 * 2. EXTRACT: parties, dates, amounts, clauses, obligations
 * 3. NORMALIZE: entity linking, ISO dates, currency normalization
 * 4. COMPILE FACTS: dd_document_facts (UPSERT)
 *
 * Uses content_hash as cache key to skip re-extraction.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractDocumentFacts } from './fact-extractor';
import { classifyDocument } from './document-classifier';
import type { WorkerRunState, WorkerConfig, WorkItem, CoverageSnapshot } from './worker-controller';

// ============================================================================
// Types
// ============================================================================

interface PhaseResult {
  itemsTotal: number;
  itemsDone: number;
  itemsError: number;
  docsNormalized: number;
  fosEvaluated: number;
  findingsCreated: number;
  findingsUpdated: number;
  conclusionsGenerated: number;
  aiCallsMade: number;
  durationMs: number;
  coverageSnapshot?: CoverageSnapshot;
  workQueue?: WorkItem[];
}

interface NormalizationResult {
  documentId: string;
  success: boolean;
  cached: boolean;
  aiCalls: number;
  error?: string;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Execute the NORMALIZE phase of the worker loop.
 *
 * Process documents from the work queue:
 * 1. For each unique document in work queue
 * 2. Classify document (fast path)
 * 3. Extract structured facts via Harvey AI
 * 4. Store in dd_document_facts
 */
export async function runNormalizePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  const startTime = Date.now();

  // Get unique documents from work queue
  const uniqueDocIds = Array.from(new Set(state.workQueue.map(w => w.document_id)));

  // Limit to AI budget
  const remainingBudget = config.aiBudgetPerCycle - state.aiBudgetUsed;
  const docsToProcess = uniqueDocIds.slice(0, Math.min(uniqueDocIds.length, remainingBudget));

  let docsNormalized = 0;
  let aiCallsMade = 0;
  let itemsError = 0;

  // Process each document
  for (const documentId of docsToProcess) {
    try {
      const result = await normalizeDocument(documentId, config.projectId);

      if (result.success) {
        docsNormalized++;
        if (!result.cached) {
          aiCallsMade++;
        }

        // Update work queue items for this document
        await updateWorkQueueStatus(state.runId, documentId, 'done');
      } else {
        itemsError++;
        await updateWorkQueueStatus(state.runId, documentId, 'error');
      }
    } catch (error) {
      console.error(`[normalize-phase] Error processing ${documentId}:`, error);
      itemsError++;
      await updateWorkQueueStatus(state.runId, documentId, 'error');
    }
  }

  return {
    itemsTotal: docsToProcess.length,
    itemsDone: docsNormalized,
    itemsError,
    docsNormalized,
    fosEvaluated: 0,
    findingsCreated: 0,
    findingsUpdated: 0,
    conclusionsGenerated: 0,
    aiCallsMade,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// Document Normalization
// ============================================================================

/**
 * Normalize a single document:
 * 1. Classify (fast path, no AI if patterns match)
 * 2. Extract facts (AI call to Harvey)
 * 3. Store in dd_document_facts
 */
async function normalizeDocument(
  documentId: string,
  projectId: string
): Promise<NormalizationResult> {
  try {
    // Step 1: Fast classification (pattern-based, no AI fallback to save budget)
    const classification = await classifyDocument(documentId, { useAiFallback: false });

    // Step 2: Full fact extraction (uses AI)
    const extraction = await extractDocumentFacts(documentId, projectId, {
      forceReExtract: false, // Use cache if available
    });

    // Step 3: Merge classification into facts if extraction was from cache
    if (extraction.cached && classification.confidence > 0.7) {
      // Update facts with better classification if we have high confidence
      await supabaseAdmin
        .from('dd_document_facts')
        .update({
          document_type: classification.document_type,
          area_codes: classification.area_codes,
          jurisdiction: classification.jurisdiction,
          language: classification.language,
        })
        .eq('id', extraction.factId);
    }

    // Step 4: Create pending FO status entries for this document
    await createPendingFOStatuses(documentId, projectId, classification.area_codes);

    return {
      documentId,
      success: true,
      cached: extraction.cached,
      aiCalls: extraction.cached ? 0 : 1,
    };
  } catch (error) {
    console.error(`[normalize-phase] Failed to normalize ${documentId}:`, error);
    return {
      documentId,
      success: false,
      cached: false,
      aiCalls: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Create pending dd_fo_document_status entries for all applicable FOs.
 */
async function createPendingFOStatuses(
  documentId: string,
  projectId: string,
  areaCodes: string[]
): Promise<void> {
  // Get applicable FOs for these areas
  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('id')
    .eq('is_active', true);

  if (areaCodes.length > 0) {
    query = query.in('area_code', areaCodes);
  }

  const { data: objectives } = await query;

  if (!objectives || objectives.length === 0) return;

  // Check existing statuses
  const { data: existingStatuses } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select('objective_id')
    .eq('document_id', documentId)
    .eq('project_id', projectId);

  const existingObjectiveIds = new Set((existingStatuses || []).map(s => s.objective_id));

  // Create pending statuses for new FOs
  const newStatuses = objectives
    .filter(obj => !existingObjectiveIds.has(obj.id))
    .map(obj => ({
      document_id: documentId,
      project_id: projectId,
      objective_id: obj.id,
      status: 'pending',
    }));

  if (newStatuses.length > 0) {
    const { error } = await supabaseAdmin
      .from('dd_fo_document_status')
      .insert(newStatuses);

    if (error) {
      console.error('[normalize-phase] Failed to create FO statuses:', error);
    }
  }
}

// ============================================================================
// Work Queue Management
// ============================================================================

/**
 * Update work queue item status in the worker run.
 */
async function updateWorkQueueStatus(
  runId: string,
  documentId: string,
  newStatus: 'processing' | 'done' | 'error'
): Promise<void> {
  // Get current work queue
  const { data: run } = await supabaseAdmin
    .from('dd_worker_runs')
    .select('work_queue')
    .eq('id', runId)
    .single();

  if (!run) return;

  const workQueue = (run.work_queue as WorkItem[]) || [];

  // Update status for all items with this document
  const updatedQueue = workQueue.map(item => {
    if (item.document_id === documentId) {
      return { ...item, status: newStatus };
    }
    return item;
  });

  await supabaseAdmin
    .from('dd_worker_runs')
    .update({ work_queue: updatedQueue })
    .eq('id', runId);
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Normalize multiple documents in batch.
 * Used for bulk processing outside the worker loop.
 */
export async function normalizeDocumentsBatch(
  documentIds: string[],
  projectId: string,
  options: {
    maxConcurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ success: number; failed: number; cached: number }> {
  const { maxConcurrency = 3, onProgress } = options;

  let success = 0;
  let failed = 0;
  let cached = 0;

  // Process in batches
  for (let i = 0; i < documentIds.length; i += maxConcurrency) {
    const batch = documentIds.slice(i, i + maxConcurrency);

    const results = await Promise.all(
      batch.map(docId => normalizeDocument(docId, projectId))
    );

    for (const result of results) {
      if (result.success) {
        success++;
        if (result.cached) cached++;
      } else {
        failed++;
      }
    }

    onProgress?.(i + batch.length, documentIds.length);
  }

  return { success, failed, cached };
}

/**
 * Get documents pending normalization for a project.
 */
export async function getPendingNormalization(
  projectId: string
): Promise<Array<{ document_id: string; name: string; uploaded_at: string }>> {
  // Get documents without facts or with stale facts
  const { data: documents } = await supabaseAdmin
    .from('vdr_documents')
    .select('id, name, uploaded_at, content_hash')
    .eq('project_id', projectId)
    .eq('is_deleted', false);

  if (!documents) return [];

  // Get existing facts
  const { data: facts } = await supabaseAdmin
    .from('dd_document_facts')
    .select('document_id, source_content_hash')
    .eq('project_id', projectId);

  const factsMap = new Map((facts || []).map(f => [f.document_id, f.source_content_hash]));

  // Filter to pending
  return documents
    .filter(doc => {
      const existingHash = factsMap.get(doc.id);
      return !existingHash || existingHash !== doc.content_hash;
    })
    .map(doc => ({
      document_id: doc.id,
      name: doc.name,
      uploaded_at: doc.uploaded_at,
    }));
}
