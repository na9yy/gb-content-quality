// Deterministic checks. Each returns { dim, key, method:'code', verdict, weight, evidence, reason }.
const c = (dim, key, verdict, evidence, reason, weight = 1) => ({ dim, key, method: 'code', verdict, weight, evidence, reason });

export function codeChecks(x, pageType, markdown) {
  const out = [];
  const isArticle = pageType !== 'product';

  // Effort
  const minWords = isArticle ? 800 : 300;
  out.push(c('effort', 'word_count', x.wordCount >= minWords ? 'pass' : x.wordCount >= minWords / 2 ? 'unclear' : 'fail',
    `${x.wordCount} words`, `Target ${minWords}+ for a ${pageType} page.`));
  const subheads = x.headings.filter(h => h.level >= 2).length;
  out.push(c('effort', 'structure', subheads >= 3 ? 'pass' : subheads >= 1 ? 'unclear' : 'fail', `${subheads} subheadings`, 'Clear sections help readers scan.'));
  out.push(c('effort', 'rich_elements', x.tables > 0 || x.listItems >= 5 ? 'pass' : 'unclear',
    `${x.tables} tables, ${x.listItems} list items`, 'Tables and lists show structured effort.'));

  // Trust
  out.push(c('trust', 'author', x.author ? 'pass' : isArticle ? 'fail' : 'unclear', x.author || 'No author found', 'Named author in JSON-LD or meta.', isArticle ? 2 : 1));
  out.push(c('trust', 'dates', x.datePublished || x.dateModified ? 'pass' : isArticle ? 'fail' : 'unclear',
    [x.datePublished && `published ${x.datePublished}`, x.dateModified && `modified ${x.dateModified}`].filter(Boolean).join(', ') || 'No dates found', 'Visible publish/update dates.'));
  if (isArticle) {
    const mod = Date.parse(x.dateModified || x.datePublished || '');
    const months = isNaN(mod) ? null : (Date.now() - mod) / (30.4 * 864e5);
    out.push(c('trust', 'freshness', months == null ? 'unclear' : months <= 12 ? 'pass' : months <= 24 ? 'unclear' : 'fail',
      months == null ? 'No date' : `${Math.round(months)} months since last update`, 'Gaming content goes stale fast.'));
  }
  out.push(c('trust', 'external_sources', x.externalDomains.length >= 2 ? 'pass' : x.externalDomains.length === 1 ? 'unclear' : 'fail',
    x.externalDomains.slice(0, 5).join(', ') || 'No external links', 'Links to official/authoritative sources.'));
  const wantSchema = isArticle ? /Article|BlogPosting|Review|NewsArticle/ : /Product|Offer/;
  out.push(c('trust', 'schema', x.schemaTypes.some(t => wantSchema.test(t)) ? 'pass' : 'fail', x.schemaTypes.join(', ') || 'No JSON-LD', 'Matching structured data.'));

  // Spam
  const dens = x.topDensity * 100;
  out.push(c('spam', 'keyword_density', dens < 2.5 ? 'pass' : dens < 4 ? 'unclear' : 'fail', `"${x.topWord}" = ${dens.toFixed(1)}% of words`, 'High single-term density looks stuffed.'));
  out.push(c('spam', 'duplicate_blocks', x.dupes === 0 ? 'pass' : x.dupes <= 2 ? 'unclear' : 'fail', `${x.dupes} repeated paragraphs`, 'Repeated blocks suggest templating.'));
  const tw = new Set((x.title || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []);
  const hw = (x.h1 || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const overlap = hw.length ? hw.filter(w => tw.has(w)).length / hw.length : 0;
  out.push(c('spam', 'title_h1_match', !x.h1 ? 'unclear' : overlap >= 0.3 ? 'pass' : 'fail', `Title: "${x.title}" / H1: "${x.h1 || 'none'}"`, 'Title should match the page topic.'));

  // Accuracy
  if (isArticle) {
    const hasVersion = /\b(patch|season|update|version|v\d+\.\d+|chapter)\b/i.test(markdown) || /\b20\d\d\b/.test(markdown);
    out.push(c('accuracy', 'version_reference', hasVersion ? 'pass' : 'unclear', hasVersion ? 'Mentions patch/season/year' : 'No version or year mentioned', 'Readers need to know which game version this applies to.'));
  }
  return out;
}
