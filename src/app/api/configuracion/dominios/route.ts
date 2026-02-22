import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Admin check: verify authenticated user has an admin-level role (clo or pm_transaccion)
// ---------------------------------------------------------------------------
async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { data: adminRole } = await supabaseAdmin
        .from('dd_project_user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['clo', 'pm_transaccion'])
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
    if (!adminRole) {
        return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 });
    }
    return null; // authorized
}

// ---------------------------------------------------------------------------
// GET /api/configuracion/dominios?domain=severity
// List enums, optionally filtered by domain. Returns grouped by domain.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
    try {
        const adminErr = await requireAdmin(req);
        if (adminErr) return adminErr;

        const { searchParams } = new URL(req.url);
        const domain = searchParams.get('domain');

        let query = supabaseAdmin
            .from('dd_domain_enums')
            .select('*')
            .order('domain')
            .order('sort_order');

        if (domain) {
            query = query.eq('domain', domain);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Domain enums GET error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Group by domain
        const grouped: Record<string, typeof data> = {};
        (data || []).forEach((item) => {
            if (!grouped[item.domain]) grouped[item.domain] = [];
            grouped[item.domain].push(item);
        });

        return NextResponse.json({ success: true, data: grouped });
    } catch (error) {
        console.error('Domain enums GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/configuracion/dominios
// Create a new enum entry
// Body: { domain, code, label, label_en?, color?, icon?, sort_order?, metadata? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const adminErr = await requireAdmin(req);
        if (adminErr) return adminErr;

        const body = await req.json();
        const { domain, code, label, label_en, color, icon, sort_order, metadata } = body;

        if (!domain || !code || !label) {
            return NextResponse.json(
                { error: 'domain, code y label son obligatorios' },
                { status: 400 }
            );
        }

        const insertData: Record<string, unknown> = {
            domain,
            code,
            label,
        };
        if (label_en !== undefined) insertData.label_en = label_en;
        if (color !== undefined) insertData.color = color;
        if (icon !== undefined) insertData.icon = icon;
        if (sort_order !== undefined) insertData.sort_order = sort_order;
        if (metadata !== undefined) insertData.metadata = metadata;

        const { data, error } = await supabaseAdmin
            .from('dd_domain_enums')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Domain enums POST error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error) {
        console.error('Domain enums POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/configuracion/dominios
// Update an existing enum entry
// Body: { id, ...fields }  — allowlist validation
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
    try {
        const adminErr = await requireAdmin(req);
        if (adminErr) return adminErr;

        const body = await req.json();
        const { id, ...fields } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
        }

        const ALLOWED_FIELDS = [
            'domain', 'code', 'label', 'label_en', 'color', 'icon',
            'sort_order', 'is_active', 'metadata',
        ];

        const updateData: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in fields) {
                updateData[key] = fields[key];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No se proporcionaron campos permitidos para actualizar' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('dd_domain_enums')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Domain enums PATCH error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Domain enums PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/configuracion/dominios
// Soft-delete: sets is_active = false (not a hard delete)
// Body: { id }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
    try {
        const adminErr = await requireAdmin(req);
        if (adminErr) return adminErr;

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('dd_domain_enums')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Domain enums DELETE error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Domain enums DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
