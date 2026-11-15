import { NextResponse } from 'next/server';
import { checkDraft, listDrafts, getDraft } from '@/lib/drafts';
import { serviceAccount } from '@/lib/google';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id');
  if (id) { const d = await getDraft(id); return d ? NextResponse.json(d) : NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  let serviceEmail = null; try { serviceEmail = serviceAccount().client_email; } catch {}
  return NextResponse.json({ drafts: await listDrafts(), serviceEmail });
}
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try { return NextResponse.json(await checkDraft(body)); }
  catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
