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
