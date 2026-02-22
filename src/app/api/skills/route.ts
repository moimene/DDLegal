import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * List skills catalog with optional filters
 * GET /api/skills?area_code=&category=&active_only=true
 */
export async function GET(req: NextRequest) {
    try {
        // Verify authenticated user
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const areaCode = searchParams.get('area_code');
        const category = searchParams.get('category');
        const activeOnly = searchParams.get('active_only') !== 'false';

        let query = supabase
            .from('dd_skills_catalog')
            .select('*')
            .order('area_code')
            .order('skill_key');

        if (areaCode) {
            query = query.eq('area_code', areaCode);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Skills list error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch skills' },
                { status: 500 }
            );
        }

        // Group by area_code for convenience
        const grouped: Record<string, typeof data> = {};
        for (const skill of data || []) {
            if (!grouped[skill.area_code]) {
                grouped[skill.area_code] = [];
            }
            grouped[skill.area_code].push(skill);
        }

        return NextResponse.json({
            success: true,
            skills: data || [],
            grouped,
            count: data?.length || 0,
        });

    } catch (error) {
        console.error('Skills API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
