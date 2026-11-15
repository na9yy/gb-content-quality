'use client';
import { useEffect, useRef, useState } from 'react';
import { color, human, fmtDate, path, n, sc, DIMS, api } from './ui';
import Result from './Result';

/* ---------- Import ---------- */
export function ImportView({ onChanged }) {
  const [urls, setUrls] = useState('');
  const [sitemap, setSitemap] = useState('');
  const [filter, setFilter] = useState('');
  const [max, setMax] = useState(200);
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState('');
  const [workers, setWorkers] = useState(3);
  const lastDone = useRef(null);
  const load = () => api('/api/import').then(j => {
    setSt(j);
    const d = (j.counts?.done || 0) + (j.counts?.skipped || 0);
    if (lastDone.current != null && d !== lastDone.current) onChanged?.();
    lastDone.current = d;
  }).catch(e => setMsg(e.message));
  const c = st?.counts || {};
  const active = (c.pending || 0) + (c.running || 0) > 0;
  useEffect(() => { load(); }, []);
  // Auto-refresh while the queue is working.
  useEffect(() => { if (!active) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [active]);

  async function add(andStart) {
    setMsg('Adding…');
    try { const j = await api('/api/import', { method: 'POST', body: JSON.stringify({ urls, sitemap, filter, max }) });
      setMsg(`Found ${j.found} URLs. Added ${j.added} to the queue${j.skipped ? `, ${j.skipped} already queued` : ''}.`); setUrls('');
      if (andStart && j.added) await start(); else load();
    } catch (e) { setMsg(e.message); }
  }
  async function start() {
    try { const j = await api('/api/queue/start', { method: 'POST', body: JSON.stringify({ workers }) });
      setMsg(j.started ? `Started ${j.started} background worker${j.started > 1 ? 's' : ''}${j.alreadyRunning ? ` (${j.alreadyRunning} already running)` : ''}. You can close this tab.` : j.pending ? `${j.alreadyRunning} workers already running.` : 'Nothing pending.');
      setTimeout(load, 2500);
    } catch (e) { setMsg(e.message); }
  }
  async function clear(what) { setSt(await api(`/api/import?what=${what}`, { method: 'DELETE' })); }
  const total = (c.pending || 0) + (c.running || 0) + (c.done || 0) + (c.skipped || 0) + (c.error || 0);
  const fin = (c.done || 0) + (c.skipped || 0) + (c.error || 0);
  const eta = active ? Math.ceil(((c.pending || 0) + (c.running || 0)) * 25 / Math.max(1, c.running || workers) / 60) : 0;
  return (
    <div className="cq-grid2">
      <div className="cq-panel">
        <div className="cq-panel-head"><b>Import pages</b></div>
        <p className="cq-help">Paste URLs (one per line) and/or a sitemap. Pages go into a queue that runs on the server, so you can close the tab. Pages whose content hasn't changed since the last check are skipped, so re-importing is cheap. Each new check costs 1 Firecrawl credit plus Claude tokens.</p>
        <textarea className="cq-textarea" rows={7} placeholder={'https://gameboost.com/blog/...\nhttps://gameboost.com/fortnite/accounts'} value={urls} onChange={e => setUrls(e.target.value)} />
        <div className="cq-row"><input className="cq-input grow" placeholder="Sitemap URL (optional), e.g. https://gameboost.com/sitemap.xml" value={sitemap} onChange={e => setSitemap(e.target.value)} /></div>
        <div className="cq-row">
          <input className="cq-input grow" placeholder="Only URLs containing… e.g. /blog/" value={filter} onChange={e => setFilter(e.target.value)} />
          <label className="cq-faint-i">Max <input className="cq-input xs" type="number" value={max} onChange={e => setMax(e.target.value)} /></label>
        </div>
        <div className="cq-row">
          <button className="btn primary" onClick={() => add(true)} disabled={!urls.trim() && !sitemap.trim()}>Add and start</button>
          <button className="btn" onClick={() => add(false)} disabled={!urls.trim() && !sitemap.trim()}>Add only</button>
        </div>
        {msg && <div className="cq-faint-i">{msg}</div>}
      </div>
      <div className="cq-panel">
        <div className="cq-panel-head"><b>Queue</b>{active && <span className="cq-live"><span className="cq-dot" />Working · ~{eta} min left</span>}<button className="cq-link" onClick={load}>Refresh</button></div>
        {total > 0 && <div className="cq-bar"><div style={{ width: `${(fin / total) * 100}%`, background: 'var(--up)' }} /></div>}
        <div className="cq-kpis">
          <div><span>Pending</span><b>{n(c.pending)}</b></div><div><span>Running</span><b style={{ color: c.running ? 'var(--blue-light)' : undefined }}>{n(c.running)}</b></div>
          <div><span>Done</span><b style={{ color: 'var(--up)' }}>{n(c.done)}</b></div><div><span>Unchanged</span><b>{n(c.skipped)}</b></div>
          <div><span>Errors</span><b style={{ color: c.error ? 'var(--down)' : undefined }}>{n(c.error)}</b></div>
        </div>
        <div className="cq-row">
          <button className="btn primary" onClick={start} disabled={!c.pending}>Start processing</button>
          <label className="cq-faint-i">Parallel workers <select className="sel" value={workers} onChange={e => setWorkers(Number(e.target.value))}>{[1, 2, 3, 4, 6, 8].map(v => <option key={v}>{v}</option>)}</select></label>
          <button className="btn sm ghost" onClick={() => clear('retry')} disabled={!c.error}>Retry errors</button>
          <button className="btn sm ghost" onClick={() => clear('finished')}>Clear finished</button>
          <button className="btn sm ghost" onClick={() => clear('pending')} disabled={!c.pending}>Stop (clear pending)</button>
        </div>
        <p className="cq-help">Runs on the server: close the tab anytime. ~25s per page per worker, so 4 workers ≈ 10 pages/min. More workers = faster, up to your Firecrawl plan's per-minute limit. If Firecrawl says slow down, pages wait and retry automatically (shown as Waiting), they don't fail. Anything left over also runs nightly at 03:17 UTC.</p>
        <table className="cq-table sm"><thead><tr><th>URL</th><th>Status</th><th>When</th></tr></thead>
          <tbody>{(st?.recent || []).map(q => (
            <tr key={q.id}><td title={q.url}>{path(q.url)}</td><td><span className={`cq-qs cq-qs-${q.status}`}>{q.status === 'skipped' ? 'unchanged' : q.status}</span>{q.error && <div className="cq-faint">{q.error.slice(0, 140)}</div>}</td><td>{fmtDate(q.finished_at || q.started_at || q.created_at)}</td></tr>
          ))}</tbody></table>
      </div>
    </div>
  );
}

/* ---------- Pre-publish ---------- */
export function PrepublishView() {
  const [mode, setMode] = useState('paste');
  const [text, setText] = useState('');
  const [doc, setDoc] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('blog');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [list, setList] = useState({ drafts: [] });
  const load = () => api('/api/draft').then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  async function run() {
    setBusy(true); setErr(''); setRes(null);
    let by = ''; try { by = localStorage.getItem('cq_labeler') || ''; } catch {}
    try { setRes(await api('/api/draft', { method: 'POST', body: JSON.stringify({ text: mode === 'paste' ? text : '', docUrl: mode === 'doc' ? doc : '', title, pageType: type, createdBy: by }) })); load(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="cq-layout">
      <aside className="cq-side">
        <div className="cq-side-head">Recent drafts <span>{list.drafts.length}</span></div>
        {list.drafts.map(d => (
          <button key={d.id} className={`cq-item ${res?.draftId === d.id ? 'active' : ''}`} onClick={async () => { setErr(''); setRes(await api(`/api/draft?id=${d.id}`)); }}>
            <b style={{ color: color(d.overall == null ? null : Number(d.overall)) }}>{sc(d.overall)}</b>
            <span><span className="cq-item-path">{d.title}</span><span className="cq-item-meta">{d.page_type} · {d.source === 'gdoc' ? 'Google Doc' : 'pasted'} · {fmtDate(d.created_at)}</span></span>
          </button>
        ))}
      </aside>
      <main>
        <div className="cq-panel">
          <div className="cq-panel-head"><b>Pre-publish check</b>
            <div className="seg-row">{[['paste', 'Paste text'], ['doc', 'Google Doc']].map(([k, l]) => <button key={k} className={`tab ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>
          </div>
          <p className="cq-help">Score a draft before it goes live. Same rubric as live pages, except checks that need the published page (schema, author, dates) are skipped. Drafts are saved here, not in the Pages list.</p>
          <div className="cq-row">
            <input className="cq-input grow" placeholder="Title / H1 (optional if the draft starts with one)" value={title} onChange={e => setTitle(e.target.value)} />
            <select className="sel" value={type} onChange={e => setType(e.target.value)}><option value="blog">Blog</option><option value="review">Review</option><option value="product">Product page</option></select>
          </div>
          {mode === 'paste'
            ? <textarea className="cq-textarea" rows={12} placeholder="Paste the draft here. Markdown headings (#, ##) help the structure checks." value={text} onChange={e => setText(e.target.value)} />
            : <>
              <input className="cq-input" style={{ width: '100%' }} placeholder="https://docs.google.com/document/d/..." value={doc} onChange={e => setDoc(e.target.value)} />
              <p className="cq-help">Share the doc with <b>{list.serviceEmail || 'the service account email'}</b> as Viewer. The Google Drive API must be enabled in that Google Cloud project.</p>
            </>}
          <div className="cq-row"><button className="btn primary" onClick={run} disabled={busy || (mode === 'paste' ? text.trim().length < 200 : !doc.trim())}>{busy ? 'Scoring… (30–90s)' : 'Check draft'}</button>{mode === 'paste' && <span className="cq-faint-i">{text.trim().split(/\s+/).filter(Boolean).length} words</span>}</div>
          {err && <div className="cq-err">{err}</div>}
        </div>
        {res && <Result r={res} />}
      </main>
    </div>
  );
}

/* ---------- Team ---------- */
function GroupTable({ title, rows, onPick }) {
  const [sort, setSort] = useState('pages');
  const sorted = [...rows].sort((a, b) => sort === 'pages' ? b.pages - a.pages : sort === 'avg' ? (a.avg ?? 9) - (b.avg ?? 9) : (a.dims[sort] ?? 9) - (b.dims[sort] ?? 9));
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>{title}</b><span className="cq-faint-i">Click a column to sort (weakest first)</span></div>
      <div className="cq-scroll"><table className="cq-table">
        <thead><tr><th>Name</th><th className="cq-sortable" onClick={() => setSort('pages')}>Pages</th><th className="cq-sortable" onClick={() => setSort('avg')}>Avg</th><th>&lt; 3.0</th>
          {DIMS.map(([k, l]) => <th key={k} className="cq-sortable" onClick={() => setSort(k)} title={l}>{l.split(' ')[0].slice(0, 7)}</th>)}</tr></thead>
        <tbody>{sorted.map(r => (
          <tr key={r.name}><td>{onPick ? <button className="cq-link" onClick={() => onPick(r.name)}>{r.name}</button> : r.name}</td><td>{r.pages}</td><td><b style={{ color: color(r.avg) }}>{sc(r.avg)}</b></td>
            <td style={{ color: r.below3 ? 'var(--down)' : undefined }}>{r.below3}</td>
            {DIMS.map(([k]) => <td key={k} style={{ color: color(r.dims[k]) }}>{sc(r.dims[k])}</td>)}</tr>
        ))}</tbody></table></div>
    </div>
  );
}
export function TeamView() {
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/team').then(setT).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="cq-err">{err}</div>;
  if (!t) return <div className="cq-busy"><div className="cq-spin" />Loading…</div>;
  return (
    <div>
      <div className="cq-kpis big"><div><span>Pages scored</span><b>{n(t.total)}</b></div><div><span>Average score</span><b style={{ color: color(t.avg) }}>{sc(t.avg)}</b></div></div>
      <p className="cq-help">Based on each page's latest check. Author comes from the page's JSON-LD or author meta tag. "Unknown" means none was found.</p>
      <GroupTable title="By author" rows={t.byAuthor} />
      <GroupTable title="By game" rows={t.byGame} />
      <GroupTable title="By page type" rows={t.byType} />
    </div>
  );
}

/* ---------- Alerts ---------- */
export function AlertsView({ onOpen, onCount }) {
  const [a, setA] = useState(null);
  const [f, setF] = useState('all');
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/alerts').then(j => { setA(j.alerts); onCount?.(j.alerts.filter(x => x.severity === 'high').length); }).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="cq-err">{err}</div>;
  if (!a) return <div className="cq-busy"><div className="cq-spin" />Loading…</div>;
  const types = ['all', ...new Set(a.map(x => x.type))];
  const shown = a.filter(x => f === 'all' || x.type === f);
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>Alerts</b>
        <div className="seg-row">{types.map(t => <button key={t} className={`tab ${f === t ? 'active' : ''}`} onClick={() => setF(t)}>{t === 'all' ? 'All' : t} <span className="n">{t === 'all' ? a.length : a.filter(x => x.type === t).length}</span></button>)}</div>
      </div>
      <p className="cq-help">Rules: overall below 3.0 · score dropped 0.5+ since the last check · blog/review not updated in 6+ months · 3+ low-confidence dimensions · 1,000+ impressions in 28 days with a score under 3.5 · clicks down 30%+ vs the previous 28 days.</p>
      {!shown.length && <div className="cq-faint-i">No alerts. Nice.</div>}
      <table className="cq-table"><tbody>{shown.map((x, i) => (
        <tr key={i}><td><span className={`cq-prio cq-prio-${x.severity}`}>{x.severity}</span></td><td><b>{x.type}</b><div className="cq-faint">{x.message}</div></td>
          <td><button className="cq-link" onClick={() => onOpen(x.crawlId)}>{path(x.url)}</button><div className="cq-faint">{x.pageType}{x.author ? ` · ${x.author}` : ''}</div></td>
          <td><b style={{ color: color(x.overall) }}>{sc(x.overall)}</b></td></tr>
      ))}</tbody></table>
    </div>
  );
}

/* ---------- Calibration ---------- */
export function CalibrationView({ onOpen }) {
  const [c, setC] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/calibration').then(setC).catch(e => setErr(e.message)); }, []);
  const ok = s => s?.within1 >= 80 && Math.abs(s?.mae) <= 0.8;
  return (
    <div>
      <div className="cq-panel">
        <div className="cq-panel-head"><b>How calibration works</b></div>
        <div className="cq-explain">
          <p><b>Why:</b> the tool's scores only matter if they match what a skilled SEO editor would say. Calibration measures that, so you know which dimensions you can trust and which rubric questions need work.</p>
          <ol>
            <li><b>Pick a sample.</b> 20–30 pages: a mix of great, average and weak pages across blogs, reviews and product pages.</li>
            <li><b>Score them blind.</b> Open the page on gameboost.com first and score each dimension 1–5 yourself, before looking at the tool's result. Then open it in the Pages tab and use <i>"Calibrate: score this page yourself"</i>. Two people scoring the same pages is even better.</li>
            <li><b>Read the table below.</b> For each dimension: <i>MAE</i> = average gap between you and the tool (lower is better). <i>Within 1</i> = % of pages where the tool is within 1 point of you. <i>Bias</i> = positive means the tool scores higher than you (too generous), negative means too harsh.</li>
            <li><b>Target:</b> 80%+ within 1 point and MAE under 0.8. A dimension that hits it is trusted (green).</li>
            <li><b>Fix the misses.</b> Open the pages with the biggest gaps, read the tool's checks and quotes, and decide who's right. If the tool is wrong, the rubric question gets reworded or re-weighted. Then re-check those pages and compare again.</li>
          </ol>
          <p className="cq-faint-i">Labels are compared with each page's latest check. If you change the rubric, re-check labelled pages before reading the numbers.</p>
        </div>
      </div>
      {err && <div className="cq-err">{err}</div>}
      {c && !c.perDim.length && <div className="cq-empty">No manual scores yet. Open a page in the Pages tab and click "Add my scores".</div>}
      {c?.perDim?.length > 0 && <>
        <div className="cq-kpis big">
          <div><span>Labels</span><b>{n(c.overall?.n)}</b></div><div><span>Pages</span><b>{n(c.pages.length)}</b></div>
          <div><span>Within 1 point</span><b style={{ color: c.overall?.within1 >= 80 ? 'var(--up)' : 'var(--new)' }}>{c.overall?.within1}%</b></div>
          <div><span>MAE</span><b>{c.overall?.mae}</b></div><div><span>Bias</span><b>{c.overall?.bias > 0 ? '+' : ''}{c.overall?.bias}</b></div>
        </div>
        <div className="cq-panel"><div className="cq-panel-head"><b>Agreement per dimension</b></div>
          <table className="cq-table"><thead><tr><th>Dimension</th><th>Labels</th><th>MAE</th><th>Within 1</th><th>Bias</th><th>Status</th></tr></thead>
            <tbody>{c.perDim.map(d => <tr key={d.dimension}><td>{human(d.dimension)}</td><td>{d.n}</td><td>{d.mae}</td><td>{d.within1}%</td><td>{d.bias > 0 ? '+' : ''}{d.bias}</td>
              <td>{d.n < 10 ? <span className="cq-faint-i">Need 10+ labels</span> : ok(d) ? <span style={{ color: 'var(--up)', fontWeight: 700 }}>Trusted</span> : <span style={{ color: 'var(--new)', fontWeight: 700 }}>Needs work</span>}</td></tr>)}</tbody></table>
        </div>
        <div className="cq-panel"><div className="cq-panel-head"><b>Labelled pages</b><span className="cq-faint-i">Tool vs human, biggest gaps first</span></div>
          <table className="cq-table sm"><thead><tr><th>Page</th><th>Dimension</th><th>Human</th><th>Tool</th><th>Gap</th><th>By</th><th>Note</th></tr></thead>
            <tbody>{c.pages.flatMap(p => p.rows).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).map((r, i) => (
              <tr key={i}><td>{path(r.url)}</td><td>{human(r.dimension)}</td><td>{r.human}</td><td>{sc(r.tool)}</td>
                <td style={{ color: Math.abs(r.diff) > 1 ? 'var(--down)' : Math.abs(r.diff) > 0.5 ? 'var(--new)' : 'var(--up)', fontWeight: 700 }}>{r.diff > 0 ? '+' : ''}{r.diff}</td><td>{r.by}</td><td className="cq-faint">{r.note}</td></tr>
            ))}</tbody></table>
        </div>
      </>}
    </div>
  );
}
