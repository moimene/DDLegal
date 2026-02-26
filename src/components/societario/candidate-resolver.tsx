'use client';

import { useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import type { SociedadCandidate } from '@/lib/supabase';

interface CandidateResolverProps {
    candidates: SociedadCandidate[];
    requestId: string;
    onResolved: (sociedadId: string) => void;
}

export default function CandidateResolver({ candidates, requestId, onResolved }: CandidateResolverProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleConfirm() {
        if (!selected) return;
        setLoading(true);
        setError('');

        try {
            const resp = await fetch('/api/societario/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: requestId,
                    selected_candidate_id: selected,
                }),
            });

            if (resp.ok) {
                const data = await resp.json();
                onResolved(data.sociedad_id);
            } else {
                const data = await resp.json();
                setError(data.error || 'Error al resolver identidad');
            }
        } catch {
            setError('Error de conexión');
        }
        setLoading(false);
    }

    if (candidates.length === 0) {
        return (
            <div
                className="border p-4"
                style={{
                    borderColor: 'var(--status-warning)',
                    borderRadius: 'var(--g-radius-lg)',
                    backgroundColor: 'var(--g-surface-card)',
                }}
            >
                <p className="text-sm" style={{ color: 'var(--g-text-primary)' }}>
                    No se encontraron candidatos. Se creará una nueva entidad.
                </p>
            </div>
        );
    }

    return (
        <div
            className="border"
            style={{
                borderColor: 'var(--status-warning)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
                boxShadow: 'var(--g-shadow-card)',
            }}
        >
            <div className="p-4 border-b" style={{ borderColor: 'var(--g-border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" style={{ color: 'var(--status-warning)' }} aria-hidden="true" />
                    <h3 className="text-sm font-bold" style={{ color: 'var(--g-text-primary)' }}>
                        Resolución de identidad requerida
                    </h3>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                    Se encontraron múltiples coincidencias. Selecciona la sociedad correcta.
                </p>
            </div>

            <div className="divide-y" style={{ '--tw-divide-color': 'var(--g-border-subtle)' } as React.CSSProperties}>
                {candidates.map(candidate => {
                    const isSelected = selected === candidate.id;
                    const scorePercent = Math.round(candidate.similarity_score * 100);
                    const scoreColor = scorePercent >= 80
                        ? 'var(--status-success)'
                        : scorePercent >= 60
                            ? 'var(--status-warning)'
                            : 'var(--status-error)';

                    return (
                        <button
                            key={candidate.id}
                            onClick={() => setSelected(candidate.id)}
                            className="w-full p-4 text-left transition-colors"
                            style={{
                                backgroundColor: isSelected
                                    ? 'var(--g-sidebar-surface-subtle)'
                                    : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-5 h-5 shrink-0 flex items-center justify-center border-2"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)',
                                        borderColor: isSelected ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                        backgroundColor: isSelected ? 'var(--g-brand-3308)' : 'transparent',
                                    }}
                                >
                                    {isSelected && <Check className="h-3 w-3" style={{ color: 'var(--g-text-inverse)' }} />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                        {candidate.denominacion_candidata}
                                    </p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        {candidate.nif_candidato && (
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                NIF: {candidate.nif_candidato}
                                            </span>
                                        )}
                                        <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
                                            Fuente: {candidate.source}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <div
                                        className="h-1.5 w-16"
                                        style={{
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            className="h-full transition-all"
                                            style={{
                                                width: `${scorePercent}%`,
                                                backgroundColor: scoreColor,
                                                borderRadius: 'var(--g-radius-full)',
                                            }}
                                        />
                                    </div>
                                    <span
                                        className="text-xs font-bold"
                                        style={{ color: scoreColor, minWidth: '32px', textAlign: 'right' }}
                                    >
                                        {scorePercent}%
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--g-border-subtle)' }}>
                {error && (
                    <p className="text-xs mb-2" style={{ color: 'var(--status-error)' }}>{error}</p>
                )}
                <button
                    onClick={handleConfirm}
                    disabled={!selected || loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    style={{
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-brand-3308)',
                        color: 'var(--g-text-inverse)',
                        border: 'none',
                        cursor: selected && !loading ? 'pointer' : 'default',
                    }}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    {loading ? 'Confirmando...' : 'Confirmar Selección'}
                </button>
            </div>
        </div>
    );
}
