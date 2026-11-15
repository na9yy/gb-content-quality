// Concrete fix suggestions for failed / unclear checks of one crawl.
import { callClaude, pickModel } from './llm';
import { db } from './supabase';

export async function suggestFixes(crawlId) {
  const s = db();
  const [{ data: cr }, { data: checks }, { data: ps }] = await Promise.all([
    s.from('crawls').select('markdown, metadata, page_id').eq('id', crawlId).single(),
    s.from('checks').select('dimension, check_key, method, verdict, evidence, reason').eq('crawl_id', crawlId).in('verdict', ['fail', 'unclear']),
    s.from('page_scores').select('page_id').eq('crawl_id', crawlId).single(),
  ]);
  if (!cr) throw new Error('Check not found');
  const { data: page } = await s.from('pages').select('url, page_type, game').eq('id', ps?.page_id || cr.page_id).single();
  if (!checks?.length) return { items: [], note: 'Nothing failed. No suggestions needed.' };

  const issues = checks.map(c => `- [${c.dimension}] ${c.check_key} (${c.verdict}): ${(c.reason || '').split('\n\nQ: ')[0]}${c.evidence && c.evidence !== 'none' ? ` | evidence: "${c.evidence.slice(0, 200)}"` : ''}`).join('\n');
  const md = cr.markdown.length > 50000 ? cr.markdown.slice(0, 50000) + '\n[truncated]' : cr.markdown;
  const model = await pickModel();
  const tool = {
    name: 'record_suggestions', description: 'Record fix suggestions.',
    input_schema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['check_key', 'priority', 'problem', 'fix'], properties: {
      check_key: { type: 'string' }, dimension: { type: 'string' },
      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      problem: { type: 'string', description: 'What is wrong, one sentence, specific to this page.' },
      fix: { type: 'string', description: 'Exactly what to change, where. Concrete steps.' },
      example: { type: 'string', description: 'Ready-to-paste example text (new intro, section, sentence) when useful. Match the page language and tone.' },
    } } } } },
  };
  const body = {
    model, max_tokens: 8000, temperature: 0,
    system: `You are a senior SEO editor for gameboost.com, a gaming marketplace. Give concrete, page-specific fixes for failed quality checks so the page better meets Google's helpful content guidance. No generic advice. Do not invent game facts: if a fix needs facts you are not sure of, say what the writer must verify. Prioritise fixes with the biggest quality impact. Group very similar issues. You MUST respond by calling the record_suggestions tool.`,
    tools: [tool], tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: `URL: ${page?.url}\nPage type: ${page?.page_type}\nGame: ${page?.game}\n\nFailed or unclear checks:\n${issues}\n\n<page_content>\n${md}\n</page_content>` }],
  };
  let j = await callClaude(body);
  if (j._status === 400 && /temperature/i.test(j.error?.message || '')) { delete body.temperature; j = await callClaude(body); }
  if (j._status !== 200) throw new Error(`Anthropic ${j._status}: ${j.error?.message || 'error'}`);
  let out = j.content?.find(b => b.type === 'tool_use')?.input;
  if (!out) { const t = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'); const m = t.match(/\{[\s\S]*\}/); try { out = m && JSON.parse(m[0]); } catch {} }
  if (!out?.items) throw new Error('Claude returned no suggestions');
  const order = { high: 0, medium: 1, low: 2 };
  const items = out.items.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  await s.from('suggestions').insert({ crawl_id: crawlId, items, model, usage: j.usage });
  return { items, model, createdAt: new Date().toISOString() };
}

export async function getSuggestions(crawlId) {
  const { data } = await db().from('suggestions').select('items, model, created_at').eq('crawl_id', crawlId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ? { items: data.items, model: data.model, createdAt: data.created_at } : null;
}
