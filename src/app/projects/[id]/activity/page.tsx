'use client';

import { useState, useEffect } from 'react';
import { useResolvedParams } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Activity, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DDProject } from '@/lib/supabase';
import ActivityTimeline from '@/components/notifications/ActivityTimeline';
import PresenceIndicator from '@/components/notifications/PresenceIndicator';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = useResolvedParams(params);
    const [project, setProject] = useState<DDProject | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProject() {
            const { data } = await supabase
                .from('dd_projects')
                .select('*')
                .eq('id', projectId)
                .single();
            setProject(data);
            setLoading(false);
        }
        loadProject();
    }, [projectId]);

    return (
        <div>
            {/* Breadcrumb */}
            <nav
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-2)',
                    marginBottom: 'var(--g-space-6)',
                    fontSize: 'var(--g-text-small)',
                    color: 'var(--g-text-muted)',
                }}
            >
                <Link
                    href="/projects"
                    style={{
                        color: 'var(--g-text-muted)',
                        transition: 'color var(--g-transition-fast)',
                    }}
                >
                    Proyectos
                </Link>
                <ChevronRight style={{ width: '14px', height: '14px' }} />
                {project ? (
                    <Link
                        href={`/projects/${projectId}`}
                        style={{
                            color: 'var(--g-text-muted)',
                            transition: 'color var(--g-transition-fast)',
                        }}
                    >
                        {project.name}
                    </Link>
                ) : (
                    <span>...</span>
                )}
                <ChevronRight style={{ width: '14px', height: '14px' }} />
                <span style={{ color: 'var(--g-text-primary)', fontWeight: 500 }}>Actividad</span>
            </nav>

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--g-space-6)',
                    gap: 'var(--g-space-4)',
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
                    <Link
                        href={`/projects/${projectId}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px solid var(--g-border-default)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-secondary)',
                            transition: 'all var(--g-transition-fast)',
                        }}
                        title="Volver al proyecto"
                    >
                        <ArrowLeft style={{ width: '18px', height: '18px' }} />
                    </Link>
                    <div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--g-space-2)',
                            }}
                        >
                            <Activity
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    color: 'var(--g-brand-bright)',
                                }}
                            />
                            <h1
                                style={{
                                    fontSize: 'var(--g-text-h1)',
                                    fontWeight: 700,
                                    color: 'var(--g-text-primary)',
                                    margin: 0,
                                }}
                            >
                                Actividad del Proyecto
                            </h1>
                        </div>
                        {project && (
                            <p
                                style={{
                                    fontSize: 'var(--g-text-small)',
                                    color: 'var(--g-text-muted)',
                                    marginTop: '4px',
                                }}
                            >
                                {project.name} &mdash; {project.target_company}
                            </p>
                        )}
                    </div>
                </div>

                {/* Presence Indicator */}
                <PresenceIndicator projectId={projectId} />
            </div>

            {/* Timeline */}
            {loading ? (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: 'var(--g-space-12)',
                    }}
                >
                    <div
                        className="skeleton"
                        style={{ width: '100%', maxWidth: '600px', height: '200px' }}
                    />
                </div>
            ) : (
                <ActivityTimeline projectId={projectId} />
            )}
        </div>
    );
}
