import { NextResponse } from 'next/server';
import { enqueue, expandSitemap, queueStatus, clearQueue } from '@/lib/queue';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const maxDuration = 120;
export async function GET() { return NextResponse.json(await queueStatus()); }
export async function POST(req) {
  const { urls = '', sitemap = '', filter = '', max = 500 } = await req.json().catch(() => ({}));
  try {
    let list = String(urls).split(/[\s,]+/).filter(u => /^https?:\/\//.test(u));
    if (sitemap) list = list.concat(await expandSitemap(sitemap.trim(), filter.trim(), Math.min(Number(max) || 500, 5000)));
    if (!list.length) return NextResponse.json({ error: 'No URLs found. Paste full URLs (https://...) or a sitemap URL.' }, { status: 400 });
    return NextResponse.json({ found: list.length, ...(await enqueue(list, sitemap ? 'sitemap' : 'manual')) });
  } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function DELETE(req) {
  await clearQueue(new URL(req.url).searchParams.get('what'));
  return NextResponse.json(await queueStatus());
}
