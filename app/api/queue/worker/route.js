import { NextResponse } from 'next/server';
import { processNext } from '@/lib/queue';
import { fireSelf } from '@/lib/selfcall';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const maxDuration = 300;

// Background worker: works the queue for ~4 min, then hands off to a fresh worker if items are left.
export async function POST(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { hop = 0 } = await req.json().catch(() => ({}));
  const t0 = Date.now(); let n = 0, empty = false;
  while (Date.now() - t0 < 230000) {
    const r = await processNext({ bulk: true }).catch(e => ({ error: String(e.message || e) }));
    if (r.done) { empty = true; break; }
    if (r.rateLimited) { await new Promise(res => setTimeout(res, 30000)); continue; }
    n++;
  }
  if (!empty && hop < 200) await fireSelf(new URL(req.url).origin, '/api/queue/worker', { hop: hop + 1 });
  return NextResponse.json({ processed: n, empty, hop });
}
