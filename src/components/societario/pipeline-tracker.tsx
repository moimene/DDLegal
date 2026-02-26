'use client';

import { CheckCircle2, Loader2, XCircle, Circle } from 'lucide-react';
import { PIPELINE_STEPS } from '@/lib/utils';

interface PipelineTrackerProps {
    currentStep: string;
    status: string; // 'pending' | 'running' | 'done' | 'needs_review' | 'failed'
}

export default function PipelineTracker({ currentStep, status }: PipelineTrackerProps) {
    const currentIndex = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
    const isNeedsReview = status === 'needs_review';
    const isFailed = status === 'failed';

    return (
        <div
            className="border p-4"
            style={{
                borderColor: 'var(--g-border-subtle)',
                borderRadius: 'var(--g-radius-lg)',
                backgroundColor: 'var(--g-surface-card)',
                boxShadow: 'var(--g-shadow-card)',
            }}
        >
            <div className="flex items-center justify-between gap-1 overflow-x-auto">
                {PIPELINE_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isActive = idx === currentIndex;
                    const isFuture = idx > currentIndex;

                    let iconColor = 'var(--g-text-muted)';
                    let textColor = 'var(--g-text-muted)';
                    let bgColor = 'transparent';

                    if (isCompleted) {
                        iconColor = 'var(--status-success)';
                        textColor = 'var(--status-success)';
                    } else if (isActive) {
                        if (isFailed) {
                            iconColor = 'var(--g-severity-critical)';
                            textColor = 'var(--g-severity-critical)';
                            bgColor = 'var(--g-priority-p0-bg)';
                        } else if (isNeedsReview) {
                            iconColor = 'var(--g-severity-medium)';
                            textColor = 'var(--g-severity-medium)';
                            bgColor = 'var(--g-trigger-bg)';
                        } else {
                            iconColor = 'var(--g-brand-3308)';
                            textColor = 'var(--g-brand-3308)';
                            bgColor = 'var(--g-sidebar-surface-subtle)';
                        }
                    }

                    return (
                        <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                            <div
                                className="flex flex-col items-center gap-1 px-2 py-1.5"
                                style={{
                                    borderRadius: 'var(--g-radius-md)',
                                    backgroundColor: bgColor,
                                    minWidth: '72px',
                                }}
                            >
                                {isCompleted && (
                                    <CheckCircle2
                                        className="h-4 w-4"
                                        style={{ color: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isActive && !isFailed && !isNeedsReview && status === 'running' && (
                                    <Loader2
                                        className="h-4 w-4 animate-spin"
                                        style={{ color: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isActive && isFailed && (
                                    <XCircle
                                        className="h-4 w-4"
                                        style={{ color: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isActive && isNeedsReview && (
                                    <Circle
                                        className="h-4 w-4"
                                        style={{ color: iconColor, fill: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isActive && status !== 'running' && !isFailed && !isNeedsReview && (
                                    <CheckCircle2
                                        className="h-4 w-4"
                                        style={{ color: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isFuture && (
                                    <Circle
                                        className="h-4 w-4"
                                        style={{ color: iconColor }}
                                        aria-hidden="true"
                                    />
                                )}
                                <span
                                    className="text-[10px] font-medium text-center leading-tight"
                                    style={{ color: textColor }}
                                >
                                    {step.label}
                                </span>
                            </div>
                            {idx < PIPELINE_STEPS.length - 1 && (
                                <div
                                    className="h-px flex-shrink-0"
                                    style={{
                                        width: '16px',
                                        backgroundColor: isCompleted
                                            ? 'var(--status-success)'
                                            : 'var(--g-border-subtle)',
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
