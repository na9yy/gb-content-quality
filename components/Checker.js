'use client';
import { useEffect, useState } from 'react';
import { color, fmtDate, path, sc, api, Usage } from './ui';
import Result from './Result';
import { ImportView, PrepublishView, TeamView, AlertsView, CalibrationView } from './Views';

const TABS = [['pages', 'Pages'], ['import', 'Import'], ['draft', 'Pre-publish'], ['team', 'Team'], ['alerts', 'Alerts'], ['calibration', 'Calibration']];

export default function Checker() {
  const [tab, setTab] = useState('pages');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [list, setList] = useState([]);
  const [listErr, setListErr] = useState('');
  const [usage, setUsage] = useState(null);
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [sort, setSort] = useState('date');
  const [alertCount, setAlertCount] = useState(null);

  async function loadList() {
    try { const j = await api('/api/results'); setList(j.results || []); setListErr(''); return j.results || []; }
    catch (e) { setListErr(`Could not load list: ${e.message}`); return []; }
  }
  const loadUsage = () => api('/api/usage').then(setUsage).catch(() => {});
  // Reload the list every time you open the Pages tab, and every 20s while it's open.
  useEffect(() => {
    if (tab !== 'pages') return;
    loadList();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadList(); }, 20000);
    return () => clearInterval(t);
  }, [tab]);
  useEffect(() => { loadUsage(); api('/api/alerts').then(j => setAlertCount(j.alerts.filter(x => x.severity === 'high').length)).catch(() => {}); }, []);

  async function check(e) {
    e?.preventDefault(); if (!url || busy) return;
    setTab('pages'); setBusy(true); setErr(''); setResult(null);
    const started = Date.now();
    let ok = false, j;
    try { j = await api('/api/check', { method: 'POST', body: JSON.stringify({ url }) }); ok = true; }
    catch (e2) { j = { error: e2.message }; }
    const fresh = await loadList(); loadUsage();
    setBusy(false);
    if (ok) return setResult(j);
    const saved = fresh.find(x => x.url && url.includes(path(x.url)) && Date.parse(x.scoredAt) >= started - 5000);
    if (saved) return open(saved.crawlId);
    setErr(j?.error || 'Something went wrong');
  }
  async function open(id) {
    setTab('pages'); setErr(''); setBusy(true);
    try { setResult(await api(`/api/results?id=${id}`)); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  // Latest check per page for the list; history lives inside each result.
  const latest = Object.values(list.reduce((a, x) => { if (!a[x.url] || a[x.url].scoredAt < x.scoredAt) a[x.url] = x; return a; }, {}));
  const shown = latest
    .filter(x => (typeF === 'all' || x.pageType === typeF) && (!q || `${x.url} ${x.title || ''} ${x.game || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'low' ? (a.overall ?? 9) - (b.overall ?? 9) : sort === 'high' ? (b.overall ?? 0) - (a.overall ?? 0) : b.scoredAt.localeCompare(a.scoredAt));

  return (
    <>
      <div className="head">
        <div className="bar">
          <a className="logo" href="/"><img src="/logo.png" alt="GameBoost" /></a><span className="ver">Content Quality</span>
          <form className="search cq-urlform" onSubmit={check}><input placeholder="Paste a gameboost.com URL to check…" value={url} onChange={e => setUrl(e.target.value)} /></form>
          <button className="btn primary" onClick={check} disabled={busy || !url}>{busy && tab === 'pages' ? 'Checking…' : 'Check page'}</button>
          <div className="meta"><a className="logout" href="/api/logout">Log out</a></div>
        </div>
        <div className="bar"><div className="seg-row">
          {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''} ${k === 'alerts' && alertCount ? 'alert' : ''}`} onClick={() => setTab(k)}>{l}{k === 'pages' && <span className="n">{latest.length}</span>}{k === 'alerts' && alertCount != null && <span className="n">{alertCount}</span>}</button>)}
        </div></div>
      </div>
      <div className="wrap">
        {tab === 'pages' && (
          <div className="cq-layout">
            <aside className="cq-side">
              <Usage u={usage} onRefresh={loadUsage} />
              {listErr && <div className="cq-err sm">{listErr}</div>}
              <div className="cq-side-head">Checked pages <span>{latest.length} <button className="cq-link" onClick={loadList}>Refresh</button></span></div>
              <input className="cq-filter" placeholder="Filter by URL, title, game…" value={q} onChange={e => setQ(e.target.value)} />
              <div className="cq-row tight">
                <select className="sel" value={typeF} onChange={e => setTypeF(e.target.value)}><option value="all">All types</option><option value="blog">Blogs</option><option value="review">Reviews</option><option value="product">Products</option></select>
                <select className="sel" value={sort} onChange={e => setSort(e.target.value)}><option value="date">Newest</option><option value="low">Lowest score</option><option value="high">Highest score</option></select>
              </div>
              {shown.map(x => (
                <button key={x.crawlId} className={`cq-item ${result?.pageId && result?.url === x.url ? 'active' : ''}`} onClick={() => open(x.crawlId)}>
                  <b style={{ color: color(x.overall) }}>{sc(x.overall)}</b>
                  <span><span className="cq-item-path">{path(x.url)}</span><span className="cq-item-meta">{x.pageType} · {fmtDate(x.scoredAt)}</span></span>
                </button>
              ))}
              {!latest.length && !listErr && <div className="cq-empty-side">No pages checked yet.</div>}
            </aside>
            <main>
              {err && <div className="cq-err">{err}</div>}
              {busy && <div className="cq-busy"><div className="cq-spin" />Crawling the page and running ~40 checks. Takes 30 to 90 seconds.</div>}
              {!busy && result && <Result r={result} onOpen={open} />}
              {!busy && !result && !err && <div className="cq-empty">Paste a URL above, pick a page on the left, or bulk-add pages in the Import tab.</div>}
            </main>
          </div>
        )}
        {tab === 'import' && <ImportView onChanged={() => { loadList(); }} />}
        {tab === 'draft' && <PrepublishView />}
        {tab === 'team' && <TeamView />}
        {tab === 'alerts' && <AlertsView onOpen={open} onCount={setAlertCount} />}
        {tab === 'calibration' && <CalibrationView onOpen={open} />}
      </div>
    </>
  );
}
