import { db } from './supabase';
import { DIMENSIONS, scoreLabel } from './rubric';

export async function getResult(crawlId) {
  const s = db();
  const [{ data: ps }, { data: cr }, { data: dims }, { data: checks }] = await Promise.all([
    s.from('page_scores').select('overall, is_ymyl, rubric_version, scored_at, pages(url, title, page_type, game)').eq('crawl_id', crawlId).single(),
    s.from('crawls').select('crawled_at, word_count, metadata').eq('id', crawlId).single(),
    s.from('dimension_scores').select('*').eq('crawl_id', crawlId),
    s.from('checks').select('dimension, check_key, method, verdict, weight, evidence, reason').eq('crawl_id', crawlId).order('id'),
  ]);
  if (!ps) return null;
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

export async function listResults(limit = 100) {
  const { data, error } = await db().from('page_scores')
    .select('crawl_id, overall, is_ymyl, scored_at, pages(url, title, page_type, game)')
    .order('scored_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ crawlId: r.crawl_id, overall: r.overall == null ? null : Number(r.overall), isYmyl: r.is_ymyl, scoredAt: r.scored_at, url: r.pages?.url, title: r.pages?.title, pageType: r.pages?.page_type, game: r.pages?.game }));
}
