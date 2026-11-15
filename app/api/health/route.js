import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

const KEYS = ['DASHBOARD_PASSWORD','AUTH_SECRET','CRON_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ANTHROPIC_API_KEY','FIRECRAWL_API_KEY','DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD','OPENAI_API_KEY','GSC_SERVICE_ACCOUNT_JSON','GSC_SITE_URL'];

async function safe(fn) { try { return await fn(); } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 200) }; } }

async function gsc() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return { ok: false, error: 'missing' };
  let sa;
  try { sa = JSON.parse(raw); } catch { return { ok: false, error: 'not valid JSON (pasted only part of the file?)' }; }
  if (sa.type !== 'service_account' || !sa.client_email || !sa.private_key) return { ok: false, error: 'JSON is missing client_email/private_key' };
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) }).then(r => r.json());
  if (!tok.access_token) return { ok: false, error: `Google rejected key: ${tok.error_description || tok.error}`, client_email: sa.client_email };
  const sites = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { authorization: `Bearer ${tok.access_token}` } }).then(r => r.json());
  const list = (sites.siteEntry || []).map(s => s.siteUrl);
  const want = process.env.GSC_SITE_URL;
  return { ok: list.includes(want), client_email: sa.client_email, sites: list, note: list.includes(want) ? 'has access' : `key works but no access to ${want}. Add ${sa.client_email} as a user in GSC.` };
}

async function supabase() {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/domain_blocklist?select=domain`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'accept-profile': 'content_quality' } });
  const host = (process.env.SUPABASE_URL || '').replace(/^https:\/\//, '').split('.')[0];
  return { ok: r.ok, status: r.status, project_ref: host, body: r.ok ? await r.json() : (await r.text()).slice(0, 200) };
}

async function anthropic() {
  const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
  return { ok: r.ok, status: r.status };
}
async function openai() {
  const r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
  return { ok: r.ok, status: r.status };
}
async function firecrawl() {
  const r = await fetch('https://api.firecrawl.dev/v1/team/credit-usage', { headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` } });
  return { ok: r.ok, status: r.status };
}
async function dataforseo() {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
  const r = await fetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { authorization: `Basic ${auth}` } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.status_code === 20000, status: r.status, code: j.status_code };
}

export async function GET(req) {
  const key = new URL(req.url).searchParams.get('key');
  const ok = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}` || key === process.env.CRON_SECRET;
  if (!process.env.CRON_SECRET || !ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const present = Object.fromEntries(KEYS.map(k => [k, !!process.env[k]]));
  const [g, s, a, o, f, d] = await Promise.all([safe(gsc), safe(supabase), safe(anthropic), safe(openai), safe(firecrawl), safe(dataforseo)]);
  return NextResponse.json({ present, gsc: g, supabase: s, anthropic: a, openai: o, firecrawl: f, dataforseo: d });
}
