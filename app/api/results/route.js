import { NextResponse } from 'next/server';
import { getResult, listResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id');
  try {
    if (id) {
      const r = await getResult(id);
      return r ? NextResponse.json(r) : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ results: await listResults() });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
