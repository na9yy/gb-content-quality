// Pull structured facts out of the scraped page. Pure code, no LLM.
const STOP = new Set('the and for with that this from your you are was were have has had but not all can will its into than then them they their there what when where which who how why our out get got use used using more most also just like make made very much many some any each other about after before over under only into been being would could should game games'.split(' '));

export function extract({ markdown, rawHtml, metadata }, pageUrl) {
  const host = new URL(pageUrl).hostname.replace(/^www\./, '');
  const lines = markdown.split('\n');
  const headings = lines.filter(l => /^#{1,6}\s/.test(l)).map(l => ({ level: l.match(/^#+/)[0].length, text: l.replace(/^#+\s*/, '').trim() }));
  const h1 = headings.find(h => h.level === 1)?.text || '';
  const listItems = lines.filter(l => /^\s*([-*+]|\d+\.)\s+/.test(l)).length;
  const tables = lines.filter(l => /^\s*\|?\s*:?-{3,}/.test(l)).length;

  // plain text for word stats
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const wordCount = words.length;

  // keyword density: share of most frequent meaningful word
  const freq = {};
  for (const w of words) if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const topDensity = wordCount ? top[1] / wordCount : 0;

  // links in main content
  const links = [...markdown.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]);
  const external = [...new Set(links.filter(u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return !h.endsWith(host); } catch { return false; } }).map(u => new URL(u).hostname.replace(/^www\./, '')))];

  // duplicate paragraphs (template repetition)
  const paras = markdown.split(/\n\s*\n/).map(p => p.trim().toLowerCase()).filter(p => p.length > 80);
  const seen = new Set(); let dupes = 0;
  for (const p of paras) { if (seen.has(p)) dupes++; seen.add(p); }

  // JSON-LD
  const ld = [];
  for (const m of rawHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1].trim()); (Array.isArray(j) ? j : j['@graph'] || [j]).forEach(x => ld.push(x)); } catch {}
  }
  const types = ld.flatMap(x => [].concat(x['@type'] || []));
  const pick = k => ld.map(x => x[k]).find(Boolean);
  const authorLd = pick('author');
  const author = typeof authorLd === 'string' ? authorLd : [].concat(authorLd || []).map(a => a?.name).filter(Boolean).join(', ');
  const datePublished = pick('datePublished') || metadata['article:published_time'] || null;
  const dateModified = pick('dateModified') || metadata['article:modified_time'] || null;

  return {
    title: metadata.title || metadata.ogTitle || '',
    description: metadata.description || '',
    h1, headings, listItems, tables, wordCount, topWord: top[0], topDensity,
    externalDomains: external, dupes, schemaTypes: [...new Set(types)],
    author: author || metadata.author || '', datePublished, dateModified,
    statusCode: metadata.statusCode || null,
  };
}

export function pageTypeFromUrl(url) {
  const p = new URL(url).pathname;
  if (p.includes('/reviews/')) return 'review';
  if (p.includes('/blog/')) return 'blog';
  return 'product';
}
