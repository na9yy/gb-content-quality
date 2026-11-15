// Full check for one URL: scrape -> extract -> code checks -> Claude checks -> score -> store.
import crypto from 'node:crypto';
import { scrape } from './firecrawl';
import { extract, pageTypeFromUrl } from './extract';
import { codeChecks } from './checks-code';
import { llmChecks } from './llm';
import { scoreDimensions, overallScore } from './score';
import { RUBRIC_VERSION } from './rubric';
import { db } from './supabase';

export async function runCheck(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const pageType = pageTypeFromUrl(url);
  const page = await scrape(url);
  if (!page.markdown || page.markdown.length < 200) throw new Error('Page returned almost no text. Check the URL.');
  const x = extract(page, url);

  const code = codeChecks(x, pageType, page.markdown);
  const llm = await llmChecks({ url, pageType, title: x.title || x.h1, markdown: page.markdown });
  const checks = [...code, ...llm.checks];
  const dims = scoreDimensions(checks).map(d => ({ ...d, summary: llm.summaries[d.dim] || '' }));
  const { overall, verdict } = overallScore(dims, llm.isYmyl);

  // store
  const s = db();
  const { data: pg, error: e1 } = await s.from('pages')
    .upsert({ url, page_type: pageType, game: llm.game, title: x.title, last_scored: new Date().toISOString() }, { onConflict: 'url' })
    .select('id').single();
  if (e1) throw new Error(`DB pages: ${e1.message}`);
  const { data: cr, error: e2 } = await s.from('crawls').insert({
    page_id: pg.id, http_status: x.statusCode, markdown: page.markdown, word_count: x.wordCount,
    content_hash: crypto.createHash('sha256').update(page.markdown).digest('hex'),
    metadata: { title: x.title, description: x.description, h1: x.h1, author: x.author, datePublished: x.datePublished, dateModified: x.dateModified, schemaTypes: x.schemaTypes, externalDomains: x.externalDomains, model: llm.model, usage: llm.usage, ymylReason: llm.ymylReason },
  }).select('id').single();
  if (e2) throw new Error(`DB crawls: ${e2.message}`);
  const crawlId = cr.id;
  await s.from('checks').insert(checks.map(c => ({ crawl_id: crawlId, dimension: c.dim, check_key: c.key, method: c.method, verdict: c.verdict, weight: c.weight, evidence: (c.evidence || '').slice(0, 1000), reason: c.question ? `${c.reason}\n\nQ: ${c.question}` : c.reason, rubric_version: RUBRIC_VERSION })));
  await s.from('dimension_scores').insert(dims.map(d => ({ crawl_id: crawlId, dimension: d.dim, score: d.score, passed: d.passed, failed: d.failed, unclear: d.unclear, confidence: d.confidence, summary: d.summary })));
  await s.from('page_scores').insert({ crawl_id: crawlId, page_id: pg.id, overall, is_ymyl: llm.isYmyl, rubric_version: RUBRIC_VERSION });

  return { crawlId };
}

export function normalizeUrl(u) {
  const x = new URL(u.trim());
  x.hash = '';
  for (const k of [...x.searchParams.keys()]) if (/^utm_|^gclid|^fbclid/.test(k)) x.searchParams.delete(k);
  return x.toString().replace(/\/$/, '');
}
