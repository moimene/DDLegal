// ============================================================
// Workflow Template Loader
// Reads templates from dd_workflow_templates + dd_workflow_template_versions
// In-memory cache with 5-min TTL
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  WorkflowTemplate,
  WorkflowTemplateVersion,
  WorkflowTemplateWithVersion,
} from './template-types';

// --- Cache ---
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expires_at: number;
}

const templateCache = new Map<string, CacheEntry<WorkflowTemplateWithVersion>>();
let allTemplatesCache: CacheEntry<WorkflowTemplateWithVersion[]> | null = null;

function isCacheValid<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return entry != null && Date.now() < entry.expires_at;
}

// --- Public API ---

/**
 * Load a single workflow template with its latest published version.
 * Returns null if template not found or no published version exists.
 */
export async function loadWorkflowTemplate(
  templateKey: string
): Promise<WorkflowTemplateWithVersion | null> {
  // Check cache
  const cached = templateCache.get(templateKey);
  if (isCacheValid(cached)) {
    return cached.data;
  }

  // Query template
  const { data: template, error: tErr } = await supabaseAdmin
    .from('dd_workflow_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (tErr || !template) return null;

  // Query latest published version
  const { data: version, error: vErr } = await supabaseAdmin
    .from('dd_workflow_template_versions')
    .select('*')
    .eq('template_id', template.id)
    .eq('is_published', true)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (vErr || !version) return null;

  const result: WorkflowTemplateWithVersion = {
    ...(template as unknown as WorkflowTemplate),
    latest_version: version as unknown as WorkflowTemplateVersion,
  };

  // Cache it
  templateCache.set(templateKey, {
    data: result,
    expires_at: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

/**
 * Load all active workflow templates with their latest published versions.
 */
export async function loadAllTemplates(): Promise<WorkflowTemplateWithVersion[]> {
  // Check cache
  if (isCacheValid(allTemplatesCache)) {
    return allTemplatesCache.data;
  }

  // Query all active templates
  const { data: templates, error: tErr } = await supabaseAdmin
    .from('dd_workflow_templates')
    .select('*')
    .eq('is_active', true)
    .order('template_key');

  if (tErr || !templates || templates.length === 0) return [];

  // Query all published versions
  const templateIds = templates.map(t => t.id);
  const { data: versions, error: vErr } = await supabaseAdmin
    .from('dd_workflow_template_versions')
    .select('*')
    .in('template_id', templateIds)
    .eq('is_published', true)
    .order('version_number', { ascending: false });

  if (vErr || !versions) return [];

  // Build map: template_id -> latest version
  const versionMap = new Map<string, WorkflowTemplateVersion>();
  for (const v of versions) {
    // First version for each template_id is the latest (ordered desc)
    if (!versionMap.has(v.template_id)) {
      versionMap.set(v.template_id, v as unknown as WorkflowTemplateVersion);
    }
  }

  // Combine
  const results: WorkflowTemplateWithVersion[] = [];
  for (const t of templates) {
    const version = versionMap.get(t.id);
    if (version) {
      const combined: WorkflowTemplateWithVersion = {
        ...(t as unknown as WorkflowTemplate),
        latest_version: version,
      };
      results.push(combined);

      // Also cache individually
      templateCache.set(t.template_key, {
        data: combined,
        expires_at: Date.now() + CACHE_TTL_MS,
      });
    }
  }

  // Cache all
  allTemplatesCache = {
    data: results,
    expires_at: Date.now() + CACHE_TTL_MS,
  };

  return results;
}

/**
 * Invalidate all template caches. Call after admin operations
 * (create/update/publish template).
 */
export function invalidateTemplateCache(): void {
  templateCache.clear();
  allTemplatesCache = null;
}

/**
 * Get cache stats for observability.
 */
export function getTemplateCacheStats(): {
  entries: number;
  has_all_cache: boolean;
} {
  return {
    entries: templateCache.size,
    has_all_cache: isCacheValid(allTemplatesCache),
  };
}
