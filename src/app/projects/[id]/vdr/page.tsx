'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useResolvedParams, formatDate as formatDateUtil } from '@/lib/utils';
import Link from 'next/link';
import {
    ArrowLeft, FolderOpen, FolderPlus, FileText, Upload, ChevronRight,
    ChevronDown, ChevronUp, Clock, Shield, AlertTriangle, CheckCircle2, Search,
    MoreHorizontal, Eye, Download, Trash2, Plus, Home, Filter, X,
    Archive, FolderInput, ArrowUpDown, Calendar, Tag, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface VDRFolder {
    id: string; project_id: string; parent_id: string | null; name: string;
    area_code: string | null; sort_order: number; created_at: string;
}

interface VDRDocument {
    id: string; project_id: string; folder_id: string | null; area_code: string | null;
    name: string; description: string | null; category: string; status: string;
    is_confidential: boolean; tags: string[]; created_at: string; updated_at: string;
}

interface VDRVersion {
    id: string; document_id: string; version_number: number; original_filename: string;
    file_type: string; file_size_bytes: number; storage_path: string;
    checksum_sha256: string | null; change_notes: string | null; created_at: string;
}

interface GapStats {
    total_expected: number; total_uploaded: number; gaps_count: number; coverage_pct: number;
}

type SortField = 'name' | 'created_at' | 'status' | 'category';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
    dateFrom: string;
    dateTo: string;
    fileType: string;
    confidentiality: string;
    tag: string;
    status: string;
}

const ITEMS_PER_PAGE = 20;

const VDR_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    staged: { label: 'Preparado', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    uploaded: { label: 'Subido', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    processing: { label: 'Procesando', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    indexed: { label: 'Indexado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    superseded: { label: 'Superado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    archived: { label: 'Archivado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
};

const CATEGORY_OPTIONS = [
    'general', 'contrato', 'escritura', 'estatutos', 'cuentas_anuales',
    'nomina', 'poliza', 'licencia', 'sentencia', 'informe', 'certificado',
];

export default function VDRPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);
    const [folders, setFolders] = useState<VDRFolder[]>([]);
    const [documents, setDocuments] = useState<VDRDocument[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<VDRDocument | null>(null);
    const [versions, setVersions] = useState<VDRVersion[]>([]);
    const [gapStats, setGapStats] = useState<GapStats | null>(null);
    const [gaps, setGaps] = useState<Array<{ id: string; area_code: string; category: string; name: string; is_mandatory: boolean }>>([]);
    const [showGaps, setShowGaps] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadCategory, setUploadCategory] = useState('general');
    const [searchTerm, setSearchTerm] = useState('');

    // --- New state: sorting ---
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // --- New state: bulk selection ---
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // --- New state: advanced filters ---
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        dateFrom: '',
        dateTo: '',
        fileType: '',
        confidentiality: '',
        tag: '',
        status: '',
    });

    // --- New state: pagination ---
    const [currentPage, setCurrentPage] = useState(1);

    // --- New state: breadcrumb path (folder navigation history) ---
    const [folderPath, setFolderPath] = useState<VDRFolder[]>([]);

    const fetchData = async () => {
        const [foldersRes, docsRes, gapRes] = await Promise.all([
            fetch(`/api/vdr/folders?project_id=${id}`).then(r => r.json()),
            fetch(`/api/vdr/documents?project_id=${id}`).then(r => r.json()),
            fetch(`/api/vdr/gap-analysis?project_id=${id}`).then(r => r.json()),
        ]);
        setFolders(foldersRes.folders || []);
        setDocuments(docsRes.documents || []);
        setGapStats(gapRes.stats || null);
        setGaps(gapRes.gaps || []);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [id]);

    // Build breadcrumb path when selectedFolder changes
    useEffect(() => {
        if (!selectedFolder) {
            setFolderPath([]);
            return;
        }
        const path: VDRFolder[] = [];
        let current = folders.find(f => f.id === selectedFolder);
        while (current) {
            path.unshift(current);
            current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
        }
        setFolderPath(path);
    }, [selectedFolder, folders]);

    // Reset page when filters or folder change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedFolder, searchTerm, advancedFilters, sortField, sortDirection]);

    // Clear selection when filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [selectedFolder, searchTerm, advancedFilters, currentPage]);

    const fetchVersions = async (docId: string) => {
        const res = await fetch(`/api/vdr/documents/${docId}/versions`);
        const data = await res.json();
        setVersions(data.versions || []);
    };

    const handleSelectDoc = (doc: VDRDocument) => {
        setSelectedDoc(doc);
        fetchVersions(doc.id);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        await fetch('/api/vdr/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: id, parent_id: selectedFolder, name: newFolderName }),
        });
        setNewFolderName('');
        setShowNewFolder(false);
        fetchData();
        toast.success('Carpeta creada correctamente');
    };

    const handleUploadDoc = async () => {
        if (!uploadName.trim()) return;
        const res = await fetch('/api/vdr/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: id,
                folder_id: selectedFolder,
                name: uploadName,
                category: uploadCategory,
            }),
        });
        const data = await res.json();
        if (data.success && data.document) {
            // Create initial version
            await fetch(`/api/vdr/documents/${data.document.id}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_filename: uploadName,
                    file_type: uploadName.split('.').pop() || 'pdf',
                    storage_path: `projects/${id}/${Date.now()}_${uploadName}`,
                }),
            });
        }
        setUploadName('');
        setUploadCategory('general');
        setShowUpload(false);
        fetchData();
        toast.success('Documento creado correctamente');
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (d: string) => formatDateUtil(d);

    const rootFolders = folders.filter(f => !f.parent_id);
    const getChildFolders = (parentId: string) => folders.filter(f => f.parent_id === parentId);

    // --- Collect unique tags across all documents for filter dropdown ---
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        documents.forEach(d => d.tags?.forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [documents]);

    // --- Unique categories for filter dropdown ---
    const allCategories = useMemo(() => {
        const catSet = new Set<string>();
        documents.forEach(d => { if (d.category) catSet.add(d.category); });
        return Array.from(catSet).sort();
    }, [documents]);

    // --- Advanced filtering logic ---
    const filteredDocs = useMemo(() => {
        return documents.filter(d => {
            const matchesFolder = selectedFolder ? d.folder_id === selectedFolder : true;
            const matchesSearch = searchTerm ? d.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;

            // Advanced filters
            const matchesDateFrom = advancedFilters.dateFrom
                ? new Date(d.created_at) >= new Date(advancedFilters.dateFrom)
                : true;
            const matchesDateTo = advancedFilters.dateTo
                ? new Date(d.created_at) <= new Date(advancedFilters.dateTo + 'T23:59:59')
                : true;
            const matchesFileType = advancedFilters.fileType
                ? d.category === advancedFilters.fileType
                : true;
            const matchesConfidentiality = advancedFilters.confidentiality
                ? advancedFilters.confidentiality === 'confidencial'
                    ? d.is_confidential
                    : !d.is_confidential
                : true;
            const matchesTag = advancedFilters.tag
                ? d.tags?.includes(advancedFilters.tag)
                : true;
            const matchesStatus = advancedFilters.status
                ? d.status === advancedFilters.status
                : true;

            return matchesFolder && matchesSearch && matchesDateFrom && matchesDateTo
                && matchesFileType && matchesConfidentiality && matchesTag && matchesStatus;
        });
    }, [documents, selectedFolder, searchTerm, advancedFilters]);

    // --- Sorting logic ---
    const sortedDocs = useMemo(() => {
        const sorted = [...filteredDocs];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'name':
                    cmp = a.name.localeCompare(b.name, 'es');
                    break;
                case 'created_at':
                    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status, 'es');
                    break;
                case 'category':
                    cmp = a.category.localeCompare(b.category, 'es');
                    break;
            }
            return sortDirection === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [filteredDocs, sortField, sortDirection]);

    // --- Pagination logic ---
    const totalPages = Math.max(1, Math.ceil(sortedDocs.length / ITEMS_PER_PAGE));
    const paginatedDocs = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedDocs.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedDocs, currentPage]);

    // --- Sorting toggle handler ---
    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }, [sortField]);

    const SortIndicator = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3" style={{ opacity: 0.3 }} />;
        return sortDirection === 'asc'
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />;
    };

    // --- Bulk selection handlers ---
    const toggleSelectItem = useCallback((docId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else next.add(docId);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === paginatedDocs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedDocs.map(d => d.id)));
        }
    }, [paginatedDocs, selectedIds.size]);

    const isAllSelected = paginatedDocs.length > 0 && selectedIds.size === paginatedDocs.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < paginatedDocs.length;

    // --- Bulk action handlers ---
    const handleBulkDownload = () => {
        toast.success(`${selectedIds.size} documento(s) marcados para descarga`);
        setSelectedIds(new Set());
    };

    const handleBulkMove = () => {
        toast.success(`${selectedIds.size} documento(s) marcados para mover`);
        setSelectedIds(new Set());
    };

    const handleBulkArchive = async () => {
        const count = selectedIds.size;
        for (const docId of Array.from(selectedIds)) {
            await fetch(`/api/vdr/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' }),
            });
        }
        setSelectedIds(new Set());
        fetchData();
        toast.success(`${count} documento(s) archivados`);
    };

    // --- Advanced filter helpers ---
    const hasActiveFilters = advancedFilters.dateFrom || advancedFilters.dateTo
        || advancedFilters.fileType || advancedFilters.confidentiality
        || advancedFilters.tag || advancedFilters.status;

    const clearAdvancedFilters = () => {
        setAdvancedFilters({
            dateFrom: '',
            dateTo: '',
            fileType: '',
            confidentiality: '',
            tag: '',
            status: '',
        });
    };

    // --- Navigate folder via breadcrumb ---
    const handleBreadcrumbClick = (folderId: string | null) => {
        setSelectedFolder(folderId);
    };

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
                <div className="skeleton h-8 w-64" style={{ borderRadius: 'var(--g-radius-md)' }} />
                <div className="skeleton h-96 w-full" style={{ borderRadius: 'var(--g-radius-lg)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--g-link)' }}>
                        <ArrowLeft className="h-4 w-4" /> Proyecto
                    </Link>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        Data Room Virtual
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGaps(!showGaps)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: gapStats && gapStats.gaps_count > 0 ? 'var(--status-warning)' : 'var(--g-border-default)',
                            color: gapStats && gapStats.gaps_count > 0 ? 'var(--status-warning)' : 'var(--g-text-secondary)',
                        }}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {gapStats ? `${gapStats.gaps_count} gaps · ${gapStats.coverage_pct}% cobertura` : 'Gap Analysis'}
                    </button>
                    <button
                        onClick={() => setShowUpload(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                        }}
                    >
                        <Upload className="h-3.5 w-3.5" /> Subir Documento
                    </button>
                </div>
            </div>

            {/* Breadcrumb Navigation */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', flexWrap: 'wrap' }}>
                <button
                    onClick={() => handleBreadcrumbClick(null)}
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{
                        color: selectedFolder ? 'var(--g-link)' : 'var(--g-text-primary)',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: 'var(--g-space-1) var(--g-space-2)',
                        borderRadius: 'var(--g-radius-sm)',
                    }}
                >
                    <Home className="h-3.5 w-3.5" />
                    Inicio
                </button>
                {folderPath.map((folder, idx) => {
                    const isLast = idx === folderPath.length - 1;
                    return (
                        <span key={folder.id} className="inline-flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" style={{ color: 'var(--g-text-secondary)' }} />
                            <button
                                onClick={() => handleBreadcrumbClick(folder.id)}
                                className="text-xs font-medium"
                                style={{
                                    color: isLast ? 'var(--g-text-primary)' : 'var(--g-link)',
                                    fontWeight: isLast ? 600 : 400,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 'var(--g-space-1) var(--g-space-2)',
                                    borderRadius: 'var(--g-radius-sm)',
                                }}
                            >
                                {folder.name}
                            </button>
                        </span>
                    );
                })}
            </nav>

            {/* Gap Analysis Panel */}
            {showGaps && gapStats && (
                <div className="g-card p-4" style={{ borderRadius: 'var(--g-radius-lg)', borderLeft: '3px solid var(--status-warning)' }}>
                    <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--g-text-primary)' }}>
                        Analisis de Brechas Documentales
                    </h3>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                        {[
                            { label: 'Esperados', value: gapStats.total_expected, color: 'var(--g-text-primary)' },
                            { label: 'Subidos', value: gapStats.total_uploaded, color: 'var(--status-success)' },
                            { label: 'Pendientes', value: gapStats.gaps_count, color: 'var(--status-warning)' },
                            { label: 'Cobertura', value: `${gapStats.coverage_pct}%`, color: gapStats.coverage_pct >= 80 ? 'var(--status-success)' : 'var(--status-warning)' },
                        ].map((s, i) => (
                            <div key={i} className="text-center p-2 border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)' }}>
                                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                    {gaps.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {gaps.slice(0, 10).map((g, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs p-2" style={{ backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-sm)' }}>
                                    <AlertTriangle className="h-3 w-3" style={{ color: g.is_mandatory ? 'var(--status-error)' : 'var(--status-warning)' }} />
                                    <span style={{ color: 'var(--g-text-primary)' }}>{g.name}</span>
                                    <span style={{ color: 'var(--g-text-secondary)' }}>{'\u00B7'} {g.area_code} {'\u00B7'} {g.category}</span>
                                    {g.is_mandatory && <span className="px-1 text-xs font-medium" style={{ color: 'var(--status-error)' }}>Obligatorio</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main Layout: Folder Tree + Document List + Detail */}
            <div className="grid grid-cols-12 gap-4" style={{ minHeight: '500px' }}>
                {/* Folder Tree */}
                <div className="col-span-3 g-card p-4" style={{ borderRadius: 'var(--g-radius-lg)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>Carpetas</h3>
                        <button onClick={() => setShowNewFolder(true)} className="p-1 hover:opacity-70" style={{ color: 'var(--g-text-secondary)' }}>
                            <FolderPlus className="h-4 w-4" />
                        </button>
                    </div>
                    {showNewFolder && (
                        <div className="flex gap-2 mb-3">
                            <input
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Nombre carpeta"
                                className="flex-1 h-7 px-2 text-xs border"
                                style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <button onClick={handleCreateFolder} className="px-2 h-7 text-xs font-medium" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}>
                                OK
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setSelectedFolder(null)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs"
                        style={{
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: !selectedFolder ? 'var(--g-sec-100)' : 'transparent',
                            color: 'var(--g-text-primary)',
                            fontWeight: !selectedFolder ? 600 : 400,
                        }}
                    >
                        <FolderOpen className="h-3.5 w-3.5" /> Todos los documentos
                    </button>
                    {rootFolders.map(folder => (
                        <div key={folder.id}>
                            <button
                                onClick={() => setSelectedFolder(folder.id)}
                                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs mt-0.5"
                                style={{
                                    borderRadius: 'var(--g-radius-sm)',
                                    backgroundColor: selectedFolder === folder.id ? 'var(--g-sec-100)' : 'transparent',
                                    color: 'var(--g-text-primary)',
                                    fontWeight: selectedFolder === folder.id ? 600 : 400,
                                }}
                            >
                                <FolderOpen className="h-3.5 w-3.5" style={{ color: 'var(--g-brand-3308)' }} />
                                {folder.name}
                                {folder.area_code && <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>({folder.area_code})</span>}
                            </button>
                            {getChildFolders(folder.id).map(child => (
                                <button
                                    key={child.id}
                                    onClick={() => setSelectedFolder(child.id)}
                                    className="w-full text-left flex items-center gap-2 pl-6 pr-2 py-1 text-xs mt-0.5"
                                    style={{
                                        borderRadius: 'var(--g-radius-sm)',
                                        backgroundColor: selectedFolder === child.id ? 'var(--g-sec-100)' : 'transparent',
                                        color: 'var(--g-text-secondary)',
                                        fontWeight: selectedFolder === child.id ? 600 : 400,
                                    }}
                                >
                                    <FolderOpen className="h-3 w-3" /> {child.name}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Document List */}
                <div className="col-span-5 g-card p-4" style={{ borderRadius: 'var(--g-radius-lg)', display: 'flex', flexDirection: 'column' }}>
                    {/* Search bar + filter toggle */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar documentos..."
                                className="w-full h-8 pl-7 pr-3 text-xs border"
                                style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                            />
                        </div>
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                borderColor: hasActiveFilters ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                color: hasActiveFilters ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                backgroundColor: hasActiveFilters ? 'var(--g-sec-100)' : 'transparent',
                            }}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Filtros
                            {hasActiveFilters && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '14px', height: '14px', borderRadius: '50%',
                                    backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)',
                                    fontSize: '9px', fontWeight: 700,
                                }}>
                                    !
                                </span>
                            )}
                        </button>
                        <span className="text-xs" style={{ color: 'var(--g-text-secondary)', whiteSpace: 'nowrap' }}>{sortedDocs.length} docs</span>
                    </div>

                    {/* Advanced Filters Bar */}
                    {showAdvancedFilters && (
                        <div
                            className="g-card mb-3 p-3"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-muted)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>Filtros Avanzados</span>
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAdvancedFilters}
                                        className="inline-flex items-center gap-1 text-xs"
                                        style={{ color: 'var(--g-link)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        <X className="h-3 w-3" /> Limpiar
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--g-space-2)' }}>
                                {/* Date From */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <Calendar className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Fecha desde
                                    </label>
                                    <input
                                        type="date"
                                        value={advancedFilters.dateFrom}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, dateFrom: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                </div>
                                {/* Date To */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <Calendar className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Fecha hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={advancedFilters.dateTo}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, dateTo: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                </div>
                                {/* File Type / Category */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <FileText className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Tipo
                                    </label>
                                    <select
                                        value={advancedFilters.fileType}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, fileType: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    >
                                        <option value="">Todos</option>
                                        {allCategories.map(c => (
                                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Status */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <CheckCircle2 className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Estado
                                    </label>
                                    <select
                                        value={advancedFilters.status}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, status: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    >
                                        <option value="">Todos</option>
                                        {Object.entries(VDR_STATUS).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Confidentiality */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <Lock className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Confidencialidad
                                    </label>
                                    <select
                                        value={advancedFilters.confidentiality}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, confidentiality: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    >
                                        <option value="">Todos</option>
                                        <option value="confidencial">Confidencial</option>
                                        <option value="no_confidencial">No confidencial</option>
                                    </select>
                                </div>
                                {/* Tags */}
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--g-text-secondary)' }}>
                                        <Tag className="inline h-3 w-3" style={{ marginRight: '2px' }} />
                                        Etiqueta
                                    </label>
                                    <select
                                        value={advancedFilters.tag}
                                        onChange={e => setAdvancedFilters(f => ({ ...f, tag: e.target.value }))}
                                        className="w-full h-7 px-2 text-xs border"
                                        style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    >
                                        <option value="">Todas</option>
                                        {allTags.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Column Header Row (sortable) */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 1fr 90px 80px',
                            gap: 'var(--g-space-2)',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderBottom: '1px solid var(--g-border-default)',
                            marginBottom: 'var(--g-space-1)',
                        }}
                    >
                        {/* Select All checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                                onChange={toggleSelectAll}
                                style={{ accentColor: 'var(--g-brand-3308)', cursor: 'pointer', width: '14px', height: '14px' }}
                                title="Seleccionar todos"
                            />
                        </div>
                        {/* Name header */}
                        <button
                            onClick={() => handleSort('name')}
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: 'var(--g-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            Nombre <SortIndicator field="name" />
                        </button>
                        {/* Date header */}
                        <button
                            onClick={() => handleSort('created_at')}
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: 'var(--g-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            Fecha <SortIndicator field="created_at" />
                        </button>
                        {/* Status header */}
                        <button
                            onClick={() => handleSort('status')}
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: 'var(--g-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, justifyContent: 'flex-end' }}
                        >
                            Estado <SortIndicator field="status" />
                        </button>
                    </div>

                    {/* Document rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflowY: 'auto' }}>
                        {paginatedDocs.length === 0 ? (
                            <p className="text-xs text-center py-8" style={{ color: 'var(--g-text-secondary)' }}>
                                No hay documentos{selectedFolder ? ' en esta carpeta' : ''}.
                            </p>
                        ) : paginatedDocs.map(doc => {
                            const st = VDR_STATUS[doc.status] || VDR_STATUS.draft;
                            const isChecked = selectedIds.has(doc.id);
                            return (
                                <div
                                    key={doc.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '28px 1fr 90px 80px',
                                        gap: 'var(--g-space-2)',
                                        alignItems: 'center',
                                        padding: '8px 10px',
                                        borderRadius: 'var(--g-radius-md)',
                                        border: '1px solid',
                                        borderColor: selectedDoc?.id === doc.id ? 'var(--g-brand-3308)' : isChecked ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                        backgroundColor: selectedDoc?.id === doc.id ? 'var(--g-sec-100)' : isChecked ? 'var(--g-sec-100)' : 'var(--g-surface-card)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {/* Checkbox */}
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={e => { e.stopPropagation(); toggleSelectItem(doc.id); }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleSelectItem(doc.id)}
                                            style={{ accentColor: 'var(--g-brand-3308)', cursor: 'pointer', width: '14px', height: '14px' }}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    {/* Name + metadata */}
                                    <div
                                        className="min-w-0"
                                        onClick={() => handleSelectDoc(doc)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}
                                    >
                                        <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--g-brand-3308)' }} />
                                        <div className="min-w-0" style={{ flex: 1 }}>
                                            <p className="text-xs font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>{doc.name}</p>
                                            <p className="text-xs truncate" style={{ color: 'var(--g-text-secondary)' }}>
                                                {doc.area_code || 'General'} {'\u00B7'} {doc.category}
                                            </p>
                                        </div>
                                        {doc.is_confidential && <Shield className="h-3 w-3 shrink-0" style={{ color: 'var(--status-error)' }} />}
                                    </div>
                                    {/* Date */}
                                    <span
                                        className="text-xs"
                                        style={{ color: 'var(--g-text-secondary)' }}
                                        onClick={() => handleSelectDoc(doc)}
                                    >
                                        {formatDate(doc.created_at)}
                                    </span>
                                    {/* Status badge */}
                                    <div
                                        style={{ display: 'flex', justifyContent: 'flex-end' }}
                                        onClick={() => handleSelectDoc(doc)}
                                    >
                                        <span className="px-1.5 py-0.5 text-xs" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>
                                            {st.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {sortedDocs.length > ITEMS_PER_PAGE && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: 'var(--g-space-3)',
                                borderTop: '1px solid var(--g-border-default)',
                                marginTop: 'var(--g-space-3)',
                            }}
                        >
                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                {((currentPage - 1) * ITEMS_PER_PAGE) + 1}
                                {' - '}
                                {Math.min(currentPage * ITEMS_PER_PAGE, sortedDocs.length)}
                                {' de '}
                                {sortedDocs.length}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs font-medium border disabled:opacity-40"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        borderColor: 'var(--g-border-default)',
                                        color: 'var(--g-text-primary)',
                                        backgroundColor: 'var(--g-surface-card)',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    Anterior
                                </button>
                                <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs font-medium border disabled:opacity-40"
                                    style={{
                                        borderRadius: 'var(--g-radius-md)',
                                        borderColor: 'var(--g-border-default)',
                                        color: 'var(--g-text-primary)',
                                        backgroundColor: 'var(--g-surface-card)',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Document Detail + Versions */}
                <div className="col-span-4 g-card p-4" style={{ borderRadius: 'var(--g-radius-lg)' }}>
                    {selectedDoc ? (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>Detalle</h3>
                                <button onClick={() => { setSelectedDoc(null); setVersions([]); }} className="p-1" style={{ color: 'var(--g-text-secondary)' }}>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Nombre</p>
                                    <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>{selectedDoc.name}</p>
                                </div>
                                {selectedDoc.description && (
                                    <div>
                                        <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Descripcion</p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-primary)' }}>{selectedDoc.description}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Area</p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-primary)' }}>{selectedDoc.area_code || 'General'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Categoria</p>
                                        <p className="text-xs" style={{ color: 'var(--g-text-primary)' }}>{selectedDoc.category}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedDoc.is_confidential && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--status-error)', color: 'var(--g-text-inverse)' }}>
                                            <Shield className="h-3 w-3" /> Confidencial
                                        </span>
                                    )}
                                    {selectedDoc.tags.map((tag, i) => (
                                        <span key={i} className="px-2 py-0.5 text-xs" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--g-surface-muted)', color: 'var(--g-text-secondary)' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Version History */}
                                <div className="border-t pt-3" style={{ borderColor: 'var(--g-border-default)' }}>
                                    <h4 className="font-bold text-xs mb-2" style={{ color: 'var(--g-text-primary)' }}>
                                        Historial de Versiones ({versions.length})
                                    </h4>
                                    {versions.length === 0 ? (
                                        <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Sin versiones registradas.</p>
                                    ) : versions.map(v => (
                                        <div key={v.id} className="flex items-center gap-2 p-2 mb-1 border" style={{ borderRadius: 'var(--g-radius-sm)', borderColor: 'var(--g-border-default)' }}>
                                            <span className="font-bold text-xs" style={{ color: 'var(--g-brand-3308)' }}>v{v.version_number}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs truncate" style={{ color: 'var(--g-text-primary)' }}>{v.original_filename}</p>
                                                <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {formatFileSize(v.file_size_bytes)} {'\u00B7'} {v.file_type} {'\u00B7'} {formatDate(v.created_at)}
                                                </p>
                                            </div>
                                            {v.checksum_sha256 && (
                                                <span title="SHA-256 verificado">
                                                    <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: 'var(--status-success)' }} />
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <FileText className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>Selecciona un documento para ver su detalle</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 'var(--g-space-6)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-3)',
                        padding: 'var(--g-space-3) var(--g-space-5)',
                        borderRadius: 'var(--g-radius-xl)',
                        backgroundColor: 'var(--g-surface-card)',
                        border: '1px solid var(--g-border-default)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    }}
                >
                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-primary)' }}>
                        {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
                    </span>
                    <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--g-border-default)' }} />
                    <button
                        onClick={handleBulkDownload}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            color: 'var(--g-text-primary)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <Download className="h-3.5 w-3.5" /> Descargar
                    </button>
                    <button
                        onClick={handleBulkMove}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--g-border-default)',
                            color: 'var(--g-text-primary)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <FolderInput className="h-3.5 w-3.5" /> Mover
                    </button>
                    <button
                        onClick={handleBulkArchive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            borderColor: 'var(--status-warning)',
                            color: 'var(--status-warning)',
                            backgroundColor: 'var(--g-surface-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <Archive className="h-3.5 w-3.5" /> Archivar
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="p-1"
                        style={{ color: 'var(--g-text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}
                        title="Deseleccionar todo"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="g-card p-6 w-full max-w-md" style={{ borderRadius: 'var(--g-radius-xl)' }}>
                        <h3 className="font-bold mb-4" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>Nuevo Documento</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Nombre *</label>
                                <input value={uploadName} onChange={e => setUploadName(e.target.value)} className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Categoria</label>
                                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}>
                                    {CATEGORY_OPTIONS.map(c => (
                                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)' }}>Cancelar</button>
                            <button onClick={handleUploadDoc} disabled={!uploadName.trim()} className="px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}>Crear</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
