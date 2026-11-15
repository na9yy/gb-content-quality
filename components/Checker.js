'use client';
import { useEffect, useState } from 'react';

const color = s => s == null ? 'var(--faint)' : s >= 3.5 ? 'var(--up)' : s >= 2.5 ? 'var(--new)' : 'var(--down)';
const human = k => k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const fmtDate = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const path = u => { try { return new URL(u).pathname; } catch { return u; } };

function Gauge({ score }) {
  const pct = score == null ? 0 : (score - 1) / 4;
  const c = Math.PI * 70;
  return (
    <svg viewBox="0 0 180 110" className="cq-gauge">
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="var(--panel-3)" strokeWidth="12" strokeLinecap="round" />
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke={color(score)} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      <text x="90" y="82" textAnchor="middle" className="cq-gauge-num">{score == null ? '–' : score.toFixed(1)}</text>
      <text x="90" y="102" textAnchor="middle" className="cq-gauge-sub">/ 5</text>
    </svg>
  );
}

function Dimension({ d }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cq-dim">
      <button className="cq-dim-head" onClick={() => setOpen(!open)}>
        <div className="cq-dim-title">{d.label}{!d.inOverall && <span className="cq-tag">Not in overall</span>}</div>
        <div className="cq-dim-score"><span style={{ color: color(d.score) }}>{d.verdict}</span> <b>{d.score == null ? '–' : d.score.toFixed(1)}</b><i>/ 5</i></div>
      </button>
      <div className="cq-bar"><div style={{ width: `${d.score == null ? 0 : (d.score / 5) * 100}%`, background: color(d.score) }} /></div>
      <button className="cq-dim-foot" onClick={() => setOpen(!open)}>
        <span className="cq-sum">{d.summary}</span>
        <span className="cq-counts">{d.confidence === 'low' && 'Low confidence · '}{d.passed} passed{d.failed ? ` · ${d.failed} failed` : ''}{d.unclear ? ` · ${d.unclear} unclear` : ''} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="cq-checks">
          {d.checks.map(c => (
            <div key={c.key} className="cq-check">
              <span className={`cq-v cq-v-${c.verdict}`}>{c.verdict}</span>
              <div>
                <div className="cq-check-name">{human(c.key)} <span className="cq-method">{c.method === 'llm' ? 'AI' : 'Code'}</span>{c.weight > 1 && <span className="cq-method">Critical</span>}</div>
                <div className="cq-reason">{c.reason?.split('\n\nQ: ')[0]}</div>
                {c.evidence && c.evidence !== 'none' && <div className="cq-evidence">“{c.evidence}”</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Result({ r }) {
  return (
    <div className="cq-result">
      <div className="cq-result-head">
        <div className="cq-crumb">{r.pageType} · {r.game || '–'} · {r.wordCount} words · {fmtDate(r.scoredAt)}</div>
        <a href={r.url} target="_blank" rel="noreferrer" className="cq-url">{path(r.url)} ↗</a>
        <div className="cq-title">{r.title}</div>
      </div>
      <div className="cq-overall">
        <div className="cq-overall-card">
          <div className="cq-label">Overall score</div>
          <Gauge score={r.overall} />
          <div className="cq-verdict" style={{ color: color(r.overall) }}>{r.verdict}</div>
          {r.isYmyl && <div className="cq-ymyl">YMYL page: Trust counts double</div>}
        </div>
        <div className="cq-mini">
          {r.dimensions.map(d => (
            <div key={d.dim} className="cq-mini-row"><span>{d.label}</span><b style={{ color: color(d.score) }}>{d.score == null ? '–' : d.score.toFixed(1)}</b></div>
          ))}
        </div>
      </div>
      <div className="cq-dims">{r.dimensions.map(d => <Dimension key={d.dim} d={d} />)}</div>
      <div className="cq-foot">{r.meta?.model ? `Judge: ${r.meta.model} · ` : ''}Only the page text is scored. Speed, layout and images are not.</div>
    </div>
  );
}

const n = v => v == null ? '–' : Number(v).toLocaleString('en-US');
function Usage({ u, onRefresh }) {
  if (!u) return <div className="cq-usage"><div className="cq-side-head">Usage</div><div className="cq-faint">Loading…</div></div>;
  const fc = u.firecrawl || {}, d = u.dataforseo || {}, a = u.app || {};
  const pct = fc.plan ? Math.max(0, Math.min(100, (fc.remaining / fc.plan) * 100)) : null;
  return (
    <div className="cq-usage">
      <div className="cq-side-head">Usage <button className="cq-link" onClick={onRefresh}>Refresh</button></div>
      <div className="cq-u-row"><span>Firecrawl credits left</span><b>{fc.ok ? n(fc.remaining) : 'error'}{fc.plan ? <i> / {n(fc.plan)}</i> : null}</b></div>
      {pct != null && <div className="cq-bar"><div style={{ width: `${pct}%`, background: pct > 25 ? 'var(--up)' : pct > 10 ? 'var(--new)' : 'var(--down)' }} /></div>}
      {fc.periodEnd && <div className="cq-faint">Resets {new Date(fc.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>}
      <div className="cq-u-row"><span>Checks today / 30d</span><b>{n(a.checksToday)} / {n(a.checks30d)}</b></div>
      <div className="cq-u-row"><span>Pages tracked</span><b>{n(a.pagesTracked)}</b></div>
      <div className="cq-u-row"><span>Claude cost 30d</span><b>${a.claude?.estCost30d ?? '–'}</b></div>
      <div className="cq-u-row"><span>Avg per check</span><b>${a.claude?.avgCostPerCheck ?? '–'}</b></div>
      <div className="cq-u-row"><span>DataForSEO balance</span><b>{d.ok ? `$${Number(d.balance).toFixed(2)}` : 'error'}</b></div>
      <div className="cq-faint">{a.claude?.priceNote}</div>
    </div>
  );
}

export default function Checker() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');

  const [listErr, setListErr] = useState('');
  const [usage, setUsage] = useState(null);
  async function loadList() {
    try {
      const r = await fetch('/api/results', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setList(j.results || []); setListErr(''); return j.results || [];
    } catch (e) { setListErr(`Could not load list: ${e.message}`); return []; }
  }
  async function loadUsage() {
    const j = await fetch('/api/usage', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setUsage(j);
  }
  useEffect(() => { loadList(); loadUsage(); }, []);

  async function check(e) {
    e?.preventDefault(); if (!url || busy) return;
    setBusy(true); setErr(''); setResult(null);
    const started = Date.now();
    let r, j;
    try {
      r = await fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      j = await r.json().catch(() => ({ error: 'Request failed or timed out' }));
    } catch { j = { error: 'Connection dropped while checking.' }; }
    const fresh = await loadList(); loadUsage();
    setBusy(false);
    if (r?.ok) return setResult(j);
    // request failed on our side, but the server may have finished: open the saved result if there is one
    const saved = fresh.find(x => x.url && url.includes(new URL(x.url).pathname) && Date.parse(x.scoredAt) >= started - 5000);
    if (saved) return open(saved.crawlId);
    setErr(j?.error || 'Something went wrong');
  }
  async function open(id) {
    setErr(''); setResult(null); setBusy(true);
    const j = await fetch(`/api/results?id=${id}`).then(r => r.json());
    setBusy(false); setResult(j);
  }

  const shown = list.filter(x => !q || (x.url + ' ' + (x.title || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="head"><div className="bar">
        <a className="logo" href="/"><img src="/logo.png" alt="GameBoost" /></a><span className="ver">Content Quality</span>
        <form className="search cq-urlform" onSubmit={check}>
          <input placeholder="Paste a gameboost.com URL to check…" value={url} onChange={e => setUrl(e.target.value)} />
        </form>
        <button className="btn primary" onClick={check} disabled={busy || !url}>{busy ? 'Checking…' : 'Check page'}</button>
        <div className="meta"><a className="logout" href="/api/logout">Log out</a></div>
      </div></div>
      <div className="wrap cq-layout">
        <aside className="cq-side">
          <Usage u={usage} onRefresh={loadUsage} />
          {listErr && <div className="cq-err">{listErr}</div>}
          <div className="cq-side-head">Checked pages <span>{list.length}</span></div>
          <input className="cq-filter" placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} />
          {shown.map(x => (
            <button key={x.crawlId} className={`cq-item ${result?.crawlId === x.crawlId ? 'active' : ''}`} onClick={() => open(x.crawlId)}>
              <b style={{ color: color(x.overall) }}>{x.overall == null ? '–' : x.overall.toFixed(1)}</b>
              <span><span className="cq-item-path">{path(x.url)}</span><span className="cq-item-meta">{x.pageType} · {fmtDate(x.scoredAt)}</span></span>
            </button>
          ))}
          {!list.length && <div className="cq-empty-side">No pages checked yet.</div>}
        </aside>
        <main>
          {err && <div className="cq-err">{err}</div>}
          {busy && <div className="cq-busy"><div className="cq-spin" />Crawling the page and running ~40 checks. Takes 30 to 90 seconds.</div>}
          {!busy && result && <Result r={result} />}
          {!busy && !result && !err && <div className="cq-empty">Paste a URL above, or pick a checked page on the left.</div>}
        </main>
      </div>
    </>
  );
}
