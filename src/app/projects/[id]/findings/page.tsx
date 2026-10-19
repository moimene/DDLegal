'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Filter, ChevronDown, ChevronRight,
  AlertTriangle, AlertOctagon, AlertCircle, Info, CheckCircle2,
  XCircle, Clock, FileText, Shield, Scale, RefreshCw,
  Eye, Edit3, Link2, X, ChevronUp, FileSearch, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useResolvedParams, formatDate, formatCurrency, AREA_COLORS } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

interface Finding {
  id: string;
  project_id: string;
  external_ref: string | null;
  source_type: string;
  area_code: string;
  title: string;
  summary: string | null;
  description: string | null;
  severity: string;
  probability: string;
  timing: string | null;
  relevance_tier: number;
  tier_auto_calculated: number | null;
  status: string;
  hitl_required: boolean;
  hitl_decision: string | null;
  raw_score: number | null;
  is_deal_breaker: boolean;
  is_red_flag: boolean;
  economic_impact_amount: number | null;
  economic_impact_currency: string | null;
  mitigation_recommended: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  objective_id: string | null;
}

interface Evidence {
  id: string;
  finding_id: string;
  evidence_type: string | null;
  vdr_chunk_id: string | null;
  vdr_document_id: string | null;
  external_url: string | null;
  page_number: number | null;
  section_title: string | null;
  snippet: string | null;
  similarity_score: number | null;
  link_method: string | null;
  linked_at: string | null;
}

interface FindingDetail {
  finding: Finding;
  evidence: Evidence[];
  contingency: Record<string, unknown> | null;
  negotiation_actions: Record<string, unknown>[];
  hitl_decisions: Record<string, unknown>[];
  war_room_decisions: Record<string, unknown>[];
}

interface FindingSummary {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_tier: Record<string, number>;
  by_area: Record<string, number>;
}

type FilterSeverity = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'informational';
type FilterStatus = 'all' | 'identified' | 'under_review' | 'validated' | 'accepted' | 'mitigated' | 'resolved' | 'dismissed';
type FilterTier = 'all' | '1' | '2' | '3';

// ── Config ─────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<string, typeof AlertOctagon> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  informational: Info,
};

const SEVERITY_CONFIG: Record<string, { bg: string; fg: string }> = {
  critical: { bg: '#DC2626', fg: '#fff' },
  high: { bg: '#EA580C', fg: '#fff' },
  medium: { bg: '#CA8A04', fg: '#fff' },
  low: { bg: '#16A34A', fg: '#fff' },
  informational: { bg: '#6B7280', fg: '#fff' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  identified: { label: 'Identificado', color: '#6B7280', icon: Eye },
  under_review: { label: 'En revisión', color: '#F59E0B', icon: Clock },
  validated: { label: 'Validado', color: '#3B82F6', icon: CheckCircle2 },
  contested: { label: 'Contestado', color: '#EF4444', icon: XCircle },
  accepted: { label: 'Aceptado', color: '#10B981', icon: CheckCircle2 },
  mitigated: { label: 'Mitigado', color: '#8B5CF6', icon: Shield },
  reported: { label: 'Reportado', color: '#6366F1', icon: FileText },
  negotiated: { label: 'Negociado', color: '#EC4899', icon: Scale },
  resolved: { label: 'Resuelto', color: '#059669', icon: CheckCircle2 },
  dismissed: { label: 'Descartado', color: '#9CA3AF', icon: XCircle },
};

const TIER_CONFIG: Record<number, { label: string; color: string; description: string }> = {
  1: { label: 'Tier 1 - Decisorio', color: '#EF4444', description: 'Crítico para la decisión de inversión' },
  2: { label: 'Tier 2 - Gestión', color: '#F59E0B', description: 'Requiere gestión activa' },
  3: { label: 'Tier 3 - Registro', color: '#6B7280', description: 'Para registro y seguimiento' },
};

const AREA_NAME_MAP: Record<string, string> = {
  MERC: 'Mercantil',
  CONT: 'Contractual',
  LAB: 'Laboral',
  FISC: 'Fiscal',
  PI: 'Propiedad Intelectual',
  LIT: 'Litigios',
  ADM: 'Administrativo',
  GENERAL: 'General',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  identified: ['under_review', 'dismissed'],
  under_review: ['validated', 'contested', 'dismissed'],
  validated: ['accepted', 'contested'],
  contested: ['under_review', 'validated', 'dismissed'],
  accepted: ['mitigated', 'reported'],
  mitigated: ['reported', 'resolved'],
  reported: ['negotiated', 'resolved'],
  negotiated: ['resolved'],
  resolved: [],
  dismissed: [],
};

// ── Main Component ─────────────────────────────────────────────────

export default function ProjectFindingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = useResolvedParams(params);

  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<FindingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [findingEvidence, setFindingEvidence] = useState<Evidence[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Panels
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Get auth token
  const getAuthHeader = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_session_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Load findings
  const loadFindings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: projectId });
      params.append('include_inactive', 'true');
      if (filterSeverity !== 'all') params.append('severity', filterSeverity);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterTier !== 'all') params.append('tier', filterTier);
      if (filterArea !== 'all') params.append('area_code', filterArea);

      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/findings?${params.toString()}`, { headers: getAuthHeader() }),
        fetch(`/api/findings?project_id=${projectId}&summary=true`, { headers: getAuthHeader() }),
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setFindings(listData.data || []);
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data);
      }
    } catch (err) {
      toast.error('Error al cargar findings');
    } finally {
      setLoading(false);
    }
  }, [projectId, filterSeverity, filterStatus, filterTier, filterArea, getAuthHeader]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  // Filter findings by search term
  const filteredFindings = useMemo(() => {
    if (!searchTerm.trim()) return findings;
    const term = searchTerm.toLowerCase();
    return findings.filter(f =>
      f.title.toLowerCase().includes(term) ||
      f.description?.toLowerCase().includes(term) ||
      f.area_code.toLowerCase().includes(term)
    );
  }, [findings, searchTerm]);

  // Load finding detail
  const loadFindingDetail = useCallback(async (finding: Finding) => {
    setSelectedFinding(finding);
    setFindingEvidence([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/findings/${finding.id}`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        // API returns either FindingDetail structure or just the finding
        if (data.data?.finding) {
          // FindingDetail structure
          setSelectedFinding(data.data.finding);
          setFindingEvidence(data.data.evidence || []);
        } else {
          // Just the finding
          setSelectedFinding(data.data || finding);
          setFindingEvidence([]);
        }
      }
    } catch {
      // Keep basic finding data
    } finally {
      setDetailLoading(false);
    }
  }, [getAuthHeader]);

  // Update finding status
  const updateStatus = useCallback(async (findingId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Estado actualizado a "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
        loadFindings();
        if (selectedFinding?.id === findingId) {
          const data = await res.json();
          setSelectedFinding(data.data);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al actualizar estado');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  }, [getAuthHeader, loadFindings, selectedFinding]);

  // Update finding tier
  const updateTier = useCallback(async (findingId: string, newTier: number, justification: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ relevance_tier: newTier, tier_justification: justification }),
      });

      if (res.ok) {
        toast.success(`Tier actualizado a ${newTier}`);
        loadFindings();
        if (selectedFinding?.id === findingId) {
          const data = await res.json();
          setSelectedFinding(data.data);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al actualizar tier');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  }, [getAuthHeader, loadFindings, selectedFinding]);

  // Render severity badge
  const SeverityBadge = ({ severity }: { severity: string }) => {
    const Icon = SEVERITY_ICONS[severity] || Info;
    const config = SEVERITY_CONFIG[severity] || { bg: '#6B7280', fg: '#fff' };
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: config.bg, color: config.fg }}
      >
        <Icon size={12} />
        {severity}
      </span>
    );
  };

  // Render status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || { label: status, color: '#6B7280', icon: Info };
    const Icon = config.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  // Render tier badge
  const TierBadge = ({ tier }: { tier: number }) => {
    const config = TIER_CONFIG[tier] || TIER_CONFIG[3];
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        T{tier}
      </span>
    );
  };

  if (loading && findings.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--g-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--g-bg)] border-b border-[var(--g-border)]">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text)]"
              >
                <ArrowLeft size={16} />
                Volver
              </Link>
              <h1 className="text-xl font-semibold text-[var(--g-text)]">
                Findings
              </h1>
              {summary && (
                <span className="text-sm text-[var(--g-text-secondary)]">
                  ({summary.total} total)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showFilters
                    ? 'bg-[var(--g-brand-3308)] text-white'
                    : 'bg-[var(--g-card)] text-[var(--g-text)] hover:bg-[var(--g-hover)]'
                }`}
              >
                <Filter size={16} />
                Filtros
                {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={loadFindings}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--g-card)] text-[var(--g-text)] hover:bg-[var(--g-hover)]"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-[var(--g-card)] rounded-lg border border-[var(--g-border)]">
              <div className="grid grid-cols-5 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-xs text-[var(--g-text-secondary)] mb-1">Buscar</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Título, descripción..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--g-border)] bg-[var(--g-bg)] text-sm"
                  />
                </div>
                {/* Severity */}
                <div>
                  <label className="block text-xs text-[var(--g-text-secondary)] mb-1">Severidad</label>
                  <select
                    value={filterSeverity}
                    onChange={e => setFilterSeverity(e.target.value as FilterSeverity)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--g-border)] bg-[var(--g-bg)] text-sm"
                  >
                    <option value="all">Todas</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label className="block text-xs text-[var(--g-text-secondary)] mb-1">Estado</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--g-border)] bg-[var(--g-bg)] text-sm"
                  >
                    <option value="all">Todos</option>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                {/* Tier */}
                <div>
                  <label className="block text-xs text-[var(--g-text-secondary)] mb-1">Tier</label>
                  <select
                    value={filterTier}
                    onChange={e => setFilterTier(e.target.value as FilterTier)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--g-border)] bg-[var(--g-bg)] text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="1">Tier 1 - Decisorio</option>
                    <option value="2">Tier 2 - Gestión</option>
                    <option value="3">Tier 3 - Registro</option>
                  </select>
                </div>
                {/* Area */}
                <div>
                  <label className="block text-xs text-[var(--g-text-secondary)] mb-1">Área</label>
                  <select
                    value={filterArea}
                    onChange={e => setFilterArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--g-border)] bg-[var(--g-bg)] text-sm"
                  >
                    <option value="all">Todas</option>
                    {Object.entries(AREA_NAME_MAP).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="mt-4 grid grid-cols-5 gap-4">
              {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
                <div
                  key={sev}
                  className="p-3 rounded-lg border border-[var(--g-border)] bg-[var(--g-card)]"
                  style={{ borderLeftWidth: 4, borderLeftColor: SEVERITY_CONFIG[sev]?.bg }}
                >
                  <div className="text-2xl font-bold" style={{ color: SEVERITY_CONFIG[sev]?.bg }}>
                    {summary.by_severity?.[sev] || 0}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)] capitalize">{sev}</div>
                </div>
              ))}
              <div className="p-3 rounded-lg border border-[var(--g-border)] bg-[var(--g-card)]">
                <div className="text-2xl font-bold text-[var(--g-text)]">{summary.total}</div>
                <div className="text-xs text-[var(--g-text-secondary)]">Total</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Findings List */}
          <div className={`flex-1 ${selectedFinding ? 'max-w-[60%]' : ''}`}>
            <div className="bg-[var(--g-card)] rounded-lg border border-[var(--g-border)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--g-hover)] text-left text-xs text-[var(--g-text-secondary)]">
                    <th className="px-4 py-3 font-medium">Severidad</th>
                    <th className="px-4 py-3 font-medium">Título</th>
                    <th className="px-4 py-3 font-medium">Área</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map(finding => (
                    <tr
                      key={finding.id}
                      onClick={() => loadFindingDetail(finding)}
                      className={`border-t border-[var(--g-border)] cursor-pointer transition-colors ${
                        selectedFinding?.id === finding.id
                          ? 'bg-[var(--g-brand-3308)]10'
                          : 'hover:bg-[var(--g-hover)]'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm text-[var(--g-text)] line-clamp-1">
                          {finding.title}
                        </div>
                        {finding.summary ? (
                          <div className="text-xs text-[var(--g-text-secondary)] mt-0.5 line-clamp-2">
                            {finding.summary}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--g-text-secondary)] mt-0.5 italic">
                            Resumen Harvey en generación
                          </div>
                        )}
                        {finding.is_deal_breaker && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700">
                            <AlertOctagon size={10} />
                            Deal Breaker
                          </span>
                        )}
                        {!finding.is_active && (
                          <span className="inline-flex items-center gap-1 mt-1 ml-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-700">
                            Archivado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: `${AREA_COLORS[finding.area_code] || '#6B7280'}20`,
                            color: AREA_COLORS[finding.area_code] || '#6B7280',
                          }}
                        >
                          {finding.area_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={finding.relevance_tier} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={finding.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                        {formatDate(finding.created_at)}
                      </td>
                    </tr>
                  ))}
                  {filteredFindings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--g-text-secondary)]">
                        No se encontraron findings con los filtros actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedFinding && (
            <div className="w-[40%] max-w-[500px]">
              <div className="sticky top-32 bg-[var(--g-card)] rounded-lg border border-[var(--g-border)] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-[var(--g-border)] bg-[var(--g-hover)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={selectedFinding.severity} />
                        <TierBadge tier={selectedFinding.relevance_tier} />
                        <StatusBadge status={selectedFinding.status} />
                      </div>
                      <h3 className="font-semibold text-[var(--g-text)]">
                        {selectedFinding.title}
                      </h3>
                      {selectedFinding.summary ? (
                        <p className="mt-2 text-sm text-[var(--g-text-secondary)] italic">
                          {selectedFinding.summary}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--g-text-secondary)] italic">
                          Resumen Harvey en generación
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedFinding(null)}
                      className="p-1 rounded hover:bg-[var(--g-border)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {detailLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : (
                  <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {/* Description */}
                    {selectedFinding.description && (
                      <div>
                        <h4 className="text-xs font-medium text-[var(--g-text-secondary)] mb-1">Descripción</h4>
                        <p className="text-sm text-[var(--g-text)]">{selectedFinding.description}</p>
                      </div>
                    )}

                    {/* Mitigation */}
                    {selectedFinding.mitigation_recommended && (
                      <div>
                        <h4 className="text-xs font-medium text-[var(--g-text-secondary)] mb-1">Mitigación Recomendada</h4>
                        <p className="text-sm text-[var(--g-text)]">{selectedFinding.mitigation_recommended}</p>
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-[var(--g-bg)] rounded-lg">
                        <div className="text-xs text-[var(--g-text-secondary)]">Área</div>
                        <div className="font-medium">{AREA_NAME_MAP[selectedFinding.area_code] || selectedFinding.area_code}</div>
                      </div>
                      <div className="p-3 bg-[var(--g-bg)] rounded-lg">
                        <div className="text-xs text-[var(--g-text-secondary)]">Probabilidad</div>
                        <div className="font-medium capitalize">{selectedFinding.probability}</div>
                      </div>
                      <div className="p-3 bg-[var(--g-bg)] rounded-lg">
                        <div className="text-xs text-[var(--g-text-secondary)]">Timing</div>
                        <div className="font-medium">{selectedFinding.timing || 'N/A'}</div>
                      </div>
                      <div className="p-3 bg-[var(--g-bg)] rounded-lg">
                        <div className="text-xs text-[var(--g-text-secondary)]">Score</div>
                        <div className="font-medium">{selectedFinding.raw_score?.toFixed(2) || 'N/A'}</div>
                      </div>
                      {selectedFinding.economic_impact_amount && (
                        <div className="p-3 bg-[var(--g-bg)] rounded-lg col-span-2">
                          <div className="text-xs text-[var(--g-text-secondary)]">Impacto Económico</div>
                          <div className="font-medium text-lg">
                            {formatCurrency(
                              selectedFinding.economic_impact_amount,
                              selectedFinding.economic_impact_currency || 'EUR',
                              { maximumFractionDigits: 2 } // Maintain default precision behavior (by overriding `utils.ts`'s 0 to 2, or whatever original behavior was)
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Flags */}
                    <div className="flex gap-2">
                      {selectedFinding.is_deal_breaker && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-100 text-red-700">
                          <AlertOctagon size={12} />
                          Deal Breaker
                        </span>
                      )}
                      {selectedFinding.is_red_flag && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">
                          <AlertTriangle size={12} />
                          Red Flag
                        </span>
                      )}
                      {selectedFinding.hitl_required && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                          <Eye size={12} />
                          HITL Requerido
                        </span>
                      )}
                      {!selectedFinding.is_active && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-200 text-gray-700">
                          Archivado
                        </span>
                      )}
                    </div>

                    {/* Evidence */}
                    {findingEvidence.length > 0 && (
                      <div className="pt-4 border-t border-[var(--g-border)]">
                        <h4 className="text-xs font-medium text-[var(--g-text-secondary)] mb-3 flex items-center gap-2">
                          <FileSearch size={14} />
                          Evidencia ({findingEvidence.length})
                        </h4>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {findingEvidence.map((evidence) => (
                            <div
                              key={evidence.id}
                              className="p-3 bg-[var(--g-bg)] rounded-lg border border-[var(--g-border)]"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  {evidence.section_title && (
                                    <div className="text-xs font-medium text-[var(--g-text)] truncate">
                                      {evidence.section_title}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-[var(--g-text-secondary)] flex items-center gap-2">
                                    {evidence.evidence_type && (
                                      <span className="px-1.5 py-0.5 bg-[var(--g-hover)] rounded">
                                        {evidence.evidence_type}
                                      </span>
                                    )}
                                    {evidence.page_number && (
                                      <span>Pág. {evidence.page_number}</span>
                                    )}
                                    {evidence.similarity_score && (
                                      <span title="Relevancia">
                                        {(evidence.similarity_score * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {evidence.vdr_document_id && (
                                    <Link
                                      href={`/projects/${projectId}/vdr?doc=${evidence.vdr_document_id}${evidence.page_number ? `&page=${evidence.page_number}` : ''}`}
                                      className="p-1 rounded hover:bg-[var(--g-hover)]"
                                      title="Ver documento fuente"
                                    >
                                      <ExternalLink size={12} />
                                    </Link>
                                  )}
                                  {evidence.external_url && (
                                    <a
                                      href={evidence.external_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-[var(--g-hover)]"
                                      title="Ver fuente externa"
                                    >
                                      <Link2 size={12} />
                                    </a>
                                  )}
                                </div>
                              </div>
                              {evidence.snippet && (
                                <div className="text-xs text-[var(--g-text)] bg-[var(--g-card)] p-2 rounded border-l-2 border-[var(--g-brand-3308)] line-clamp-3">
                                  "{evidence.snippet}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t border-[var(--g-border)]">
                      <h4 className="text-xs font-medium text-[var(--g-text-secondary)] mb-3">Acciones</h4>
                      {!selectedFinding.is_active ? (
                        <div className="text-xs text-[var(--g-text-secondary)]">
                          Finding archivado. Solo lectura para mantener trazabilidad histórica.
                        </div>
                      ) : (
                        <>
                          {/* Status Transitions */}
                          <div className="mb-3">
                            <div className="text-xs text-[var(--g-text-secondary)] mb-2">Cambiar Estado</div>
                            <div className="flex flex-wrap gap-2">
                              {VALID_TRANSITIONS[selectedFinding.status]?.map(nextStatus => (
                                <button
                                  key={nextStatus}
                                  onClick={() => updateStatus(selectedFinding.id, nextStatus)}
                                  disabled={actionLoading}
                                  className="px-3 py-1.5 rounded text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                                  style={{
                                    backgroundColor: `${STATUS_CONFIG[nextStatus]?.color}20`,
                                    color: STATUS_CONFIG[nextStatus]?.color,
                                  }}
                                >
                                  → {STATUS_CONFIG[nextStatus]?.label}
                                </button>
                              ))}
                              {(!VALID_TRANSITIONS[selectedFinding.status] || VALID_TRANSITIONS[selectedFinding.status].length === 0) && (
                                <span className="text-xs text-[var(--g-text-secondary)]">Estado final - sin transiciones disponibles</span>
                              )}
                            </div>
                          </div>

                          {/* Tier Override */}
                          <div>
                            <div className="text-xs text-[var(--g-text-secondary)] mb-2">Cambiar Tier</div>
                            <div className="flex gap-2">
                              {[1, 2, 3].map(tier => (
                                <button
                                  key={tier}
                                  onClick={() => {
                                    const justification = prompt(`Justificación para cambiar a Tier ${tier}:`);
                                    if (justification) {
                                      updateTier(selectedFinding.id, tier, justification);
                                    }
                                  }}
                                  disabled={actionLoading || selectedFinding.relevance_tier === tier}
                                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                                    selectedFinding.relevance_tier === tier
                                      ? 'bg-[var(--g-brand-3308)] text-white'
                                      : 'bg-[var(--g-bg)] hover:bg-[var(--g-hover)]'
                                  }`}
                                >
                                  Tier {tier}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Source Info */}
                    <div className="pt-4 border-t border-[var(--g-border)] text-xs text-[var(--g-text-secondary)]">
                      <div>Fuente: {selectedFinding.source_type}</div>
                      <div>Creado: {formatDate(selectedFinding.created_at)}</div>
                      <div>Actualizado: {formatDate(selectedFinding.updated_at)}</div>
                      {selectedFinding.external_ref && (
                        <div className="mt-1 font-mono text-[10px] break-all">
                          Ref: {selectedFinding.external_ref}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
