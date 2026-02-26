'use client';

import { useState } from 'react';
import {
    Building2, Users, FileText, AlertTriangle,
    TrendingUp, Clock
} from 'lucide-react';
import type { DDSnapshot } from '@/lib/supabase';
import { TIPO_ACTO_LABELS, CARGO_LABELS, formatDate } from '@/lib/utils';

interface SnapshotViewerProps {
    snapshot: DDSnapshot;
}

const TABS = [
    { key: 'general', label: 'Datos Generales', icon: Building2 },
    { key: 'gobierno', label: 'Gobierno', icon: Users },
    { key: 'modificaciones', label: 'Modificaciones', icon: FileText },
    { key: 'timeline', label: 'Timeline', icon: Clock },
    { key: 'redflags', label: 'Red Flags', icon: AlertTriangle },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function SnapshotViewer({ snapshot }: SnapshotViewerProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('general');

    const datos = snapshot.datos_generales as Record<string, unknown>;
    const admins = snapshot.administradores as Array<Record<string, unknown>>;
    const apoderamientos = snapshot.apoderamientos as Array<Record<string, unknown>>;
    const mods = snapshot.modificaciones as Array<Record<string, unknown>>;
    const capitalHistory = snapshot.capital_history as Array<Record<string, unknown>>;
    const timeline = snapshot.timeline_eventos as Array<Record<string, unknown>>;
    const redFlags = snapshot.red_flags as Array<Record<string, unknown>>;

    return (
        <div
            className="border"
            style={{
                borderColor: 'var(--g-border-subtle)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
                boxShadow: 'var(--g-shadow-card)',
            }}
        >
            {/* Tab bar */}
            <div
                className="flex items-center gap-0.5 p-1.5 border-b overflow-x-auto"
                style={{ borderColor: 'var(--g-border-subtle)' }}
            >
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const Icon = tab.icon;
                    const count = tab.key === 'gobierno' ? admins.length + apoderamientos.length
                        : tab.key === 'modificaciones' ? mods.length + capitalHistory.length
                        : tab.key === 'timeline' ? timeline.length
                        : tab.key === 'redflags' ? redFlags.length
                        : 0;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap"
                            style={{
                                borderRadius: 'var(--g-radius-md)',
                                backgroundColor: isActive ? 'var(--g-surface-subtle)' : 'transparent',
                                color: isActive ? 'var(--g-brand-3308)' : 'var(--g-text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            {tab.label}
                            {count > 0 && (
                                <span
                                    className="px-1 py-0.5 text-[9px] font-bold"
                                    style={{
                                        borderRadius: 'var(--g-radius-full)',
                                        backgroundColor: tab.key === 'redflags'
                                            ? 'var(--g-priority-p0-bg)'
                                            : 'var(--g-surface-muted)',
                                        color: tab.key === 'redflags'
                                            ? 'var(--g-priority-p0)'
                                            : 'var(--g-text-muted)',
                                    }}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="p-4">
                {activeTab === 'general' && (
                    <div className="space-y-3">
                        <FieldRow label="Denominación" value={datos.denominacion as string} />
                        <FieldRow label="NIF" value={datos.nif as string} />
                        <FieldRow label="Domicilio" value={datos.domicilio as string} />
                        <FieldRow label="Objeto social" value={datos.objeto_social as string} />
                        <FieldRow
                            label="Capital social"
                            value={datos.capital_social
                                ? `${Number(datos.capital_social).toLocaleString('es-ES')} ${datos.moneda || 'EUR'}`
                                : null}
                        />
                        <FieldRow label="Órgano de administración" value={datos.organo_admin as string} />
                        <FieldRow label="Fecha constitución" value={datos.fecha_constitucion ? formatDate(datos.fecha_constitucion as string) : null} />
                    </div>
                )}

                {activeTab === 'gobierno' && (
                    <div className="space-y-4">
                        {admins.length > 0 && (
                            <div>
                                <h4
                                    className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                                    style={{ color: 'var(--g-text-muted)' }}
                                >
                                    Administradores Vigentes ({admins.length})
                                </h4>
                                <div className="space-y-2">
                                    {admins.map((admin, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 p-2.5 border"
                                            style={{
                                                borderColor: 'var(--g-border-subtle)',
                                                borderRadius: 'var(--g-radius-md)',
                                            }}
                                        >
                                            <div
                                                className="w-8 h-8 shrink-0 flex items-center justify-center text-xs font-bold"
                                                style={{
                                                    borderRadius: 'var(--g-radius-full)',
                                                    backgroundColor: 'var(--g-sidebar-surface-subtle)',
                                                    color: 'var(--g-brand-3308)',
                                                }}
                                            >
                                                {(admin.nombre as string)?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium" style={{ color: 'var(--g-text-primary)' }}>
                                                    {admin.nombre as string}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span
                                                        className="px-1.5 py-0.5 text-[9px] font-semibold"
                                                        style={{
                                                            borderRadius: 'var(--g-radius-sm)',
                                                            backgroundColor: 'var(--g-surface-muted)',
                                                            color: 'var(--g-text-secondary)',
                                                        }}
                                                    >
                                                        {CARGO_LABELS[admin.cargo as string] || admin.cargo as string}
                                                    </span>
                                                    {(admin.fecha_inicio as string) ? (
                                                        <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                                            Desde {formatDate(admin.fecha_inicio as string)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {apoderamientos.length > 0 && (
                            <div>
                                <h4
                                    className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                                    style={{ color: 'var(--g-text-muted)' }}
                                >
                                    Apoderamientos ({apoderamientos.length})
                                </h4>
                                <div className="space-y-2">
                                    {apoderamientos.map((pod, i) => (
                                        <div
                                            key={i}
                                            className="p-2.5 border text-sm"
                                            style={{
                                                borderColor: 'var(--g-border-subtle)',
                                                borderRadius: 'var(--g-radius-md)',
                                            }}
                                        >
                                            <span
                                                className="px-1.5 py-0.5 text-[9px] font-semibold mr-2"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: 'var(--g-input-bg)',
                                                    color: 'var(--g-input-color)',
                                                }}
                                            >
                                                {TIPO_ACTO_LABELS[pod.tipo as string] || pod.tipo as string}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
                                                {formatDate(pod.fecha as string)}
                                            </span>
                                            {(pod.raw_text as string) ? (
                                                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--g-text-primary)' }}>
                                                    {(pod.raw_text as string).slice(0, 150)}
                                                    {(pod.raw_text as string).length > 150 ? '...' : ''}
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {admins.length === 0 && apoderamientos.length === 0 && (
                            <EmptyState text="No se encontraron datos de gobierno corporativo" />
                        )}
                    </div>
                )}

                {activeTab === 'modificaciones' && (
                    <div className="space-y-4">
                        {mods.length > 0 && (
                            <div className="space-y-2">
                                {mods.map((mod, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-2.5 border"
                                        style={{
                                            borderColor: 'var(--g-border-subtle)',
                                            borderRadius: 'var(--g-radius-md)',
                                        }}
                                    >
                                        <TrendingUp
                                            className="h-4 w-4 shrink-0 mt-0.5"
                                            style={{ color: 'var(--g-brand-3308)' }}
                                            aria-hidden="true"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="px-1.5 py-0.5 text-[9px] font-semibold"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        backgroundColor: 'var(--g-severity-medium)',
                                                        color: 'var(--g-text-inverse)',
                                                    }}
                                                >
                                                    {TIPO_ACTO_LABELS[mod.tipo as string] || mod.tipo as string}
                                                </span>
                                                <span className="text-[10px]" style={{ color: 'var(--g-text-muted)' }}>
                                                    {formatDate(mod.fecha as string)}
                                                </span>
                                            </div>
                                            {(mod.raw_text as string) ? (
                                                <p className="text-xs mt-1" style={{ color: 'var(--g-text-secondary)' }}>
                                                    {(mod.raw_text as string).slice(0, 200)}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {capitalHistory.length > 0 && (
                            <div>
                                <h4
                                    className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                                    style={{ color: 'var(--g-text-muted)' }}
                                >
                                    Historial de Capital ({capitalHistory.length})
                                </h4>
                                <div className="space-y-1.5">
                                    {capitalHistory.map((ch, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span style={{ color: 'var(--g-text-muted)' }}>
                                                {formatDate(ch.fecha as string)}
                                            </span>
                                            <span
                                                className="px-1 py-0.5 text-[9px] font-semibold"
                                                style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: ch.tipo === 'AMPLIACION_CAPITAL'
                                                        ? 'var(--g-source-bg)'
                                                        : 'var(--g-priority-p0-bg)',
                                                    color: ch.tipo === 'AMPLIACION_CAPITAL'
                                                        ? 'var(--g-source-color)'
                                                        : 'var(--g-priority-p0)',
                                                }}
                                            >
                                                {ch.tipo === 'AMPLIACION_CAPITAL' ? '+ Ampliación' : '- Reducción'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {mods.length === 0 && capitalHistory.length === 0 && (
                            <EmptyState text="No se encontraron modificaciones en el período" />
                        )}
                    </div>
                )}

                {activeTab === 'timeline' && (
                    <div className="space-y-1.5" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {timeline.length > 0 ? (
                            timeline.map((event, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 py-2"
                                    style={{
                                        borderBottom: i < timeline.length - 1
                                            ? '1px solid var(--g-border-subtle)'
                                            : 'none',
                                    }}
                                >
                                    <span className="text-[10px] shrink-0 pt-0.5 font-mono" style={{ color: 'var(--g-text-muted)', minWidth: '70px' }}>
                                        {formatDate(event.fecha as string)}
                                    </span>
                                    <span
                                        className="px-1 py-0.5 text-[8px] font-bold uppercase shrink-0"
                                        style={{
                                            borderRadius: 'var(--g-radius-sm)',
                                            backgroundColor: 'var(--g-surface-muted)',
                                            color: 'var(--g-text-secondary)',
                                        }}
                                    >
                                        {TIPO_ACTO_LABELS[event.tipo_acto as string]?.slice(0, 15) || event.tipo_acto as string}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--g-text-primary)' }}>
                                        {(event.descripcion as string)?.slice(0, 120) || '—'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <EmptyState text="No hay eventos en el timeline" />
                        )}
                    </div>
                )}

                {activeTab === 'redflags' && (
                    <div className="space-y-2">
                        {redFlags.length > 0 ? (
                            redFlags.map((flag, i) => {
                                const severity = flag.severidad as string;
                                const sevColor = severity === 'critical'
                                    ? 'var(--g-severity-critical)'
                                    : severity === 'high'
                                        ? 'var(--g-severity-high)'
                                        : 'var(--g-severity-medium)';
                                const sevBg = severity === 'critical'
                                    ? 'var(--g-priority-p0-bg)'
                                    : severity === 'high'
                                        ? 'var(--g-hitl-bg)'
                                        : 'var(--g-trigger-bg)';

                                return (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-3 border"
                                        style={{
                                            borderColor: sevColor,
                                            borderRadius: 'var(--g-radius-md)',
                                            backgroundColor: sevBg,
                                        }}
                                    >
                                        <AlertTriangle
                                            className="h-4 w-4 shrink-0 mt-0.5"
                                            style={{ color: sevColor }}
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="px-1.5 py-0.5 text-[9px] font-bold uppercase"
                                                    style={{
                                                        borderRadius: 'var(--g-radius-sm)',
                                                        color: sevColor,
                                                    }}
                                                >
                                                    {severity}
                                                </span>
                                                <span className="text-[10px] font-medium" style={{ color: 'var(--g-text-muted)' }}>
                                                    {flag.tipo as string}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-1" style={{ color: 'var(--g-text-primary)' }}>
                                                {flag.descripcion as string}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div
                                className="flex items-center gap-2 p-3"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: 'var(--g-source-bg)',
                                }}
                            >
                                <span className="text-sm" style={{ color: 'var(--status-success)' }}>
                                    ✓ No se detectaron red flags
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex gap-2 text-sm">
            <span
                className="shrink-0 font-medium"
                style={{ color: 'var(--g-text-secondary)', minWidth: '150px' }}
            >
                {label}:
            </span>
            <span style={{ color: value ? 'var(--g-text-primary)' : 'var(--g-text-muted)' }}>
                {value || 'No disponible'}
            </span>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm" style={{ color: 'var(--g-text-muted)' }}>{text}</p>
        </div>
    );
}
