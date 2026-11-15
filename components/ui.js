'use client';
export const color = s => s == null ? 'var(--faint)' : s >= 3.5 ? 'var(--up)' : s >= 2.5 ? 'var(--new)' : 'var(--down)';
export const human = k => (k || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
export const fmtDate = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const fmtDay = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
export const path = u => { try { return new URL(u).pathname; } catch { return u || ''; } };
export const n = v => v == null ? '–' : Number(v).toLocaleString('en-US');
export const sc = v => v == null ? '–' : Number(v).toFixed(1);
export const DIMS = [['originality','Originality'],['effort','Content effort'],['helpfulness','Helpfulness'],['skill','Talent or skill'],['accuracy','Accuracy'],['trust','Trust'],['people_first','People-first'],['spam','Spam']];

export async function api(url, opts = {}) {
  const r = await fetch(url, { cache: 'no-store', ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export function Gauge({ score }) {
  const pct = score == null ? 0 : (score - 1) / 4, c = Math.PI * 70;
  return (
    <svg viewBox="0 0 180 110" className="cq-gauge">
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="var(--panel-3)" strokeWidth="12" strokeLinecap="round" />
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke={color(score)} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      <text x="90" y="82" textAnchor="middle" className="cq-gauge-num">{sc(score)}</text>
      <text x="90" y="102" textAnchor="middle" className="cq-gauge-sub">/ 5</text>
    </svg>
  );
}

export function Delta({ v, suffix = '' }) {
  if (v == null || v === 0) return <span className="cq-faint-i">{v === 0 ? `±0${suffix}` : ''}</span>;
  return <span style={{ color: v > 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>{v > 0 ? '+' : ''}{typeof v === 'number' && !suffix ? v.toFixed(1) : v}{suffix}</span>;
}

export function Usage({ u, onRefresh }) {
  if (!u) return <div className="cq-usage"><div className="cq-side-head">Usage</div><div className="cq-faint">Loading…</div></div>;
  const fc = u.firecrawl || {}, d = u.dataforseo || {}, a = u.app || {};
  const pct = fc.plan ? Math.max(0, Math.min(100, (fc.remaining / fc.plan) * 100)) : null;
  return (
    <div className="cq-usage">
      <div className="cq-side-head">Usage <button className="cq-link" onClick={onRefresh}>Refresh</button></div>
      <div className="cq-u-row"><span>Firecrawl credits left</span><b>{fc.ok ? n(fc.remaining) : 'error'}{fc.plan ? <i> / {n(fc.plan)}</i> : null}</b></div>
      {pct != null && <div className="cq-bar"><div style={{ width: `${pct}%`, background: pct > 25 ? 'var(--up)' : pct > 10 ? 'var(--new)' : 'var(--down)' }} /></div>}
      {fc.periodEnd && <div className="cq-faint">Resets {fmtDay(fc.periodEnd)}</div>}
      <div className="cq-u-row"><span>Checks today / 30d</span><b>{n(a.checksToday)} / {n(a.checks30d)}</b></div>
      <div className="cq-u-row"><span>Pages tracked</span><b>{n(a.pagesTracked)}</b></div>
      <div className="cq-u-row"><span>Claude cost 30d</span><b>${a.claude?.estCost30d ?? '–'}</b></div>
      <div className="cq-u-row"><span>Avg per check</span><b>${a.claude?.avgCostPerCheck ?? '–'}</b></div>
      <div className="cq-u-row"><span>DataForSEO balance</span><b>{d.ok ? `$${Number(d.balance).toFixed(2)}` : 'error'}</b></div>
      <div className="cq-faint">{a.claude?.priceNote}</div>
    </div>
  );
}
