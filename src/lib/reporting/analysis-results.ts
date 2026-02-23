import { supabaseAdmin } from '@/lib/supabase-admin';
import { computeEvidenceHash } from '@/lib/vdr/content-hash';

export interface AnalysisResult {
  id: string;
  project_id: string;
  area: string;
  report_type: string;
  finding_key: string;
  structured_data: Record<string, unknown>;
  evidence_refs: string[];
  confidence_score: number;
  version: number;
  source_skill: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert an analysis result. Increments version on conflict.
 */
export async function upsertAnalysisResult(opts: {
  projectId: string;
  area: string;
  reportType: string;
  findingKey: string;
  structuredData: Record<string, unknown>;
  evidenceRefs: string[];
  confidenceScore?: number;
  sourceSkill?: string;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('dd_analysis_results')
    .select('id, version')
    .eq('project_id', opts.projectId)
    .eq('area', opts.area)
    .eq('finding_key', opts.findingKey)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('dd_analysis_results')
      .update({
        structured_data: opts.structuredData,
        evidence_refs: opts.evidenceRefs,
        confidence_score: opts.confidenceScore ?? 0,
        source_skill: opts.sourceSkill || null,
        version: existing.version + 1,
        report_type: opts.reportType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('dd_analysis_results')
      .insert({
        project_id: opts.projectId,
        area: opts.area,
        report_type: opts.reportType,
        finding_key: opts.findingKey,
        structured_data: opts.structuredData,
        evidence_refs: opts.evidenceRefs,
        confidence_score: opts.confidenceScore ?? 0,
        source_skill: opts.sourceSkill || null,
      });
  }
}

/**
 * Load all accumulated analysis results for a project + report_type.
 */
export async function loadAnalysisResults(
  projectId: string,
  reportType: string,
): Promise<AnalysisResult[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .eq('report_type', reportType)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load analysis results: ${error.message}`);
  return (data || []) as AnalysisResult[];
}

/**
 * Compute the evidence hash for a project (all indexed docs).
 */
export async function getProjectEvidenceHash(projectId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('vdr_documents')
    .select('content_hash')
    .eq('project_id', projectId)
    .eq('embedding_status', 'done')
    .not('content_hash', 'is', null)
    .order('content_hash');

  if (error) throw new Error(`Failed to compute evidence hash: ${error.message}`);

  const hashes = (data || []).map(d => d.content_hash).filter(Boolean) as string[];
  return computeEvidenceHash(hashes);
}

/**
 * Invalidate all report caches for a project.
 */
export async function invalidateProjectReportCache(projectId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('dd_report_cache')
    .update({ is_valid: false })
    .eq('project_id', projectId)
    .eq('is_valid', true)
    .select('id');

  if (error) throw new Error(`Failed to invalidate cache: ${error.message}`);
  return (data || []).length;
}

/**
 * Check if a valid cache entry exists for a report.
 */
export async function checkReportCache(
  projectId: string,
  reportType: string,
  evidenceHash: string,
): Promise<{ hit: boolean; htmlContent?: string; mdContent?: string; jsonOutput?: Record<string, unknown> }> {
  const { data } = await supabaseAdmin
    .from('dd_report_cache')
    .select('html_content, md_content, json_output, valid_until')
    .eq('project_id', projectId)
    .eq('report_type', reportType)
    .eq('evidence_hash', evidenceHash)
    .eq('is_valid', true)
    .gt('valid_until', new Date().toISOString())
    .maybeSingle();

  if (data) {
    return {
      hit: true,
      htmlContent: data.html_content || undefined,
      mdContent: data.md_content || undefined,
      jsonOutput: data.json_output as Record<string, unknown> | undefined,
    };
  }

  return { hit: false };
}

/**
 * Store a report in cache and version history.
 */
export async function storeReport(opts: {
  projectId: string;
  reportType: string;
  evidenceHash: string;
  jsonOutput: Record<string, unknown>;
  htmlContent: string;
  mdContent?: string;
  cadencia: 'on_demand' | 'daily' | 'weekly' | 'monthly';
  generatedBy?: string;
}): Promise<string> {
  const ttlMap: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    on_demand: 30 * 24 * 60 * 60 * 1000,
  };

  const validUntil = new Date(Date.now() + (ttlMap[opts.cadencia] || ttlMap.on_demand));

  // Upsert cache
  await supabaseAdmin
    .from('dd_report_cache')
    .upsert({
      project_id: opts.projectId,
      report_type: opts.reportType,
      evidence_hash: opts.evidenceHash,
      html_content: opts.htmlContent,
      md_content: opts.mdContent || null,
      json_output: opts.jsonOutput,
      is_valid: true,
      valid_until: validUntil.toISOString(),
    }, { onConflict: 'project_id,report_type,evidence_hash' });

  // Get next version number
  const { data: lastVersion } = await supabaseAdmin
    .from('dd_report_versions')
    .select('version')
    .eq('project_id', opts.projectId)
    .eq('report_type', opts.reportType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersion?.version || 0) + 1;

  // Insert version
  const { data: versionRow, error } = await supabaseAdmin
    .from('dd_report_versions')
    .insert({
      project_id: opts.projectId,
      report_type: opts.reportType,
      version: nextVersion,
      json_output: opts.jsonOutput,
      html_content: opts.htmlContent,
      md_content: opts.mdContent || null,
      evidence_hash: opts.evidenceHash,
      generated_by: opts.generatedBy || 'system',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to store report version: ${error.message}`);
  return versionRow.id;
}
