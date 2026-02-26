'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Settings2, RefreshCw, Plus, Archive, Save } from 'lucide-react';

type TabKey = 'catalog' | 'project';

interface Project {
  id: string;
  name: string;
  status?: string;
}

interface FindingObjective {
  id: string;
  objective_key: string;
  title: string;
  area_code: string;
  severity_if_positive: string;
  is_active: boolean;
}

interface Finding {
  id: string;
  title: string;
  summary: string | null;
  area_code: string;
  severity: string;
  probability: string;
  status: string;
  is_active: boolean;
}

interface ObjectiveFormState {
  objective_key: string;
  title: string;
  area_code: string;
  severity_if_positive: string;
}

interface FindingFormState {
  area_code: string;
  title: string;
  summary: string;
  severity: string;
  probability: string;
}

const AREA_OPTIONS = ['MERC', 'CONT', 'LAB', 'FISC', 'PI', 'LIT', 'ADM', 'GENERAL'];
const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'informational'];
const PROBABILITY_OPTIONS = ['certain', 'alta', 'probable', 'media', 'possible', 'baja', 'remote'];

export default function FindingsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [objectives, setObjectives] = useState<FindingObjective[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);

  const [objectiveForm, setObjectiveForm] = useState<ObjectiveFormState>({
    objective_key: '',
    title: '',
    area_code: 'GENERAL',
    severity_if_positive: 'medium',
  });

  const [findingForm, setFindingForm] = useState<FindingFormState>({
    area_code: 'GENERAL',
    title: '',
    summary: '',
    severity: 'medium',
    probability: 'possible',
  });

  const [editingObjective, setEditingObjective] = useState<FindingObjective | null>(null);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_session_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const canLoadFindings = useMemo(() => !!selectedProjectId, [selectedProjectId]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const projectIsClosed = selectedProject?.status === 'closed';

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects', { headers: authHeaders() });
    if (!res.ok) {
      throw new Error('No se pudieron cargar proyectos');
    }
    const json = await res.json();
    const rows = (json.data || []) as Project[];
    setProjects(rows);
    if (!selectedProjectId && rows.length > 0) {
      setSelectedProjectId(rows[0].id);
    }
  }, [authHeaders, selectedProjectId]);

  const loadObjectives = useCallback(async () => {
    const res = await fetch('/api/finding-objectives?include_inactive=true', { headers: authHeaders() });
    if (!res.ok) {
      throw new Error('No se pudo cargar el catálogo de findings');
    }
    const json = await res.json();
    setObjectives(json.objectives || []);
  }, [authHeaders]);

  const loadFindings = useCallback(async () => {
    if (!selectedProjectId) return;
    const res = await fetch(`/api/findings?project_id=${selectedProjectId}&include_inactive=true`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      throw new Error('No se pudieron cargar findings');
    }
    const json = await res.json();
    setFindings(json.data || []);
  }, [authHeaders, selectedProjectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadProjects(), loadObjectives()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de carga';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loadObjectives, loadProjects]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (canLoadFindings) {
      loadFindings().catch(() => {
        toast.error('No se pudieron cargar findings');
      });
    }
  }, [canLoadFindings, loadFindings]);

  const handleCreateObjective = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/finding-objectives', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective_key: objectiveForm.objective_key.trim(),
          version: '1.0',
          title: objectiveForm.title.trim(),
          area_code: objectiveForm.area_code,
          severity_if_positive: objectiveForm.severity_if_positive,
          evaluation_criteria: [],
          data_required: [],
          deal_types: [],
          jurisdictions: [],
          is_active: true,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo crear el objetivo');
      }

      toast.success('Objetivo creado');
      setObjectiveForm({
        objective_key: '',
        title: '',
        area_code: 'GENERAL',
        severity_if_positive: 'medium',
      });
      await loadObjectives();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear objetivo');
    }
  };

  const handleUpdateObjective = async (objective: FindingObjective) => {
    try {
      const res = await fetch('/api/finding-objectives', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: objective.id,
          title: objective.title,
          area_code: objective.area_code,
          severity_if_positive: objective.severity_if_positive,
          is_active: objective.is_active,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo actualizar el objetivo');
      }

      toast.success('Objetivo actualizado');
      setEditingObjective(null);
      await loadObjectives();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar objetivo');
    }
  };

  const handleArchiveObjective = async (objectiveId: string) => {
    try {
      const res = await fetch('/api/finding-objectives', {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: objectiveId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo desactivar el objetivo');
      }

      toast.success('Objetivo desactivado');
      await loadObjectives();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al desactivar objetivo');
    }
  };

  const handleCreateFinding = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error('Selecciona un proyecto');
      return;
    }

    try {
      const res = await fetch('/api/findings', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          area_code: findingForm.area_code,
          title: findingForm.title.trim(),
          summary: findingForm.summary.trim() || null,
          severity: findingForm.severity,
          probability: findingForm.probability,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo crear el finding');
      }

      toast.success('Finding creado');
      setFindingForm({
        area_code: 'GENERAL',
        title: '',
        summary: '',
        severity: 'medium',
        probability: 'possible',
      });
      await loadFindings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear finding');
    }
  };

  const handleUpdateFinding = async (finding: Finding) => {
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finding.title,
          summary: finding.summary,
          area_code: finding.area_code,
          severity: finding.severity,
          probability: finding.probability,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo actualizar el finding');
      }

      toast.success('Finding actualizado');
      setEditingFinding(null);
      await loadFindings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar finding');
    }
  };

  const handleArchiveFinding = async (findingId: string) => {
    if (!projectIsClosed) {
      toast.error('Los findings solo pueden darse de baja cuando el proyecto está cerrado');
      return;
    }

    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive_reason: 'Archived from findings admin console' }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo archivar el finding');
      }

      toast.success('Finding archivado');
      await loadFindings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al archivar finding');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
          <Settings2 size={22} style={{ color: 'var(--g-brand-3308)' }} />
          <div>
            <h1 style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>Administración de Findings</h1>
            <p style={{ color: 'var(--g-text-secondary)' }}>ABM de catálogo FO y findings operativos por proyecto</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Recargar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
        <button
          onClick={() => setActiveTab('catalog')}
          className="px-4 py-2 rounded-lg"
          style={{
            backgroundColor: activeTab === 'catalog' ? 'var(--g-brand-3308)' : 'var(--g-surface-subtle)',
            color: activeTab === 'catalog' ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
          }}
        >
          Catálogo de Findings
        </button>
        <button
          onClick={() => setActiveTab('project')}
          className="px-4 py-2 rounded-lg"
          style={{
            backgroundColor: activeTab === 'project' ? 'var(--g-brand-3308)' : 'var(--g-surface-subtle)',
            color: activeTab === 'project' ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
          }}
        >
          Findings por Proyecto
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--g-space-4)' }}>
          <form className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }} onSubmit={handleCreateObjective}>
            <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>Alta FO</h2>
            <input
              value={objectiveForm.objective_key}
              onChange={(e) => setObjectiveForm(prev => ({ ...prev, objective_key: e.target.value }))}
              placeholder="FO-MERC-999"
              className="px-3 py-2 rounded-lg border"
            />
            <input
              value={objectiveForm.title}
              onChange={(e) => setObjectiveForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título del objetivo"
              className="px-3 py-2 rounded-lg border"
            />
            <select
              value={objectiveForm.area_code}
              onChange={(e) => setObjectiveForm(prev => ({ ...prev, area_code: e.target.value }))}
              className="px-3 py-2 rounded-lg border"
            >
              {AREA_OPTIONS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
            <select
              value={objectiveForm.severity_if_positive}
              onChange={(e) => setObjectiveForm(prev => ({ ...prev, severity_if_positive: e.target.value }))}
              className="px-3 py-2 rounded-lg border"
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>{severity}</option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
            >
              <Plus size={14} />
              Crear objetivo
            </button>
          </form>

          <div className="g-card" style={{ padding: 'var(--g-space-4)' }}>
            <h2 style={{ fontSize: 'var(--g-text-h3)', marginBottom: 'var(--g-space-3)', color: 'var(--g-text-primary)' }}>
              Catálogo ({objectives.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
              {objectives.map((objective) => {
                const isEditing = editingObjective?.id === objective.id;
                const row = isEditing ? editingObjective : objective;
                return (
                  <div key={objective.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--g-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 120px 120px auto', gap: 'var(--g-space-2)', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{objective.objective_key}</div>
                      <input
                        value={row?.title || ''}
                        onChange={(e) => setEditingObjective(prev => ({ ...(prev || objective), title: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      />
                      <select
                        value={row?.area_code || objective.area_code}
                        onChange={(e) => setEditingObjective(prev => ({ ...(prev || objective), area_code: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      >
                        {AREA_OPTIONS.map((area) => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                      <select
                        value={row?.severity_if_positive || objective.severity_if_positive}
                        onChange={(e) => setEditingObjective(prev => ({ ...(prev || objective), severity_if_positive: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      >
                        {SEVERITY_OPTIONS.map((severity) => (
                          <option key={severity} value={severity}>{severity}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-1)' }}>
                        {isEditing ? (
                          <button
                            onClick={() => handleUpdateObjective(row as FindingObjective)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded"
                            style={{ backgroundColor: 'var(--status-success)', color: 'var(--g-text-inverse)' }}
                          >
                            <Save size={12} />
                            Guardar
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingObjective(objective)}
                            className="px-2 py-1 rounded border"
                          >
                            Editar
                          </button>
                        )}
                        {objective.is_active && (
                          <button
                            onClick={() => handleArchiveObjective(objective.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded"
                            style={{ backgroundColor: 'var(--status-warning)', color: 'var(--g-text-inverse)' }}
                          >
                            <Archive size={12} />
                            Baja
                          </button>
                        )}
                      </div>
                    </div>
                    {!objective.is_active && (
                      <p style={{ marginTop: 'var(--g-space-2)', color: 'var(--status-warning)' }}>Objetivo inactivo</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'project' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--g-space-4)' }}>
          <form className="g-card" style={{ padding: 'var(--g-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }} onSubmit={handleCreateFinding}>
            <h2 style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>Alta manual de finding</h2>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 rounded-lg border"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}{project.status ? ` (${project.status})` : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 'var(--g-text-caption)', color: 'var(--g-text-secondary)' }}>
              Baja lógica de findings habilitada solo en proyectos con estado <strong>closed</strong>.
            </p>
            <select
              value={findingForm.area_code}
              onChange={(e) => setFindingForm(prev => ({ ...prev, area_code: e.target.value }))}
              className="px-3 py-2 rounded-lg border"
            >
              {AREA_OPTIONS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
            <input
              value={findingForm.title}
              onChange={(e) => setFindingForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título del finding"
              className="px-3 py-2 rounded-lg border"
            />
            <textarea
              value={findingForm.summary}
              onChange={(e) => setFindingForm(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Resumen (opcional)"
              className="px-3 py-2 rounded-lg border min-h-[88px]"
            />
            <select
              value={findingForm.severity}
              onChange={(e) => setFindingForm(prev => ({ ...prev, severity: e.target.value }))}
              className="px-3 py-2 rounded-lg border"
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>{severity}</option>
              ))}
            </select>
            <select
              value={findingForm.probability}
              onChange={(e) => setFindingForm(prev => ({ ...prev, probability: e.target.value }))}
              className="px-3 py-2 rounded-lg border"
            >
              {PROBABILITY_OPTIONS.map((probability) => (
                <option key={probability} value={probability}>{probability}</option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
            >
              <Plus size={14} />
              Crear finding
            </button>
          </form>

          <div className="g-card" style={{ padding: 'var(--g-space-4)' }}>
            <h2 style={{ fontSize: 'var(--g-text-h3)', marginBottom: 'var(--g-space-3)', color: 'var(--g-text-primary)' }}>
              Findings ({findings.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
              {findings.map((finding) => {
                const isEditing = editingFinding?.id === finding.id;
                const row = isEditing ? editingFinding : finding;
                return (
                  <div key={finding.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--g-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 120px auto', gap: 'var(--g-space-2)', alignItems: 'center' }}>
                      <input
                        value={row?.title || ''}
                        onChange={(e) => setEditingFinding(prev => ({ ...(prev || finding), title: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      />
                      <select
                        value={row?.area_code || finding.area_code}
                        onChange={(e) => setEditingFinding(prev => ({ ...(prev || finding), area_code: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      >
                        {AREA_OPTIONS.map((area) => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                      <select
                        value={row?.severity || finding.severity}
                        onChange={(e) => setEditingFinding(prev => ({ ...(prev || finding), severity: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      >
                        {SEVERITY_OPTIONS.map((severity) => (
                          <option key={severity} value={severity}>{severity}</option>
                        ))}
                      </select>
                      <select
                        value={row?.probability || finding.probability}
                        onChange={(e) => setEditingFinding(prev => ({ ...(prev || finding), probability: e.target.value }))}
                        className="px-2 py-1 rounded border"
                        disabled={!isEditing}
                      >
                        {PROBABILITY_OPTIONS.map((probability) => (
                          <option key={probability} value={probability}>{probability}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--g-space-1)' }}>
                        {isEditing ? (
                          <button
                            onClick={() => handleUpdateFinding(row as Finding)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded"
                            style={{ backgroundColor: 'var(--status-success)', color: 'var(--g-text-inverse)' }}
                          >
                            <Save size={12} />
                            Guardar
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingFinding(finding)}
                            className="px-2 py-1 rounded border"
                          >
                            Editar
                          </button>
                        )}
                        {finding.is_active && (
                          <button
                            onClick={() => handleArchiveFinding(finding.id)}
                            disabled={!projectIsClosed}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded"
                            style={{
                              backgroundColor: projectIsClosed ? 'var(--status-warning)' : 'var(--g-surface-muted)',
                              color: projectIsClosed ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                              cursor: projectIsClosed ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <Archive size={12} />
                            Baja
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ marginTop: 'var(--g-space-2)', color: 'var(--g-text-secondary)' }}>
                      Estado: {finding.status} · {finding.is_active ? 'activo' : 'inactivo'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
