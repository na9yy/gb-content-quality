import { db } from './supabase';
import { DIMENSIONS, scoreLabel } from './rubric';

export async function getResult(crawlId) {
  const s = db();
  const [{ data: ps }, { data: cr }, { data: dims }, { data: checks }] = await Promise.all([
    s.from('page_scores').select('page_id, overall, is_ymyl, rubric_version, scored_at').eq('crawl_id', crawlId).single(),
    s.from('crawls').select('crawled_at, word_count, metadata').eq('id', crawlId).single(),
    s.from('dimension_scores').select('*').eq('crawl_id', crawlId),
    s.from('checks').select('dimension, check_key, method, verdict, weight, evidence, reason').eq('crawl_id', crawlId).order('id'),
  ]);
  if (!ps) return null;
  const { data: pg } = await s.from('pages').select('url, title, page_type, game').eq('id', ps.page_id).single();
  ps.pages = pg || {};
  const byDim = Object.fromEntries((dims || []).map(d => [d.dimension, d]));
  return {
    crawlId: Number(crawlId), url: ps.pages.url, title: ps.pages.title, pageType: ps.pages.page_type, game: ps.pages.game,
    overall: ps.overall == null ? null : Number(ps.overall), verdict: scoreLabel(ps.overall == null ? null : Number(ps.overall), 'overall'),
    isYmyl: ps.is_ymyl, scoredAt: ps.scored_at, wordCount: cr?.word_count, meta: cr?.metadata || {},
    dimensions: DIMENSIONS.map(d => {
      const r = byDim[d.key] || {};
      const score = r.score == null ? null : Number(r.score);
      return { dim: d.key, label: d.label, inOverall: d.inOverall, score, verdict: scoreLabel(score, d.key), passed: r.passed || 0, failed: r.failed || 0, unclear: r.unclear || 0, confidence: r.confidence, summary: r.summary || '',
        checks: (checks || []).filter(c => c.dimension === d.key).map(c => ({ key: c.check_key, method: c.method, verdict: c.verdict, weight: Number(c.weight), evidence: c.evidence, reason: c.reason })) };
    }),
  };
}

export async function listResults(limit = 200) {
  const s = db();
  const { data: scores, error } = await s.from('page_scores')
    .select('crawl_id, page_id, overall, is_ymyl, scored_at')
    .order('scored_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`page_scores: ${error.message}`);
  const ids = [...new Set((scores || []).map(r => r.page_id))];
  const { data: pages, error: e2 } = ids.length ? await s.from('pages').select('id, url, title, page_type, game').in('id', ids) : { data: [] };
  if (e2) throw new Error(`pages: ${e2.message}`);
  const byId = Object.fromEntries((pages || []).map(p => [p.id, p]));
  return (scores || []).map(r => { const p = byId[r.page_id] || {};
    return { crawlId: r.crawl_id, overall: r.overall == null ? null : Number(r.overall), isYmyl: r.is_ymyl, scoredAt: r.scored_at, url: p.url, title: p.title, pageType: p.page_type, game: p.game }; });
}
