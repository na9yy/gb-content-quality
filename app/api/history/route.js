import { NextResponse } from 'next/server';
import { history } from '@/lib/insights';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('pageId');
  try { return NextResponse.json({ history: await history(id) }); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
