// Scoring engine shared by live pages and drafts, plus the live-page pipeline (scrape, score, store).
import crypto from 'node:crypto';
import { scrape } from './firecrawl';
import { extract, pageTypeFromUrl } from './extract';
import { codeChecks } from './checks-code';
import { llmChecks } from './llm';
import { scoreDimensions, overallScore } from './score';
import { RUBRIC_VERSION } from './rubric';
import { db } from './supabase';
import { refreshGsc } from './gsc';

// Checks that need the live page's HTML (schema, author, dates). Skipped for drafts.
const LIVE_ONLY = new Set(['author', 'dates', 'freshness', 'schema', 'title_h1_match']);

export async function scoreContent({ url, pageType, markdown, rawHtml = '', metadata = {}, isDraft = false, model }) {
  const x = extract({ markdown, rawHtml, metadata }, url);
  let code = codeChecks(x, pageType, markdown);
  if (isDraft) code = code.filter(c => !LIVE_ONLY.has(c.key));
  const llm = await llmChecks({ url, pageType, title: x.title || x.h1, markdown, model });
  const checks = [...code, ...llm.checks];
  const dims = scoreDimensions(checks).map(d => ({ ...d, summary: llm.summaries[d.dim] || '' }));
  const { overall } = overallScore(dims, llm.isYmyl);
  return { x, checks, dims, overall, llm };
}

export async function runCheck(rawUrl, { force = false, bulk = false } = {}) {
  const url = normalizeUrl(rawUrl);
  const pageType = pageTypeFromUrl(url);
  const page = await scrape(url);
  if (!page.markdown || page.markdown.length < 200) throw new Error('Page returned almost no text. Check the URL.');
  const hash = crypto.createHash('sha256').update(page.markdown).digest('hex');
  const s = db();

  // Skip scoring if content is unchanged since the last check (saves Claude cost).
  if (!force) {
    const { data: prev } = await s.from('pages').select('id').eq('url', url).maybeSingle();
    if (prev) {
      const { data: last } = await s.from('crawls').select('id, content_hash').eq('page_id', prev.id).order('crawled_at', { ascending: false }).limit(1).maybeSingle();
      if (last?.content_hash === hash) {
        const { data: ps } = await s.from('page_scores').select('rubric_version').eq('crawl_id', last.id).maybeSingle();
        if (ps?.rubric_version === RUBRIC_VERSION) {
          await refreshGsc(prev.id, url).catch(() => {});
          return { crawlId: last.id, unchanged: true };
        }
      }
    }
  }

  const { x, checks, dims, overall, llm } = await scoreContent({ url, pageType, ...page, model: bulk ? process.env.ANTHROPIC_MODEL_BULK : undefined });

  const { data: pg, error: e1 } = await s.from('pages')
    .upsert({ url, page_type: pageType, game: llm.game, title: x.title, last_scored: new Date().toISOString() }, { onConflict: 'url' })
    .select('id').single();
  if (e1) throw new Error(`DB pages: ${e1.message}`);
  const { data: cr, error: e2 } = await s.from('crawls').insert({
    page_id: pg.id, http_status: x.statusCode, markdown: page.markdown, word_count: x.wordCount, content_hash: hash,
    metadata: { title: x.title, description: x.description, h1: x.h1, headings: x.headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).slice(0, 80), author: x.author, datePublished: x.datePublished, dateModified: x.dateModified, schemaTypes: x.schemaTypes, externalDomains: x.externalDomains, model: llm.model, usage: llm.usage, ymylReason: llm.ymylReason },
  }).select('id').single();
  if (e2) throw new Error(`DB crawls: ${e2.message}`);
  const crawlId = cr.id;
  const r1 = await s.from('checks').insert(checks.map(c => ({ crawl_id: crawlId, dimension: c.dim, check_key: c.key, method: c.method, verdict: c.verdict, weight: c.weight, evidence: (c.evidence || '').slice(0, 1000), reason: c.question ? `${c.reason}\n\nQ: ${c.question}` : c.reason, rubric_version: RUBRIC_VERSION })));
  const r2 = await s.from('dimension_scores').insert(dims.map(d => ({ crawl_id: crawlId, dimension: d.dim, score: d.score, passed: d.passed, failed: d.failed, unclear: d.unclear, confidence: d.confidence, summary: d.summary })));
  const r3 = await s.from('page_scores').insert({ crawl_id: crawlId, page_id: pg.id, overall, is_ymyl: llm.isYmyl, rubric_version: RUBRIC_VERSION });
  for (const r of [r1, r2, r3]) if (r.error) throw new Error(`DB save: ${r.error.message}`);

  await refreshGsc(pg.id, url).catch(() => {});
  return { crawlId, unchanged: false };
}

export function normalizeUrl(u) {
  const x = new URL(u.trim());
  x.hash = '';
  for (const k of [...x.searchParams.keys()]) if (/^utm_|^gclid|^fbclid/.test(k)) x.searchParams.delete(k);
  return x.toString().replace(/\/$/, '');
}
