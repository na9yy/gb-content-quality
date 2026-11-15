import { NextResponse } from 'next/server';
import { alerts } from '@/lib/insights';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ alerts: await alerts() }); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
