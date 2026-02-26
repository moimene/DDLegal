'use client';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

export default function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: 'var(--g-radius-full)',
        backgroundColor: checked ? 'var(--status-success)' : 'var(--g-border-default)',
        position: 'relative',
        transition: 'background-color var(--g-transition-fast)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: 'var(--g-radius-full)',
          backgroundColor: 'var(--g-text-inverse)',
          transition: 'left var(--g-transition-fast)',
          boxShadow: 'var(--g-shadow-sm)',
        }}
      />
    </button>
  );
}
