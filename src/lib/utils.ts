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
    critical: { label: 'Crítica', color: 'var(--g-severity-critical)' },
    high: { label: 'Alta', color: 'var(--g-severity-high)' },
    medium: { label: 'Media', color: 'var(--g-severity-medium)' },
    low: { label: 'Baja', color: 'var(--g-severity-low)' },
};

// ============================================================
// Microtools, Evidence & Skills configs
// ============================================================

export const TOOL_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: 'Pendiente', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    running: { label: 'Ejecutando', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    completed: { label: 'Completado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    cancelled: { label: 'Cancelado', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
};

export const SKILL_CATEGORY_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    verificacion: { label: 'Verificacion', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    analisis: { label: 'Analisis', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    extraccion: { label: 'Extraccion', bg: 'var(--g-brand-bright)', fg: 'var(--g-text-inverse)' },
    generacion: { label: 'Generacion', bg: 'var(--g-sec-700)', fg: 'var(--g-text-inverse)' },
    monitorizacion: { label: 'Monitorizacion', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
};

export const EVIDENCE_SOURCE_CONFIG: Record<string, { label: string; icon: string }> = {
    document: { label: 'Documento', icon: 'FileText' },
    registry_scrape: { label: 'Registro publico', icon: 'Globe' },
    api_response: { label: 'Respuesta API', icon: 'Zap' },
    manual_entry: { label: 'Entrada manual', icon: 'PenLine' },
    ai_output: { label: 'Salida IA', icon: 'Bot' },
};

// ============================================================
// Societario On-Demand configs
// ============================================================

export const REQUEST_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    pending:      { label: 'Pendiente',       bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    running:      { label: 'Ejecutando',      bg: 'var(--status-info)',     fg: 'var(--g-text-inverse)' },
    done:         { label: 'Completado',       bg: 'var(--status-success)',  fg: 'var(--g-text-inverse)' },
    needs_review: { label: 'Requiere revisión', bg: 'var(--status-warning)',  fg: 'var(--g-text-inverse)' },
    failed:       { label: 'Fallido',          bg: 'var(--status-error)',    fg: 'var(--g-text-inverse)' },
};

export const PIPELINE_STEPS = [
    { key: 'created',            label: 'Solicitud',   icon: 'FileText' },
    { key: 'identity_resolved',  label: 'Resolución',  icon: 'Search' },
    { key: 'borme_ingested',     label: 'BORME',       icon: 'Database' },
    { key: 'snapshot_built',     label: 'Snapshot',     icon: 'Camera' },
    { key: 'report_generated',   label: 'Informe',     icon: 'FileCheck' },
    { key: 'validated',          label: 'Validación',  icon: 'ShieldCheck' },
] as const;

export const TIPO_ACTO_LABELS: Record<string, string> = {
    CONSTITUCION:          'Constitución',
    NOMBRAMIENTO_ADMIN:    'Nombramiento Administrador',
    CESE_ADMIN:            'Cese Administrador',
    REELECCION:            'Reelección',
    AMPLIACION_CAPITAL:    'Ampliación de Capital',
    REDUCCION_CAPITAL:     'Reducción de Capital',
    CAMBIO_DOMICILIO:      'Cambio de Domicilio',
    CAMBIO_OBJETO:         'Cambio de Objeto Social',
    CAMBIO_DENOMINACION:   'Cambio de Denominación',
    DISOLUCION:            'Disolución',
    LIQUIDACION:           'Liquidación',
    FUSION:                'Fusión',
    ESCISION:              'Escisión',
    TRANSFORMACION:        'Transformación',
    PODER_GENERAL:         'Poder General',
    PODER_ESPECIAL:        'Poder Especial',
    REVOCACION_PODER:      'Revocación de Poder',
    DEPOSITO_CUENTAS:      'Depósito de Cuentas',
    NOMBRAMIENTO_AUDITOR:  'Nombramiento Auditor',
    CESE_AUDITOR:          'Cese Auditor',
    EMISION_OBLIGACIONES:  'Emisión de Obligaciones',
    SITUACION_CONCURSAL:   'Situación Concursal',
    OTRO:                  'Otro',
};

export const CARGO_LABELS: Record<string, string> = {
    ADMIN_UNICO:        'Administrador Único',
    ADMIN_SOLIDARIO:    'Administrador Solidario',
    ADMIN_MANCOMUNADO:  'Administrador Mancomunado',
    CONSEJERO:          'Consejero',
    PRESIDENTE:         'Presidente',
    VICEPRESIDENTE:     'Vicepresidente',
    SECRETARIO:         'Secretario',
    VICESECRETARIO:     'Vicesecretario',
    CONSEJERO_DELEGADO: 'Consejero Delegado',
    DIRECTOR_GENERAL:   'Director General',
    APODERADO:          'Apoderado',
    LIQUIDADOR:         'Liquidador',
    AUDITOR:            'Auditor',
};

// ============================================================
// IP Radar configs
// ============================================================

export const IP_PIPELINE_STEPS = [
    { key: 'created',             label: 'Solicitud',   icon: 'FileText' },
    { key: 'titular_resolved',    label: 'Titular',     icon: 'User' },
    { key: 'registries_searched', label: 'Registros',   icon: 'Search' },
    { key: 'snapshot_built',      label: 'Snapshot',    icon: 'Camera' },
    { key: 'report_generated',    label: 'Informe',     icon: 'FileCheck' },
] as const;

export const IP_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    solicitada:  { label: 'Solicitada',  bg: 'var(--status-info)',    fg: 'var(--g-text-inverse)' },
    registrada:  { label: 'Registrada',  bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    renovada:    { label: 'Renovada',    bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    expirada:    { label: 'Expirada',    bg: 'var(--status-error)',   fg: 'var(--g-text-inverse)' },
    denegada:    { label: 'Denegada',    bg: 'var(--status-error)',   fg: 'var(--g-text-inverse)' },
    opuesta:     { label: 'Opuesta',     bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    retirada:    { label: 'Retirada',    bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    anulada:     { label: 'Anulada',     bg: 'var(--status-error)',   fg: 'var(--g-text-inverse)' },
};

export const ALERT_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    new:          { label: 'Nueva',       bg: 'var(--status-error)',   fg: 'var(--g-text-inverse)' },
    acknowledged: { label: 'Reconocida',  bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    resolved:     { label: 'Resuelta',    bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
};

export const REPORT_FAMILY_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    transactional: { label: 'Transaccional', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    pmo:           { label: 'PMO',           bg: 'var(--status-info)',  fg: 'var(--g-text-inverse)' },
    compliance:    { label: 'Compliance',    bg: 'var(--g-sec-700)',    fg: 'var(--g-text-inverse)' },
};

export const NIZA_CLASSES: Record<number, string> = {
    1: 'Productos quimicos',
    2: 'Pinturas, barnices',
    3: 'Cosmeticos, perfumeria',
    4: 'Aceites, grasas industriales',
    5: 'Productos farmaceuticos',
    6: 'Metales comunes',
    7: 'Maquinas, motores',
    8: 'Herramientas manuales',
    9: 'Aparatos cientificos, informatica',
    10: 'Aparatos medicos',
    11: 'Iluminacion, calefaccion',
    12: 'Vehiculos',
    13: 'Armas de fuego',
    14: 'Joyeria, relojeria',
    15: 'Instrumentos musicales',
    16: 'Papel, carton, imprenta',
    17: 'Caucho, plasticos',
    18: 'Cuero, marroquineria',
    19: 'Materiales de construccion',
    20: 'Muebles',
    21: 'Utensilios domesticos',
    22: 'Cuerdas, lonas',
    23: 'Hilos textiles',
    24: 'Tejidos',
    25: 'Vestimenta, calzado',
    26: 'Merceria, bordados',
    27: 'Alfombras, revestimientos suelo',
    28: 'Juegos, juguetes, deportes',
    29: 'Alimentos: carne, pescado, lacteos',
    30: 'Alimentos: cafe, te, cereales',
    31: 'Productos agricolas',
    32: 'Bebidas no alcoholicas',
    33: 'Bebidas alcoholicas',
    34: 'Tabaco',
    35: 'Publicidad, gestion comercial',
    36: 'Seguros, finanzas',
    37: 'Construccion, reparacion',
    38: 'Telecomunicaciones',
    39: 'Transporte, almacenamiento',
    40: 'Tratamiento de materiales',
    41: 'Educacion, entretenimiento',
    42: 'Servicios cientificos, tecnologicos',
    43: 'Hosteleria, restauracion',
    44: 'Servicios medicos, veterinarios',
    45: 'Servicios juridicos, seguridad',
};
