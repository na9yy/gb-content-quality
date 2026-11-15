// Claude judge: answers every LLM check in one call via a forced tool call (structured JSON).
import { LLM_CHECKS, DIMENSIONS } from './rubric';

let cachedModel = null;
async function pickModel() {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (cachedModel) return cachedModel;
  const r = await fetch('https://api.anthropic.com/v1/models?limit=50', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
  const j = await r.json();
  const ids = (j.data || []).map(m => m.id);
  cachedModel = ids.find(id => id.includes('sonnet')) || ids[0];
  if (!cachedModel) throw new Error('No Anthropic model available');
  return cachedModel;
}

const SYSTEM = `You are a strict, experienced Google Search Quality Rater reviewing pages on gameboost.com, a gaming marketplace (accounts, currency, items, boosting, game guides).
Judge ONLY the page text you are given. Rules:
- For each check answer "pass", "fail" or "unclear".
- "pass" needs an exact short quote from the page as evidence (max 200 chars). No supporting quote = not a pass.
- "fail" when the page clearly does not meet the check. Quote the weakest relevant passage, or write "none" if the thing is missing.
- "unclear" only when the page text alone cannot answer it (e.g. you are not sure a game fact is right).
- Be strict. A typical average web page should pass about half the checks. Do not be generous.
- Reasons: one short sentence, plain English.`;

export async function llmChecks({ url, pageType, title, markdown }) {
  const checks = LLM_CHECKS.filter(c => !c.types || c.types.includes(pageType));
  const model = await pickModel();
  const tool = {
    name: 'record_review',
    description: 'Record the review results.',
    input_schema: {
      type: 'object',
      required: ['game', 'is_ymyl', 'checks', 'dimension_summaries'],
      properties: {
        game: { type: 'string', description: 'Main game the page is about, or "multiple"/"none".' },
        is_ymyl: { type: 'boolean', description: 'True if the topic can significantly affect money, safety or health (e.g. buying accounts with real money, payment safety). Pure game guides are false.' },
        ymyl_reason: { type: 'string' },
        checks: {
          type: 'array',
          items: {
            type: 'object', required: ['key', 'verdict', 'evidence', 'reason'],
            properties: {
              key: { type: 'string', enum: checks.map(c => c.key) },
              verdict: { type: 'string', enum: ['pass', 'fail', 'unclear'] },
              evidence: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
        dimension_summaries: {
          type: 'array',
          description: 'One short sentence per dimension summarising the verdict, like a rater note.',
          items: { type: 'object', required: ['dim', 'summary'], properties: { dim: { type: 'string', enum: DIMENSIONS.map(d => d.key) }, summary: { type: 'string' } } },
        },
      },
    },
  };
  const list = checks.map(c => `- ${c.key} [${c.dim}]: ${c.q}`).join('\n');
  const content = markdown.length > 60000 ? markdown.slice(0, 60000) + '\n\n[truncated]' : markdown;
  const user = `Page URL: ${url}\nPage type: ${pageType}\nTitle: ${title}\n\nChecks to answer (answer every one, use the key):\n${list}\n\n<page_content>\n${content}\n</page_content>`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 8000, temperature: 0,
      system: SYSTEM,
      tools: [tool], tool_choice: { type: 'tool', name: 'record_review' },
      messages: [{ role: 'user', content: user }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j.error?.message || 'error'}`);
  const out = j.content?.find(b => b.type === 'tool_use')?.input;
  if (!out) throw new Error('Claude returned no structured result');

  const byKey = Object.fromEntries((out.checks || []).map(c => [c.key, c]));
  const results = checks.map(c => {
    const a = byKey[c.key];
    return { dim: c.dim, key: c.key, method: 'llm', weight: c.weight || 1, question: c.q,
      verdict: a?.verdict || 'unclear', evidence: a?.evidence || '', reason: a?.reason || 'No answer returned' };
  });
  return { model, game: out.game, isYmyl: !!out.is_ymyl, ymylReason: out.ymyl_reason || '', summaries: Object.fromEntries((out.dimension_summaries || []).map(d => [d.dim, d.summary])), checks: results, usage: j.usage };
}
