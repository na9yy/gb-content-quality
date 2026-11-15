import { NextResponse } from 'next/server';
import { calibration, saveLabels } from '@/lib/insights';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export async function GET() {
  try { return NextResponse.json(await calibration()); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function POST(req) {
  const { pageId, labeledBy, scores, note } = await req.json().catch(() => ({}));
  if (!pageId || !labeledBy) return NextResponse.json({ error: 'Need page and your name' }, { status: 400 });
  try { return NextResponse.json(await saveLabels(pageId, String(labeledBy).trim(), scores || {}, note)); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
