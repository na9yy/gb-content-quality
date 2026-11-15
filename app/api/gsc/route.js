import { NextResponse } from 'next/server';
import { refreshGsc } from '@/lib/gsc';
import { db } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req) {
  const { pageId } = await req.json().catch(() => ({}));
  try {
    const { data: p } = await db().from('pages').select('url').eq('id', pageId).single();
    if (!p) throw new Error('Page not found');
    return NextResponse.json(await refreshGsc(pageId, p.url));
  } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
