// Team view, alerts, history and calibration. All computed from stored results.
import { db } from './supabase';
import { DIMENSIONS } from './rubric';
import { summarize } from './gsc';

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const avg = a => a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null;

export async function latestRows() {
  const { data, error } = await db().from('latest_page_scores').select('*').limit(10000);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ ...r, overall: r.overall == null ? null : Number(r.overall) }));
}

async function dimsFor(crawlIds) {
  const out = {};
  for (const ids of chunk(crawlIds, 200)) {
    const { data } = await db().from('dimension_scores').select('crawl_id, dimension, score, confidence').in('crawl_id', ids);
    for (const d of data || []) (out[d.crawl_id] ||= {})[d.dimension] = { score: d.score == null ? null : Number(d.score), confidence: d.confidence };
  }
  return out;
}

async function gscFor(pageIds) {
  const out = {};
  for (const ids of chunk(pageIds, 200)) {
    const { data } = await db().from('gsc_stats').select('*').in('page_id', ids);
    const by = {};
    for (const r of data || []) (by[r.page_id] ||= []).push(r);
    for (const [id, rows] of Object.entries(by)) out[id] = summarize(rows);
  }
  return out;
}

export async function teamView() {
  const rows = await latestRows();
  const dims = await dimsFor(rows.map(r => r.crawl_id));
  const group = key => {
    const g = {};
    for (const r of rows) (g[r[key] || 'Unknown'] ||= []).push(r);
    return Object.entries(g).map(([name, rs]) => ({
      name, pages: rs.length, avg: avg(rs.map(r => r.overall).filter(v => v != null)),
      below3: rs.filter(r => r.overall != null && r.overall < 3).length,
      dims: Object.fromEntries(DIMENSIONS.map(d => [d.key, avg(rs.map(r => dims[r.crawl_id]?.[d.key]?.score).filter(v => v != null))])),
    })).sort((a, b) => b.pages - a.pages);
  };
  return { total: rows.length, avg: avg(rows.map(r => r.overall).filter(v => v != null)), byAuthor: group('author'), byGame: group('game'), byType: group('page_type') };
}

export async function alerts() {
  const rows = await latestRows();
  const s = db();
  const { data: hist } = await s.from('page_scores').select('page_id, overall, scored_at').order('scored_at', { ascending: false }).limit(20000);
  const prev = {};
  const seen = {};
  for (const h of hist || []) { seen[h.page_id] = (seen[h.page_id] || 0) + 1; if (seen[h.page_id] === 2) prev[h.page_id] = h.overall == null ? null : Number(h.overall); }
  const dims = await dimsFor(rows.map(r => r.crawl_id));
  const gsc = await gscFor(rows.map(r => r.page_id));
  const out = [];
  const add = (r, type, severity, message) => out.push({ type, severity, message, pageId: r.page_id, crawlId: r.crawl_id, url: r.url, title: r.title, overall: r.overall, author: r.author, pageType: r.page_type });
  for (const r of rows) {
    const g = gsc[r.page_id];
    if (r.overall != null && r.overall < 3) add(r, 'Low score', 'high', `Overall ${r.overall.toFixed(1)}. Below 3.0.`);
    const p = prev[r.page_id];
    if (p != null && r.overall != null && r.overall - p <= -0.5) add(r, 'Score dropped', 'high', `Dropped from ${p.toFixed(1)} to ${r.overall.toFixed(1)}.`);
    if (r.page_type !== 'product') {
      const d = Date.parse(r.date_modified || r.date_published || '');
      if (!isNaN(d)) { const m = Math.round((Date.now() - d) / (30.4 * 864e5)); if (m >= 6) add(r, 'Stale content', m >= 12 ? 'high' : 'medium', `Last updated ${m} months ago.`); }
      else add(r, 'No update date', 'low', 'No published or modified date found.');
    }
    const low = Object.values(dims[r.crawl_id] || {}).filter(d => d.confidence === 'low').length;
    if (low >= 3) add(r, 'Low confidence', 'low', `${low} dimensions have low confidence. Review by hand.`);
    if (g?.last28 && g.last28.impressions >= 1000 && r.overall != null && r.overall < 3.5) add(r, 'Traffic at risk', 'high', `${g.last28.impressions.toLocaleString()} impressions in 28d with score ${r.overall.toFixed(1)}.`);
    if (g?.clicksChange != null && g.clicksChange <= -30 && (g.prev28?.clicks || 0) >= 20) add(r, 'Traffic drop', 'medium', `Clicks ${g.clicksChange}% vs previous 28 days.`);
  }
  const sev = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => sev[a.severity] - sev[b.severity] || (a.overall ?? 9) - (b.overall ?? 9));
}

export async function history(pageId) {
  const s = db();
  const { data: ps } = await s.from('page_scores').select('crawl_id, overall, scored_at, rubric_version').eq('page_id', pageId).order('scored_at', { ascending: false }).limit(50);
  const ids = (ps || []).map(p => p.crawl_id);
  const dims = await dimsFor(ids);
  const { data: crs } = ids.length ? await s.from('crawls').select('id, word_count, metadata').in('id', ids) : { data: [] };
  const cm = Object.fromEntries((crs || []).map(c => [c.id, c]));
  return (ps || []).map(p => ({ crawlId: p.crawl_id, overall: p.overall == null ? null : Number(p.overall), scoredAt: p.scored_at, rubric: p.rubric_version,
    wordCount: cm[p.crawl_id]?.word_count, headings: cm[p.crawl_id]?.metadata?.headings || [], dateModified: cm[p.crawl_id]?.metadata?.dateModified,
    dims: Object.fromEntries(Object.entries(dims[p.crawl_id] || {}).map(([k, v]) => [k, v.score])) }));
}

// Calibration: compare human labels with tool scores (latest crawl at or before label time).
export async function calibration() {
  const s = db();
  const { data: labels } = await s.from('manual_labels').select('*').limit(10000);
  if (!labels?.length) return { pages: [], perDim: [], overall: null };
  const pageIds = [...new Set(labels.map(l => l.page_id))];
  const rows = (await latestRows()).filter(r => pageIds.includes(r.page_id));
  const dims = await dimsFor(rows.map(r => r.crawl_id));
  const byPage = Object.fromEntries(rows.map(r => [r.page_id, r]));
  const pairs = [];
  for (const l of labels) {
    const r = byPage[l.page_id]; if (!r) continue;
    const tool = l.dimension === 'overall' ? r.overall : dims[r.crawl_id]?.[l.dimension]?.score;
    if (tool == null) continue;
    pairs.push({ pageId: l.page_id, url: r.url, dimension: l.dimension, human: l.score, tool, diff: Math.round((tool - l.score) * 10) / 10, by: l.labeled_by, note: l.note });
  }
  const stat = ps => ps.length ? {
    n: ps.length,
    mae: Math.round((ps.reduce((a, p) => a + Math.abs(p.diff), 0) / ps.length) * 100) / 100,
    within1: Math.round((ps.filter(p => Math.abs(p.diff) <= 1).length / ps.length) * 100),
    bias: Math.round((ps.reduce((a, p) => a + p.diff, 0) / ps.length) * 100) / 100,
  } : null;
  const perDim = [...DIMENSIONS.map(d => d.key), 'overall'].map(k => ({ dimension: k, ...stat(pairs.filter(p => p.dimension === k)) })).filter(x => x.n);
  const pages = Object.values(pairs.reduce((a, p) => { (a[p.pageId] ||= { pageId: p.pageId, url: p.url, rows: [] }).rows.push(p); return a; }, {}));
  return { pages, perDim, overall: stat(pairs) };
}

export async function saveLabels(pageId, labeledBy, scores, note) {
  const rows = Object.entries(scores).filter(([, v]) => v >= 1 && v <= 5).map(([dimension, score]) => ({ page_id: pageId, dimension, score: Math.round(score), labeled_by: labeledBy, note: note || null, labeled_at: new Date().toISOString() }));
  if (!rows.length) throw new Error('No scores given');
  const { error } = await db().from('manual_labels').upsert(rows, { onConflict: 'page_id,dimension,labeled_by' });
  if (error) throw new Error(error.message);
  return { saved: rows.length };
}
