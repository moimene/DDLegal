'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Bot, ClipboardList, AlertTriangle,
    FileText, MessageSquare, CheckCircle2,
    Loader2, ListChecks, Sparkles, ChevronDown,
    ChevronUp, Zap, FileSearch, Brain,
    Upload, FolderOpen, ChevronRight, X, ShieldCheck, Users, Activity,
    Swords, Target, GitBranch
} from 'lucide-react';
import { EventFeed } from '@/components/events';
import { SmartSuggestions } from '@/components/events';
import { supabase } from '@/lib/supabase';
import type { DDProject, DDArea, DDProcess, DDTask, DDContingency, DDQA, DDDeliverable, DDSkill, DDDocument } from '@/lib/supabase';
import { cn, STATUS_CONFIG, SEVERITY_CONFIG, SKILL_CATEGORY_CONFIG, REVIEW_DEPTH_CONFIG, ROLE_CONFIG, formatDate, formatCurrency, useResolvedParams } from '@/lib/utils';

const PROJECT_STATUS_CONFIG: Record<DDProject['status'], { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    active: { label: 'Activo', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    review: { label: 'En revisión', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    closed: { label: 'Cerrado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
};

const AI_STATUS_CONFIG: Record<DDTask['ai_status'], { label: string; bg: string; fg: string }> = {
    none: { label: 'No ejecutado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    running: { label: 'Ejecutando', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    completed: { label: 'Completado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
};

const DELIVERABLE_STATUS_CONFIG: Record<DDDeliverable['status'], { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    review: { label: 'En revisión', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    approved: { label: 'Aprobado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    final: { label: 'Final', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
};

function getAiSummary(output: Record<string, unknown> | null): string {
    if (!output) return 'Sin salida IA registrada todavía.';
    const maybeOutput = output.output;
    if (maybeOutput && typeof maybeOutput === 'object') {
        const summary = (maybeOutput as Record<string, unknown>).summary;
        if (typeof summary === 'string' && summary.trim().length > 0) {
            return summary;
        }
    }
    const message = output.message;
    if (typeof message === 'string' && message.trim().length > 0) {
        return message;
    }
    try {
        return JSON.stringify(output).slice(0, 220);
    } catch {
        return 'No se pudo procesar el detalle del resultado IA.';
    }
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);
    const [project, setProject] = useState<DDProject | null>(null);
    const [areas, setAreas] = useState<DDArea[]>([]);
    const [processes, setProcesses] = useState<DDProcess[]>([]);
    const [tasks, setTasks] = useState<DDTask[]>([]);
    const [contingencies, setContingencies] = useState<DDContingency[]>([]);
    const [qas, setQas] = useState<DDQA[]>([]);
    const [deliverables, setDeliverables] = useState<DDDeliverable[]>([]);
    const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [aiRunning, setAiRunning] = useState<string | null>(null);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
    const [skills, setSkills] = useState<DDSkill[]>([]);
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
    const [expandedArea, setExpandedArea] = useState<string | null>(null);
    const [skillOutput, setSkillOutput] = useState<Record<string, unknown> | null>(null);
    const [teamRoles, setTeamRoles] = useState<Array<{id: string; user_id: string; role: string; area_code: string | null; is_active: boolean; granted_at: string}>>([]);

    // Data Room state
    interface ExpectedDoc { id: string; area_code: string; category: string; name: string; description: string | null; is_mandatory: boolean; sort_order: number; }
    interface DocStats { total_uploaded: number; total_expected: number; gaps_count: number; coverage_pct: number; }
    const [ddDocuments, setDdDocuments] = useState<DDDocument[]>([]);
    const [expectedDocs, setExpectedDocs] = useState<ExpectedDoc[]>([]);
    const [docGaps, setDocGaps] = useState<ExpectedDoc[]>([]);
    const [docStats, setDocStats] = useState<DocStats>({ total_uploaded: 0, total_expected: 0, gaps_count: 0, coverage_pct: 100 });
    const [docUploading, setDocUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [showGaps, setShowGaps] = useState(false);
    const [docFormName, setDocFormName] = useState('');
    const [docFormArea, setDocFormArea] = useState('');
    const [docFormCategory, setDocFormCategory] = useState('general');
    const [docFormFile, setDocFormFile] = useState<File | null>(null);

    const fetchDocuments = async () => {
        try {
            const res = await fetch(`/api/documents?project_id=${id}`);
            const json = await res.json();
            if (json.success) {
                setDdDocuments(json.documents);
                setExpectedDocs(json.expected);
                setDocGaps(json.gaps);
                setDocStats(json.stats);
            }
        } catch (err) {
            console.error('Error fetching documents:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'documents') {
            fetchDocuments();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, id]);

    useEffect(() => {
        if (activeTab === 'team') {
            fetch(`/api/projects/${id}/roles`)
                .then(r => r.json())
                .then(data => setTeamRoles(data.roles || []))
                .catch(err => console.error('Error fetching team:', err));
        }
    }, [activeTab, id]);

    const handleDocUpload = async () => {
        if (!docFormName || !docFormFile) return;
        setDocUploading(true);
        const ext = docFormFile.name.split('.').pop() || 'bin';
        try {
            await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: id,
                    area_code: docFormArea || null,
                    name: docFormName,
                    original_filename: docFormFile.name,
                    file_type: ext,
                    file_size_bytes: docFormFile.size,
                    storage_path: `projects/${id}/${Date.now()}_${docFormFile.name}`,
                    category: docFormCategory,
                }),
            });
            setDocFormName('');
            setDocFormArea('');
            setDocFormCategory('general');
            setDocFormFile(null);
            setShowUploadForm(false);
            await fetchDocuments();
        } catch (err) {
            console.error('Error uploading document:', err);
        }
        setDocUploading(false);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const DOC_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
        uploaded: { label: 'Subido', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
        processing: { label: 'Procesando', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
        indexed: { label: 'Indexado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
        error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    };

    const CATEGORY_LABELS: Record<string, string> = {
        contrato: 'Contrato', escritura: 'Escritura', estatutos: 'Estatutos',
        cuentas_anuales: 'Cuentas anuales', nomina: 'Nómina', poliza: 'Póliza',
        licencia: 'Licencia', sentencia: 'Sentencia', informe: 'Informe',
        certificado: 'Certificado', convenio: 'Convenio', acta: 'Acta',
        poder: 'Poder', registro: 'Registro', general: 'General',
    };

    const areaByCode = useMemo(() => new Map(areas.map(a => [a.code, a])), [areas]);
    const processById = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes]);
    const areaById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);

    useEffect(() => {
        async function load() {
            const [pRes, aRes, prRes, tRes, cRes, qaRes, dRes] = await Promise.all([
                supabase.from('dd_projects').select('*').eq('id', id).single(),
                supabase.from('dd_areas').select('*').order('sort_order'),
                supabase.from('dd_processes').select('*').order('sort_order'),
                supabase.from('dd_tasks').select('*').eq('project_id', id).order('created_at'),
                supabase.from('dd_contingencies').select('*').eq('project_id', id).order('severity'),
                supabase.from('dd_qa').select('*').eq('project_id', id).order('created_at', { ascending: false }),
                supabase.from('dd_deliverables').select('*').eq('project_id', id).order('created_at', { ascending: false }),
            ]);

            const skillsRes = await supabase
                .from('dd_skills_catalog')
                .select('*')
                .eq('is_active', true)
                .order('area_code, skill_key');

            const warnings: string[] = [];
            if (qaRes.error) {
                warnings.push('No se pudo cargar la pestaña Q&A (tabla dd_qa no disponible o sin permisos).');
            }
            if (dRes.error) {
                warnings.push('No se pudo cargar la pestaña Documentos (tabla dd_deliverables no disponible o sin permisos).');
            }

            setProject(pRes.data);
            setAreas(aRes.data || []);
            setProcesses(prRes.data || []);
            setTasks(tRes.data || []);
            setContingencies(cRes.data || []);
            setQas(qaRes.data || []);
            setDeliverables(dRes.data || []);
            setSkills(skillsRes.data || []);
            setLoadWarnings(warnings);
            setLoading(false);
        }
        load();
    }, [id]);

    const refreshTasks = async () => {
        const { data } = await supabase.from('dd_tasks').select('*').eq('project_id', id).order('created_at');
        setTasks(data || []);
    };

    const invokeHarvey = async (processId: string, skillKey?: string) => {
        setAiRunning(processId);
        try {
            const proc = processes.find(p => p.id === processId);
            const skill = skillKey ? skills.find(s => s.skill_key === skillKey) : null;

            await fetch('/api/harvey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: id,
                    process_id: processId,
                    prompt: skill?.prompt_template || proc?.harvey_prompt,
                    skill_key: skillKey || null,
                    target_company: project?.target_company,
                    sector: project?.target_sector,
                }),
            });
            await refreshTasks();
        } catch (err) {
            console.error('Harvey invocation error:', err);
        }
        setAiRunning(null);
    };

    const updateTaskStatus = async (taskId: string, status: DDTask['status']) => {
        setStatusUpdating(taskId);
        const { error } = await supabase
            .from('dd_tasks')
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', taskId);

        if (!error) {
            setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));
        }
        setStatusUpdating(null);
    };

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: ClipboardList },
        { id: 'tasks', label: 'Tareas', icon: CheckCircle2 },
        { id: 'contingencies', label: 'Contingencias', icon: AlertTriangle },
        { id: 'documents', label: 'Documentos', icon: FileText },
        { id: 'qa', label: 'Q&A', icon: MessageSquare },
        { id: 'team', label: 'Equipo', icon: Users },
        { id: 'events', label: 'Eventos', icon: Activity },
        { id: 'suggestions', label: 'IA Insights', icon: Sparkles },
    ];

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-40 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
                <div className="skeleton h-64 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    if (!project) return <div>Proyecto no encontrado</div>;

    const tasksByArea = areas.map(area => ({
        area,
        tasks: tasks.filter(t => t.area_id === area.id),
        processes: processes.filter(p => p.area_id === area.id),
    }));

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const hitlQueueCount = tasks.filter(
        t => t.status === 'review' || (t.ai_status === 'completed' && t.status !== 'completed')
    ).length;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--g-link)' }}
                    >
                        <ArrowLeft className="h-4 w-4" /> Proyectos
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        {project.name}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        {project.target_company} · {project.deal_type} · {project.target_sector || 'Sin sector'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/client/projects/${id}`}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-sec-100)',
                            color: 'var(--g-brand-3308)',
                        }}
                    >
                        Portal cliente
                    </Link>
                    {project.review_depth && (
                        <span
                            className="inline-flex items-center px-3 py-1 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: REVIEW_DEPTH_CONFIG[project.review_depth]?.color + '20',
                                color: REVIEW_DEPTH_CONFIG[project.review_depth]?.color,
                                border: `1px solid ${REVIEW_DEPTH_CONFIG[project.review_depth]?.color}40`,
                            }}
                        >
                            {REVIEW_DEPTH_CONFIG[project.review_depth]?.labelEs || project.review_depth}
                        </span>
                    )}
                    <span
                        className="inline-flex items-center px-3 py-1 text-sm font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-full)',
                            backgroundColor: PROJECT_STATUS_CONFIG[project.status].bg,
                            color: PROJECT_STATUS_CONFIG[project.status].fg,
                        }}
                    >
                        {PROJECT_STATUS_CONFIG[project.status].label}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div
                className="p-5 border"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderColor: 'var(--g-border-default)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-card)',
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        Progreso General
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--g-brand-3308)' }}>
                        {progressPct}% ({completedTasks}/{totalTasks})
                    </span>
                </div>
                <div className="h-2 w-full overflow-hidden" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-full)' }}>
                    <div
                        className="h-full transition-all"
                        style={{
                            width: `${progressPct}%`,
                            backgroundColor: 'var(--g-brand-3308)',
                            borderRadius: 'var(--g-radius-full)',
                            transition: 'width var(--g-transition-smooth)',
                        }}
                    />
                </div>
                <div className="grid grid-cols-5 gap-3 mt-4">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const count = tasks.filter(t => t.status === key).length;
                        return (
                            <div key={key} className="text-center">
                                <p className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>{count}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{cfg.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b" style={{ borderColor: 'var(--g-border-subtle)' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2',
                            activeTab === tab.id ? 'border-current' : 'border-transparent opacity-60 hover:opacity-80'
                        )}
                        style={{
                            color: activeTab === tab.id ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                        }}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (() => {
                const CATEGORY_ICON: Record<string, React.ReactNode> = {
                    verificacion: <CheckCircle2 className="h-3.5 w-3.5" />,
                    analisis: <Brain className="h-3.5 w-3.5" />,
                    extraccion: <FileSearch className="h-3.5 w-3.5" />,
                    generacion: <Sparkles className="h-3.5 w-3.5" />,
                    monitorizacion: <Zap className="h-3.5 w-3.5" />,
                };

                // Filter skills by review_depth: light=P0, standard=P0+P1, enhanced=all
                const allowedPriorities: Record<string, string[]> = {
                    light: ['P0'],
                    standard: ['P0', 'P1'],
                    enhanced: ['P0', 'P1', 'P2', 'P3'],
                };
                const depth = project.review_depth || 'standard';
                const allowed = allowedPriorities[depth] || allowedPriorities.standard;
                const filteredSkills = skills.filter(s => !s.priority || allowed.includes(s.priority));
                const hiddenCount = skills.length - filteredSkills.length;

                const skillsByCategory = filteredSkills.reduce<Record<string, number>>((acc, s) => {
                    acc[s.category] = (acc[s.category] || 0) + 1;
                    return acc;
                }, {});

                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                Skills por Area — Harvey AI
                            </h3>
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" style={{ color: 'var(--g-brand-bright)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--g-text-secondary)' }}>
                                    {filteredSkills.length} skills activos
                                    {hiddenCount > 0 && (
                                        <span className="text-xs ml-1" style={{ color: 'var(--g-text-muted)' }}>
                                            ({hiddenCount} ocultos por {REVIEW_DEPTH_CONFIG[depth]?.labelEs || depth})
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {tasksByArea.filter(g => g.processes.length > 0).map(({ area, processes: areaProcs, tasks: areaTasks }) => {
                            const areaSkills = filteredSkills.filter(s => s.area_code === area.code);
                            const isExpanded = expandedArea === area.id;

                            return (
                                <div
                                    key={area.id}
                                    className="border overflow-hidden"
                                    style={{
                                        borderColor: 'var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        borderLeft: `4px solid ${area.color}`,
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    {/* Area Header - clickable */}
                                    <button
                                        type="button"
                                        onClick={() => setExpandedArea(isExpanded ? null : area.id)}
                                        className="w-full px-5 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-all"
                                        style={{ backgroundColor: 'var(--g-surface-subtle)' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color || 'var(--g-border-default)' }} />
                                            <span className="font-medium text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {area.name}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                ({areaProcs.length} procesos)
                                            </span>
                                            {areaSkills.length > 0 && (
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-full)',
                                                        backgroundColor: 'var(--g-brand-bright)',
                                                        color: 'var(--g-text-inverse)',
                                                    }}
                                                >
                                                    <Sparkles className="h-3 w-3" />
                                                    {areaSkills.length} skills
                                                </span>
                                            )}
                                        </div>
                                        {isExpanded
                                            ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                            : <ChevronDown className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                        }
                                    </button>

                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div>
                                            {/* Skills Grid */}
                                            {areaSkills.length > 0 && (
                                                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--g-border-subtle)' }}>
                                                    <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--g-text-muted)' }}>
                                                        Skills disponibles
                                                    </p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {areaSkills.map(skill => {
                                                            const catCfg = SKILL_CATEGORY_CONFIG[skill.category];
                                                            const firstProc = areaProcs[0];
                                                            const runKey = `${firstProc?.id}-${skill.skill_key}`;
                                                            const isRunningSkill = aiRunning === runKey;

                                                            return (
                                                                <div
                                                                    key={skill.skill_key}
                                                                    className="p-4 border flex flex-col justify-between"
                                                                    style={{
                                                                        borderColor: selectedSkill === skill.skill_key ? 'var(--g-brand-bright)' : 'var(--g-border-subtle)',
                                                                        borderRadius: 'var(--g-radius-md)',
                                                                        backgroundColor: 'var(--g-surface-card)',
                                                                        boxShadow: selectedSkill === skill.skill_key ? '0 0 0 1px var(--g-brand-bright)' : 'none',
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div className="flex items-start gap-2 mb-2">
                                                                            <span style={{ color: catCfg?.bg || 'var(--g-text-secondary)' }}>
                                                                                {CATEGORY_ICON[skill.category] || <Bot className="h-3.5 w-3.5" />}
                                                                            </span>
                                                                            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--g-text-primary)' }}>
                                                                                {skill.name}
                                                                            </p>
                                                                        </div>
                                                                        {skill.description && (
                                                                            <p
                                                                                className="text-xs mb-3"
                                                                                style={{
                                                                                    color: 'var(--g-text-secondary)',
                                                                                    display: '-webkit-box',
                                                                                    WebkitLineClamp: 2,
                                                                                    WebkitBoxOrient: 'vertical',
                                                                                    overflow: 'hidden',
                                                                                }}
                                                                            >
                                                                                {skill.description}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center justify-between mt-auto pt-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span
                                                                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                                                                                style={{
                                                                                    borderRadius: 'var(--g-radius-full)',
                                                                                    backgroundColor: catCfg?.bg || 'var(--g-surface-muted)',
                                                                                    color: catCfg?.fg || 'var(--g-text-primary)',
                                                                                }}
                                                                            >
                                                                                {catCfg?.label || skill.category}
                                                                            </span>
                                                                            <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                                                                {skill.area_code.toLowerCase()}
                                                                            </span>
                                                                            {skill.hitl_required && (
                                                                                <span
                                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium"
                                                                                    style={{
                                                                                        borderRadius: 'var(--g-radius-full)',
                                                                                        backgroundColor: 'var(--status-error-bg)',
                                                                                        color: 'var(--status-error)',
                                                                                    }}
                                                                                    title="Revisión humana obligatoria antes de publicar"
                                                                                >
                                                                                    <ShieldCheck className="h-3 w-3" />
                                                                                    HITL
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (firstProc) {
                                                                                    setSelectedSkill(skill.skill_key);
                                                                                    setAiRunning(runKey);
                                                                                    invokeHarvey(firstProc.id, skill.skill_key).finally(() => {
                                                                                        setAiRunning(null);
                                                                                        setSelectedSkill(null);
                                                                                    });
                                                                                }
                                                                            }}
                                                                            disabled={!!aiRunning}
                                                                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                                                            style={{
                                                                                backgroundColor: 'var(--g-brand-bright)',
                                                                                color: 'var(--g-text-inverse)',
                                                                                borderRadius: 'var(--g-radius-md)',
                                                                            }}
                                                                        >
                                                                            {isRunningSkill ? (
                                                                                <><Loader2 className="h-3 w-3 animate-spin" /> Ejecutando...</>
                                                                            ) : (
                                                                                <><Zap className="h-3 w-3" /> Ejecutar</>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Process list (fallback with generic Harvey AI button) */}
                                            <div>
                                                <div className="px-5 py-2" style={{ backgroundColor: 'var(--g-surface-subtle)' }}>
                                                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--g-text-muted)' }}>
                                                        Procesos
                                                    </p>
                                                </div>
                                                <div className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                                    {areaProcs.map(proc => {
                                                        const task = areaTasks.find(t => t.process_id === proc.id);
                                                        const isRunning = aiRunning === proc.id;
                                                        return (
                                                            <div key={proc.id} className="px-5 py-3 flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                                        P{proc.number}. {proc.name}
                                                                    </p>
                                                                    {task && (
                                                                        <span
                                                                            className="inline-flex items-center mt-1 px-2 py-0.5 text-xs font-medium"
                                                                            style={{
                                                                                borderRadius: 'var(--g-radius-full)',
                                                                                backgroundColor: task.status === 'completed' ? 'var(--status-success)' : 'var(--g-surface-muted)',
                                                                                color: task.status === 'completed' ? 'var(--g-text-inverse)' : 'var(--g-text-primary)',
                                                                            }}
                                                                        >
                                                                            {STATUS_CONFIG[task.status]?.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => invokeHarvey(proc.id)}
                                                                    disabled={!!aiRunning}
                                                                    aria-busy={isRunning}
                                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                                                    style={{
                                                                        backgroundColor: 'var(--g-brand-bright)',
                                                                        color: 'var(--g-text-inverse)',
                                                                        borderRadius: 'var(--g-radius-md)',
                                                                    }}
                                                                >
                                                                    {isRunning ? (
                                                                        <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Ejecutando...</>
                                                                    ) : (
                                                                        <><Bot className="h-3 w-3" aria-hidden="true" /> Harvey AI</>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Resumen de capacidades */}
                        <div
                            className="p-5 border"
                            style={{
                                backgroundColor: 'var(--g-surface-card)',
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                boxShadow: 'var(--g-shadow-card)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Brain className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} />
                                <h4 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                    Resumen de capacidades
                                </h4>
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold" style={{ color: 'var(--g-brand-3308)' }}>{skills.length}</p>
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Skills totales</p>
                                </div>
                                <div
                                    className="h-10"
                                    style={{ width: '1px', backgroundColor: 'var(--g-border-subtle)' }}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(skillsByCategory).map(([cat, count]) => {
                                        const cfg = SKILL_CATEGORY_CONFIG[cat];
                                        return (
                                            <span
                                                key={cat}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: cfg?.bg || 'var(--g-surface-muted)',
                                                    color: cfg?.fg || 'var(--g-text-primary)',
                                                }}
                                            >
                                                {CATEGORY_ICON[cat]}
                                                {cfg?.label || cat} ({count})
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                            <Link
                                href="/skills"
                                className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-all"
                                style={{ color: 'var(--g-brand-bright)' }}
                            >
                                <Sparkles className="h-4 w-4" />
                                Ver catalogo completo
                            </Link>
                        </div>

                        {/* Accesos rápidos */}
                        <div
                            className="g-card"
                            style={{
                                padding: 'var(--g-space-5)',
                                borderRadius: 'var(--g-radius-xl)',
                            }}
                        >
                            <h3
                                className="font-bold"
                                style={{
                                    fontSize: 'var(--g-text-h3)',
                                    color: 'var(--g-text-primary)',
                                    marginBottom: 'var(--g-space-4)',
                                }}
                            >
                                Accesos rápidos
                            </h3>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 'var(--g-space-3)',
                                }}
                            >
                                {[
                                    { href: `/projects/${id}/vdr`, label: 'Data Room', icon: FolderOpen },
                                    { href: `/projects/${id}/qa`, label: 'Q&A', icon: MessageSquare },
                                    { href: `/projects/${id}/cockpit`, label: 'Deal Cockpit', icon: Zap },
                                    { href: `/projects/${id}/negotiation`, label: 'Negociación', icon: FileText },
                                    { href: `/projects/${id}/hitl`, label: 'HITL Review', icon: ShieldCheck },
                                    { href: `/projects/${id}/activity`, label: 'Actividad', icon: Activity },
                                    { href: `/projects/${id}/war-room`, label: 'War Room', icon: Swords },
                                    { href: `/projects/${id}/scoring`, label: 'Scoring', icon: Target },
                                    { href: `/projects/${id}/workflows`, label: 'Workflows', icon: GitBranch },
                                ].map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--g-space-3)',
                                            padding: 'var(--g-space-3) var(--g-space-4)',
                                            borderRadius: 'var(--g-radius-lg)',
                                            border: '1px solid var(--g-border-default)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                            textDecoration: 'none',
                                            transition: 'all var(--g-transition-smooth)',
                                        }}
                                        className="hover:opacity-80"
                                    >
                                        <span
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '2rem',
                                                height: '2rem',
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-brand-3308)',
                                                color: 'var(--g-text-inverse)',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <item.icon className="h-4 w-4" />
                                        </span>
                                        <span className="text-sm font-medium">{item.label}</span>
                                        <ChevronRight
                                            className="h-4 w-4"
                                            style={{ marginLeft: 'auto', color: 'var(--g-text-tertiary)' }}
                                        />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {activeTab === 'contingencies' && (
                <div className="space-y-4">
                    {contingencies.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <AlertTriangle className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin contingencias</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Las contingencias aparecerán cuando Harvey analice la documentación
                            </p>
                        </div>
                    ) : (
                        contingencies.map(c => (
                            <div
                                key={c.id}
                                className="p-5 border"
                                style={{
                                    backgroundColor: 'var(--g-surface-card)',
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-lg)',
                                    borderLeft: `4px solid ${SEVERITY_CONFIG[c.severity]?.color || 'var(--g-border-default)'}`,
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-medium" style={{ color: 'var(--g-text-primary)' }}>{c.title}</h4>
                                        <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>{c.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <span
                                            className="inline-flex px-2.5 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: SEVERITY_CONFIG[c.severity]?.color,
                                                color: 'var(--g-text-inverse)',
                                            }}
                                        >
                                            {SEVERITY_CONFIG[c.severity]?.label}
                                        </span>
                                        <p className="text-sm font-bold mt-2" style={{ color: 'var(--g-text-primary)' }}>
                                            {formatCurrency(c.estimated_amount)}
                                        </p>
                                    </div>
                                </div>
                                {c.recommendation && (
                                    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--g-surface-subtle)', borderRadius: 'var(--g-radius-md)' }}>
                                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-brand-3308)' }}>Recomendación:</p>
                                        <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>{c.recommendation}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            Tareas operativas
                        </h3>
                        <Link
                            href={`/projects/${id}/hitl`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-sec-100)',
                                color: 'var(--g-brand-3308)',
                            }}
                        >
                            <ListChecks className="h-3.5 w-3.5" />
                            Revisión HITL ({hitlQueueCount})
                        </Link>
                    </div>

                    {tasks.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin tareas registradas</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Invoca Harvey AI desde Resumen para crear tareas por proceso
                            </p>
                        </div>
                    ) : (
                        <div
                            className="overflow-x-auto border"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <table className="w-full min-w-[980px]">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                                        {['Proceso', 'Área', 'Estado', 'IA', 'Prioridad', 'Vencimiento', 'Última salida IA'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                                style={{ color: 'var(--g-text-muted)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                    {tasks.map((task) => {
                                        const process = processById.get(task.process_id);
                                        const area = task.area_id ? areaById.get(task.area_id) : undefined;
                                        return (
                                            <tr key={task.id}>
                                                <td className="px-4 py-3 text-sm">
                                                    <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {process ? `P${process.number}. ${process.name}` : 'Proceso no encontrado'}
                                                    </p>
                                                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                        Creada: {formatDate(task.created_at)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: area?.color || 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-inverse)',
                                                        }}
                                                    >
                                                        {area?.name || 'Sin área'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={task.status}
                                                        disabled={statusUpdating === task.id}
                                                        aria-busy={statusUpdating === task.id}
                                                        aria-label={`Estado de tarea ${process?.name || task.id}`}
                                                        onChange={(e) => updateTaskStatus(task.id, e.target.value as DDTask['status'])}
                                                        className="h-8 px-2 text-xs border"
                                                        style={{
                                                            borderColor: 'var(--g-border-default)',
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            color: 'var(--g-text-primary)',
                                                            backgroundColor: 'var(--g-surface-card)',
                                                        }}
                                                    >
                                                        {(Object.keys(STATUS_CONFIG) as DDTask['status'][]).map((status) => (
                                                            <option key={status} value={status}>
                                                                {STATUS_CONFIG[status].label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: AI_STATUS_CONFIG[task.ai_status].bg,
                                                            color: AI_STATUS_CONFIG[task.ai_status].fg,
                                                        }}
                                                    >
                                                        {AI_STATUS_CONFIG[task.ai_status].label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {task.priority}
                                                </td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {formatDate(task.due_date)}
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {(() => {
                                                        if (!task.ai_output) return getAiSummary(task.ai_output);
                                                        const output = (task.ai_output.output && typeof task.ai_output.output === 'object')
                                                            ? task.ai_output.output as Record<string, unknown>
                                                            : task.ai_output;
                                                        const structuredKeys = Object.keys(output).filter(
                                                            k => !['summary', 'message', 'skill_key', 'timestamp', 'status'].includes(k)
                                                                && typeof output[k] !== 'object'
                                                                && output[k] !== null
                                                                && output[k] !== undefined
                                                        );
                                                        if (structuredKeys.length >= 2) {
                                                            return (
                                                                <div className="space-y-1">
                                                                    {typeof task.ai_output.skill_key === 'string' && (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium mb-1"
                                                                            style={{
                                                                                borderRadius: 'var(--g-radius-sm)',
                                                                                backgroundColor: 'var(--g-brand-bright)',
                                                                                color: 'var(--g-text-inverse)',
                                                                            }}
                                                                        >
                                                                            <Sparkles className="h-2.5 w-2.5" />
                                                                            {task.ai_output.skill_key}
                                                                        </span>
                                                                    )}
                                                                    {structuredKeys.slice(0, 5).map(key => (
                                                                        <div key={key} className="flex gap-2">
                                                                            <span className="font-medium capitalize" style={{ color: 'var(--g-text-muted)', minWidth: '80px' }}>
                                                                                {key.replace(/_/g, ' ')}:
                                                                            </span>
                                                                            <span style={{ color: 'var(--g-text-primary)' }}>
                                                                                {String(output[key]).slice(0, 120)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {structuredKeys.length > 5 && (
                                                                        <span style={{ color: 'var(--g-text-muted)' }}>
                                                                            +{structuredKeys.length - 5} campos mas
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return getAiSummary(task.ai_output);
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'documents' && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            Data Room
                        </h3>
                        <div className="flex items-center gap-2">
                            {ddDocuments.length > 0 && (
                                <Link
                                    href="/reports/new"
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-sec-100)',
                                        color: 'var(--g-brand-3308)',
                                    }}
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Generar informe
                                </Link>
                            )}
                            <button
                                onClick={() => setShowUploadForm(!showUploadForm)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-brand-3308)',
                                    color: 'var(--g-text-inverse)',
                                }}
                            >
                                <Upload className="h-3.5 w-3.5" />
                                Subir documento
                            </button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div
                        className="p-4 border grid grid-cols-4 gap-4"
                        style={{
                            backgroundColor: 'var(--g-surface-card)',
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-lg)',
                            boxShadow: 'var(--g-shadow-card)',
                        }}
                    >
                        <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: 'var(--g-brand-3308)' }}>{docStats.total_uploaded}</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Subidos</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>{docStats.total_expected}</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Esperados</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: docStats.gaps_count > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>{docStats.gaps_count}</p>
                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Pendientes</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Cobertura</p>
                                <p className="text-sm font-bold" style={{ color: 'var(--g-brand-3308)' }}>{docStats.coverage_pct}%</p>
                            </div>
                            <div className="h-2 w-full overflow-hidden" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-full)' }}>
                                <div
                                    className="h-full transition-all"
                                    style={{
                                        width: `${docStats.coverage_pct}%`,
                                        backgroundColor: docStats.coverage_pct >= 80 ? 'var(--status-success)' : docStats.coverage_pct >= 50 ? 'var(--status-warning)' : 'var(--status-error)',
                                        borderRadius: 'var(--g-radius-full)',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Upload Form */}
                    {showUploadForm && (
                        <div
                            className="p-5 border"
                            style={{
                                backgroundColor: 'var(--g-surface-card)',
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                boxShadow: 'var(--g-shadow-card)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>Nuevo documento</h4>
                                <button onClick={() => setShowUploadForm(false)} className="p-1 hover:opacity-70">
                                    <X className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-secondary)' }}>Nombre del documento *</label>
                                    <input
                                        type="text"
                                        value={docFormName}
                                        onChange={(e) => setDocFormName(e.target.value)}
                                        placeholder="Ej: Escritura de constitución"
                                        className="w-full h-9 px-3 text-sm border"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-secondary)' }}>Área</label>
                                    <select
                                        value={docFormArea}
                                        onChange={(e) => setDocFormArea(e.target.value)}
                                        className="w-full h-9 px-3 text-sm border"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                        }}
                                    >
                                        <option value="">Sin área</option>
                                        {areas.map(a => (
                                            <option key={a.id} value={a.code}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-secondary)' }}>Categoría</label>
                                    <select
                                        value={docFormCategory}
                                        onChange={(e) => setDocFormCategory(e.target.value)}
                                        className="w-full h-9 px-3 text-sm border"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-card)',
                                            color: 'var(--g-text-primary)',
                                        }}
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-secondary)' }}>Archivo *</label>
                                    <div
                                        className="relative flex items-center justify-center h-9 border border-dashed cursor-pointer hover:opacity-80"
                                        style={{
                                            borderColor: 'var(--g-border-default)',
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: 'var(--g-surface-subtle)',
                                        }}
                                    >
                                        <input
                                            type="file"
                                            onChange={(e) => setDocFormFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                            {docFormFile ? `${docFormFile.name} (${formatFileSize(docFormFile.size)})` : 'Seleccionar archivo...'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={handleDocUpload}
                                    disabled={docUploading || !docFormName || !docFormFile}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: 'var(--g-brand-3308)',
                                        color: 'var(--g-text-inverse)',
                                    }}
                                >
                                    {docUploading ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</>
                                    ) : (
                                        <><Upload className="h-3 w-3" /> Subir documento</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Documents Table */}
                    {ddDocuments.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <FolderOpen className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Data Room vacío</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Sube documentos para comenzar la revisión de due diligence
                            </p>
                        </div>
                    ) : (
                        <div
                            className="overflow-x-auto border"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <table className="w-full min-w-[860px]">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--g-surface-muted)' }}>
                                        {['Nombre', 'Área', 'Categoría', 'Tipo', 'Tamaño', 'Estado', 'Fecha'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                                style={{ color: 'var(--g-text-muted)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                                    {ddDocuments.map((doc) => {
                                        const docArea = doc.area_code ? areaByCode.get(doc.area_code) : null;
                                        const statusCfg = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.uploaded;
                                        return (
                                            <tr key={doc.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--g-text-muted)' }} />
                                                        <div>
                                                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>{doc.name}</p>
                                                            <p className="text-xs" style={{ color: 'var(--g-text-muted)' }}>{doc.original_filename}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {docArea ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs">
                                                            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: docArea.color || 'var(--g-border-default)' }} />
                                                            <span style={{ color: 'var(--g-text-secondary)' }}>{docArea.name}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>--</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {CATEGORY_LABELS[doc.category] || doc.category}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex px-2 py-0.5 text-xs font-mono uppercase"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-secondary)',
                                                        }}
                                                    >
                                                        {doc.file_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {formatFileSize(doc.file_size_bytes)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-full)',
                                                            backgroundColor: statusCfg.bg,
                                                            color: statusCfg.fg,
                                                        }}
                                                    >
                                                        {statusCfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {formatDate(doc.created_at)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Gap List Panel */}
                    {expectedDocs.length > 0 && (
                        <div
                            className="border overflow-hidden"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <button
                                onClick={() => setShowGaps(!showGaps)}
                                className="w-full px-5 py-3 flex items-center justify-between hover:opacity-80 transition-all"
                                style={{ backgroundColor: 'var(--g-surface-subtle)' }}
                            >
                                <div className="flex items-center gap-2">
                                    {showGaps ? (
                                        <ChevronDown className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                                    )}
                                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        Gap List — Documentos pendientes
                                    </span>
                                    {docGaps.length > 0 && (
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: 'var(--status-warning)',
                                                color: 'var(--g-text-inverse)',
                                            }}
                                        >
                                            {docGaps.length} pendientes
                                        </span>
                                    )}
                                </div>
                            </button>
                            {showGaps && (
                                <div className="p-5 space-y-4">
                                    {Array.from(new Set(docGaps.map(g => g.area_code))).map(areaCode => {
                                        const areaInfo = areaByCode.get(areaCode);
                                        const areaGaps = docGaps.filter(g => g.area_code === areaCode);
                                        return (
                                            <div key={areaCode}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: areaInfo?.color || 'var(--g-border-default)' }} />
                                                    <span className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                        {areaInfo?.name || areaCode}
                                                    </span>
                                                    <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                                        ({areaGaps.length})
                                                    </span>
                                                </div>
                                                <div className="space-y-2 ml-5">
                                                    {areaGaps.map(gap => (
                                                        <div
                                                            key={gap.id}
                                                            className="flex items-start justify-between p-3 border"
                                                            style={{
                                                                borderColor: 'var(--g-border-subtle)',
                                                                borderRadius: 'var(--g-radius-md)',
                                                                backgroundColor: 'var(--g-surface-subtle)',
                                                            }}
                                                        >
                                                            <div>
                                                                <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>{gap.name}</p>
                                                                {gap.description && (
                                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>{gap.description}</p>
                                                                )}
                                                            </div>
                                                            <span
                                                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium flex-shrink-0 ml-3"
                                                                style={{
                                                                    borderRadius: 'var(--g-radius-full)',
                                                                    backgroundColor: gap.is_mandatory ? 'var(--status-error)' : 'var(--g-surface-muted)',
                                                                    color: gap.is_mandatory ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                                                                }}
                                                            >
                                                                {gap.is_mandatory ? 'Obligatorio' : 'Opcional'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {docGaps.length === 0 && (
                                        <div className="text-center py-6">
                                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--status-success)' }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                Todos los documentos esperados han sido subidos
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'qa' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Q&A del proyecto
                    </h3>

                    {loadWarnings.some((w) => w.includes('Q&A')) && (
                        <div
                            className="p-3 border"
                            style={{
                                borderColor: 'var(--status-warning)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-subtle)',
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                {loadWarnings.find((w) => w.includes('Q&A'))}
                            </p>
                        </div>
                    )}

                    {qas.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 border border-dashed"
                            style={{
                                borderColor: 'var(--g-border-subtle)',
                                borderRadius: 'var(--g-radius-lg)',
                                backgroundColor: 'var(--g-surface-card)',
                            }}
                        >
                            <MessageSquare className="h-10 w-10 mb-3" style={{ color: 'var(--g-sec-300)' }} />
                            <p className="font-medium" style={{ color: 'var(--g-text-primary)' }}>Sin preguntas abiertas</p>
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                                Las preguntas al cliente aparecerán aquí con su estado
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {qas.map((qa) => (
                                <div
                                    key={qa.id}
                                    className="p-4 border"
                                    style={{
                                        borderColor: 'var(--g-border-default)',
                                        borderRadius: 'var(--g-radius-lg)',
                                        backgroundColor: 'var(--g-surface-card)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <span
                                            className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium capitalize"
                                            style={{
                                                borderRadius: 'var(--g-radius-full)',
                                                backgroundColor: qa.status === 'answered' || qa.status === 'closed'
                                                    ? 'var(--status-success)'
                                                    : qa.status === 'follow_up'
                                                        ? 'var(--status-warning)'
                                                        : 'var(--g-surface-muted)',
                                                color: qa.status === 'answered' || qa.status === 'closed' || qa.status === 'follow_up'
                                                    ? 'var(--g-text-inverse)'
                                                    : 'var(--g-text-primary)',
                                            }}
                                        >
                                            {qa.status}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {formatDate(qa.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        {qa.question}
                                    </p>
                                    {qa.answer && (
                                        <div
                                            className="mt-3 p-3"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-surface-subtle)',
                                            }}
                                        >
                                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--g-brand-3308)' }}>
                                                Respuesta
                                            </p>
                                            <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                                                {qa.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'team' && (
                <div className="g-card p-6" style={{ borderRadius: 'var(--g-radius-xl)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                            Equipo del Proyecto
                        </h2>
                        <span className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            {teamRoles.filter(r => r.is_active).length} miembros activos
                        </span>
                    </div>
                    {teamRoles.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
                            No hay miembros asignados al proyecto.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                            {teamRoles.filter(r => r.is_active).map(member => {
                                const roleConfig = ROLE_CONFIG[member.role] || { labelEs: member.role, color: '#6B7280' };
                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-3 border"
                                        style={{
                                            borderRadius: 'var(--g-radius-md)',
                                            borderColor: 'var(--g-border-default)',
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="h-8 w-8 flex items-center justify-center text-xs font-bold"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: roleConfig.color + '20',
                                                    color: roleConfig.color,
                                                }}
                                            >
                                                {roleConfig.label?.charAt(0) || 'U'}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    {member.user_id.substring(0, 8)}...
                                                </p>
                                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {roleConfig.labelEs}{member.area_code ? ` · ${member.area_code}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: roleConfig.color + '15',
                                                color: roleConfig.color,
                                            }}
                                        >
                                            {roleConfig.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'events' && (
                <EventFeed projectId={id} />
            )}

            {activeTab === 'suggestions' && (
                <SmartSuggestions projectId={id} context="dashboard" />
            )}
        </div>
    );
}
