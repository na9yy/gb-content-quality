import { NextResponse } from 'next/server';
import { processNext } from '@/lib/queue';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function POST() {
  try { return NextResponse.json(await processNext()); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
