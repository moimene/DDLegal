'use client';

import { Loader2, CheckCircle2, AlertCircle, Clock, Ban } from 'lucide-react';
import { TOOL_STATUS_CONFIG } from '@/lib/utils';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
    pending: Clock,
    running: Loader2,
    completed: CheckCircle2,
    error: AlertCircle,
    cancelled: Ban,
};

interface ExecutionStatusProps {
    status: string;
    size?: 'sm' | 'md';
    showIcon?: boolean;
}

export default function ExecutionStatus({ status, size = 'sm', showIcon = true }: ExecutionStatusProps) {
    const config = TOOL_STATUS_CONFIG[status] || TOOL_STATUS_CONFIG.pending;
    const Icon = STATUS_ICONS[status] || Clock;
    const isRunning = status === 'running';

    return (
        <span
            className={`inline-flex items-center gap-1 font-medium ${
                size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
            }`}
            style={{
                borderRadius: 'var(--g-radius-full)',
                backgroundColor: config.bg,
                color: config.fg,
            }}
        >
            {showIcon && (
                <Icon
                    className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${isRunning ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                />
            )}
            {config.label}
        </span>
    );
}
