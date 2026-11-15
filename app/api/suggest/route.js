import { NextResponse } from 'next/server';
import { suggestFixes } from '@/lib/suggest';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function POST(req) {
  const { crawlId } = await req.json().catch(() => ({}));
  try { return NextResponse.json(await suggestFixes(crawlId)); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
