import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { document_id, folder_id, permission, expires_hours, max_downloads, created_by } = body;
        if (!document_id && !folder_id) return NextResponse.json({ error: 'document_id or folder_id required' }, { status: 400 });

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (expires_hours || 24) * 3600 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('vdr_links')
            .insert({
                document_id: document_id || null,
                folder_id: folder_id || null,
                token,
                permission: permission || 'view',
                expires_at: expiresAt,
                max_downloads: max_downloads || null,
                created_by: created_by || null,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, link: data });
    } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
