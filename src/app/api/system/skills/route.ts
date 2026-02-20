import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest) {
  try {
    const { skill_id, is_active } = await req.json();

    if (!skill_id || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'skill_id (string) and is_active (boolean) are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('dd_skills_catalog')
      .update({ is_active })
      .eq('id', skill_id)
      .select()
      .single();

    if (error) {
      console.error('Skill toggle error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, skill: data });
  } catch (error) {
    console.error('Skill toggle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
