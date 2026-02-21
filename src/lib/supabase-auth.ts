import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Auth-aware Browser Client
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates an auth-aware Supabase client for browser usage.
 * Persists the session in localStorage so users stay logged in
 * across page reloads. Uses autoRefreshToken to silently renew
 * the JWT before it expires.
 */
export function createAuthSupabase(): SupabaseClient {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
    });
}

// Singleton for convenience in browser contexts
let _authClient: SupabaseClient | null = null;

export function getAuthSupabase(): SupabaseClient {
    if (!_authClient) {
        _authClient = createAuthSupabase();
    }
    return _authClient;
}

// ============================================================
// Types — Roles & Review Depth
// ============================================================

export type ProjectRole =
    | 'clo'
    | 'pm_transaccion'
    | 'abogado_area'
    | 'deal_sponsor'
    | 'target_liaison'
    | 'stakeholder_negocio'
    | 'cliente_externo';

export type ReviewDepth = 'light' | 'standard' | 'enhanced';

export interface ProjectUserRole {
    id: string;
    project_id: string;
    user_id: string;
    role: ProjectRole;
    area_code: string | null;
    is_active: boolean;
    granted_by: string | null;
    granted_at: string;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Permission Matrix
// ============================================================

export interface RolePermissions {
    can_edit_tasks: boolean;
    can_view_contingencies: boolean;
    can_edit_contingencies: boolean;
    can_manage_qa: boolean;
    can_respond_qa: boolean;
    can_view_reports: boolean;
    can_approve_reports: boolean;
    can_upload_vdr: boolean;
    can_publish_vdr: boolean;
    can_manage_roles: boolean;
    can_view_all_areas: boolean;
    can_view_war_room: boolean;
    can_view_negotiation: boolean;
}

/**
 * Static permission matrix for each project role.
 *
 * - clo:                 Full access across the board.
 * - pm_transaccion:      Operational lead; edits tasks, manages Q&A, VDR, roles, war room.
 * - abogado_area:        Area-scoped; edits tasks/Q&A/VDR only within own area.
 * - deal_sponsor:        Read-only strategic view (contingencies, reports, war room, negotiation).
 * - target_liaison:      Responds to Q&A and uploads to own VDR zone. Very limited.
 * - stakeholder_negocio: Views reports and war room. No editing.
 * - cliente_externo:     Read-only progress + approved reports. Most restricted.
 */
export const ROLE_PERMISSIONS: Record<ProjectRole, RolePermissions> = {
    clo: {
        can_edit_tasks: true,
        can_view_contingencies: true,
        can_edit_contingencies: true,
        can_manage_qa: true,
        can_respond_qa: true,
        can_view_reports: true,
        can_approve_reports: true,
        can_upload_vdr: true,
        can_publish_vdr: true,
        can_manage_roles: true,
        can_view_all_areas: true,
        can_view_war_room: true,
        can_view_negotiation: true,
    },
    pm_transaccion: {
        can_edit_tasks: true,
        can_view_contingencies: true,
        can_edit_contingencies: true,
        can_manage_qa: true,
        can_respond_qa: true,
        can_view_reports: true,
        can_approve_reports: false,
        can_upload_vdr: true,
        can_publish_vdr: true,
        can_manage_roles: true,
        can_view_all_areas: true,
        can_view_war_room: true,
        can_view_negotiation: false,
    },
    abogado_area: {
        can_edit_tasks: true,       // scoped to own area
        can_view_contingencies: true,
        can_edit_contingencies: true, // scoped to own area
        can_manage_qa: true,        // scoped to own area
        can_respond_qa: true,
        can_view_reports: true,
        can_approve_reports: false,
        can_upload_vdr: true,       // scoped to own area
        can_publish_vdr: false,
        can_manage_roles: false,
        can_view_all_areas: false,  // only own area
        can_view_war_room: false,
        can_view_negotiation: false,
    },
    deal_sponsor: {
        can_edit_tasks: false,
        can_view_contingencies: true,
        can_edit_contingencies: false,
        can_manage_qa: false,
        can_respond_qa: false,
        can_view_reports: true,
        can_approve_reports: false,
        can_upload_vdr: false,
        can_publish_vdr: false,
        can_manage_roles: false,
        can_view_all_areas: true,
        can_view_war_room: true,
        can_view_negotiation: true,
    },
    target_liaison: {
        can_edit_tasks: false,
        can_view_contingencies: false,
        can_edit_contingencies: false,
        can_manage_qa: false,
        can_respond_qa: true,       // can answer questions
        can_view_reports: false,
        can_approve_reports: false,
        can_upload_vdr: true,       // scoped to own zone
        can_publish_vdr: false,
        can_manage_roles: false,
        can_view_all_areas: false,
        can_view_war_room: false,
        can_view_negotiation: false,
    },
    stakeholder_negocio: {
        can_edit_tasks: false,
        can_view_contingencies: false,
        can_edit_contingencies: false,
        can_manage_qa: false,
        can_respond_qa: false,
        can_view_reports: true,
        can_approve_reports: false,
        can_upload_vdr: false,
        can_publish_vdr: false,
        can_manage_roles: false,
        can_view_all_areas: false,
        can_view_war_room: true,
        can_view_negotiation: false,
    },
    cliente_externo: {
        can_edit_tasks: false,
        can_view_contingencies: false,
        can_edit_contingencies: false,
        can_manage_qa: false,
        can_respond_qa: false,
        can_view_reports: true,     // approved reports only
        can_approve_reports: false,
        can_upload_vdr: false,
        can_publish_vdr: false,
        can_manage_roles: false,
        can_view_all_areas: false,
        can_view_war_room: false,
        can_view_negotiation: false,
    },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check whether a given role has a specific permission.
 */
export function hasPermission(
    role: ProjectRole,
    permission: keyof RolePermissions
): boolean {
    return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

/**
 * Human-readable label for a role (Spanish).
 */
export function getRoleLabel(role: ProjectRole): string {
    const labels: Record<ProjectRole, string> = {
        clo: 'CLO / Director Legal',
        pm_transaccion: 'PM de Transaccion',
        abogado_area: 'Abogado por Area',
        deal_sponsor: 'Deal Sponsor',
        target_liaison: 'Contacto Target',
        stakeholder_negocio: 'Stakeholder Negocio',
        cliente_externo: 'Cliente Externo',
    };
    return labels[role] ?? role;
}

/**
 * Brand color hex for a role (for badges, avatars, etc.).
 */
export function getRoleColor(role: ProjectRole): string {
    const colors: Record<ProjectRole, string> = {
        clo: '#7C3AED',
        pm_transaccion: '#2563EB',
        abogado_area: '#059669',
        deal_sponsor: '#D97706',
        target_liaison: '#DC2626',
        stakeholder_negocio: '#7C3AED',
        cliente_externo: '#6B7280',
    };
    return colors[role] ?? '#6B7280';
}

/**
 * Human-readable label for a review depth level (Spanish).
 */
export function getReviewDepthLabel(depth: ReviewDepth): string {
    const labels: Record<ReviewDepth, string> = {
        light: 'Revision Ligera',
        standard: 'Revision Estandar',
        enhanced: 'Revision Intensiva',
    };
    return labels[depth] ?? depth;
}

/**
 * Configuration object for each review depth level.
 * Controls thresholds and HITL (human-in-the-loop) parameters.
 */
export function getReviewDepthConfig(depth: ReviewDepth): {
    label: string;
    labelEs: string;
    color: string;
    description: string;
    groundingThreshold: number;
    hitlRequired: boolean;
    hitlMinPercentage: number;
    maxAutoApprove: boolean;
} {
    const configs: Record<ReviewDepth, ReturnType<typeof getReviewDepthConfig>> = {
        light: {
            label: 'Light',
            labelEs: 'Revision Ligera',
            color: '#10B981',
            description: 'Subconjunto critico, umbrales reducidos',
            groundingThreshold: 0.7,
            hitlRequired: false,
            hitlMinPercentage: 10,
            maxAutoApprove: true,
        },
        standard: {
            label: 'Standard',
            labelEs: 'Revision Estandar',
            color: '#3B82F6',
            description: 'Parametros base del sistema',
            groundingThreshold: 0.85,
            hitlRequired: true,
            hitlMinPercentage: 30,
            maxAutoApprove: false,
        },
        enhanced: {
            label: 'Enhanced',
            labelEs: 'Revision Intensiva',
            color: '#EF4444',
            description: 'Maximo rigor, HITL ampliado',
            groundingThreshold: 0.95,
            hitlRequired: true,
            hitlMinPercentage: 70,
            maxAutoApprove: false,
        },
    };
    return configs[depth];
}
