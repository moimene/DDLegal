import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ProjectRole } from '@/lib/supabase-auth';

/**
 * Setup Test Users — API Route (Dev Only)
 * POST /api/auth/setup-test-users
 *
 * Creates 7 test users (one per role) with known passwords.
 * Idempotent: skips if user already exists.
 * Also assigns project roles if a project_id is provided.
 */

interface TestUser {
    email: string;
    role: ProjectRole;
    label: string;
    area_code?: string;
}

const TEST_PASSWORD = 'test123456';

const TEST_USERS: TestUser[] = [
    { email: 'clo@test.ddlegal.com', role: 'clo', label: 'CLO / Director Legal' },
    { email: 'pm@test.ddlegal.com', role: 'pm_transaccion', label: 'PM de Transaccion' },
    { email: 'abogado.merc@test.ddlegal.com', role: 'abogado_area', label: 'Abogado Mercantil', area_code: 'MERC' },
    { email: 'sponsor@test.ddlegal.com', role: 'deal_sponsor', label: 'Deal Sponsor' },
    { email: 'target@test.ddlegal.com', role: 'target_liaison', label: 'Contacto Target' },
    { email: 'stakeholder@test.ddlegal.com', role: 'stakeholder_negocio', label: 'Stakeholder Negocio' },
    { email: 'cliente@test.ddlegal.com', role: 'cliente_externo', label: 'Cliente Externo' },
];

export async function POST(req: NextRequest) {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: 'This endpoint is only available in development.' },
                { status: 403 }
            );
        }

        // CRON_SECRET protection: if set, require Bearer token
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = req.headers.get('authorization');
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json(
                    { success: false, error: 'Unauthorized' },
                    { status: 401 }
                );
            }
        }

        const body = await req.json().catch(() => ({}));
        const { project_id } = body as { project_id?: string };

        const results: {
            email: string;
            role: ProjectRole;
            status: 'created' | 'existing' | 'error';
            user_id?: string;
            error?: string;
        }[] = [];

        for (const testUser of TEST_USERS) {
            try {
                // Check if user already exists by listing users
                const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
                    page: 1,
                    perPage: 1000,
                });

                const existingUser = existingUsers?.users?.find(
                    (u) => u.email === testUser.email
                );

                let userId: string;

                if (existingUser) {
                    userId = existingUser.id;
                    results.push({
                        email: testUser.email,
                        role: testUser.role,
                        status: 'existing',
                        user_id: userId,
                    });
                } else {
                    // Create new user
                    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                        email: testUser.email,
                        password: TEST_PASSWORD,
                        email_confirm: true,
                        user_metadata: {
                            full_name: testUser.label,
                            role: testUser.role,
                            is_test_user: true,
                        },
                    });

                    if (createError || !newUser.user) {
                        results.push({
                            email: testUser.email,
                            role: testUser.role,
                            status: 'error',
                            error: createError?.message || 'Failed to create user',
                        });
                        continue;
                    }

                    userId = newUser.user.id;
                    results.push({
                        email: testUser.email,
                        role: testUser.role,
                        status: 'created',
                        user_id: userId,
                    });
                }

                // Assign project role if project_id provided
                if (project_id && userId) {
                    // Check if role assignment already exists
                    const { data: existingRole } = await supabaseAdmin
                        .from('dd_project_user_roles')
                        .select('id')
                        .eq('project_id', project_id)
                        .eq('user_id', userId)
                        .eq('role', testUser.role)
                        .maybeSingle();

                    if (!existingRole) {
                        await supabaseAdmin.from('dd_project_user_roles').insert({
                            project_id,
                            user_id: userId,
                            role: testUser.role,
                            area_code: testUser.area_code || null,
                            is_active: true,
                            granted_by: null,
                        });
                    }
                }
            } catch (err) {
                results.push({
                    email: testUser.email,
                    role: testUser.role,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            test_password: TEST_PASSWORD,
            users: results,
            project_id: project_id || null,
        });
    } catch (error) {
        console.error('Setup test users API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
