// Usage + cost overview: Firecrawl credits, DataForSEO balance, Claude tokens from our own logs.
import { db } from './supabase';

const IN_PRICE = Number(process.env.CLAUDE_PRICE_IN_PER_M || 3);    // USD per 1M input tokens (estimate)
const OUT_PRICE = Number(process.env.CLAUDE_PRICE_OUT_PER_M || 15); // USD per 1M output tokens (estimate)

async function firecrawl() {
  const h = { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` };
  // v2 gives plan + billing period; fall back to v1 (remaining only)
  let r = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', { headers: h });
  let j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) { r = await fetch('https://api.firecrawl.dev/v1/team/credit-usage', { headers: h }); j = await r.json().catch(() => ({})); }
  if (!r.ok || !j.success) return { ok: false, error: j.error || `HTTP ${r.status}` };
  const d = j.data || {};
  return { ok: true, remaining: d.remainingCredits ?? d.remaining_credits ?? null, plan: d.planCredits ?? d.plan_credits ?? null,
    periodStart: d.billingPeriodStart ?? d.billing_period_start ?? null, periodEnd: d.billingPeriodEnd ?? d.billing_period_end ?? null };
}

async function dataforseo() {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
  const r = await fetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { authorization: `Basic ${auth}` } });
  const j = await r.json().catch(() => ({}));
  const m = j.tasks?.[0]?.result?.[0]?.money;
  return m ? { ok: true, balance: m.balance, totalSpent: m.total } : { ok: false, error: j.status_message || `HTTP ${r.status}` };
}

async function own() {
  const s = db();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const { data } = await s.from('crawls').select('crawled_at, metadata').gte('crawled_at', since30).limit(10000);
  const rows = data || [];
  const sum = arr => arr.reduce((a, r) => {
    const u = r.metadata?.usage || {};
    a.in += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    a.out += u.output_tokens || 0; a.n++; return a;
  }, { in: 0, out: 0, n: 0 });
  const m = sum(rows), t = sum(rows.filter(r => r.crawled_at >= today.toISOString()));
  const cost = x => Math.round(((x.in * IN_PRICE + x.out * OUT_PRICE) / 1e6) * 100) / 100;
  const { count: pages } = await s.from('pages').select('id', { count: 'exact', head: true });
  return {
    pagesTracked: pages || 0,
    checksToday: t.n, checks30d: m.n,
    firecrawlCreditsUsed30d: m.n, // 1 credit per scrape
    claude: { inputTokens30d: m.in, outputTokens30d: m.out, estCost30d: cost(m), estCostToday: cost(t), avgCostPerCheck: m.n ? Math.round((cost(m) / m.n) * 1000) / 1000 : null, priceNote: `Estimate at $${IN_PRICE}/M in, $${OUT_PRICE}/M out` },
  };
}

export async function getUsage() {
  const safe = p => p.catch(e => ({ ok: false, error: String(e.message || e) }));
  const [fc, dfs, mine] = await Promise.all([safe(firecrawl()), safe(dataforseo()), safe(own())]);
  return { firecrawl: fc, dataforseo: dfs, app: mine, at: new Date().toISOString() };
}
