import { supabaseAdmin } from '@/lib/supabase-admin';

export const DD_REPORTS_OPTIONAL_COLUMNS = [
  'report_category',
  'visibility',
  'version_number',
  'is_frozen',
  'frozen_at',
  'frozen_by',
] as const;

export type DDReportsOptionalColumn = (typeof DD_REPORTS_OPTIONAL_COLUMNS)[number];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedColumns: Set<string> | null = null;
let cacheExpiresAt = 0;

function canUseCache(now: number): boolean {
  return cachedColumns !== null && cacheExpiresAt > now;
}

function setCache(columns: Set<string>, now: number): void {
  cachedColumns = columns;
  cacheExpiresAt = now + CACHE_TTL_MS;
}

function isMissingColumnError(error: { message?: string | null; details?: string | null }): boolean {
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return combined.includes('column') && combined.includes('does not exist');
}

async function detectColumn(column: DDReportsOptionalColumn): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('dd_reports')
    .select(`id,${column}`)
    .limit(1);

  if (!error) return true;
  if (isMissingColumnError(error)) return false;

  console.warn(`[ReportsSchemaCompat] Column check failed for "${column}":`, error.message);
  return false;
}

export async function getDDReportsColumnSet(): Promise<Set<string>> {
  const now = Date.now();
  if (canUseCache(now)) return cachedColumns as Set<string>;

  const checks = await Promise.all(
    DD_REPORTS_OPTIONAL_COLUMNS.map(async (column) => ({
      column,
      exists: await detectColumn(column),
    })),
  );

  const columns = new Set<string>(
    checks.filter((entry) => entry.exists).map((entry) => entry.column),
  );

  if (columns.size === 0 && cachedColumns) {
    // Keep stale cache if transient connectivity issues happen.
    return cachedColumns;
  }

  setCache(columns, now);
  return columns;
}

export function hasDDReportsColumns(
  availableColumns: Set<string>,
  requiredColumns: readonly string[],
): boolean {
  return requiredColumns.every((column) => availableColumns.has(column));
}

export function buildDDReportsSelect(
  baseColumns: readonly string[],
  optionalColumns: readonly string[],
  availableColumns: Set<string>,
): string {
  const selectedColumns = [
    ...baseColumns,
    ...optionalColumns.filter((column) => availableColumns.has(column)),
  ];
  return selectedColumns.join(', ');
}
