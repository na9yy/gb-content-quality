// Search Console data per page: last 28 days vs previous 28, last 90 days, top queries.
import { googleToken } from './google';
import { db } from './supabase';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const day = d => d.toISOString().slice(0, 10);
const ago = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

async function query(body) {
  const site = encodeURIComponent(process.env.GSC_SITE_URL || 'sc-domain:gameboost.com');
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
    method: 'POST', headers: { authorization: `Bearer ${await googleToken(SCOPE)}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`GSC ${r.status}: ${j.error?.message || 'error'}`);
  return j.rows || [];
}

async function totals(url, start, end) {
  for (const u of [url, url + '/']) {
    const rows = await query({ startDate: day(start), endDate: day(end), dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: u }] }], rowLimit: 1 });
    if (rows.length) return { url: u, ...rows[0] };
  }
  return { url, clicks: 0, impressions: 0, ctr: 0, position: null };
}

export async function refreshGsc(pageId, url) {
  const end = ago(3); // GSC data lags ~2-3 days
  const periods = [
    { key: 'last28', start: ago(30), end },
    { key: 'prev28', start: ago(58), end: ago(31) },
    { key: 'last90', start: ago(92), end },
  ];
  const res = {};
  const tot = await Promise.all(periods.map(p => totals(url, p.start, p.end)));
  periods.forEach((p, i) => { res[p.key] = { ...tot[i], start: day(p.start), end: day(p.end) }; });
  const matched = res.last90.url;
  const top = await query({ startDate: res.last90.start, endDate: res.last90.end, dimensions: ['query'], dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: matched }] }], rowLimit: 10 });
  const s = db();
  const rows = periods.map(p => ({
    page_id: pageId, period_start: res[p.key].start, period_end: res[p.key].end,
    clicks: res[p.key].clicks, impressions: res[p.key].impressions, ctr: res[p.key].ctr, position: res[p.key].position,
    top_queries: p.key === 'last90' ? top.map(t => ({ q: t.keys[0], clicks: t.clicks, impressions: t.impressions, position: Math.round(t.position * 10) / 10 })) : null,
    fetched_at: new Date().toISOString(),
  }));
  await s.from('gsc_stats').upsert(rows, { onConflict: 'page_id,period_start,period_end' });
  return summarize(rows);
}

export function summarize(rows) {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => (b.fetched_at || '').localeCompare(a.fetched_at || ''));
  const latest = sorted[0].fetched_at;
  const set = sorted.filter(r => r.fetched_at === latest);
  const span = r => (Date.parse(r.period_end) - Date.parse(r.period_start)) / 864e5;
  const byLen = set.sort((a, b) => span(a) - span(b));
  const short = byLen.filter(r => span(r) < 40).sort((a, b) => b.period_end.localeCompare(a.period_end));
  const last28 = short[0], prev28 = short[1], last90 = byLen.find(r => span(r) >= 80);
  const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : null;
  return {
    fetchedAt: latest,
    last28: last28 && pick(last28), prev28: prev28 && pick(prev28), last90: last90 && pick(last90),
    clicksChange: last28 && prev28 ? pct(last28.clicks, prev28.clicks) : null,
    impressionsChange: last28 && prev28 ? pct(last28.impressions, prev28.impressions) : null,
    topQueries: last90?.top_queries || [],
  };
}
const pick = r => ({ clicks: r.clicks, impressions: r.impressions, ctr: r.ctr == null ? null : Number(r.ctr), position: r.position == null ? null : Math.round(Number(r.position) * 10) / 10, start: r.period_start, end: r.period_end });

export async function getGsc(pageId) {
  const { data } = await db().from('gsc_stats').select('*').eq('page_id', pageId).order('fetched_at', { ascending: false }).limit(9);
  return summarize(data || []);
}
