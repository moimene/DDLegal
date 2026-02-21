'use client';

import { useState } from 'react';
import {
    FileCheck, AlertTriangle, Shield, Upload, ChevronRight,
    CheckCircle2, Eye, Plus, FileText, TrendingDown,
} from 'lucide-react';
import { formatCurrency, SEVERITY_CONFIG } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface ProcessWorkbenchProps {
    projectId: string;
    areaCode: string;
    areaName: string;
}

interface ChecklistItem {
    id: string;
    name: string;
    received: boolean;
    status: 'received' | 'pending' | 'requested' | 'waived';
}

interface Finding {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    groundingScore: number;
    skillName: string;
    createdAt: string;
}

interface Contingency {
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    estimatedAmount: number | null;
    currency: string;
    status: 'open' | 'proposed' | 'agreed' | 'rejected' | 'deferred';
    spaClause: string | null;
}

// ── Status configs ───────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<ChecklistItem['status'], { label: string; bg: string; fg: string }> = {
    received: { label: 'Recibido', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    pending: { label: 'Pendiente', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    requested: { label: 'Solicitado', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    waived: { label: 'Eximido', bg: 'var(--g-text-muted)', fg: 'var(--g-text-inverse)' },
};

const CONTINGENCY_STATUS_CONFIG: Record<Contingency['status'], { label: string; bg: string; fg: string }> = {
    open: { label: 'Abierto', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    proposed: { label: 'Propuesto', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    agreed: { label: 'Acordado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    rejected: { label: 'Rechazado', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    deferred: { label: 'Diferido', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
};

// ── Mock Data ────────────────────────────────────────────────

const MOCK_CHECKLIST: ChecklistItem[] = [
    { id: 'doc-1', name: 'Contratos laborales vigentes', received: true, status: 'received' },
    { id: 'doc-2', name: 'Convenio colectivo aplicable', received: true, status: 'received' },
    { id: 'doc-3', name: 'Nominas ultimos 12 meses', received: false, status: 'requested' },
    { id: 'doc-4', name: 'Actas de infracciones laborales', received: false, status: 'pending' },
    { id: 'doc-5', name: 'Plan de igualdad', received: true, status: 'received' },
    { id: 'doc-6', name: 'Registro retributivo', received: false, status: 'pending' },
    { id: 'doc-7', name: 'Acuerdos de teletrabajo', received: true, status: 'received' },
    { id: 'doc-8', name: 'Protocolo de desconexion digital', received: false, status: 'waived' },
    { id: 'doc-9', name: 'Certificados de Seguridad Social', received: true, status: 'received' },
    { id: 'doc-10', name: 'Litigios laborales pendientes', received: false, status: 'requested' },
];

const MOCK_FINDINGS: Finding[] = [
    {
        id: 'find-1',
        severity: 'critical',
        title: 'Incumplimiento plan de igualdad',
        description: 'La empresa no ha actualizado el plan de igualdad conforme a las modificaciones del RD 901/2020. Se detectan deficiencias en el diagnostico de situacion y medidas correctoras obsoletas.',
        groundingScore: 92,
        skillName: 'analizar-plan-igualdad',
        createdAt: '2026-02-18',
    },
    {
        id: 'find-2',
        severity: 'high',
        title: 'Contratos temporales sin causa justificada',
        description: 'Se identifican 14 contratos temporales que carecen de causa de temporalidad conforme al art. 15 ET tras la reforma laboral 2021. Riesgo de conversion a indefinidos.',
        groundingScore: 87,
        skillName: 'verificar-contratos-temporales',
        createdAt: '2026-02-19',
    },
    {
        id: 'find-3',
        severity: 'medium',
        title: 'Registro horario incompleto',
        description: 'El sistema de registro de jornada presenta lagunas en 3 de los 8 centros de trabajo revisados. Potencial infraccion grave conforme al art. 7.5 LISOS.',
        groundingScore: 74,
        skillName: 'verificar-registro-jornada',
        createdAt: '2026-02-20',
    },
    {
        id: 'find-4',
        severity: 'low',
        title: 'Clausula de no competencia atipica',
        description: 'Se detectan pactos de no competencia post-contractual en 3 directivos cuya compensacion economica podria ser insuficiente segun jurisprudencia reciente del TS.',
        groundingScore: 65,
        skillName: 'analizar-pactos-no-competencia',
        createdAt: '2026-02-20',
    },
];

const MOCK_CONTINGENCIES: Contingency[] = [
    {
        id: 'cont-1',
        title: 'Conversion contratos temporales a indefinidos',
        severity: 'high',
        estimatedAmount: 420000,
        currency: 'EUR',
        status: 'open',
        spaClause: '8.2(a) — Garantias Laborales',
    },
    {
        id: 'cont-2',
        title: 'Sancion por plan de igualdad deficiente',
        severity: 'critical',
        estimatedAmount: 150000,
        currency: 'EUR',
        status: 'proposed',
        spaClause: '8.2(c) — Compliance Laboral',
    },
    {
        id: 'cont-3',
        title: 'Reclamacion horas extraordinarias no compensadas',
        severity: 'medium',
        estimatedAmount: 85000,
        currency: 'EUR',
        status: 'open',
        spaClause: null,
    },
    {
        id: 'cont-4',
        title: 'Demanda colectiva clasificacion profesional',
        severity: 'high',
        estimatedAmount: 210000,
        currency: 'EUR',
        status: 'deferred',
        spaClause: '8.2(a) — Garantias Laborales',
    },
];

// ── Helpers ──────────────────────────────────────────────────

function getGroundingColor(score: number): string {
    if (score >= 80) return 'var(--status-success)';
    if (score >= 60) return 'var(--status-warning)';
    return 'var(--status-error)';
}

// ── Component ────────────────────────────────────────────────

export default function ProcessWorkbench({ projectId, areaCode, areaName }: ProcessWorkbenchProps) {
    const [checklist, setChecklist] = useState<ChecklistItem[]>(MOCK_CHECKLIST);
    const findings = MOCK_FINDINGS;
    const contingencies = MOCK_CONTINGENCIES;

    const receivedCount = checklist.filter(d => d.received).length;
    const totalCount = checklist.length;
    const progressPct = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0;

    const handleToggle = (id: string) => {
        setChecklist(prev =>
            prev.map(item =>
                item.id === id
                    ? {
                        ...item,
                        received: !item.received,
                        status: !item.received ? 'received' : 'pending',
                    }
                    : item,
            ),
        );
    };

    // Suppress unused var warning — projectId will be used for API calls
    void projectId;

    return (
        <div
            className="animate-fade-in"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--g-space-6)',
            }}
        >
            {/* ============================================================ */}
            {/* HEADER */}
            {/* ============================================================ */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--g-space-3)',
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBottom: 'var(--g-space-1)' }}>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 8px',
                                fontSize: 'var(--g-text-caption)',
                                fontWeight: 'var(--g-font-weight-bold)',
                                textTransform: 'uppercase',
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--g-surface-subtle)',
                                color: 'var(--g-brand-3308)',
                                letterSpacing: '0.06em',
                            }}
                        >
                            {areaCode}
                        </span>
                    </div>
                    <h1
                        style={{
                            fontSize: 'var(--g-text-h1)',
                            fontWeight: 'var(--g-font-weight-bold)',
                            color: 'var(--g-text-primary)',
                            lineHeight: 'var(--g-leading-tight)',
                        }}
                    >
                        {areaName}
                    </h1>
                    <p
                        style={{
                            fontSize: 'var(--g-text-small)',
                            color: 'var(--g-text-secondary)',
                            marginTop: 'var(--g-space-1)',
                        }}
                    >
                        Mesa de trabajo operativa &mdash; Checklist, hallazgos y contingencias
                    </p>
                </div>

                {/* Summary pill */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    <div
                        style={{
                            padding: 'var(--g-space-2) var(--g-space-4)',
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ fontSize: 'var(--g-text-caption)', fontWeight: 'var(--g-font-weight-medium)', color: 'var(--g-brand-3308)', textTransform: 'uppercase' }}>
                            Documentos
                        </p>
                        <p style={{ fontSize: 'var(--g-text-h2)', fontWeight: 'var(--g-font-weight-bold)', color: 'var(--g-text-primary)' }}>
                            {receivedCount}/{totalCount}
                        </p>
                    </div>
                    <div
                        style={{
                            padding: 'var(--g-space-2) var(--g-space-4)',
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ fontSize: 'var(--g-text-caption)', fontWeight: 'var(--g-font-weight-medium)', color: 'var(--g-brand-3308)', textTransform: 'uppercase' }}>
                            Hallazgos
                        </p>
                        <p style={{ fontSize: 'var(--g-text-h2)', fontWeight: 'var(--g-font-weight-bold)', color: 'var(--g-text-primary)' }}>
                            {findings.length}
                        </p>
                    </div>
                    <div
                        style={{
                            padding: 'var(--g-space-2) var(--g-space-4)',
                            borderRadius: 'var(--g-radius-md)',
                            backgroundColor: 'var(--g-surface-subtle)',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ fontSize: 'var(--g-text-caption)', fontWeight: 'var(--g-font-weight-medium)', color: 'var(--g-brand-3308)', textTransform: 'uppercase' }}>
                            Contingencias
                        </p>
                        <p style={{ fontSize: 'var(--g-text-h2)', fontWeight: 'var(--g-font-weight-bold)', color: 'var(--g-text-primary)' }}>
                            {contingencies.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* 3-COLUMN LAYOUT */}
            {/* ============================================================ */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '30% 40% 30%',
                    gap: 'var(--g-space-5)',
                    alignItems: 'start',
                }}
            >
                {/* ──────────────────────────────────────────────────────── */}
                {/* LEFT PANEL: CHECKLIST */}
                {/* ──────────────────────────────────────────────────────── */}
                <div
                    className="g-card"
                    style={{
                        padding: 'var(--g-space-5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    {/* Panel header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <FileCheck
                            style={{ width: '16px', height: '16px', color: 'var(--g-brand-3308)' }}
                        />
                        <h2
                            style={{
                                fontSize: 'var(--g-text-body)',
                                fontWeight: 'var(--g-font-weight-bold)',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            Checklist Documental
                        </h2>
                    </div>

                    {/* Progress bar */}
                    <div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 'var(--g-space-2)',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 'var(--g-font-weight-medium)',
                                    color: 'var(--g-text-secondary)',
                                }}
                            >
                                {receivedCount}/{totalCount} documentos recibidos
                            </span>
                            <span
                                style={{
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 'var(--g-font-weight-bold)',
                                    color: progressPct === 100 ? 'var(--status-success)' : 'var(--g-text-primary)',
                                }}
                            >
                                {progressPct}%
                            </span>
                        </div>
                        <div
                            style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: 'var(--g-radius-full)',
                                backgroundColor: 'var(--g-surface-muted)',
                            }}
                        >
                            <div
                                style={{
                                    width: `${progressPct}%`,
                                    height: '100%',
                                    borderRadius: 'var(--g-radius-full)',
                                    backgroundColor: progressPct === 100 ? 'var(--status-success)' : 'var(--g-brand-3308)',
                                    transition: 'width var(--g-transition-smooth)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Document list */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            maxHeight: '480px',
                            overflowY: 'auto',
                        }}
                    >
                        {checklist.map((item) => {
                            const statusCfg = DOC_STATUS_CONFIG[item.status];
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--g-space-3)',
                                        padding: 'var(--g-space-2) var(--g-space-3)',
                                        borderRadius: 'var(--g-radius-md)',
                                        backgroundColor: item.received ? 'var(--g-surface-subtle)' : 'transparent',
                                        transition: 'background-color var(--g-transition-fast)',
                                    }}
                                >
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => handleToggle(item.id)}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: 'var(--g-radius-sm)',
                                            border: item.received
                                                ? '2px solid var(--status-success)'
                                                : '2px solid var(--g-border-default)',
                                            backgroundColor: item.received ? 'var(--status-success)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            padding: 0,
                                            transition: 'all var(--g-transition-fast)',
                                        }}
                                        aria-label={`Marcar ${item.name} como ${item.received ? 'pendiente' : 'recibido'}`}
                                    >
                                        {item.received && (
                                            <CheckCircle2
                                                style={{ width: '12px', height: '12px', color: 'var(--g-text-inverse)' }}
                                            />
                                        )}
                                    </button>

                                    {/* Document name */}
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: 'var(--g-text-small)',
                                            fontWeight: 'var(--g-font-weight-regular)',
                                            color: item.received ? 'var(--g-text-secondary)' : 'var(--g-text-primary)',
                                            textDecoration: item.received ? 'line-through' : 'none',
                                            lineHeight: 'var(--g-leading-normal)',
                                            minWidth: 0,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                        title={item.name}
                                    >
                                        {item.name}
                                    </span>

                                    {/* Status badge */}
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '1px 6px',
                                            fontSize: '10px',
                                            fontWeight: 'var(--g-font-weight-medium)',
                                            borderRadius: 'var(--g-radius-full)',
                                            backgroundColor: statusCfg.bg,
                                            color: statusCfg.fg,
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {statusCfg.label}
                                    </span>

                                    {/* Upload button */}
                                    {!item.received && (
                                        <button
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: 'var(--g-radius-sm)',
                                                border: '1px solid var(--g-border-default)',
                                                backgroundColor: 'var(--g-surface-card)',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                                padding: 0,
                                                transition: 'all var(--g-transition-fast)',
                                            }}
                                            title={`Subir ${item.name}`}
                                            aria-label={`Subir ${item.name}`}
                                        >
                                            <Upload
                                                style={{ width: '12px', height: '12px', color: 'var(--g-text-secondary)' }}
                                            />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* CENTER PANEL: FINDINGS */}
                {/* ──────────────────────────────────────────────────────── */}
                <div
                    className="g-card"
                    style={{
                        padding: 'var(--g-space-5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    {/* Panel header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                        <AlertTriangle
                            style={{ width: '16px', height: '16px', color: 'var(--g-severity-high)' }}
                        />
                        <h2
                            style={{
                                fontSize: 'var(--g-text-body)',
                                fontWeight: 'var(--g-font-weight-bold)',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            Hallazgos IA
                        </h2>
                        <span
                            style={{
                                marginLeft: 'auto',
                                fontSize: 'var(--g-text-caption)',
                                color: 'var(--g-text-secondary)',
                            }}
                        >
                            {findings.length} hallazgo{findings.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Findings list */}
                    {findings.length === 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 'var(--g-space-12) var(--g-space-6)',
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px dashed var(--g-border-subtle)',
                            }}
                        >
                            <FileText
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    color: 'var(--g-text-muted)',
                                    marginBottom: 'var(--g-space-3)',
                                    opacity: 0.5,
                                }}
                            />
                            <p
                                style={{
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 'var(--g-font-weight-medium)',
                                    color: 'var(--g-text-secondary)',
                                }}
                            >
                                Sin hallazgos para esta area
                            </p>
                            <p
                                style={{
                                    fontSize: 'var(--g-text-caption)',
                                    color: 'var(--g-text-muted)',
                                    marginTop: 'var(--g-space-1)',
                                }}
                            >
                                Los hallazgos apareceran al ejecutar skills de analisis.
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--g-space-3)',
                                maxHeight: '480px',
                                overflowY: 'auto',
                            }}
                        >
                            {findings.map((finding) => {
                                const sevCfg = SEVERITY_CONFIG[finding.severity];
                                const groundingColor = getGroundingColor(finding.groundingScore);
                                return (
                                    <div
                                        key={finding.id}
                                        style={{
                                            padding: 'var(--g-space-4)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1px solid var(--g-border-subtle)',
                                            borderLeft: `3px solid ${sevCfg.color}`,
                                            backgroundColor: 'var(--g-surface-card)',
                                            transition: 'box-shadow var(--g-transition-normal)',
                                        }}
                                    >
                                        {/* Finding header */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--g-space-2)',
                                                marginBottom: 'var(--g-space-2)',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            {/* Severity badge */}
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: 'var(--g-font-weight-bold)',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: sevCfg.color,
                                                    color: '#fff',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {sevCfg.label}
                                            </span>

                                            {/* Grounding score */}
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: 'var(--g-font-weight-bold)',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: `color-mix(in srgb, ${groundingColor} 12%, transparent)`,
                                                    color: groundingColor,
                                                }}
                                                title="Grounding score — fiabilidad de la evidencia"
                                            >
                                                <Shield style={{ width: '10px', height: '10px' }} />
                                                {finding.groundingScore}
                                            </span>

                                            {/* Skill name */}
                                            <span
                                                style={{
                                                    marginLeft: 'auto',
                                                    fontSize: '10px',
                                                    color: 'var(--g-text-muted)',
                                                    fontStyle: 'italic',
                                                }}
                                            >
                                                {finding.skillName}
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3
                                            style={{
                                                fontSize: 'var(--g-text-small)',
                                                fontWeight: 'var(--g-font-weight-bold)',
                                                color: 'var(--g-text-primary)',
                                                lineHeight: 'var(--g-leading-tight)',
                                                marginBottom: 'var(--g-space-2)',
                                            }}
                                        >
                                            {finding.title}
                                        </h3>

                                        {/* Description preview */}
                                        <p
                                            style={{
                                                fontSize: 'var(--g-text-caption)',
                                                color: 'var(--g-text-secondary)',
                                                lineHeight: 'var(--g-leading-relaxed)',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {finding.description}
                                        </p>

                                        {/* Footer */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: 'var(--g-space-3)',
                                                paddingTop: 'var(--g-space-3)',
                                                borderTop: '1px solid var(--g-border-subtle)',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    color: 'var(--g-text-muted)',
                                                }}
                                            >
                                                {finding.createdAt}
                                            </span>

                                            <button
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 'var(--g-font-weight-medium)',
                                                    borderRadius: 'var(--g-radius-md)',
                                                    border: '1px solid var(--g-brand-3308)',
                                                    backgroundColor: 'transparent',
                                                    color: 'var(--g-brand-3308)',
                                                    cursor: 'pointer',
                                                    transition: 'all var(--g-transition-fast)',
                                                }}
                                                title="Revisar hallazgo en HITL"
                                            >
                                                <Eye style={{ width: '12px', height: '12px' }} />
                                                Revisar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* RIGHT PANEL: CONTINGENCIES */}
                {/* ──────────────────────────────────────────────────────── */}
                <div
                    className="g-card"
                    style={{
                        padding: 'var(--g-space-5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    {/* Panel header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--g-space-2)',
                        }}
                    >
                        <TrendingDown
                            style={{ width: '16px', height: '16px', color: 'var(--g-severity-critical)' }}
                        />
                        <h2
                            style={{
                                fontSize: 'var(--g-text-body)',
                                fontWeight: 'var(--g-font-weight-bold)',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            Contingencias
                        </h2>
                        <span
                            style={{
                                marginLeft: 'auto',
                                fontSize: 'var(--g-text-caption)',
                                color: 'var(--g-text-secondary)',
                            }}
                        >
                            {contingencies.length}
                        </span>
                    </div>

                    {/* New contingency button */}
                    <button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--g-space-2)',
                            width: '100%',
                            padding: 'var(--g-space-2) var(--g-space-3)',
                            fontSize: 'var(--g-text-small)',
                            fontWeight: 'var(--g-font-weight-medium)',
                            borderRadius: 'var(--g-radius-md)',
                            border: '1px dashed var(--g-border-default)',
                            backgroundColor: 'transparent',
                            color: 'var(--g-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all var(--g-transition-fast)',
                        }}
                        title="Crear nueva contingencia"
                    >
                        <Plus style={{ width: '14px', height: '14px' }} />
                        Nueva contingencia
                    </button>

                    {/* Contingencies list */}
                    {contingencies.length === 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 'var(--g-space-12) var(--g-space-6)',
                                borderRadius: 'var(--g-radius-md)',
                                border: '1px dashed var(--g-border-subtle)',
                            }}
                        >
                            <Shield
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    color: 'var(--g-text-muted)',
                                    marginBottom: 'var(--g-space-3)',
                                    opacity: 0.5,
                                }}
                            />
                            <p
                                style={{
                                    fontSize: 'var(--g-text-small)',
                                    fontWeight: 'var(--g-font-weight-medium)',
                                    color: 'var(--g-text-secondary)',
                                }}
                            >
                                Sin contingencias identificadas
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--g-space-3)',
                                maxHeight: '480px',
                                overflowY: 'auto',
                            }}
                        >
                            {contingencies.map((cont) => {
                                const sevCfg = SEVERITY_CONFIG[cont.severity];
                                const statusCfg = CONTINGENCY_STATUS_CONFIG[cont.status];
                                return (
                                    <div
                                        key={cont.id}
                                        style={{
                                            padding: 'var(--g-space-4)',
                                            borderRadius: 'var(--g-radius-md)',
                                            border: '1px solid var(--g-border-subtle)',
                                            borderLeft: `3px solid ${sevCfg.color}`,
                                            backgroundColor: 'var(--g-surface-card)',
                                        }}
                                    >
                                        {/* Header badges */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--g-space-2)',
                                                marginBottom: 'var(--g-space-2)',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: 'var(--g-font-weight-bold)',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: sevCfg.color,
                                                    color: '#fff',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {sevCfg.label}
                                            </span>
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: 'var(--g-font-weight-medium)',
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: statusCfg.bg,
                                                    color: statusCfg.fg,
                                                }}
                                            >
                                                {statusCfg.label}
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3
                                            style={{
                                                fontSize: 'var(--g-text-small)',
                                                fontWeight: 'var(--g-font-weight-bold)',
                                                color: 'var(--g-text-primary)',
                                                lineHeight: 'var(--g-leading-tight)',
                                                marginBottom: 'var(--g-space-2)',
                                            }}
                                        >
                                            {cont.title}
                                        </h3>

                                        {/* Amount */}
                                        {cont.estimatedAmount != null && (
                                            <p
                                                style={{
                                                    fontSize: 'var(--g-text-body)',
                                                    fontWeight: 'var(--g-font-weight-bold)',
                                                    color: 'var(--g-text-primary)',
                                                    marginBottom: 'var(--g-space-2)',
                                                }}
                                            >
                                                {formatCurrency(cont.estimatedAmount, cont.currency)}
                                            </p>
                                        )}

                                        {/* SPA Clause link */}
                                        {cont.spaClause && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    paddingTop: 'var(--g-space-2)',
                                                    borderTop: '1px solid var(--g-border-subtle)',
                                                    marginTop: 'var(--g-space-2)',
                                                }}
                                            >
                                                <ChevronRight
                                                    style={{
                                                        width: '12px',
                                                        height: '12px',
                                                        color: 'var(--g-brand-3308)',
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--g-link)',
                                                        cursor: 'pointer',
                                                        fontWeight: 'var(--g-font-weight-medium)',
                                                    }}
                                                    title={`Ir a clausula SPA: ${cont.spaClause}`}
                                                >
                                                    {cont.spaClause}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
