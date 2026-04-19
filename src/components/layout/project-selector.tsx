'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FolderKanban, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROJECT_ID_RE = /^\/projects\/([^/]+)/;

const STATUS_COLORS: Record<string, string> = {
    active: 'var(--g-status-active)',
    review: 'var(--g-status-review)',
    draft: 'var(--g-status-draft)',
    closed: 'var(--g-status-closed)',
};

const STATUS_LABELS: Record<string, string> = {
    active: 'Activo',
    review: 'En revision',
    draft: 'Borrador',
    closed: 'Cerrado',
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectItem {
    id: string;
    name: string;
    target_company: string;
    status: 'draft' | 'active' | 'review' | 'closed';
    deal_type: string;
}

interface Props {
    collapsed: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProjectSelector({ collapsed }: Props) {
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);

    /* Detect current project from URL */
    const match = PROJECT_ID_RE.exec(pathname);
    const currentProjectId = match ? match[1] : null;
    const currentProject = projects.find((p) => p.id === currentProjectId);

    /* -------------------------------------------------------------- */
    /*  Fetch projects on mount                                        */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        const token = localStorage.getItem('dd_session_token');
        if (!token) {
            setLoading(false);
            return;
        }

        fetch('/api/projects', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setProjects(data.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    /* -------------------------------------------------------------- */
    /*  Close dropdown on click outside                                */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    /* -------------------------------------------------------------- */
    /*  Handlers                                                       */
    /* -------------------------------------------------------------- */

    function selectProject(id: string) {
        router.push(`/projects/${id}`);
        setOpen(false);
    }

    function toggleOpen() {
        if (projects.length > 0) setOpen((prev) => !prev);
    }

    /* -------------------------------------------------------------- */
    /*  Don't render while loading or when there are no projects        */
    /* -------------------------------------------------------------- */

    if (loading) {
        return (
            <div
                style={{
                    padding: collapsed ? 'var(--g-space-2) 0' : 'var(--g-space-2) var(--g-space-3)',
                    marginBottom: 'var(--g-space-2)',
                }}
            >
                <div
                    style={{
                        height: collapsed ? '36px' : '40px',
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-sidebar-surface-subtle)',
                        animation: 'pulse 2s ease-in-out infinite',
                    }}
                />
            </div>
        );
    }

    if (projects.length === 0) return null;

    /* -------------------------------------------------------------- */
    /*  Collapsed state: icon-only with popover                        */
    /* -------------------------------------------------------------- */

    if (collapsed) {
        return (
            <div
                ref={containerRef}
                style={{ position: 'relative', padding: 'var(--g-space-2) 0', marginBottom: 'var(--g-space-2)' }}
            >
                {/* Trigger: icon button */}
                <button
                    onClick={toggleOpen}
                    title={currentProject ? currentProject.name : 'Seleccionar Proyecto'}
                    aria-label={currentProject ? currentProject.name : 'Seleccionar Proyecto'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        margin: '0 auto',
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: open ? 'var(--g-sidebar-surface-selected)' : 'var(--g-sidebar-surface-hover)',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color var(--g-transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                        if (!open) e.currentTarget.style.backgroundColor = 'var(--g-sidebar-surface-active-hover)';
                    }}
                    onMouseLeave={(e) => {
                        if (!open) e.currentTarget.style.backgroundColor = 'var(--g-sidebar-surface-hover)';
                    }}
                >
                    <FolderKanban
                        style={{
                            width: '18px',
                            height: '18px',
                            color: 'var(--g-text-inverse)',
                        }}
                    />
                    {/* Status dot overlay */}
                    {currentProject && (
                        <span
                            style={{
                                position: 'absolute',
                                top: 'var(--g-space-1)',
                                right: 'var(--g-space-1)',
                                width: '8px',
                                height: '8px',
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: STATUS_COLORS[currentProject.status] || STATUS_COLORS.draft,
                                border: '1.5px solid var(--g-brand-3308)',
                            }}
                        />
                    )}
                </button>

                {/* Popover dropdown (positioned to the right) */}
                {open && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 'calc(100% + var(--g-space-2))',
                            width: '260px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: 'var(--g-brand-3308)',
                            border: '1px solid var(--g-sidebar-surface-selected)',
                            borderRadius: 'var(--g-radius-md)',
                            zIndex: 50,
                            boxShadow: 'var(--g-shadow-popover)',
                            padding: 'var(--g-space-1)',
                        }}
                    >
                        <div
                            style={{
                                padding: 'var(--g-space-2) 10px var(--g-space-1)',
                                fontSize: 'var(--g-text-caption)',
                                fontWeight: 'var(--g-font-weight-bold)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--g-sidebar-text-muted)',
                            }}
                        >
                            Proyectos
                        </div>
                        {projects.map((project) => {
                            const isActive = project.id === currentProjectId;
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => selectProject(project.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') selectProject(project.id);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: 'var(--g-space-2) 10px',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: isActive ? 'var(--g-sidebar-surface-selected)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'background-color var(--g-transition-fast)',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--g-sidebar-surface-active-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {/* Status dot */}
                                    <span
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: STATUS_COLORS[project.status] || STATUS_COLORS.draft,
                                            flexShrink: 0,
                                        }}
                                    />
                                    {/* Project name */}
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: 'var(--g-text-body)',
                                            fontWeight: isActive ? 600 : 'var(--g-font-weight-regular)',
                                            color: 'var(--g-text-inverse)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {project.name}
                                    </span>
                                    {/* Arrow hint */}
                                    {isActive && (
                                        <ArrowRight
                                            style={{
                                                width: '14px',
                                                height: '14px',
                                                color: 'var(--g-sidebar-text-muted)',
                                                flexShrink: 0,
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Bottom separator */}
                <hr
                    style={{
                        border: 'none',
                        borderTop: '1px solid var(--g-sidebar-divider)',
                        margin: 'var(--g-space-2) var(--g-space-2) 0',
                    }}
                />
            </div>
        );
    }

    /* -------------------------------------------------------------- */
    /*  Expanded state: full selector with inline dropdown             */
    /* -------------------------------------------------------------- */

    const ChevronIcon = open ? ChevronUp : ChevronDown;

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', padding: 'var(--g-space-2) var(--g-space-3)', marginBottom: 'var(--g-space-1)' }}
        >
            {/* Trigger button */}
            <button
                onClick={toggleOpen}
                aria-expanded={open}
                aria-controls={open ? 'project-selector-panel' : undefined}
                aria-haspopup="listbox"
                aria-label={currentProject ? currentProject.name : 'Seleccionar Proyecto'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: 'var(--g-space-2) 10px',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: open ? 'var(--g-sidebar-surface-selected)' : 'var(--g-sidebar-surface-hover)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color var(--g-transition-fast)',
                }}
                onMouseEnter={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = 'var(--g-sidebar-surface-active-hover)';
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = open ? 'var(--g-sidebar-surface-selected)' : 'var(--g-sidebar-surface-hover)';
                }}
            >
                <FolderKanban
                    style={{
                        width: '18px',
                        height: '18px',
                        color: 'var(--g-text-inverse)',
                        flexShrink: 0,
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    {currentProject ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                            {/* Status dot */}
                            <span
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: STATUS_COLORS[currentProject.status] || STATUS_COLORS.draft,
                                    flexShrink: 0,
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 'var(--g-text-body)',
                                    fontWeight: 600,
                                    color: 'var(--g-text-inverse)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {currentProject.name}
                            </span>
                        </div>
                    ) : (
                        <span
                            style={{
                                fontSize: 'var(--g-text-body)',
                                fontWeight: 'var(--g-font-weight-medium)',
                                color: 'var(--g-sidebar-placeholder)',
                            }}
                        >
                            Seleccionar Proyecto
                        </span>
                    )}
                </div>
                <ChevronIcon
                    style={{
                        width: '14px',
                        height: '14px',
                        color: 'var(--g-sidebar-text-muted)',
                        flexShrink: 0,
                    }}
                />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    id="project-selector-panel"
                    role="listbox"
                    aria-label="Lista de proyectos"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + var(--g-space-1))',
                        left: 'var(--g-space-3)',
                        right: 'var(--g-space-3)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        backgroundColor: 'var(--g-brand-3308)',
                        border: '1px solid var(--g-sidebar-surface-selected)',
                        borderRadius: 'var(--g-radius-md)',
                        zIndex: 50,
                        boxShadow: 'var(--g-shadow-popover)',
                        padding: 'var(--g-space-1)',
                    }}
                >
                    {projects.map((project) => {
                        const isActive = project.id === currentProjectId;
                        return (
                            <div
                                key={project.id}
                                onClick={() => selectProject(project.id)}
                                role="option"
                                tabIndex={0}
                                aria-selected={isActive}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') selectProject(project.id);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: 'var(--g-space-2) 10px',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: isActive ? 'var(--g-sidebar-surface-selected)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background-color var(--g-transition-fast)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--g-sidebar-surface-active-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'var(--g-sidebar-surface-selected)' : 'transparent';
                                }}
                            >
                                {/* Status dot */}
                                <span
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: STATUS_COLORS[project.status] || STATUS_COLORS.draft,
                                        flexShrink: 0,
                                    }}
                                    title={STATUS_LABELS[project.status] || project.status}
                                />
                                {/* Project info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 'var(--g-text-body)',
                                            fontWeight: isActive ? 600 : 'var(--g-font-weight-regular)',
                                            color: 'var(--g-text-inverse)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            lineHeight: 'var(--g-leading-tight)',
                                        }}
                                    >
                                        {project.name}
                                    </span>
                                    {project.target_company && (
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: 'var(--g-text-caption)',
                                                color: 'var(--g-sidebar-text-faint)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                lineHeight: 'var(--g-leading-tight)',
                                                marginTop: '1px',
                                            }}
                                        >
                                            {project.target_company}
                                        </span>
                                    )}
                                </div>
                                {/* Active indicator arrow */}
                                {isActive && (
                                    <ArrowRight
                                        style={{
                                            width: '14px',
                                            height: '14px',
                                            color: 'var(--g-sidebar-text-muted)',
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom separator */}
            <hr
                style={{
                    border: 'none',
                    borderTop: '1px solid var(--g-sidebar-divider)',
                    margin: 'var(--g-space-2) 0 0',
                }}
            />
        </div>
    );
}
