import { type APIRequestContext } from '@playwright/test';
import { authPost, authGet } from '../helpers/api-helpers';

/**
 * Data Fixture — Shared data seeding helpers for E2E tests
 *
 * Provides helpers to create VDR folders/documents, Q&A threads, and other
 * test entities via the app's API routes. All operations use authenticated
 * API calls so that business logic, RLS, and event triggers are exercised.
 */

// ---------------------------------------------------------------------------
// VDR Seeding
// ---------------------------------------------------------------------------

export interface SeededFolder {
    id: string;
    name: string;
    parent_id: string | null;
}

export interface SeededDocument {
    id: string;
    name: string;
    folder_id: string | null;
    status: string;
}

/**
 * Create a VDR folder and return its ID.
 */
export async function createVDRFolder(
    request: APIRequestContext,
    token: string,
    projectId: string,
    name: string,
    parentId?: string,
    areaCode?: string,
): Promise<SeededFolder> {
    const resp = await authPost(request, '/api/vdr/folders', token, {
        project_id: projectId,
        name,
        parent_id: parentId || null,
        area_code: areaCode || null,
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `createVDRFolder("${name}") failed: ${resp.status()} ${body}`,
        );
    }

    const body = await resp.json();
    return {
        id: body.folder.id,
        name: body.folder.name,
        parent_id: body.folder.parent_id,
    };
}

/**
 * Create a VDR document and return its ID.
 */
export async function createVDRDocument(
    request: APIRequestContext,
    token: string,
    projectId: string,
    name: string,
    opts?: {
        folderId?: string;
        areaCode?: string;
        category?: string;
        isConfidential?: boolean;
        tags?: string[];
    },
): Promise<SeededDocument> {
    const resp = await authPost(request, '/api/vdr/documents', token, {
        project_id: projectId,
        name,
        folder_id: opts?.folderId || null,
        area_code: opts?.areaCode || null,
        category: opts?.category || 'general',
        is_confidential: opts?.isConfidential || false,
        tags: opts?.tags || [],
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `createVDRDocument("${name}") failed: ${resp.status()} ${body}`,
        );
    }

    const body = await resp.json();
    return {
        id: body.document.id,
        name: body.document.name,
        folder_id: body.document.folder_id,
        status: body.document.status,
    };
}

// ---------------------------------------------------------------------------
// Q&A Seeding
// ---------------------------------------------------------------------------

export interface SeededThread {
    id: string;
    thread_number: number;
    subject: string;
    status: string;
}

/**
 * Create a Q&A thread and return its ID and thread_number.
 */
export async function createQAThread(
    request: APIRequestContext,
    token: string,
    projectId: string,
    subject: string,
    opts?: {
        areaCode?: string;
        priority?: string;
        slaHours?: number;
        clientVisible?: boolean;
    },
): Promise<SeededThread> {
    const resp = await authPost(request, '/api/qa/threads', token, {
        project_id: projectId,
        subject,
        area_code: opts?.areaCode || null,
        priority: opts?.priority || 'medium',
        sla_hours: opts?.slaHours || null,
        client_visible: opts?.clientVisible || false,
        source: 'manual',
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `createQAThread("${subject}") failed: ${resp.status()} ${body}`,
        );
    }

    const body = await resp.json();
    return {
        id: body.thread.id,
        thread_number: body.thread.thread_number,
        subject: body.thread.subject,
        status: body.thread.status,
    };
}

/**
 * Send a message on a Q&A thread.
 */
export async function sendQAMessage(
    request: APIRequestContext,
    token: string,
    threadId: string,
    content: string,
    senderRole: 'advisor' | 'target' | 'system' | 'ai' = 'advisor',
): Promise<string> {
    const resp = await authPost(
        request,
        `/api/qa/threads/${threadId}/messages`,
        token,
        { content, sender_role: senderRole },
    );

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `sendQAMessage(${threadId}) failed: ${resp.status()} ${body}`,
        );
    }

    const body = await resp.json();
    return body.message?.id || body.id;
}

// ---------------------------------------------------------------------------
// Project Discovery (shared utility)
// ---------------------------------------------------------------------------

/**
 * Find the first active project visible to the authenticated user.
 * Returns null if no projects are found.
 */
export async function findFirstProject(
    request: APIRequestContext,
    token: string,
): Promise<string | null> {
    // Strategy 1: Try the projects listing API
    try {
        const resp = await authGet(request, '/api/projects', token);
        if (resp.ok()) {
            const body = await resp.json();
            const projects = body.projects || body.data || (Array.isArray(body) ? body : []);
            if (projects.length > 0) {
                const active = projects.find(
                    (p: { status?: string }) => p.status === 'active',
                );
                return (active?.id || projects[0].id) as string;
            }
        }
    } catch {
        // Continue to next strategy
    }

    // Strategy 2: Health endpoint
    try {
        const healthResp = await request.get('/api/system/health');
        if (healthResp.ok()) {
            const body = await healthResp.json();
            if (body.demo_project_id) {
                return body.demo_project_id as string;
            }
        }
    } catch {
        // No project found
    }

    return null;
}
