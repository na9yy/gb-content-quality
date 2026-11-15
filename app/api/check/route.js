import { NextResponse } from 'next/server';
import { runCheck } from '@/lib/pipeline';
import { getResult } from '@/lib/results';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function POST(req) {
  const { url } = await req.json().catch(() => ({}));
  try { new URL(url); } catch { return NextResponse.json({ error: 'Enter a full URL, like https://gameboost.com/blog/...' }, { status: 400 }); }
  try {
    const { crawlId } = await runCheck(url);
    return NextResponse.json(await getResult(crawlId));
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
