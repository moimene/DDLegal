/**
 * Resolve params in a way compatible with Next.js 14 (plain object) AND 15 (Promise).
 * Next.js 14: params is a plain object — returned as-is.
 * Next.js 15: params is a Promise — upgrade this function to use React.use() when migrating.
 */
export function useResolvedParams<T>(params: T | Promise<T>): T {
    // Next.js 14.2: params is always a plain object, just cast and return.
    // When upgrading to Next.js 15, replace with: return use(params as Promise<T>);
    return params as T;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

// ⚡ Bolt: Cache Intl formatters to reduce instantiation overhead.
// Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` is an expensive operation.
// Caching them based on locale and options string prevents redundant instantiations,
// yielding significant performance improvements, particularly during list rendering.
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

export function getCachedDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${locale}-${options ? JSON.stringify(options) : ''}`;
    if (!dateTimeFormatCache.has(key)) {
        dateTimeFormatCache.set(key, new Intl.DateTimeFormat(locale, options));
    }
    return dateTimeFormatCache.get(key)!;
}

// ⚡ Bolt: Cache Intl.NumberFormat
const numberFormatCache = new Map<string, Intl.NumberFormat>();

export function getCachedNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `${locale}-${options ? JSON.stringify(options) : ''}`;
    if (!numberFormatCache.has(key)) {
        numberFormatCache.set(key, new Intl.NumberFormat(locale, options));
    }
    return numberFormatCache.get(key)!;
}

export function formatDate(date: string | null): string {
    if (!date) return '—';
    return getCachedDateTimeFormat('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(date));
}

export function formatCurrency(amount: number | null, currency = 'EUR'): string {
    if (amount === null) return '—';
    return getCachedNumberFormat('es-ES', {
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

// ============================================================
// Role & Review Depth configs (Phase 1 — PMO Evolution)
// ============================================================

export const ROLE_CONFIG: Record<string, { label: string; labelEs: string; color: string; icon: string }> = {
    clo: { label: 'CLO', labelEs: 'CLO / Director Legal', color: '#7C3AED', icon: 'Crown' },
    pm_transaccion: { label: 'PM', labelEs: 'PM de Transaccion', color: '#2563EB', icon: 'ClipboardList' },
    abogado_area: { label: 'Area', labelEs: 'Abogado por Area', color: '#059669', icon: 'Scale' },
    deal_sponsor: { label: 'Sponsor', labelEs: 'Deal Sponsor', color: '#D97706', icon: 'Star' },
    target_liaison: { label: 'Target', labelEs: 'Contacto Target', color: '#DC2626', icon: 'Building2' },
    stakeholder_negocio: { label: 'Stakeholder', labelEs: 'Stakeholder Negocio', color: '#7C3AED', icon: 'Briefcase' },
    cliente_externo: { label: 'Cliente', labelEs: 'Cliente Externo', color: '#6B7280', icon: 'Eye' },
};

export const REVIEW_DEPTH_CONFIG: Record<string, { label: string; labelEs: string; color: string; description: string }> = {
    light: { label: 'Light', labelEs: 'Revision Ligera', color: '#10B981', description: 'Subconjunto critico, umbrales reducidos' },
    standard: { label: 'Standard', labelEs: 'Revision Estandar', color: '#3B82F6', description: 'Parametros base del sistema' },
    enhanced: { label: 'Enhanced', labelEs: 'Revision Intensiva', color: '#EF4444', description: 'Maximo rigor, HITL ampliado' },
};

// ============================================================
// VDR & Q&A configs (Phase 2 — PMO Evolution)
// ============================================================

export const VDR_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    staged: { label: 'Preparado', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    uploaded: { label: 'Subido', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    processing: { label: 'Procesando', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    indexed: { label: 'Indexado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    superseded: { label: 'Superado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    archived: { label: 'Archivado', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
    error: { label: 'Error', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
};

export const QA_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: 'Borrador', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    sent: { label: 'Enviada', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    pending_response: { label: 'Pendiente', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
    answered: { label: 'Respondida', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    follow_up: { label: 'Seguimiento', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    escalated: { label: 'Escalada', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    closed: { label: 'Cerrada', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-secondary)' },
};

export const QA_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critica', color: 'var(--g-severity-critical)' },
    high: { label: 'Alta', color: 'var(--g-severity-high)' },
    medium: { label: 'Media', color: 'var(--g-severity-medium)' },
    low: { label: 'Baja', color: 'var(--g-severity-low)' },
};

export const REPORT_CATEGORY_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    operational: { label: 'Operativo', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    workstream: { label: 'Workstream', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    consolidated: { label: 'Consolidado', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    transactional: { label: 'Transaccional', bg: 'var(--g-brand-3308)', fg: 'var(--g-text-inverse)' },
    final: { label: 'Final', bg: 'var(--g-sec-700)', fg: 'var(--g-text-inverse)' },
    negotiation: { label: 'Negociacion', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
};

export const REPORT_VISIBILITY_CONFIG: Record<string, { label: string; color: string }> = {
    internal: { label: 'Interno', color: 'var(--g-text-secondary)' },
    client: { label: 'Cliente', color: 'var(--status-info)' },
    deal_team: { label: 'Deal Team', color: 'var(--g-brand-3308)' },
    counterparty: { label: 'Contraparte', color: 'var(--status-warning)' },
    committee: { label: 'Comite', color: 'var(--g-sec-700)' },
};

// ============================================================
// Fase 3: Negotiation Constants
// ============================================================

export const NEGOTIATION_STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    open: { label: 'Abierto', bg: 'var(--g-surface-muted)', fg: 'var(--g-text-primary)' },
    proposed: { label: 'Propuesto', bg: 'var(--status-info)', fg: 'var(--g-text-inverse)' },
    agreed: { label: 'Acordado', bg: 'var(--status-success)', fg: 'var(--g-text-inverse)' },
    rejected: { label: 'Rechazado', bg: 'var(--status-error)', fg: 'var(--g-text-inverse)' },
    deferred: { label: 'Diferido', bg: 'var(--status-warning)', fg: 'var(--g-text-inverse)' },
};

export const TREATMENT_CONFIG: Record<string, { label: string; description: string; color: string }> = {
    indemnity: { label: 'Indemnizacion', description: 'Indemnizacion por danos y perjuicios', color: 'var(--status-error)' },
    retention: { label: 'Retencion', description: 'Retencion de parte del precio', color: 'var(--status-warning)' },
    escrow: { label: 'Escrow', description: 'Deposito en cuenta escrow', color: 'var(--status-info)' },
    price_adjustment: { label: 'Ajuste de Precio', description: 'Ajuste al precio de compra', color: 'var(--g-brand-3308)' },
    insurance: { label: 'Seguro R&W', description: 'Cubierto por seguro de representaciones', color: 'var(--g-sec-700)' },
    waiver: { label: 'Renuncia', description: 'Riesgo asumido sin proteccion', color: 'var(--g-text-muted)' },
};

export const CLAUSE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    r_and_w: { label: 'Representaciones y Garantias', color: 'var(--g-brand-3308)' },
    indemnity: { label: 'Indemnizacion', color: 'var(--status-error)' },
    limitation: { label: 'Limitacion', color: 'var(--status-warning)' },
    condition_precedent: { label: 'Condicion Precedente', color: 'var(--status-info)' },
    definition: { label: 'Definicion', color: 'var(--g-text-secondary)' },
    boilerplate: { label: 'Boilerplate', color: 'var(--g-text-muted)' },
};

export const BASKET_TYPE_CONFIG: Record<string, { label: string; description: string }> = {
    deductible: { label: 'Deductible', description: 'Solo se indemniza el exceso sobre el basket' },
    tipping: { label: 'Tipping', description: 'Una vez superado el basket, se indemniza desde el primer euro' },
    mini_basket: { label: 'Mini-basket', description: 'Umbral minimo por reclamacion individual' },
    none: { label: 'Sin basket', description: 'Sin umbral minimo de reclamacion' },
};

// ============================================================
// Kanban State Config (S2)
// ============================================================

export const KANBAN_STATE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  backlog: { label: 'Backlog', color: 'var(--g-status-neutral)', icon: 'Inbox' },
  info_solicitada: { label: 'Info solicitada', color: 'var(--g-status-warning)', icon: 'Send' },
  info_recibida: { label: 'Info recibida', color: 'var(--g-status-info)', icon: 'Download' },
  lista_para_analisis: { label: 'Lista para análisis', color: 'var(--g-status-info)', icon: 'CheckCircle' },
  en_analisis: { label: 'En análisis', color: 'var(--g-status-active)', icon: 'Search' },
  ia_propuesta: { label: 'IA propuesta', color: 'var(--g-status-ai)', icon: 'Sparkles' },
  hitl_revision: { label: 'HITL revisión', color: 'var(--g-status-warning)', icon: 'UserCheck' },
  conclusion: { label: 'Conclusión', color: 'var(--g-status-success)', icon: 'FileCheck' },
  integrado_en_informe: { label: 'Integrado en informe', color: 'var(--g-status-success)', icon: 'BookCheck' },
  bloqueado: { label: 'Bloqueado', color: 'var(--g-severity-critical)', icon: 'AlertOctagon' },
};

// ── War Room (S6) ──────────────────────────────────────

export const DECISION_TYPE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  accept_risk: { label: 'Aceptar riesgo', color: '#6B7280', description: 'Riesgo aceptado sin accion adicional' },
  mitigate: { label: 'Mitigar', color: '#10B981', description: 'Accion de mitigacion implementada' },
  transfer: { label: 'Transferir', color: '#3B82F6', description: 'Riesgo transferido (seguro, escrow, etc.)' },
  reject: { label: 'Rechazar', color: '#EF4444', description: 'Deal breaker — no se acepta' },
  defer: { label: 'Diferir', color: '#F59E0B', description: 'Decision aplazada pendiente mas informacion' },
  escalate: { label: 'Escalar', color: '#8B5CF6', description: 'Escalado a comite / CLO / socio' },
};

export const NOTIFICATION_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  severity_change: { label: 'Cambio de severidad', icon: '⚠️' },
  new_blocker: { label: 'Nuevo bloqueante', icon: '🚫' },
  request_overdue: { label: 'Solicitud vencida', icon: '⏰' },
  decision_required: { label: 'Decision requerida', icon: '⚖️' },
  red_flag_new: { label: 'Nuevo red flag', icon: '🚩' },
};
