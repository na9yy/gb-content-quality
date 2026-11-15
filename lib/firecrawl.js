// Scrape one URL with Firecrawl: main-content markdown + full raw HTML (for JSON-LD, meta).
export async function scrape(url) {
  const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown', 'rawHtml'], onlyMainContent: true, timeout: 60000 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`Firecrawl failed (${r.status}): ${j.error || 'unknown error'}`);
  const d = j.data || {};
  return { markdown: d.markdown || '', rawHtml: d.rawHtml || '', metadata: d.metadata || {} };
}
