// Bulk import queue: add URLs (or sitemaps), process them one by one.
import { db } from './supabase';
import { runCheck, normalizeUrl } from './pipeline';

export async function expandSitemap(url, filter, max = 2000, depth = 0) {
  const r = await fetch(url, { headers: { 'user-agent': 'GameBoost-ContentQuality/1.0' } });
  if (!r.ok) throw new Error(`Sitemap ${r.status}: ${url}`);
  const xml = await r.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex/i.test(xml) && depth < 2) {
    const out = [];
    for (const sm of locs) { if (out.length >= max) break; out.push(...await expandSitemap(sm, filter, max - out.length, depth + 1)); }
    return out;
  }
  return locs.filter(u => !filter || u.includes(filter)).slice(0, max);
}

export async function enqueue(urls, source = 'manual') {
  const clean = [...new Set(urls.map(u => { try { return normalizeUrl(u); } catch { return null; } }).filter(Boolean))];
  if (!clean.length) return { added: 0, skipped: 0 };
  const s = db();
  const { data: active } = await s.from('queue').select('url').in('status', ['pending', 'running']).in('url', clean.slice(0, 1000));
  const busy = new Set((active || []).map(r => r.url));
  const rows = clean.filter(u => !busy.has(u)).map(url => ({ url, source }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await s.from('queue').insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return { added: rows.length, skipped: clean.length - rows.length };
}

export async function processNext({ bulk = false } = {}) {
  const s = db();
  const { data, error } = await s.rpc('claim_queue_item');
  if (error) throw new Error(error.message);
  const item = data?.[0];
  if (!item) return { done: true };
  try {
    const r = await runCheck(item.url, { bulk });
    await s.from('queue').update({ status: r.unchanged ? 'skipped' : 'done', crawl_id: r.crawlId, finished_at: new Date().toISOString(), error: null }).eq('id', item.id);
    return { id: item.id, url: item.url, status: r.unchanged ? 'skipped' : 'done', crawlId: r.crawlId };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 500);
    await s.from('queue').update({ status: item.attempts >= 3 ? 'error' : 'pending', error: msg, finished_at: new Date().toISOString() }).eq('id', item.id);
    return { id: item.id, url: item.url, status: 'error', error: msg };
  }
}

export async function queueStatus() {
  const s = db();
  const counts = {};
  for (const st of ['pending', 'running', 'done', 'skipped', 'error']) {
    const { count } = await s.from('queue').select('id', { count: 'exact', head: true }).eq('status', st);
    counts[st] = count || 0;
  }
  const { data: recent } = await s.from('queue').select('id, url, status, error, crawl_id, created_at, started_at, finished_at').order('started_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true }).limit(60);
  return { counts, recent: recent || [] };
}

export async function clearQueue(what) {
  const s = db();
  if (what === 'pending') await s.from('queue').delete().eq('status', 'pending');
  if (what === 'finished') await s.from('queue').delete().in('status', ['done', 'skipped', 'error']);
  if (what === 'retry') await s.from('queue').update({ status: 'pending', attempts: 0, error: null }).eq('status', 'error');
}
