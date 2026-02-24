// src/lib/findings/fo-analysis-worker.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { DealContext } from './objective-resolver';
import { evaluateObjective, recordRuleExecution, type EvaluationFacts } from './rule-evaluator';
import { persistFindings, type PersistFindingInput } from './findings-service';
import type { FindingObjective } from './objective-types';
import type { WorkflowFinding } from '@/lib/workflows/types';

export interface WorkerConfig {
  batchSize: number;
  maxAiCallsPerRun: number;
  projectId?: string;
}

export interface WorkerResult {
  processed: number;
  findings_created: number;
  errors: number;
  skipped: number;
  duration_ms: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: 10,
  maxAiCallsPerRun: 5, // Respect Harvey rate limits
};

/**
 * Process pending FO document analyses
 */
export async function runFOAnalysisWorker(
  config: Partial<WorkerConfig> = {}
): Promise<WorkerResult> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const result: WorkerResult = {
    processed: 0,
    findings_created: 0,
    errors: 0,
    skipped: 0,
    duration_ms: 0,
  };

  // Fetch batch of pending items
  let query = supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      id,
      project_id,
      objective_id,
      document_id,
      content_hash_at_analysis
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(cfg.batchSize);

  if (cfg.projectId) {
    query = query.eq('project_id', cfg.projectId);
  }

  const { data: pendingItems, error: fetchError } = await query;

  if (fetchError) {
    console.error('[FOWorker] Failed to fetch pending items:', fetchError.message);
    result.errors = 1;
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  if (!pendingItems || pendingItems.length === 0) {
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  let aiCallsMade = 0;

  console.log(`[FOWorker] Processing ${pendingItems.length} pending items for project ${cfg.projectId}`);

  for (const item of pendingItems) {
    if (aiCallsMade >= cfg.maxAiCallsPerRun) {
      console.log('[FOWorker] Reached AI call limit, stopping batch');
      break;
    }

    console.log(`[FOWorker] Processing item ${item.id}, document ${item.document_id}`);

    try {
      // Mark as analyzing
      await supabaseAdmin
        .from('dd_fo_document_status')
        .update({ status: 'analyzing' })
        .eq('id', item.id);

      // Load objective
      const { data: foData } = await supabaseAdmin
        .from('dd_finding_objectives')
        .select('*')
        .eq('id', item.objective_id)
        .single();

      if (!foData) {
        await markAsError(item.id, 'Objective not found');
        result.errors++;
        continue;
      }

      const fo = foData as FindingObjective;

      // Load document with chunks
      // Note: vdr_documents uses 'category' not 'document_type'
      const { data: docData, error: docError } = await supabaseAdmin
        .from('vdr_documents')
        .select('id, content_hash, category, project_id')
        .eq('id', item.document_id)
        .single();

      if (docError) {
        console.error(`[FOWorker] Document query error for ${item.document_id}:`, docError.message, docError.code);
        await markAsError(item.id, `Document query error: ${docError.message}`);
        result.errors++;
        continue;
      }

      if (!docData) {
        console.error(`[FOWorker] Document not found: ${item.document_id}`);
        await markAsError(item.id, 'Document not found');
        result.errors++;
        continue;
      }

      // Check if content_hash unchanged (skip if already analyzed with same hash)
      // Only skip if we have a previous analysis hash AND it matches the current document hash
      if (item.content_hash_at_analysis &&
          docData.content_hash &&
          item.content_hash_at_analysis === docData.content_hash) {
        await markAsSkipped(item.id);
        result.skipped++;
        continue;
      }

      // Load document chunks
      const { data: chunks } = await supabaseAdmin
        .from('vdr_chunks')
        .select('id, content, page_number')
        .eq('document_id', item.document_id)
        .limit(20);

      const facts: EvaluationFacts = {
        document_id: item.document_id,
        document_type: docData.category ?? 'unknown',
        content_hash: docData.content_hash ?? '',
        chunks: (chunks ?? []).map(c => ({
          id: c.id,
          content: c.content,
          page: c.page_number,
        })),
      };

      // Load deal context
      const { data: projectData } = await supabaseAdmin
        .from('dd_projects')
        .select('deal_type, target_jurisdiction, target_company')
        .eq('id', item.project_id)
        .single();

      const dealContext: DealContext = {
        deal_type: projectData?.deal_type ?? 'M&A',
        jurisdiction: projectData?.target_jurisdiction ?? 'ES',
        project_id: item.project_id,
        target_company: projectData?.target_company,
      };

      // Evaluate objective
      const evalResult = await evaluateObjective(fo, facts, dealContext);
      aiCallsMade += evalResult.ai_calls_made;

      let findingId: string | undefined;

      // Create finding if generated
      if (evalResult.finding_generated && evalResult.finding_data) {
        const workflowFinding: WorkflowFinding = {
          title: evalResult.finding_data.title,
          severity: evalResult.severity_computed as 'critical' | 'high' | 'medium' | 'low' | 'informational',
          probability: 'media', // Default
          timing: 'post_closing', // Default
          mitigation: `Revisar según criterios del FO ${fo.objective_key}`,
          verifiability: 'partially',
          evidence_refs: evalResult.finding_data.evidence_refs,
        };

        const findingInput: PersistFindingInput = {
          project_id: item.project_id,
          finding: workflowFinding,
          area_code: fo.area_code,
          source_type: 'workflow_ai',
        };

        const persistResult = await persistFindings([findingInput]);
        findingId = persistResult.finding_ids[0];

        if (findingId) {
          // Update finding with objective_id
          await supabaseAdmin
            .from('dd_findings')
            .update({ objective_id: fo.id })
            .eq('id', findingId);

          result.findings_created++;
        }
      }

      // Record rule execution
      const ruleExecutionId = await recordRuleExecution(
        item.project_id,
        evalResult,
        dealContext,
        findingId
      );

      // Mark as analyzed
      await supabaseAdmin
        .from('dd_fo_document_status')
        .update({
          status: 'analyzed',
          content_hash_at_analysis: docData.content_hash,
          finding_generated: evalResult.finding_generated,
          finding_id: findingId ?? null,
          rule_execution_id: ruleExecutionId,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      result.processed++;

    } catch (err) {
      console.error('[FOWorker] Error processing item:', err);
      await markAsError(item.id, (err as Error).message);
      result.errors++;
    }
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

async function markAsError(id: string, reason: string): Promise<void> {
  console.error(`[FOWorker] Item ${id} error: ${reason}`);
  await supabaseAdmin
    .from('dd_fo_document_status')
    .update({ status: 'error' })
    .eq('id', id);
}

async function markAsSkipped(id: string): Promise<void> {
  await supabaseAdmin
    .from('dd_fo_document_status')
    .update({ status: 'skipped', analyzed_at: new Date().toISOString() })
    .eq('id', id);
}
