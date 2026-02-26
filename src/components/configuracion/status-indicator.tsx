'use client';

import { CheckCircle2, AlertCircle, Loader2, MinusCircle } from 'lucide-react';

type StatusType = 'ok' | 'error' | 'warning' | 'loading' | 'unconfigured';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  detail?: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<StatusType, { bg: string; fg: string; text: string }> = {
  ok: { bg: 'hsla(160, 100%, 30%, 0.12)', fg: 'var(--g-severity-low)', text: 'Operativo' },
  error: { bg: 'hsla(0, 72%, 51%, 0.12)', fg: 'var(--g-severity-critical)', text: 'Error' },
  warning: { bg: 'hsla(45, 80%, 42%, 0.12)', fg: 'var(--g-severity-medium)', text: 'Advertencia' },
  loading: { bg: 'var(--g-input-bg)', fg: 'var(--g-input-color)', text: 'Verificando...' },
  unconfigured: { bg: 'var(--g-surface-muted)', fg: 'var(--g-text-muted)', text: 'No configurado' },
};

const STATUS_ICONS = {
  ok: CheckCircle2,
  error: AlertCircle,
  warning: AlertCircle,
  loading: Loader2,
  unconfigured: MinusCircle,
};

export default function StatusIndicator({ status, label, detail, size = 'sm' }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[status];
  const iconSize = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 'var(--g-text-caption)' : 'var(--g-text-small)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-1)',
        padding: '2px 8px',
        borderRadius: 'var(--g-radius-full)',
        backgroundColor: config.bg,
        color: config.fg,
        fontSize,
        fontWeight: 'var(--g-font-weight-medium)' as unknown as number,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon
        size={iconSize}
        className={status === 'loading' ? 'animate-spin' : undefined}
      />
      {label || config.text}
      {detail && (
        <span style={{ opacity: 0.7, fontWeight: 'var(--g-font-weight-regular)' as unknown as number }}>
          {detail}
        </span>
      )}
    </span>
  );
}
