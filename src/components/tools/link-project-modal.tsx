'use client';

import { useEffect, useState } from 'react';
import { X, Link2, Loader2 } from 'lucide-react';
import type { DDProject } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface LinkProjectModalProps {
    open: boolean;
    onClose: () => void;
    executionId: string;
    onLinked?: (projectId: string, projectName: string) => void;
}

export default function LinkProjectModal({ open, onClose, executionId, onLinked }: LinkProjectModalProps) {
    const [projects, setProjects] = useState<DDProject[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            supabase
                .from('dd_projects')
                .select('*')
                .in('status', ['active', 'draft', 'review'])
                .order('updated_at', { ascending: false })
                .then(({ data }) => {
                    setProjects(data || []);
                    setLoading(false);
                });
        }
    }, [open]);

    async function handleLink() {
        if (!selectedId) return;
        setLinking(true);

        const resp = await fetch('/api/tools/link-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                execution_id: executionId,
                project_id: selectedId,
                notes: notes.trim() || null,
            }),
        });

        if (resp.ok) {
            const data = await resp.json();
            onLinked?.(selectedId, data.project_name);
            setSelectedId('');
            setNotes('');
            onClose();
        }
        setLinking(false);
    }

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 transition-opacity"
                style={{ backgroundColor: 'var(--g-overlay-light)' }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 animate-fade-in"
                style={{
                    backgroundColor: 'var(--g-surface-card)',
                    borderRadius: 'var(--g-radius-lg)',
                    boxShadow: 'var(--g-shadow-modal)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Vincular a proyecto"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" style={{ color: 'var(--g-brand-3308)' }} />
                        <h2 className="text-lg font-bold" style={{ color: 'var(--g-text-primary)' }}>
                            Vincular a Proyecto
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 transition-colors hover:opacity-80"
                        style={{ color: 'var(--g-text-secondary)' }}
                        aria-label="Cerrar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Project select */}
                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="link-project-select"
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--g-text-primary)' }}
                        >
                            Proyecto destino
                        </label>
                        {loading ? (
                            <div className="skeleton h-10 w-full" style={{ borderRadius: 'var(--g-radius-md)' }} />
                        ) : (
                            <select
                                id="link-project-select"
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border"
                                style={{
                                    borderColor: 'var(--g-border-default)',
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-surface-card)',
                                    color: 'var(--g-text-primary)',
                                }}
                            >
                                <option value="">Seleccionar proyecto...</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — {p.target_company}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="link-project-notes"
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--g-text-primary)' }}
                        >
                            Notas (opcional)
                        </label>
                        <textarea
                            id="link-project-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 text-sm border resize-none"
                            style={{
                                borderColor: 'var(--g-border-default)',
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                            }}
                            placeholder="Contexto de la vinculación..."
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium border transition-colors hover:opacity-80"
                        style={{
                            borderColor: 'var(--g-border-default)',
                            borderRadius: 'var(--g-radius-md)',
                            color: 'var(--g-text-primary)',
                            backgroundColor: 'transparent',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleLink}
                        disabled={!selectedId || linking}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-brand-3308)',
                            color: 'var(--g-text-inverse)',
                        }}
                    >
                        {linking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Vincular
                    </button>
                </div>
            </div>
        </>
    );
}
