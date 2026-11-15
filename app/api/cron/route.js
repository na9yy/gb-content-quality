import { NextResponse } from 'next/server';
import { processNext } from '@/lib/queue';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
// Called daily by Vercel Cron (Authorization: Bearer CRON_SECRET). Works the queue for ~4 minutes.
export async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const t0 = Date.now(), done = [];
  while (Date.now() - t0 < 230000) {
    const r = await processNext().catch(e => ({ error: String(e.message || e) }));
    if (r.done) break;
    if (r.rateLimited) { await new Promise(res => setTimeout(res, 30000)); continue; }
    done.push(r);
  }
  return NextResponse.json({ processed: done.length, results: done });
}
