'use client';

import { useEffect, useState } from 'react';
import { useResolvedParams, getCachedDateTimeFormat } from '@/lib/utils';
import Link from 'next/link';
import {
    ArrowLeft, MessageSquare, Plus, Clock, AlertTriangle,
    Send, ChevronRight, Filter, CheckCircle2, XCircle
} from 'lucide-react';

interface QAThread {
    id: string; project_id: string; area_code: string | null; thread_number: number;
    subject: string; priority: string; status: string; source: string;
    assigned_to: string | null; due_date: string | null; sla_hours: number | null;
    sla_breached: boolean; client_visible: boolean; tags: string[];
    created_at: string; updated_at: string;
}

interface QAMessage {
    id: string; thread_id: string; sender_role: string; sender_id: string | null;
    content: string; attachments: unknown[]; is_internal: boolean; created_at: string;
}

interface QASLA { id: string; thread_id: string; sla_type: string; target_at: string; actual_at: string | null; is_met: boolean | null; }

const QA_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    sent: { label: 'Enviada', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    pending_response: { label: 'Pendiente', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    answered: { label: 'Respondida', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    follow_up: { label: 'Seguimiento', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    escalated: { label: 'Escalada', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    closed: { label: 'Cerrada', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
};

const PRIORITY: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critica', color: 'var(--g-severity-critical)' },
    high: { label: 'Alta', color: 'var(--g-severity-high)' },
    medium: { label: 'Media', color: 'var(--g-severity-medium)' },
    low: { label: 'Baja', color: 'var(--g-severity-low)' },
};

const SENDER: Record<string, { label: string; color: string }> = {
    advisor: { label: 'Asesor', color: 'var(--g-brand-3308)' },
    target: { label: 'Target', color: 'var(--status-warning)' },
    system: { label: 'Sistema', color: 'var(--g-text-secondary)' },
    ai: { label: 'IA', color: 'var(--status-info)' },
};

export default function QAPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);
    const [threads, setThreads] = useState<QAThread[]>([]);
    const [selectedThread, setSelectedThread] = useState<QAThread | null>(null);
    const [messages, setMessages] = useState<QAMessage[]>([]);
    const [slas, setSlas] = useState<QASLA[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewThread, setShowNewThread] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [newAreaCode, setNewAreaCode] = useState('');
    const [newSlaHours, setNewSlaHours] = useState('48');
    const [replyContent, setReplyContent] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchThreads = async () => {
        let url = `/api/qa/threads?project_id=${id}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        const res = await fetch(url);
        const data = await res.json();
        setThreads(data.threads || []);
        setLoading(false);
    };

    useEffect(() => { fetchThreads(); }, [id, statusFilter]);

    const fetchThread = async (threadId: string) => {
        const res = await fetch(`/api/qa/threads/${threadId}`);
        const data = await res.json();
        setMessages(data.messages || []);
        setSlas(data.slas || []);
    };

    const handleSelectThread = (thread: QAThread) => {
        setSelectedThread(thread);
        fetchThread(thread.id);
    };

    const handleCreateThread = async () => {
        if (!newSubject.trim()) return;
        const res = await fetch('/api/qa/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: id,
                subject: newSubject,
                priority: newPriority,
                area_code: newAreaCode || null,
                sla_hours: parseInt(newSlaHours) || 48,
            }),
        });
        const data = await res.json();
        if (data.success) {
            setNewSubject(''); setNewPriority('medium'); setNewAreaCode(''); setShowNewThread(false);
            fetchThreads();
        }
    };

    const handleSendReply = async () => {
        if (!replyContent.trim() || !selectedThread) return;
        await fetch(`/api/qa/threads/${selectedThread.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_role: 'advisor', content: replyContent }),
        });
        setReplyContent('');
        fetchThread(selectedThread.id);
        fetchThreads();
    };

    const formatDate = (d: string) => getCachedDateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

    const getSlaIndicator = (thread: QAThread) => {
        if (thread.status === 'closed') return { color: 'var(--g-text-secondary)', icon: CheckCircle2 };
        if (thread.sla_breached) return { color: 'var(--status-error)', icon: XCircle };
        const threadSla = slas.find(s => s.thread_id === thread.id && s.sla_type === 'response');
        if (threadSla && !threadSla.actual_at) {
            const hoursLeft = (new Date(threadSla.target_at).getTime() - Date.now()) / 3600000;
            if (hoursLeft <= 0) return { color: 'var(--status-error)', icon: XCircle };
            if (hoursLeft <= 8) return { color: 'var(--status-warning)', icon: Clock };
        }
        return { color: 'var(--status-success)', icon: Clock };
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
                        Q&A — Preguntas y Respuestas
                    </h1>
                </div>
                <button
                    onClick={() => setShowNewThread(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                    style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                >
                    <Plus className="h-3.5 w-3.5" /> Nueva Pregunta
                </button>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                {['', 'draft', 'sent', 'pending_response', 'answered', 'escalated', 'closed'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className="px-2 py-1 text-xs"
                        style={{
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: statusFilter === s ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                            color: statusFilter === s ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
                            fontWeight: statusFilter === s ? 600 : 400,
                        }}
                    >
                        {s ? (QA_STATUS[s]?.label || s) : 'Todos'}
                    </button>
                ))}
                <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>{threads.length} hilos</span>
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-12 gap-4" style={{ minHeight: '500px' }}>
                {/* Thread list */}
                <div className="col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {threads.length === 0 ? (
                        <div className="g-card p-8 text-center" style={{ borderRadius: 'var(--g-radius-lg)' }}>
                            <MessageSquare className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>No hay hilos Q&A.</p>
                        </div>
                    ) : threads.map(thread => {
                        const st = QA_STATUS[thread.status] || QA_STATUS.draft;
                        const pr = PRIORITY[thread.priority] || PRIORITY.medium;
                        return (
                            <button
                                key={thread.id}
                                onClick={() => handleSelectThread(thread)}
                                className="w-full text-left g-card p-3 border transition-all hover:translate-y-[-1px]"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    borderColor: selectedThread?.id === thread.id ? 'var(--g-brand-3308)' : 'var(--g-border-default)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium" style={{ color: 'var(--g-text-secondary)' }}>Q-{String(thread.thread_number).padStart(3, '0')}</span>
                                    <div className="flex items-center gap-1.5">
                                        {thread.sla_breached && <AlertTriangle className="h-3 w-3" style={{ color: 'var(--status-error)' }} />}
                                        <span className="px-1.5 py-0.5 text-xs" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: st.bg, color: st.fg }}>{st.label}</span>
                                    </div>
                                </div>
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--g-text-primary)' }}>{thread.subject}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="inline-block h-1.5 w-1.5" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: pr.color }} />
                                    <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{pr.label}</span>
                                    {thread.area_code && <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>{'\u00B7'} {thread.area_code}</span>}
                                    <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>{formatDate(thread.created_at)}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Thread detail + Messages */}
                <div className="col-span-7 g-card p-4" style={{ borderRadius: 'var(--g-radius-lg)', display: 'flex', flexDirection: 'column' }}>
                    {selectedThread ? (
                        <>
                            <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--g-border-default)' }}>
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>Q-{String(selectedThread.thread_number).padStart(3, '0')} {'\u00B7'} {selectedThread.area_code || 'General'}</p>
                                    <h3 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>{selectedThread.subject}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedThread.sla_breached && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs" style={{ borderRadius: 'var(--g-radius-sm)', backgroundColor: 'var(--status-error)', color: 'var(--g-text-inverse)' }}>
                                            <AlertTriangle className="h-3 w-3" /> SLA incumplido
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Messages timeline */}
                            <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                                {messages.length === 0 ? (
                                    <p className="text-xs text-center py-8" style={{ color: 'var(--g-text-secondary)' }}>Sin mensajes aun.</p>
                                ) : messages.map(msg => {
                                    const sender = SENDER[msg.sender_role] || SENDER.system;
                                    const isAdvisor = msg.sender_role === 'advisor';
                                    return (
                                        <div
                                            key={msg.id}
                                            className="p-3"
                                            style={{
                                                borderRadius: 'var(--g-radius-md)',
                                                backgroundColor: isAdvisor ? 'var(--g-sec-100)' : 'var(--g-surface-muted)',
                                                marginLeft: isAdvisor ? 'var(--g-space-6)' : '0',
                                                marginRight: isAdvisor ? '0' : 'var(--g-space-6)',
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-block h-1.5 w-1.5" style={{ borderRadius: 'var(--g-radius-full)', backgroundColor: sender.color }} />
                                                <span className="text-xs font-medium" style={{ color: sender.color }}>{sender.label}</span>
                                                {msg.is_internal && <span className="text-xs px-1" style={{ color: 'var(--g-text-secondary)', backgroundColor: 'var(--g-surface-muted)', borderRadius: 'var(--g-radius-sm)' }}>Interno</span>}
                                                <span className="text-xs ml-auto" style={{ color: 'var(--g-text-secondary)' }}>{formatDate(msg.created_at)}</span>
                                            </div>
                                            <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--g-text-primary)' }}>{msg.content}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reply box */}
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--g-border-default)' }}>
                                <div className="flex gap-2">
                                    <textarea
                                        value={replyContent}
                                        onChange={e => setReplyContent(e.target.value)}
                                        placeholder="Escribir respuesta..."
                                        rows={2}
                                        className="flex-1 px-3 py-2 text-xs border resize-none"
                                        style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!replyContent.trim()}
                                        className="self-end p-2 disabled:opacity-50"
                                        style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <MessageSquare className="h-10 w-10 mb-3" style={{ color: 'var(--g-text-secondary)', opacity: 0.3 }} />
                            <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>Selecciona un hilo para ver los mensajes</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Thread Modal */}
            {showNewThread && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="g-card p-6 w-full max-w-md" style={{ borderRadius: 'var(--g-radius-xl)' }}>
                        <h3 className="font-bold mb-4" style={{ fontSize: 'var(--g-text-h3)', color: 'var(--g-text-primary)' }}>Nueva Pregunta</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Asunto *</label>
                                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Prioridad</label>
                                    <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }}>
                                        <option value="low">Baja</option>
                                        <option value="medium">Media</option>
                                        <option value="high">Alta</option>
                                        <option value="critical">Critica</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>Area</label>
                                    <input value={newAreaCode} onChange={e => setNewAreaCode(e.target.value)} placeholder="MERC, CONT..." className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--g-text-primary)' }}>SLA (horas)</label>
                                <input type="number" value={newSlaHours} onChange={e => setNewSlaHours(e.target.value)} className="w-full h-9 px-3 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)', backgroundColor: 'var(--g-surface-card)' }} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowNewThread(false)} className="px-4 py-2 text-sm border" style={{ borderRadius: 'var(--g-radius-md)', borderColor: 'var(--g-border-default)' }}>Cancelar</button>
                            <button onClick={handleCreateThread} disabled={!newSubject.trim()} className="px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ borderRadius: 'var(--g-radius-md)', backgroundColor: 'var(--g-brand-3308)', color: 'var(--g-text-inverse)' }}>Crear</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
