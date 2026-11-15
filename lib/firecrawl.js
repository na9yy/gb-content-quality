// Scrape one URL with Firecrawl: main-content markdown + full raw HTML (for JSON-LD, meta).
// On 429 (rate limit) it waits and retries, so bulk runs slow down instead of failing.
export class RateLimitError extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function scrape(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'rawHtml'], onlyMainContent: true, timeout: 60000 }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429) {
      if (attempt === 4) throw new RateLimitError(`Firecrawl rate limit: ${j.error || '429'}`);
      const wait = Number(r.headers.get('retry-after')) * 1000 || 15000 * attempt + Math.random() * 5000;
      await sleep(Math.min(wait, 45000));
      continue;
    }
    if (!r.ok || !j.success) throw new Error(`Firecrawl failed (${r.status}): ${j.error || 'unknown error'}`);
    const d = j.data || {};
    return { markdown: d.markdown || '', rawHtml: d.rawHtml || '', metadata: d.metadata || {} };
  }
}
