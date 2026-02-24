// ============================================================
// N.1: Red Flag Report Generator
// Aggregates contingencies, negotiation alerts, and war room
// decisions into a structured red flag report for a project.
//
// Fase C: When FINDINGS_FIRST is enabled, reads from dd_findings
// instead of dd_contingencies + dd_negotiation_alerts.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import { isFindingsFirstEnabled, getRedFlagFindings } from '@/lib/findings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedFlagEntry {
  id: string;
  title: string;
  area_code: string;
  severity: string;
  probability: string;
  economic_impact?: number;
  source: 'contingency' | 'alert' | 'finding';
  source_id: string;
  mitigation?: string;
  hitl_status?: string;
  war_room_decision?: string;
}

export interface RedFlagReportOutput {
  project_id: string;
  generated_at: string;
  total_red_flags: number;
  by_severity: Record<string, number>;
  by_area: Record<string, number>;
  deal_breakers: RedFlagEntry[];
  critical_flags: RedFlagEntry[];
  high_flags: RedFlagEntry[];
  medium_low_flags: RedFlagEntry[];
  executive_summary: string;
  war_room_decisions_count: number;
  unresolved_count: number;
  source: 'dd_findings' | 'legacy';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize title for dedup comparison */
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Build severity label in Spanish */
function severityLabel(sev: string): string {
  const map: Record<string, string> = {
    critical: 'criticos',
    high: 'altos',
    medium: 'medios',
    low: 'bajos',
  };
  return map[sev] ?? sev;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a structured Red Flag Report for a project.
 *
 * FINDINGS_FIRST path: reads from dd_findings (is_red_flag=true OR severity in critical/high).
 * Legacy path: merges dd_contingencies + dd_negotiation_alerts.
 * Both paths cross-reference dd_war_room_decisions.
 */
export async function generateRedFlagReport(
  projectId: string,
): Promise<RedFlagReportOutput> {
  // --- Load war room decisions (always needed) ---
  const { data: decisions } = await supabaseAdmin
    .from('dd_war_room_decisions')
    .select('*')
    .eq('project_id', projectId);

  const decisionByContingencyId = new Map<string, string>();
  const decisionByAlertId = new Map<string, string>();
  const decisionByFindingId = new Map<string, string>();
  for (const d of (decisions ?? [])) {
    if (d.contingency_id) {
      decisionByContingencyId.set(d.contingency_id, `${d.decision_type}: ${d.title}`);
    }
    if (d.alert_id) {
      decisionByAlertId.set(d.alert_id, `${d.decision_type}: ${d.title}`);
    }
    // Future: when war_room_decisions gets finding_id FK
    if (d.finding_id) {
      decisionByFindingId.set(d.finding_id, `${d.decision_type}: ${d.title}`);
    }
  }

  // --- Build all flags ---
  let allFlags: RedFlagEntry[];

  if (isFindingsFirstEnabled()) {
    allFlags = await loadFindingsFirstFlags(projectId, decisionByFindingId, decisionByContingencyId);
    console.log(`[RedFlagReport] FINDINGS_FIRST: ${allFlags.length} flags from dd_findings`);
  } else {
    allFlags = await loadLegacyFlags(projectId, decisionByContingencyId, decisionByAlertId);
  }

  // --- Categorize ---
  const dealBreakers: RedFlagEntry[] = [];
  const criticalFlags: RedFlagEntry[] = [];
  const highFlags: RedFlagEntry[] = [];
  const mediumLowFlags: RedFlagEntry[] = [];

  for (const flag of allFlags) {
    if (flag.severity === 'critical' && flag.probability === 'certain') {
      dealBreakers.push(flag);
    } else if (flag.severity === 'critical') {
      criticalFlags.push(flag);
    } else if (flag.severity === 'high') {
      highFlags.push(flag);
    } else {
      mediumLowFlags.push(flag);
    }
  }

  // --- Count by severity and area ---
  const bySeverity: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const flag of allFlags) {
    bySeverity[flag.severity] = (bySeverity[flag.severity] ?? 0) + 1;
    byArea[flag.area_code] = (byArea[flag.area_code] ?? 0) + 1;
  }

  // Unresolved: flags without a war room decision and not in resolved/mitigated status
  const unresolvedCount = allFlags.filter(
    f => !f.war_room_decision && f.hitl_status !== 'resolved' && f.hitl_status !== 'mitigated',
  ).length;

  // --- Executive summary ---
  const severityParts: string[] = [];
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    const count = bySeverity[sev];
    if (count && count > 0) {
      severityParts.push(`${count} ${severityLabel(sev)}`);
    }
  }
  const severityText = severityParts.length > 0
    ? severityParts.join(', ')
    : 'ninguno';

  const executiveSummary = [
    `Se han identificado ${allFlags.length} red flags en el proyecto: ${severityText}.`,
    dealBreakers.length > 0
      ? `ATENCION: ${dealBreakers.length} deal breaker(s) detectado(s) que requieren accion inmediata.`
      : null,
    unresolvedCount > 0
      ? `${unresolvedCount} flag(s) pendiente(s) de resolucion.`
      : 'Todos los flags han sido resueltos o cuentan con decision del War Room.',
    (decisions ?? []).length > 0
      ? `El War Room ha registrado ${(decisions ?? []).length} decision(es) sobre estos hallazgos.`
      : null,
  ].filter(Boolean).join(' ');

  return {
    project_id: projectId,
    generated_at: new Date().toISOString(),
    total_red_flags: allFlags.length,
    by_severity: bySeverity,
    by_area: byArea,
    deal_breakers: dealBreakers,
    critical_flags: criticalFlags,
    high_flags: highFlags,
    medium_low_flags: mediumLowFlags,
    executive_summary: executiveSummary,
    war_room_decisions_count: (decisions ?? []).length,
    unresolved_count: unresolvedCount,
    source: isFindingsFirstEnabled() ? 'dd_findings' : 'legacy',
  };
}

// ---------------------------------------------------------------------------
// FINDINGS_FIRST path
// ---------------------------------------------------------------------------

async function loadFindingsFirstFlags(
  projectId: string,
  decisionByFindingId: Map<string, string>,
  decisionByContingencyId: Map<string, string>,
): Promise<RedFlagEntry[]> {
  const redFlagData = await getRedFlagFindings(projectId);

  const seenTitles = new Set<string>();
  const flags: RedFlagEntry[] = [];

  for (const f of redFlagData) {
    const normTitle = normalizeTitle(f.title);
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    // Look up war room decision by finding_id or contingency_id
    const decision = decisionByFindingId.get(f.id)
      || (f.contingency_id ? decisionByContingencyId.get(f.contingency_id) : undefined);

    flags.push({
      id: f.id,
      title: f.title,
      area_code: f.area_code,
      severity: f.severity,
      probability: f.probability,
      economic_impact: f.economic_impact,
      source: 'finding',
      source_id: f.id,
      mitigation: f.mitigation,
      hitl_status: f.hitl_status,
      war_room_decision: decision,
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Legacy path
// ---------------------------------------------------------------------------

async function loadLegacyFlags(
  projectId: string,
  decisionByContingencyId: Map<string, string>,
  decisionByAlertId: Map<string, string>,
): Promise<RedFlagEntry[]> {
  // Load contingencies with area info
  const { data: contingencies } = await supabaseAdmin
    .from('dd_contingencies')
    .select('id, title, description, severity, probability, estimated_amount, status, area_id, recommendation, dd_areas(code)')
    .eq('project_id', projectId)
    .in('severity', ['critical', 'high']);

  // Load negotiation alerts
  const { data: alerts } = await supabaseAdmin
    .from('dd_negotiation_alerts')
    .select('*')
    .eq('project_id', projectId);

  const seenTitles = new Set<string>();
  const allFlags: RedFlagEntry[] = [];

  // From contingencies
  for (const c of (contingencies ?? [])) {
    const areaRel = c.dd_areas as unknown as { code: string } | null;
    const areaCode = areaRel?.code ?? 'GENERAL';
    const normTitle = normalizeTitle(c.title);
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    allFlags.push({
      id: c.id,
      title: c.title,
      area_code: areaCode,
      severity: c.severity,
      probability: c.probability,
      economic_impact: c.estimated_amount ? Number(c.estimated_amount) : undefined,
      source: 'contingency',
      source_id: c.id,
      mitigation: c.recommendation ?? undefined,
      hitl_status: undefined,
      war_room_decision: decisionByContingencyId.get(c.id),
    });
  }

  // From negotiation alerts
  for (const a of (alerts ?? [])) {
    const normTitle = normalizeTitle(a.titulo ?? a.title ?? '');
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    allFlags.push({
      id: a.id,
      title: a.titulo ?? a.title ?? '',
      area_code: a.area_code ?? 'GENERAL',
      severity: a.severity ?? 'high',
      probability: 'probable',
      source: 'alert',
      source_id: a.id,
      mitigation: a.recomendacion ?? undefined,
      hitl_status: a.status,
      war_room_decision: decisionByAlertId.get(a.id),
    });
  }

  return allFlags;
}
