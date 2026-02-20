export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | null): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(date));
}

export function formatCurrency(amount: number | null, currency = 'EUR'): string {
    if (amount === null) return '—';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency', currency, maximumFractionDigits: 0
    }).format(amount);
}

export const AREA_COLORS: Record<string, string> = {
    MERC: '262, 83%, 58%',
    CONT: '217, 91%, 60%',
    LAB: '25, 95%, 53%',
    FISC: '38, 92%, 50%',
    INM: '160, 100%, 30%',
    PI: '192, 91%, 49%',
    LIT: '330, 81%, 60%',
    ADMIN: '280, 70%, 55%',
    MA: '120, 60%, 40%',
    DATOS: '200, 80%, 50%',
    GENERAL: '0, 0%, 50%',
};

export const STATUS_CONFIG = {
    pending: { label: 'Pendiente', variant: 'outline' as const },
    in_progress: { label: 'En curso', variant: 'default' as const },
    review: { label: 'En revisión', variant: 'warning' as const },
    blocked: { label: 'Bloqueado', variant: 'destructive' as const },
    completed: { label: 'Completado', variant: 'success' as const },
};

export const SEVERITY_CONFIG = {
    critical: { label: 'Crítica', color: 'hsl(0, 84%, 60%)' },
    high: { label: 'Alta', color: 'hsl(25, 95%, 53%)' },
    medium: { label: 'Media', color: 'hsl(38, 92%, 50%)' },
    low: { label: 'Baja', color: 'hsl(160, 100%, 30%)' },
};
