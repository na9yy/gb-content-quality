import { NextResponse } from 'next/server';
import { teamView } from '@/lib/insights';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export async function GET() {
  try { return NextResponse.json(await teamView()); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
