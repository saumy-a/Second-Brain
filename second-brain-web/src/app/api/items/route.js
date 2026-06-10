import { supabaseAdmin } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  const search = searchParams.get('search') || '';

  let q = supabaseAdmin
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (filter !== 'all') {
    q = q.eq('tag', filter);
  }

  if (search) {
    q = q.ilike('content', `%${search}%`);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Supabase query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
