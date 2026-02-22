import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest) {
  try {
    // Verify authenticated user
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { tool_id, is_active } = await req.json();

    if (!tool_id || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'tool_id (string) and is_active (boolean) are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('dd_tools')
      .update({ is_active })
      .eq('id', tool_id)
      .select()
      .single();

    if (error) {
      console.error('Tool toggle error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool: data });
  } catch (error) {
    console.error('Tool toggle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
