/**
 * Sense Phase — Worker Architecture v1.0
 *
 * Responsibility: Detect changes in the data universe and determine what work needs to be done.
 *
 * Components:
 * - VDR Watcher: Detect new/modified documents via content_hash
 * - Coverage Analyzer: Compute coverage by area and FO
 * - Gap Detector: Identify FOs without sufficient data
 * - Priority Calculator: Order work queue by severity × coverage × aging
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
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

interface PendingDocument {
  document_id: string;
  document_name: string;
  created_at: string;
  content_hash: string | null;
  has_facts: boolean;
}

interface ApplicableFO {
  id: string;
  objective_key: string;
  area_code: string;
  severity_if_positive: string;
}

// Severity weights for priority calculation
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
  informational: 5,
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Execute the SENSE phase of the worker loop.
 *
 * 1. Detect new/modified documents that need processing
 * 2. Get applicable Finding Objectives for the project
 * 3. Build work queue with priority scores
 * 4. Compute coverage by area
 */
export async function runSensePhase(
  state: WorkerRunState,
  config: WorkerConfig
): Promise<PhaseResult> {
  const startTime = Date.now();

  try {
    // 1. Get pending documents (new or modified since last extraction)
    const pendingDocs = await getPendingDocuments(config.projectId);

    // 2. Get applicable Finding Objectives
    const applicableFOs = await getApplicableFOs(config.projectId, config.targetArea);

    // 3. Build work queue
    const workQueue = await buildWorkQueue(
      pendingDocs,
      applicableFOs,
      config.docsPerCycle
    );

    // 4. Compute coverage
    const coverageSnapshot = await computeCoverage(config.projectId);

    // 5. Update worker run with work queue
    await supabaseAdmin
      .from('dd_worker_runs')
      .update({
        work_queue: workQueue,
        coverage_snapshot: coverageSnapshot,
      })
      .eq('id', state.runId);

    return {
      itemsTotal: pendingDocs.length * applicableFOs.length,
      itemsDone: workQueue.length,
      itemsError: 0,
      docsNormalized: 0,
      fosEvaluated: 0,
      findingsCreated: 0,
      findingsUpdated: 0,
      conclusionsGenerated: 0,
      aiCallsMade: 0,
      durationMs: Date.now() - startTime,
      coverageSnapshot,
      workQueue,
    };
  } catch (error) {
    console.error('[sense-phase] Error:', error);
    return {
      itemsTotal: 0,
      itemsDone: 0,
      itemsError: 1,
      docsNormalized: 0,
      fosEvaluated: 0,
      findingsCreated: 0,
      findingsUpdated: 0,
      conclusionsGenerated: 0,
      aiCallsMade: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Document Detection
// ============================================================================

/**
 * Get documents that need processing:
 * - New documents without facts
 * - Modified documents (content_hash changed since last extraction)
 */
async function getPendingDocuments(projectId: string): Promise<PendingDocument[]> {
  // Get all documents for project (uploaded status = ready for processing)
  const { data: documents, error: docError } = await supabaseAdmin
    .from('vdr_documents')
    .select('id, name, created_at, content_hash')
    .eq('project_id', projectId)
    .in('status', ['uploaded', 'indexed', 'processing'])
    .order('created_at', { ascending: false });

  if (docError || !documents) {
    console.error('[sense-phase] Failed to fetch documents:', docError);
    return [];
  }

  // Get existing facts for these documents
  const documentIds = documents.map(d => d.id);
  const { data: existingFacts } = await supabaseAdmin
    .from('dd_document_facts')
    .select('document_id, source_content_hash')
    .eq('project_id', projectId)
    .in('document_id', documentIds);

  const factsMap = new Map<string, string>(
    (existingFacts || []).map(f => [f.document_id, f.source_content_hash])
  );

  // Filter to pending documents
  const pendingDocs: PendingDocument[] = documents
    .map(doc => {
      const existingHash = factsMap.get(doc.id);
      const needsExtraction = !existingHash || existingHash !== doc.content_hash;

      return {
        document_id: doc.id,
        document_name: doc.name,
        created_at: doc.created_at,
        content_hash: doc.content_hash,
        has_facts: !!existingHash,
      };
    })
    .filter(doc => !doc.has_facts || doc.content_hash !== factsMap.get(doc.document_id));

  return pendingDocs;
}

// ============================================================================
// Finding Objectives
// ============================================================================

/**
 * Get applicable Finding Objectives for the project.
 * Filters by target area if in targeted mode.
 */
async function getApplicableFOs(
  projectId: string,
  targetArea?: string
): Promise<ApplicableFO[]> {
  // Get project context for filtering
  const { data: project } = await supabaseAdmin
    .from('dd_projects')
    .select('deal_type, jurisdiction')
    .eq('id', projectId)
    .single();

  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('id, objective_key, area_code, severity_if_positive')
    .eq('is_active', true);

  // Filter by target area if specified
  if (targetArea) {
    query = query.eq('area_code', targetArea);
  }

  // Filter by deal type if project has one
  if (project?.deal_type) {
    query = query.or(`applicable_deal_types.cs.{${project.deal_type}},applicable_deal_types.is.null`);
  }

  const { data: objectives, error } = await query.order('area_code', { ascending: true });

  if (error || !objectives) {
    console.error('[sense-phase] Failed to fetch objectives:', error);
    return [];
  }

  return objectives;
}

// ============================================================================
// Work Queue Building
// ============================================================================

/**
 * Build work queue with priority scores.
 *
 * Priority calculation:
 * - Base severity of FO (40/30/20/10/5 points)
 * - Coverage gap for area (0-30 points)
 * - Document age (0-20 points)
 * - Dependency resolution bonus (10 points)
 */
async function buildWorkQueue(
  pendingDocs: PendingDocument[],
  applicableFOs: ApplicableFO[],
  maxItems: number
): Promise<WorkItem[]> {
  const workItems: WorkItem[] = [];

  // Get current coverage by area
  const areaCoverage = await getAreaCoverage(pendingDocs[0]?.document_id);

  for (const doc of pendingDocs) {
    for (const fo of applicableFOs) {
      const priority = calculatePriority(doc, fo, areaCoverage);

      workItems.push({
        document_id: doc.document_id,
        objective_id: fo.id,
        priority_score: priority,
        status: 'pending',
      });
    }
  }

  // Sort by priority (highest first) and limit
  return workItems
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, maxItems);
}

function calculatePriority(
  doc: PendingDocument,
  fo: ApplicableFO,
  areaCoverage: Record<string, number>
): number {
  let score = 0;

  // 1. Severity weight (0-40)
  score += SEVERITY_WEIGHTS[fo.severity_if_positive] || 10;

  // 2. Coverage gap (0-30)
  const coverage = areaCoverage[fo.area_code] || 0;
  score += Math.round((1 - coverage / 100) * 30);

  // 3. Document age (0-20)
  const daysSinceUpload = Math.floor(
    (Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  score += Math.min(daysSinceUpload * 2, 20);

  // 4. New document bonus (10)
  if (!doc.has_facts) {
    score += 10;
  }

  return Math.min(score, 100);
}

async function getAreaCoverage(documentId?: string): Promise<Record<string, number>> {
  if (!documentId) return {};

  // Get project from document
  const { data: doc } = await supabaseAdmin
    .from('vdr_documents')
    .select('project_id')
    .eq('id', documentId)
    .single();

  if (!doc) return {};

  // Query coverage from dd_fo_document_status
  const { data: statusData } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      status,
      dd_finding_objectives!inner(area_code)
    `)
    .eq('project_id', doc.project_id);

  if (!statusData) return {};

  // Calculate coverage by area
  const areaStats: Record<string, { total: number; analyzed: number }> = {};

  for (const row of statusData) {
    // Handle both array and object forms from Supabase join
    const foData = row.dd_finding_objectives;
    const areaCode = Array.isArray(foData)
      ? (foData[0] as { area_code: string })?.area_code
      : (foData as { area_code: string })?.area_code;

    if (!areaCode) continue;

    if (!areaStats[areaCode]) {
      areaStats[areaCode] = { total: 0, analyzed: 0 };
    }
    areaStats[areaCode].total++;
    if (row.status === 'analyzed') {
      areaStats[areaCode].analyzed++;
    }
  }

  const coverage: Record<string, number> = {};
  for (const [area, stats] of Object.entries(areaStats)) {
    coverage[area] = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;
  }

  return coverage;
}

// ============================================================================
// Coverage Computation
// ============================================================================

/**
 * Compute overall coverage snapshot for the project.
 */
async function computeCoverage(projectId: string): Promise<CoverageSnapshot> {
  // Query coverage stats
  const { data: statusData } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      status,
      dd_finding_objectives!inner(area_code)
    `)
    .eq('project_id', projectId);

  if (!statusData || statusData.length === 0) {
    return { by_area: {}, overall: 0 };
  }

  // Calculate by area
  const areaStats: Record<string, { total: number; analyzed: number }> = {};
  let totalItems = 0;
  let analyzedItems = 0;

  for (const row of statusData) {
    // Handle both array and object forms from Supabase join
    const foData = row.dd_finding_objectives;
    const areaCode = Array.isArray(foData)
      ? (foData[0] as { area_code: string })?.area_code
      : (foData as { area_code: string })?.area_code;

    if (!areaCode) continue;

    if (!areaStats[areaCode]) {
      areaStats[areaCode] = { total: 0, analyzed: 0 };
    }
    areaStats[areaCode].total++;
    totalItems++;

    if (row.status === 'analyzed') {
      areaStats[areaCode].analyzed++;
      analyzedItems++;
    }
  }

  const byArea: Record<string, number> = {};
  for (const [area, stats] of Object.entries(areaStats)) {
    byArea[area] = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;
  }

  return {
    by_area: byArea,
    overall: totalItems > 0 ? Math.round((analyzedItems / totalItems) * 100) : 0,
  };
}

// ============================================================================
// Gap Detection
// ============================================================================

/**
 * Detect gaps: FOs that cannot be evaluated due to missing data.
 */
export async function detectGaps(
  projectId: string
): Promise<Array<{ objective_key: string; missing_doc_types: string[] }>> {
  // Get FOs with data requirements
  const { data: objectives } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('objective_key, data_requirements')
    .eq('is_active', true)
    .not('data_requirements', 'is', null);

  if (!objectives) return [];

  // Get available document types in project
  const { data: facts } = await supabaseAdmin
    .from('dd_document_facts')
    .select('document_type')
    .eq('project_id', projectId);

  const availableTypes = new Set((facts || []).map(f => f.document_type).filter(Boolean));

  const gaps: Array<{ objective_key: string; missing_doc_types: string[] }> = [];

  for (const obj of objectives) {
    if (!obj.data_requirements) continue;

    const requirements = obj.data_requirements as { required_doc_types?: string[] };
    const requiredTypes = requirements.required_doc_types || [];

    const missing = requiredTypes.filter(t => !availableTypes.has(t));

    if (missing.length > 0) {
      gaps.push({
        objective_key: obj.objective_key,
        missing_doc_types: missing,
      });
    }
  }

  return gaps;
}
