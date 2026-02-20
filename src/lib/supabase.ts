import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types from our DD schema
export interface DDProject {
    id: string;
    name: string;
    target_company: string;
    target_sector: string | null;
    deal_type: 'acquisition' | 'merger' | 'jv' | 'carve-out';
    status: 'draft' | 'active' | 'review' | 'closed';
    client_name: string | null;
    engagement_date: string | null;
    deadline: string | null;
    scope_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface DDArea {
    id: string;
    code: string;
    name: string;
    color: string | null;
    icon: string | null;
    sort_order: number;
}

export interface DDProcess {
    id: string;
    number: number;
    name: string;
    description: string | null;
    documents_to_prepare: string[];
    workflow_steps: string[];
    harvey_prompt: string | null;
    area_id: string;
    sort_order: number;
}

export interface DDTask {
    id: string;
    project_id: string;
    process_id: string;
    area_id: string | null;
    status: 'pending' | 'in_progress' | 'review' | 'blocked' | 'completed';
    priority: 'critical' | 'high' | 'medium' | 'low';
    assigned_to: string | null;
    reviewer: string | null;
    due_date: string | null;
    notes: string | null;
    client_visible: boolean;
    ai_output: Record<string, unknown> | null;
    ai_status: 'none' | 'running' | 'completed' | 'error';
    hitl_reviewed_at: string | null;
    hitl_reviewed_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface DDContingency {
    id: string;
    project_id: string;
    area_id: string | null;
    task_id: string | null;
    title: string;
    description: string | null;
    severity: 'critical' | 'high' | 'medium' | 'low';
    probability: 'certain' | 'probable' | 'possible' | 'remote';
    estimated_amount: number | null;
    amount_currency: string;
    status: 'identified' | 'confirmed' | 'mitigated' | 'resolved' | 'accepted';
    client_visible: boolean;
    recommendation: string | null;
    created_at: string;
}

export interface DDQA {
    id: string;
    project_id: string;
    area_id: string | null;
    question: string;
    question_reference: string | null;
    priority: string;
    status: 'draft' | 'sent' | 'answered' | 'follow_up' | 'closed';
    client_visible: boolean;
    answer: string | null;
    sent_at: string | null;
    answered_at: string | null;
    created_at: string;
}

export interface DDDeliverable {
    id: string;
    project_id: string;
    type: string;
    title: string;
    content: Record<string, unknown> | null;
    storage_path: string | null;
    version: number;
    status: 'draft' | 'review' | 'approved' | 'final';
    client_visible: boolean;
    generated_by: 'manual' | 'ai_assisted' | 'ai_auto';
    created_at: string;
}

// ============================================================
// Microtools, Evidence & Skills System
// ============================================================

export interface DDEvidence {
    id: string;
    project_id: string | null;
    tool_execution_id: string | null;
    task_id: string | null;
    contingency_id: string | null;
    source_type: 'document' | 'registry_scrape' | 'api_response' | 'manual_entry' | 'ai_output';
    source_reference: string;
    source_name: string | null;
    page_range: string | null;
    snippet: string | null;
    snippet_hash: string | null;
    confidence_score: number | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface DDSkill {
    id: string;
    area_code: string;
    area_id: string | null;
    skill_key: string;
    name: string;
    description: string | null;
    category: 'verificacion' | 'analisis' | 'extraccion' | 'generacion' | 'monitorizacion';
    prompt_template: string;
    expected_output_schema: Record<string, unknown> | null;
    evidence_requirements: Record<string, unknown>[] | null;
    agent_pipeline: string[] | null;
    is_active: boolean;
    version: number;
    created_at: string;
    updated_at: string;
    // Extended fields from legal team fichas
    purpose: string | null;
    inputs_required: string[] | null;
    trigger_description: string | null;
    authorized_sources: string[] | null;
    validation_rules: string | null;
    hitl_required: boolean;
    hitl_conditions: string | null;
    grounding_description: string | null;
    priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
    dependencies: string[] | null;
    risks_limits: string | null;
    kpis: string[] | null;
}

export interface DDTool {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    area_codes: string[];
    input_schema: Record<string, unknown> | null;
    output_schema: Record<string, unknown> | null;
    skills_used: string[] | null;
    requires_project: boolean;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface DDToolExecution {
    id: string;
    tool_id: string;
    project_id: string | null;
    input_params: Record<string, unknown>;
    output_data: Record<string, unknown> | null;
    status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
    error_message: string | null;
    executed_by: string | null;
    started_at: string | null;
    completed_at: string | null;
    duration_ms: number | null;
    evidence_count: number;
    created_at: string;
}

export interface DDToolProjectLink {
    id: string;
    tool_execution_id: string;
    project_id: string;
    linked_by: string | null;
    linked_at: string;
    notes: string | null;
}

// ============================================================
// Societario On-Demand System (PRD v1.1)
// ============================================================

export type TipoActo =
    | 'CONSTITUCION' | 'NOMBRAMIENTO_ADMIN' | 'CESE_ADMIN' | 'REELECCION'
    | 'AMPLIACION_CAPITAL' | 'REDUCCION_CAPITAL' | 'CAMBIO_DOMICILIO'
    | 'CAMBIO_OBJETO' | 'CAMBIO_DENOMINACION' | 'DISOLUCION' | 'LIQUIDACION'
    | 'FUSION' | 'ESCISION' | 'TRANSFORMACION' | 'PODER_GENERAL'
    | 'PODER_ESPECIAL' | 'REVOCACION_PODER' | 'DEPOSITO_CUENTAS'
    | 'NOMBRAMIENTO_AUDITOR' | 'CESE_AUDITOR' | 'EMISION_OBLIGACIONES'
    | 'SITUACION_CONCURSAL' | 'OTRO';

export type CargoCode =
    | 'ADMIN_UNICO' | 'ADMIN_SOLIDARIO' | 'ADMIN_MANCOMUNADO'
    | 'CONSEJERO' | 'PRESIDENTE' | 'VICEPRESIDENTE'
    | 'SECRETARIO' | 'VICESECRETARIO' | 'CONSEJERO_DELEGADO'
    | 'DIRECTOR_GENERAL' | 'APODERADO' | 'LIQUIDADOR' | 'AUDITOR';

export type RequestStatus = 'pending' | 'running' | 'done' | 'needs_review' | 'failed';

export interface Sociedad {
    id: string;
    denominacion: string;
    nif: string | null;
    domicilio: string | null;
    objeto_social: string | null;
    capital_social: number | null;
    moneda: string;
    organo_admin: string | null;
    fecha_constitucion: string | null;
    borme_id_primera: string | null;
    is_active: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Persona {
    id: string;
    nombre_completo: string;
    nif: string | null;
    tipo: 'natural' | 'juridica';
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface DDRequest {
    id: string;
    tool_execution_id: string | null;
    idempotency_key: string | null;
    sociedad_input: string;
    nif_hint: string | null;
    periodo_anios: number;
    status: RequestStatus;
    pipeline_step: string;
    sociedad_id: string | null;
    error_log: string | null;
    requested_by: string;
    created_at: string;
    updated_at: string;
}

export interface SociedadCandidate {
    id: string;
    request_id: string;
    denominacion_candidata: string;
    nif_candidato: string | null;
    similarity_score: number;
    source: string;
    is_selected: boolean;
    created_at: string;
    updated_at: string;
}

export interface BormeAnnouncement {
    id: string;
    sociedad_id: string;
    borme_date: string;
    borme_section: string | null;
    borme_code: string | null;
    tipo_acto: TipoActo;
    raw_text: string | null;
    parsed_data: Record<string, unknown>;
    source_url: string | null;
    ingested_at: string;
}

export interface GovernanceRole {
    id: string;
    sociedad_id: string;
    persona_id: string;
    cargo: CargoCode;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    borme_announcement_id: string | null;
    is_current: boolean;
    created_at: string;
    updated_at: string;
    // Joined fields
    persona?: Persona;
}

export interface DDSnapshot {
    id: string;
    request_id: string | null;
    sociedad_id: string;
    snapshot_date: string;
    datos_generales: Record<string, unknown>;
    administradores: Record<string, unknown>[];
    apoderamientos: Record<string, unknown>[];
    modificaciones: Record<string, unknown>[];
    capital_history: Record<string, unknown>[];
    timeline_eventos: Record<string, unknown>[];
    red_flags: Record<string, unknown>[];
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface DDReport {
    id: string;
    request_id: string | null;
    snapshot_id: string | null;
    report_type: string;
    prompt_used: string | null;
    evidence_pack: Record<string, unknown>;
    harvey_response: Record<string, unknown>;
    grounding_score: number;
    grounding_issues: Record<string, unknown>[];
    status: 'pending' | 'generating' | 'done' | 'failed';
    created_at: string;
    updated_at: string;
}

export interface DDSourceLog {
    id: string;
    report_id: string;
    source_type: 'borme' | 'registro' | 'manual' | 'api';
    source_url: string | null;
    fetched_at: string;
    http_status: number | null;
    response_hash: string | null;
    is_valid: boolean;
}

// ============================================================
// Report Templates & Negotiation Alerts
// ============================================================

export interface DDReportTemplate {
    id: string;
    report_type: string;
    family: 'transactional' | 'pmo' | 'compliance';
    title_template: string;
    required_sections: string[];
    evidence_pack_version: string;
    grounding_required: boolean;
    harvey_skill_key: string | null;
    export_formats: string[];
    cadencia: 'on_demand' | 'daily' | 'weekly' | 'monthly';
    audience: string[];
    url_allowlist: string[] | null;
    is_active: boolean;
    created_at: string;
}

export interface DDNegotiationAlert {
    id: string;
    request_id: string;
    project_id: string | null;
    alert_type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    titulo: string;
    impacto_negociacion: string;
    evidencia: string[];
    recomendacion: string;
    area_code: string;
    status: 'new' | 'acknowledged' | 'resolved';
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================================
// IP Radar — Propiedad Industrial
// ============================================================

export type IPJurisdiccion = 'ES' | 'EU' | 'INT';
export type IPTipoMarca = 'denominativa' | 'figurativa' | 'mixta' | 'tridimensional' | 'sonora' | 'otra';
export type IPEstadoLegal = 'solicitada' | 'registrada' | 'renovada' | 'expirada' | 'denegada' | 'opuesta' | 'retirada' | 'anulada';

export interface IPRequest {
    id: string;
    denominacion_input: string;
    titular_nif: string | null;
    scope_jurisdicciones: IPJurisdiccion[];
    project_id: string | null;
    titular_id: string | null;
    status: RequestStatus;
    pipeline_step: string;
    error_log: string | null;
    created_at: string;
    updated_at: string;
}

export interface IPTitular {
    id: string;
    nombre_oficial: string;
    nif_nie_cif: string | null;
    pais: string;
    direccion: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface IPMarca {
    id: string;
    titular_id: string;
    jurisdiccion: IPJurisdiccion;
    signo: string;
    tipo: IPTipoMarca;
    clases_niza: number[];
    estado_legal: IPEstadoLegal;
    numero_expediente: string;
    fecha_solicitud: string | null;
    fecha_concesion: string | null;
    fecha_vencimiento: string | null;
    source_url: string | null;
    evidence_ref: string | null;
    raw_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface IPDiseno {
    id: string;
    titular_id: string;
    jurisdiccion: IPJurisdiccion;
    titulo: string;
    clasificacion_locarno: string | null;
    estado_legal: IPEstadoLegal;
    numero_expediente: string;
    fecha_solicitud: string | null;
    fecha_concesion: string | null;
    fecha_vencimiento: string | null;
    source_url: string | null;
    evidence_ref: string | null;
    raw_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface IPSnapshotIP {
    id: string;
    ip_request_id: string;
    titular_id: string;
    version: number;
    data: Record<string, unknown>;
    created_at: string;
}

// ============================================================
// Data Room — Documents
// ============================================================

export interface DDDocument {
    id: string;
    project_id: string;
    area_code: string | null;
    name: string;
    original_filename: string;
    file_type: string;
    file_size_bytes: number;
    storage_path: string | null;
    status: 'uploaded' | 'processing' | 'indexed' | 'error';
    category: string;
    uploaded_by: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
