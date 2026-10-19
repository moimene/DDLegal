'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, FileText, Upload, ChevronDown, ChevronRight, AlertTriangle,
    CheckCircle2, Search, Clock, Shield, Briefcase, Scale, Users, Building2,
    Globe, FileWarning, Gavel, FolderOpen, Database, ScrollText, BarChart3,
    Filter, ArrowUpDown, Trash2, Link2, RefreshCw, Eye, PenLine, XCircle
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AreaConfig {
    code: string;
    name: string;
    icon: React.ReactNode;
}

interface ExpectedDoc {
    id: string;
    area_code: string;
    name: string;
    category: string;
    is_mandatory: boolean;
    review_depth: string;
    status: 'uploaded' | 'missing' | 'pending_review';
}

interface AuditEntry {
    id: string;
    action: 'upload' | 'delete' | 'version' | 'link' | 'review' | 'update';
    actor: string;
    description: string;
    timestamp: string;
    area_code?: string;
}

// ─── Area Definitions ──────────────────────────────────────────────────────────

const AREAS: AreaConfig[] = [
    { code: 'MERC', name: 'Mercantil / Societario', icon: <Briefcase className="h-4 w-4" /> },
    { code: 'CONT', name: 'Contratos', icon: <ScrollText className="h-4 w-4" /> },
    { code: 'LAB', name: 'Laboral', icon: <Users className="h-4 w-4" /> },
    { code: 'FISC', name: 'Fiscal / Tributario', icon: <Building2 className="h-4 w-4" /> },
    { code: 'INM', name: 'Inmobiliario', icon: <Building2 className="h-4 w-4" /> },
    { code: 'PI', name: 'Propiedad Intelectual', icon: <Shield className="h-4 w-4" /> },
    { code: 'LIT', name: 'Litigios / Disputas', icon: <Gavel className="h-4 w-4" /> },
    { code: 'ADMIN', name: 'Administrativo / Regulatorio', icon: <Scale className="h-4 w-4" /> },
    { code: 'MA', name: 'Medioambiental', icon: <Globe className="h-4 w-4" /> },
    { code: 'DATOS', name: 'Proteccion de Datos', icon: <Database className="h-4 w-4" /> },
    { code: 'GENERAL', name: 'General / Corporativo', icon: <FolderOpen className="h-4 w-4" /> },
];

// ─── Mock Data Generator ───────────────────────────────────────────────────────

function generateMockDocuments(): ExpectedDoc[] {
    const docs: ExpectedDoc[] = [
        // MERC
        { id: 'exp-001', area_code: 'MERC', name: 'Escritura de constitucion', category: 'escritura', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-002', area_code: 'MERC', name: 'Estatutos sociales vigentes', category: 'estatutos', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-003', area_code: 'MERC', name: 'Libro de actas - ultimos 3 anos', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-004', area_code: 'MERC', name: 'Certificado de vigencia mercantil', category: 'certificado', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-005', area_code: 'MERC', name: 'Poderes vigentes y revocados', category: 'escritura', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-006', area_code: 'MERC', name: 'Estructura del grupo societario', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-007', area_code: 'MERC', name: 'Pactos parasociales', category: 'contrato', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-008', area_code: 'MERC', name: 'Actas de junta directiva - ultimo ano', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },

        // CONT
        { id: 'exp-010', area_code: 'CONT', name: 'Contratos con clientes principales', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-011', area_code: 'CONT', name: 'Contratos con proveedores clave', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-012', area_code: 'CONT', name: 'Contratos de distribucion', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-013', area_code: 'CONT', name: 'Contratos de licencia de software', category: 'contrato', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-014', area_code: 'CONT', name: 'Contratos de arrendamiento', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-015', area_code: 'CONT', name: 'Acuerdos de confidencialidad (NDA)', category: 'contrato', is_mandatory: false, review_depth: 'enhanced', status: 'uploaded' },
        { id: 'exp-016', area_code: 'CONT', name: 'Contratos de joint venture', category: 'contrato', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-017', area_code: 'CONT', name: 'Garantias otorgadas y recibidas', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },

        // LAB
        { id: 'exp-020', area_code: 'LAB', name: 'Convenio colectivo aplicable', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-021', area_code: 'LAB', name: 'Plantilla de empleados actualizada', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-022', area_code: 'LAB', name: 'Contratos de alta direccion', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-023', area_code: 'LAB', name: 'Plan de prevision social / pensiones', category: 'poliza', is_mandatory: false, review_depth: 'standard', status: 'missing' },
        { id: 'exp-024', area_code: 'LAB', name: 'Actas de inspeccion de trabajo', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-025', area_code: 'LAB', name: 'Politica de retribucion variable', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'uploaded' },
        { id: 'exp-026', area_code: 'LAB', name: 'Plan de igualdad', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },

        // FISC
        { id: 'exp-030', area_code: 'FISC', name: 'Declaraciones IS ultimos 4 ejercicios', category: 'cuentas_anuales', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-031', area_code: 'FISC', name: 'Declaraciones IVA ultimo ejercicio', category: 'cuentas_anuales', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-032', area_code: 'FISC', name: 'Actas de inspeccion tributaria', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-033', area_code: 'FISC', name: 'Certificado de corriente de pago AEAT', category: 'certificado', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-034', area_code: 'FISC', name: 'Precios de transferencia', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-035', area_code: 'FISC', name: 'Cuentas anuales auditadas 3 anos', category: 'cuentas_anuales', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },

        // INM
        { id: 'exp-040', area_code: 'INM', name: 'Notas simples registrales', category: 'certificado', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-041', area_code: 'INM', name: 'Contratos de arrendamiento inmuebles', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-042', area_code: 'INM', name: 'Licencias urbanisticas', category: 'licencia', is_mandatory: false, review_depth: 'standard', status: 'missing' },
        { id: 'exp-043', area_code: 'INM', name: 'Certificados energeticos', category: 'certificado', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-044', area_code: 'INM', name: 'Seguros de inmuebles', category: 'poliza', is_mandatory: false, review_depth: 'enhanced', status: 'uploaded' },

        // PI
        { id: 'exp-050', area_code: 'PI', name: 'Registro de marcas y patentes', category: 'certificado', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-051', area_code: 'PI', name: 'Contratos de licencia de PI', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-052', area_code: 'PI', name: 'Dominios web y activos digitales', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-053', area_code: 'PI', name: 'Informe de libertad de operacion', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-054', area_code: 'PI', name: 'Acuerdos de cesion de PI empleados', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'missing' },

        // LIT
        { id: 'exp-060', area_code: 'LIT', name: 'Listado de litigios activos', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-061', area_code: 'LIT', name: 'Provisiones por litigios', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-062', area_code: 'LIT', name: 'Arbitrajes pendientes', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-063', area_code: 'LIT', name: 'Sentencias relevantes ultimos 5 anos', category: 'sentencia', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },

        // ADMIN
        { id: 'exp-070', area_code: 'ADMIN', name: 'Licencias de actividad', category: 'licencia', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-071', area_code: 'ADMIN', name: 'Permisos y autorizaciones sectoriales', category: 'licencia', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-072', area_code: 'ADMIN', name: 'Subvenciones recibidas', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-073', area_code: 'ADMIN', name: 'Expedientes sancionadores', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },

        // MA
        { id: 'exp-080', area_code: 'MA', name: 'Autorizacion ambiental integrada', category: 'licencia', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-081', area_code: 'MA', name: 'Evaluacion de impacto ambiental', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'missing' },
        { id: 'exp-082', area_code: 'MA', name: 'Plan de gestion de residuos', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-083', area_code: 'MA', name: 'Informe de suelos contaminados', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },

        // DATOS
        { id: 'exp-090', area_code: 'DATOS', name: 'Registro de actividades de tratamiento', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-091', area_code: 'DATOS', name: 'Politica de privacidad vigente', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-092', area_code: 'DATOS', name: 'Contratos con encargados de tratamiento', category: 'contrato', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-093', area_code: 'DATOS', name: 'Evaluacion de impacto (DPIA)', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-094', area_code: 'DATOS', name: 'Nombramiento DPO', category: 'certificado', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },

        // GENERAL
        { id: 'exp-100', area_code: 'GENERAL', name: 'Organigrama corporativo', category: 'informe', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-101', area_code: 'GENERAL', name: 'Plan de negocio / Business plan', category: 'informe', is_mandatory: false, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-102', area_code: 'GENERAL', name: 'Polizas de seguros vigentes', category: 'poliza', is_mandatory: true, review_depth: 'standard', status: 'uploaded' },
        { id: 'exp-103', area_code: 'GENERAL', name: 'Programa de compliance', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'missing' },
        { id: 'exp-104', area_code: 'GENERAL', name: 'Informe de auditoria interna', category: 'informe', is_mandatory: false, review_depth: 'enhanced', status: 'uploaded' },
    ];
    return docs;
}

function generateAuditTrail(): AuditEntry[] {
    return [
        { id: 'aud-01', action: 'upload', actor: 'Maria Garcia Lopez', description: 'Subio "Escritura de constitucion" al area MERC', timestamp: '2026-02-21T10:32:00Z', area_code: 'MERC' },
        { id: 'aud-02', action: 'version', actor: 'Carlos Ruiz Pena', description: 'Actualizo a v3 "Estatutos sociales vigentes" - correccion de errores', timestamp: '2026-02-21T09:15:00Z', area_code: 'MERC' },
        { id: 'aud-03', action: 'upload', actor: 'Ana Martinez Diaz', description: 'Subio "Contratos con clientes principales" (14 archivos)', timestamp: '2026-02-20T17:45:00Z', area_code: 'CONT' },
        { id: 'aud-04', action: 'link', actor: 'Maria Garcia Lopez', description: 'Creo enlace seguro de descarga para "Cuentas anuales auditadas" - expira 72h', timestamp: '2026-02-20T16:20:00Z', area_code: 'FISC' },
        { id: 'aud-05', action: 'review', actor: 'Javier Fernandez Gil', description: 'Marco como revisado "Convenio colectivo aplicable" - sin hallazgos', timestamp: '2026-02-20T14:30:00Z', area_code: 'LAB' },
        { id: 'aud-06', action: 'delete', actor: 'Carlos Ruiz Pena', description: 'Elimino version duplicada de "Notas simples registrales" (v1)', timestamp: '2026-02-20T11:10:00Z', area_code: 'INM' },
        { id: 'aud-07', action: 'upload', actor: 'Laura Sanchez Vega', description: 'Subio "Registro de marcas y patentes" con 8 certificados adjuntos', timestamp: '2026-02-19T18:00:00Z', area_code: 'PI' },
        { id: 'aud-08', action: 'update', actor: 'Ana Martinez Diaz', description: 'Actualizo metadatos de "Listado de litigios activos" - reclasificado como confidencial', timestamp: '2026-02-19T15:22:00Z', area_code: 'LIT' },
        { id: 'aud-09', action: 'link', actor: 'Maria Garcia Lopez', description: 'Creo enlace de lectura para asesores externos - area ADMIN completa', timestamp: '2026-02-19T12:05:00Z', area_code: 'ADMIN' },
        { id: 'aud-10', action: 'upload', actor: 'Javier Fernandez Gil', description: 'Subio "Politica de privacidad vigente" y "Registro de actividades de tratamiento"', timestamp: '2026-02-18T16:40:00Z', area_code: 'DATOS' },
    ];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const AUDIT_ICON: Record<AuditEntry['action'], React.ReactNode> = {
    upload: <Upload className="h-3.5 w-3.5" />,
    delete: <Trash2 className="h-3.5 w-3.5" />,
    version: <RefreshCw className="h-3.5 w-3.5" />,
    link: <Link2 className="h-3.5 w-3.5" />,
    review: <Eye className="h-3.5 w-3.5" />,
    update: <PenLine className="h-3.5 w-3.5" />,
};

const AUDIT_COLOR: Record<AuditEntry['action'], string> = {
    upload: 'var(--status-success)',
    delete: 'var(--status-error)',
    version: 'var(--status-info)',
    link: 'var(--g-brand-3308)',
    review: 'var(--status-success)',
    update: 'var(--status-warning)',
};

const AUDIT_LABEL: Record<AuditEntry['action'], string> = {
    upload: 'Carga',
    delete: 'Eliminacion',
    version: 'Version',
    link: 'Enlace',
    review: 'Revision',
    update: 'Actualizacion',
};

const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });

function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `hace ${diffDays}d`;
    return dateFormatter.format(d);
}

type SortKey = 'area_code' | 'name' | 'category' | 'is_mandatory' | 'review_depth' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function GapAnalysisPage() {
    const { id } = useParams<{ id: string }>();

    // Data
    const allDocs = useMemo(() => generateMockDocuments(), []);
    const auditTrail = useMemo(() => generateAuditTrail(), []);

    // UI State
    const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
    const [auditOpen, setAuditOpen] = useState(true);
    const [auditFilter, setAuditFilter] = useState<AuditEntry['action'] | 'all'>('all');
    const [tableAreaFilter, setTableAreaFilter] = useState<string>('all');
    const [tableMandatoryFilter, setTableMandatoryFilter] = useState<string>('all');
    const [tableDepthFilter, setTableDepthFilter] = useState<string>('all');
    const [tableSearch, setTableSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('area_code');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // ─── Computed stats ────────────────────────────────────────────────

    const totalExpected = allDocs.length;
    const uploadedDocs = allDocs.filter(d => d.status === 'uploaded');
    const totalUploaded = uploadedDocs.length;
    const coveragePct = totalExpected > 0 ? Math.round((totalUploaded / totalExpected) * 100) : 100;
    const missingDocs = allDocs.filter(d => d.status === 'missing');
    const missingMandatory = missingDocs.filter(d => d.is_mandatory).length;
    const missingOptional = missingDocs.filter(d => !d.is_mandatory).length;

    // ─── Area stats ────────────────────────────────────────────────────

    const areaStats = useMemo(() => {
        const map: Record<string, { expected: number; uploaded: number; missing: ExpectedDoc[] }> = {};
        AREAS.forEach(a => { map[a.code] = { expected: 0, uploaded: 0, missing: [] }; });
        allDocs.forEach(d => {
            if (!map[d.area_code]) return;
            map[d.area_code].expected++;
            if (d.status === 'uploaded') map[d.area_code].uploaded++;
            else map[d.area_code].missing.push(d);
        });
        return map;
    }, [allDocs]);

    // ─── Missing docs table ────────────────────────────────────────────

    const filteredMissing = useMemo(() => {
        let list = [...missingDocs];
        if (tableAreaFilter !== 'all') list = list.filter(d => d.area_code === tableAreaFilter);
        if (tableMandatoryFilter === 'mandatory') list = list.filter(d => d.is_mandatory);
        if (tableMandatoryFilter === 'optional') list = list.filter(d => !d.is_mandatory);
        if (tableDepthFilter !== 'all') list = list.filter(d => d.review_depth === tableDepthFilter);
        if (tableSearch) {
            const q = tableSearch.toLowerCase();
            list = list.filter(d => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            let valA: string | boolean = a[sortKey] as string | boolean;
            let valB: string | boolean = b[sortKey] as string | boolean;
            if (typeof valA === 'boolean') { valA = valA ? '1' : '0'; valB = valB ? '1' : '0'; }
            const cmp = String(valA).localeCompare(String(valB));
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [missingDocs, tableAreaFilter, tableMandatoryFilter, tableDepthFilter, tableSearch, sortKey, sortDir]);

    // ─── Audit trail filtering ─────────────────────────────────────────

    const filteredAudit = useMemo(() => {
        if (auditFilter === 'all') return auditTrail;
        return auditTrail.filter(a => a.action === auditFilter);
    }, [auditTrail, auditFilter]);

    // ─── Handlers ──────────────────────────────────────────────────────

    const toggleArea = (code: string) => {
        setExpandedAreas(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const getAreaColor = (pct: number): string => {
        if (pct >= 80) return 'var(--status-success)';
        if (pct >= 50) return 'var(--status-warning)';
        return 'var(--status-error)';
    };

    // ─── Render ────────────────────────────────────────────────────────

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>

            {/* ── Breadcrumb & Header ─────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--g-text-secondary)' }}>
                    <Link href={`/projects/${id}`} style={{ color: 'var(--g-link)' }}>Proyecto</Link>
                    <ChevronRight className="h-3 w-3" />
                    <Link href={`/projects/${id}/vdr`} style={{ color: 'var(--g-link)' }}>VDR</Link>
                    <ChevronRight className="h-3 w-3" />
                    <span style={{ color: 'var(--g-text-primary)' }}>Gap Analysis</span>
                </div>
                <div className="flex items-start justify-between">
                    <div>
                        <Link
                            href={`/projects/${id}/vdr`}
                            className="inline-flex items-center gap-1 text-sm mb-3"
                            style={{ color: 'var(--g-link)' }}
                        >
                            <ArrowLeft className="h-4 w-4" /> Volver al VDR
                        </Link>
                        <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                            Analisis de Brechas y Auditoria
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                            Cobertura documental del Data Room Virtual para due diligence
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: coveragePct >= 80 ? 'rgba(34,197,94,0.1)' : coveragePct >= 50 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                                color: getAreaColor(coveragePct),
                            }}
                        >
                            <BarChart3 className="h-3.5 w-3.5" />
                            {coveragePct}% cobertura global
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Section 1: KPI Summary Cards ────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
                {/* Total Expected */}
                <div className="g-card" style={{ borderRadius: 'var(--g-radius-lg)', padding: 'var(--g-space-4)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Documentos Esperados</span>
                        <FileText className="h-4 w-4" style={{ color: 'var(--g-text-secondary)', opacity: 0.5 }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--g-text-primary)' }}>{totalExpected}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>Checklist de due diligence</p>
                </div>

                {/* Uploaded */}
                <div className="g-card" style={{ borderRadius: 'var(--g-radius-lg)', padding: 'var(--g-space-4)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Documentos Subidos</span>
                        <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-success)', opacity: 0.7 }} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold" style={{ color: 'var(--status-success)' }}>{totalUploaded}</p>
                        <span className="text-sm font-medium" style={{ color: 'var(--status-success)' }}>{coveragePct}%</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>De {totalExpected} esperados</p>
                </div>

                {/* Missing Mandatory */}
                <div
                    className="g-card"
                    style={{
                        borderRadius: 'var(--g-radius-lg)',
                        padding: 'var(--g-space-4)',
                        borderLeft: missingMandatory > 0 ? '3px solid var(--status-error)' : undefined,
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Faltantes Obligatorios</span>
                        <XCircle className="h-4 w-4" style={{ color: missingMandatory > 0 ? 'var(--status-error)' : 'var(--g-text-secondary)', opacity: 0.7 }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: missingMandatory > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                        {missingMandatory}
                    </p>
                    <p className="text-xs mt-1" style={{ color: missingMandatory > 0 ? 'var(--status-error)' : 'var(--g-text-secondary)' }}>
                        {missingMandatory > 0 ? 'Requiere atencion inmediata' : 'Todos los obligatorios cubiertos'}
                    </p>
                </div>

                {/* Missing Optional */}
                <div
                    className="g-card"
                    style={{
                        borderRadius: 'var(--g-radius-lg)',
                        padding: 'var(--g-space-4)',
                        borderLeft: missingOptional > 0 ? '3px solid var(--status-warning)' : undefined,
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Faltantes Opcionales</span>
                        <AlertTriangle className="h-4 w-4" style={{ color: missingOptional > 0 ? 'var(--status-warning)' : 'var(--g-text-secondary)', opacity: 0.7 }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: missingOptional > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                        {missingOptional}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                        Recomendados para revision completa
                    </p>
                </div>
            </div>

            {/* ── Section 2: Area Coverage Grid ───────────────────────── */}
            <div>
                <h2 className="font-bold mb-3" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                    Cobertura por Area
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    {AREAS.map(area => {
                        const stats = areaStats[area.code] || { expected: 0, uploaded: 0, missing: [] };
                        const pct = stats.expected > 0 ? Math.round((stats.uploaded / stats.expected) * 100) : 100;
                        const color = getAreaColor(pct);
                        const isExpanded = expandedAreas.has(area.code);

                        return (
                            <div
                                key={area.code}
                                className="g-card"
                                style={{
                                    borderRadius: 'var(--g-radius-lg)',
                                    padding: 'var(--g-space-4)',
                                    borderTop: `3px solid ${color}`,
                                    cursor: stats.missing.length > 0 ? 'pointer' : 'default',
                                }}
                            >
                                <div
                                    className="flex items-center justify-between"
                                    onClick={() => stats.missing.length > 0 && toggleArea(area.code)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex items-center justify-center"
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: `${color}15`,
                                                color: color,
                                            }}
                                        >
                                            {area.icon}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold" style={{ color: 'var(--g-text-primary)' }}>{area.code}</p>
                                            <p className="text-xs" style={{ color: 'var(--g-text-secondary)', lineHeight: 1.2 }}>{area.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                                        {stats.missing.length > 0 && (
                                            isExpanded
                                                ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                                                : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div
                                    style={{
                                        marginTop: 'var(--g-space-3)',
                                        height: 6,
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: 'var(--g-surface-muted)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${pct}%`,
                                            height: '100%',
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: color,
                                            transition: 'width 0.5s ease',
                                        }}
                                    />
                                </div>

                                <p className="text-xs mt-2" style={{ color: 'var(--g-text-secondary)' }}>
                                    {stats.uploaded} de {stats.expected} documentos
                                    {stats.missing.length > 0 && (
                                        <span style={{ color }}> ({stats.missing.length} faltantes)</span>
                                    )}
                                </p>

                                {/* Expanded missing docs */}
                                {isExpanded && stats.missing.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: 'var(--g-space-3)',
                                            paddingTop: 'var(--g-space-3)',
                                            borderTop: '1px solid var(--g-border-default)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                        }}
                                    >
                                        {stats.missing.map(doc => (
                                            <div
                                                key={doc.id}
                                                className="flex items-center gap-2 text-xs"
                                                style={{
                                                    padding: '6px 8px',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-surface-muted)',
                                                }}
                                            >
                                                <FileWarning
                                                    className="h-3 w-3 shrink-0"
                                                    style={{ color: doc.is_mandatory ? 'var(--status-error)' : 'var(--status-warning)' }}
                                                />
                                                <span className="flex-1" style={{ color: 'var(--g-text-primary)' }}>{doc.name}</span>
                                                {doc.is_mandatory && (
                                                    <span
                                                        className="px-1.5 py-0.5 text-xs font-medium"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'rgba(239,68,68,0.1)',
                                                            color: 'var(--status-error)',
                                                        }}
                                                    >
                                                        Obligatorio
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 3: Missing Documents Table ──────────────────── */}
            <div className="g-card" style={{ borderRadius: 'var(--g-radius-lg)', padding: 'var(--g-space-4)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-bold" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                            Documentos Faltantes
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-secondary)' }}>
                            {filteredMissing.length} de {missingDocs.length} documentos pendientes de carga
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                    </div>
                </div>

                {/* Filters */}
                <div
                    className="flex items-center gap-3 mb-4 pb-4"
                    style={{ borderBottom: '1px solid var(--g-border-default)' }}
                >
                    <div className="relative flex-1" style={{ maxWidth: 240 }}>
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                        <input
                            value={tableSearch}
                            onChange={e => setTableSearch(e.target.value)}
                            placeholder="Buscar documento..."
                            className="w-full h-8 pl-7 pr-3 text-xs border"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                borderColor: 'var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                            }}
                        />
                    </div>
                    <select
                        value={tableAreaFilter}
                        onChange={e => setTableAreaFilter(e.target.value)}
                        className="h-8 px-2 text-xs border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                        }}
                    >
                        <option value="all">Todas las areas</option>
                        {AREAS.map(a => (
                            <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                    <select
                        value={tableMandatoryFilter}
                        onChange={e => setTableMandatoryFilter(e.target.value)}
                        className="h-8 px-2 text-xs border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                        }}
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="mandatory">Solo obligatorios</option>
                        <option value="optional">Solo opcionales</option>
                    </select>
                    <select
                        value={tableDepthFilter}
                        onChange={e => setTableDepthFilter(e.target.value)}
                        className="h-8 px-2 text-xs border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                        }}
                    >
                        <option value="all">Toda profundidad</option>
                        <option value="standard">Standard</option>
                        <option value="enhanced">Enhanced</option>
                    </select>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                {([
                                    { key: 'area_code' as SortKey, label: 'Area' },
                                    { key: 'name' as SortKey, label: 'Documento' },
                                    { key: 'category' as SortKey, label: 'Categoria' },
                                    { key: 'is_mandatory' as SortKey, label: 'Tipo' },
                                    { key: 'review_depth' as SortKey, label: 'Profundidad' },
                                    { key: 'status' as SortKey, label: 'Estado' },
                                ]).map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key)}
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: 'var(--g-text-secondary)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {col.label}
                                            <ArrowUpDown className="h-3 w-3" style={{ opacity: sortKey === col.key ? 1 : 0.3 }} />
                                        </span>
                                    </th>
                                ))}
                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--g-text-secondary)' }}>
                                    Accion
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMissing.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        style={{
                                            padding: '32px 12px',
                                            textAlign: 'center',
                                            fontSize: '13px',
                                            color: 'var(--g-text-secondary)',
                                        }}
                                    >
                                        No se encontraron documentos faltantes con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : filteredMissing.map((doc, idx) => (
                                <tr
                                    key={doc.id}
                                    style={{
                                        borderBottom: '1px solid var(--g-border-default)',
                                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--g-surface-muted)',
                                    }}
                                >
                                    <td style={{ padding: '10px 12px' }}>
                                        <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                color: 'var(--g-text-primary)',
                                            }}
                                        >
                                            {doc.area_code}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                            {doc.name}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                            {doc.category.charAt(0).toUpperCase() + doc.category.slice(1).replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span
                                            className="px-1.5 py-0.5 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: doc.is_mandatory ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                                color: doc.is_mandatory ? 'var(--status-error)' : 'var(--status-warning)',
                                            }}
                                        >
                                            {doc.is_mandatory ? 'Obligatorio' : 'Opcional'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span
                                            className="px-1.5 py-0.5 text-xs"
                                            style={{
                                                borderRadius: 'var(--g-radius-sm)',
                                                backgroundColor: 'var(--g-surface-muted)',
                                                color: 'var(--g-text-secondary)',
                                            }}
                                        >
                                            {doc.review_depth === 'enhanced' ? 'Enhanced' : 'Standard'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--status-error)' }}>
                                            <AlertTriangle className="h-3 w-3" />
                                            Faltante
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                        <button
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: 'var(--g-brand-3308)',
                                                color: 'var(--g-text-inverse)',
                                            }}
                                        >
                                            <Upload className="h-3 w-3" />
                                            Subir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Section 4: Audit Trail ──────────────────────────────── */}
            <div className="g-card" style={{ borderRadius: 'var(--g-radius-lg)', padding: 'var(--g-space-4)' }}>
                <div
                    className="flex items-center justify-between"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setAuditOpen(prev => !prev)}
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: 'var(--g-brand-3308)' }} />
                        <h2 className="font-bold" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>
                            Pista de Auditoria
                        </h2>
                        <span
                            className="px-1.5 py-0.5 text-xs font-medium"
                            style={{
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: 'var(--g-surface-muted)',
                                color: 'var(--g-text-secondary)',
                            }}
                        >
                            {auditTrail.length} actividades recientes
                        </span>
                    </div>
                    {auditOpen
                        ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                        : <ChevronRight className="h-4 w-4" style={{ color: 'var(--g-text-secondary)' }} />
                    }
                </div>

                {auditOpen && (
                    <div style={{ marginTop: 'var(--g-space-4)' }}>
                        {/* Audit filters */}
                        <div className="flex items-center gap-2 mb-4">
                            {(['all', 'upload', 'delete', 'version', 'link', 'review', 'update'] as const).map(action => (
                                <button
                                    key={action}
                                    onClick={e => { e.stopPropagation(); setAuditFilter(action); }}
                                    className="px-2.5 py-1 text-xs font-medium border"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        borderColor: auditFilter === action ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                        backgroundColor: auditFilter === action ? 'var(--g-brand-3308)' : 'transparent',
                                        color: auditFilter === action ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                                    }}
                                >
                                    {action === 'all' ? 'Todas' : AUDIT_LABEL[action]}
                                </button>
                            ))}
                        </div>

                        {/* Timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                            {/* Timeline line */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 15,
                                    top: 0,
                                    bottom: 0,
                                    width: 2,
                                    backgroundColor: 'var(--g-border-default)',
                                }}
                            />

                            {filteredAudit.length === 0 ? (
                                <p className="text-xs text-center py-6" style={{ color: 'var(--g-text-secondary)', marginLeft: 40 }}>
                                    Sin actividades para el filtro seleccionado.
                                </p>
                            ) : filteredAudit.map(entry => (
                                <div
                                    key={entry.id}
                                    className="flex items-start gap-3"
                                    style={{ padding: '10px 0', position: 'relative' }}
                                >
                                    {/* Icon dot */}
                                    <div
                                        className="flex items-center justify-center shrink-0"
                                        style={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: '50%',
                                            backgroundColor: 'var(--g-surface-card)',
                                            border: `2px solid ${AUDIT_COLOR[entry.action]}`,
                                            color: AUDIT_COLOR[entry.action],
                                            zIndex: 1,
                                        }}
                                    >
                                        {AUDIT_ICON[entry.action]}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1" style={{ paddingTop: 2 }}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold" style={{ color: 'var(--g-text-primary)' }}>
                                                {entry.actor}
                                            </span>
                                            <span
                                                className="px-1.5 py-0.5 text-xs"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: `${AUDIT_COLOR[entry.action]}15`,
                                                    color: AUDIT_COLOR[entry.action],
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {AUDIT_LABEL[entry.action]}
                                            </span>
                                            {entry.area_code && (
                                                <span
                                                    className="px-1.5 py-0.5 text-xs"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'var(--g-surface-muted)',
                                                        color: 'var(--g-text-secondary)',
                                                    }}
                                                >
                                                    {entry.area_code}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-primary)', lineHeight: 1.4 }}>
                                            {entry.description}
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                            {formatTimestamp(entry.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
