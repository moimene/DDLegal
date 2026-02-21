'use client';

import { useState } from 'react';
import { Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface FreezeControlProps {
    reportId: string;
    isFrozen: boolean;
    frozenAt: string | null;
    frozenBy: string | null;
    reportStatus: string;
    onFreezeChange: (frozen: boolean) => void;
}

export default function FreezeControl({
    reportId,
    isFrozen,
    frozenAt,
    frozenBy,
    reportStatus,
    onFreezeChange,
}: FreezeControlProps) {
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const canFreeze = reportStatus === 'done' && !isFrozen;
    const canUnfreeze = isFrozen;

    const handleAction = async () => {
        setLoading(true);
        setShowConfirmation(false);

        const action = isFrozen ? 'unfreeze' : 'freeze';

        try {
            const res = await fetch(`/api/reports/${reportId}/freeze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            const data = await res.json();

            if (data.success) {
                onFreezeChange(action === 'freeze');
                toast.success(
                    action === 'freeze'
                        ? 'Informe congelado correctamente'
                        : 'Informe descongelado correctamente'
                );
            } else {
                toast.error(data.error || 'Error al procesar la solicitud');
            }
        } catch {
            toast.error('Error de conexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--g-space-3)',
                padding: '14px 16px',
                borderRadius: 'var(--g-radius-lg)',
                border: `1px solid ${isFrozen ? 'var(--status-error)' : 'var(--g-border-default)'}`,
                backgroundColor: isFrozen ? 'var(--g-surface-card)' : 'var(--g-surface-card)',
            }}
        >
            {/* Estado actual */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isFrozen ? (
                        <Lock style={{ width: '16px', height: '16px', color: 'var(--status-error)' }} />
                    ) : (
                        <Unlock style={{ width: '16px', height: '16px', color: 'var(--status-success)' }} />
                    )}
                    <span
                        style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: isFrozen ? 'var(--status-error)' : 'var(--status-success)',
                        }}
                    >
                        {isFrozen ? 'Congelado' : 'Editable'}
                    </span>
                </div>

                {isFrozen && frozenAt && (
                    <span style={{ fontSize: '11px', color: 'var(--g-text-muted)' }}>
                        {formatDate(frozenAt)}
                        {frozenBy && ` por ${frozenBy}`}
                    </span>
                )}
            </div>

            {/* Confirmacion inline */}
            {showConfirmation && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: 'var(--g-radius-md)',
                        backgroundColor: 'var(--g-surface-subtle)',
                        border: '1px solid var(--g-border-default)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <AlertTriangle
                            style={{
                                width: '16px',
                                height: '16px',
                                color: 'var(--status-warning)',
                                flexShrink: 0,
                                marginTop: '1px',
                            }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--g-text-primary)', lineHeight: 1.4 }}>
                            {isFrozen
                                ? 'Al descongelar, el informe volvera a ser editable. Solo roles CLO/PM deberian realizar esta accion.'
                                : 'Una vez congelado, no se podra editar esta version. Podras crear una nueva version a partir de esta.'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowConfirmation(false)}
                            disabled={loading}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                                cursor: 'pointer',
                            }}
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={handleAction}
                            disabled={loading}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: 'none',
                                backgroundColor: isFrozen ? 'var(--g-surface-muted)' : 'var(--g-brand-3308)',
                                color: isFrozen ? 'var(--g-text-primary)' : 'var(--g-text-inverse)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {loading && (
                                <Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} />
                            )}
                            {isFrozen ? 'Confirmar descongelacion' : 'Confirmar congelacion'}
                        </button>
                    </div>
                </div>
            )}

            {/* Boton principal */}
            {!showConfirmation && (
                <>
                    {canFreeze && (
                        <button
                            onClick={() => setShowConfirmation(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: 'none',
                                backgroundColor: 'var(--g-brand-3308)',
                                color: 'var(--g-text-inverse)',
                                cursor: 'pointer',
                                transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                            <Lock style={{ width: '14px', height: '14px' }} />
                            Congelar version
                        </button>
                    )}

                    {canUnfreeze && (
                        <button
                            onClick={() => setShowConfirmation(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'transparent',
                                color: 'var(--g-text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--g-text-secondary)';
                                e.currentTarget.style.backgroundColor = 'var(--g-surface-subtle)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--g-border-default)';
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <Unlock style={{ width: '14px', height: '14px' }} />
                            Descongelar
                        </button>
                    )}

                    {!canFreeze && !canUnfreeze && reportStatus !== 'done' && (
                        <p style={{ fontSize: '11px', color: 'var(--g-text-muted)', textAlign: 'center' }}>
                            Solo informes con estado &quot;completado&quot; pueden congelarse
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
