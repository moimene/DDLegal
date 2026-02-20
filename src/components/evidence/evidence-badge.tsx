'use client';

import { FileText } from 'lucide-react';

interface EvidenceBadgeProps {
    count: number;
    onClick?: () => void;
    size?: 'sm' | 'md';
}

export default function EvidenceBadge({ count, onClick, size = 'sm' }: EvidenceBadgeProps) {
    const isClickable = !!onClick;
    const Tag = isClickable ? 'button' : 'span';

    return (
        <Tag
            onClick={onClick}
            className={`inline-flex items-center gap-1 transition-all ${
                isClickable ? 'cursor-pointer hover:opacity-80' : ''
            } ${size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}
            style={{
                borderRadius: 'var(--g-radius-full)',
                backgroundColor: count > 0 ? 'var(--g-brand-3308)' : 'var(--g-surface-muted)',
                color: count > 0 ? 'var(--g-text-inverse)' : 'var(--g-text-secondary)',
            }}
            title={`${count} evidencia${count !== 1 ? 's' : ''}`}
            aria-label={`${count} evidencia${count !== 1 ? 's' : ''}`}
        >
            <FileText className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
            {count}
        </Tag>
    );
}
