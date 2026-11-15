import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { fireSelf } from '@/lib/selfcall';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Start N background workers (minus ones already running), so processing continues with the tab closed.
export async function POST(req) {
  const { workers = 4 } = await req.json().catch(() => ({}));
  const want = Math.max(1, Math.min(8, Number(workers) || 4));
  const s = db();
  const { count: running } = await s.from('queue').select('id', { count: 'exact', head: true }).eq('status', 'running').gte('started_at', new Date(Date.now() - 10 * 60000).toISOString());
  const { count: pending } = await s.from('queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const start = Math.max(0, Math.min(want - (running || 0), pending || 0));
  const origin = new URL(req.url).origin;
  await Promise.all(Array.from({ length: start }, () => fireSelf(origin, '/api/queue/worker', { hop: 0 })));
  return NextResponse.json({ started: start, alreadyRunning: running || 0, pending: pending || 0 });
}
