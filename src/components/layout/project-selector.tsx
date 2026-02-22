'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FolderKanban, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROJECT_ID_RE = /^\/projects\/([^/]+)/;

const STATUS_COLORS: Record<string, string> = {
    active: '#4ade80',
    review: '#fbbf24',
    draft: '#9ca3af',
    closed: '#60a5fa',
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
                    padding: collapsed ? '8px 0' : '8px 12px',
                    marginBottom: '8px',
                }}
            >
                <div
                    style={{
                        height: collapsed ? '36px' : '40px',
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
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
                style={{ position: 'relative', padding: '8px 0', marginBottom: '8px' }}
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
                        backgroundColor: open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        if (!open) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
                    }}
                    onMouseLeave={(e) => {
                        if (!open) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
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
                                top: '4px',
                                right: '4px',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
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
                            left: 'calc(100% + 8px)',
                            width: '260px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: 'var(--g-brand-3308)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 'var(--g-radius-md)',
                            zIndex: 50,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            padding: '4px',
                        }}
                    >
                        <div
                            style={{
                                padding: '8px 10px 6px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'rgba(255,255,255,0.5)',
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
                                        padding: '8px 10px',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
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
                                            borderRadius: '50%',
                                            backgroundColor: STATUS_COLORS[project.status] || STATUS_COLORS.draft,
                                            flexShrink: 0,
                                        }}
                                    />
                                    {/* Project name */}
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: 'var(--g-text-body)',
                                            fontWeight: isActive ? 600 : 400,
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
                                                color: 'rgba(255,255,255,0.5)',
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
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        margin: '8px 8px 0',
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
            style={{ position: 'relative', padding: '8px 12px', marginBottom: '4px' }}
        >
            {/* Trigger button */}
            <button
                onClick={toggleOpen}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={currentProject ? currentProject.name : 'Seleccionar Proyecto'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--g-radius-md)',
                    backgroundColor: open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.backgroundColor = open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Status dot */}
                            <span
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
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
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.6)',
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
                        color: 'rgba(255,255,255,0.5)',
                        flexShrink: 0,
                    }}
                />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    role="listbox"
                    aria-label="Lista de proyectos"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '12px',
                        right: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        backgroundColor: 'var(--g-brand-3308)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 'var(--g-radius-md)',
                        zIndex: 50,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        padding: '4px',
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
                                    padding: '8px 10px',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.15)' : 'transparent';
                                }}
                            >
                                {/* Status dot */}
                                <span
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
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
                                            fontWeight: isActive ? 600 : 400,
                                            color: 'var(--g-text-inverse)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            lineHeight: '1.3',
                                        }}
                                    >
                                        {project.name}
                                    </span>
                                    {project.target_company && (
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: 'var(--g-text-caption)',
                                                color: 'rgba(255,255,255,0.45)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                lineHeight: '1.3',
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
                                            color: 'rgba(255,255,255,0.5)',
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
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    margin: '8px 0 0',
                }}
            />
        </div>
    );
}
