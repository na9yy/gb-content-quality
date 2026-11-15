'use client';
import { useEffect, useState } from 'react';
import { color, human, fmtDate, fmtDay, path, n, sc, DIMS, api, Gauge, Delta } from './ui';

function Dimension({ d, prev }) {
  const [open, setOpen] = useState(false);
  const delta = prev && d.score != null && prev.score != null ? Math.round((d.score - prev.score) * 10) / 10 : null;
  const prevV = prev ? Object.fromEntries((prev.checks || []).map(c => [c.key, c.verdict])) : {};
  return (
    <div className="cq-dim">
      <button className="cq-dim-head" onClick={() => setOpen(!open)}>
        <div className="cq-dim-title">{d.label}{!d.inOverall && <span className="cq-tag">Not in overall</span>}</div>
        <div className="cq-dim-score">{delta != null && <Delta v={delta} />} <span style={{ color: color(d.score) }}>{d.verdict}</span> <b>{sc(d.score)}</b><i>/ 5</i></div>
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
                <div className="cq-check-name">{human(c.key)} <span className="cq-method">{c.method === 'llm' ? 'AI' : 'Code'}</span>{c.weight > 1 && <span className="cq-method">Critical</span>}
                  {prev && prevV[c.key] && prevV[c.key] !== c.verdict && <span className="cq-flip">was {prevV[c.key]}</span>}</div>
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

function GscPanel({ r }) {
  const [g, setG] = useState(r.gsc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setG(r.gsc); setErr(''); }, [r.crawlId]);
  async function refresh() { setBusy(true); setErr(''); try { setG(await api('/api/gsc', { method: 'POST', body: JSON.stringify({ pageId: r.pageId }) })); } catch (e) { setErr(e.message); } setBusy(false); }
  const l = g?.last28;
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>Search Console</b><span className="cq-faint-i">{g?.last28 ? `${fmtDay(g.last28.start)} – ${fmtDay(g.last28.end)}` : ''}</span><button className="btn sm" onClick={refresh} disabled={busy}>{busy ? 'Loading…' : g ? 'Refresh' : 'Load GSC data'}</button></div>
      {err && <div className="cq-err sm">{err.includes('403') || err.includes('permission') ? `${err}. Check the service account has access to the property and the Search Console API is enabled.` : err}</div>}
      {!g && !err && <div className="cq-faint-i">No GSC data yet.</div>}
      {l && (
        <>
          <div className="cq-kpis">
            <div><span>Clicks 28d</span><b>{n(l.clicks)}</b><Delta v={g.clicksChange} suffix="%" /></div>
            <div><span>Impressions 28d</span><b>{n(l.impressions)}</b><Delta v={g.impressionsChange} suffix="%" /></div>
            <div><span>CTR</span><b>{l.ctr == null ? '–' : (l.ctr * 100).toFixed(1) + '%'}</b></div>
            <div><span>Avg position</span><b>{l.position ?? '–'}</b></div>
            <div><span>Clicks 90d</span><b>{n(g.last90?.clicks)}</b></div>
          </div>
          {!!g.topQueries?.length && (
            <table className="cq-table sm"><thead><tr><th>Top queries (90d)</th><th>Clicks</th><th>Impr.</th><th>Pos.</th></tr></thead>
              <tbody>{g.topQueries.map(q => <tr key={q.q}><td>{q.q}</td><td>{n(q.clicks)}</td><td>{n(q.impressions)}</td><td>{q.position}</td></tr>)}</tbody></table>
          )}
        </>
      )}
    </div>
  );
}

function Suggestions({ r }) {
  const [s, setS] = useState(r.suggestions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setS(r.suggestions); setErr(''); }, [r.crawlId]);
  async function run() { setBusy(true); setErr(''); try { setS(await api('/api/suggest', { method: 'POST', body: JSON.stringify({ crawlId: r.crawlId }) })); } catch (e) { setErr(e.message); } setBusy(false); }
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>Fix suggestions</b><span className="cq-faint-i">{s?.createdAt ? `Generated ${fmtDate(s.createdAt)}` : 'Concrete fixes for every failed or unclear check'}</span>
        <button className="btn sm primary" onClick={run} disabled={busy}>{busy ? 'Writing fixes… (~30s)' : s ? 'Regenerate' : 'Suggest fixes'}</button></div>
      {err && <div className="cq-err sm">{err}</div>}
      {s?.note && <div className="cq-faint-i">{s.note}</div>}
      {s?.items?.map((it, i) => (
        <div key={i} className="cq-sug">
          <div className="cq-sug-head"><span className={`cq-prio cq-prio-${it.priority}`}>{it.priority}</span><b>{human(it.check_key)}</b>{it.dimension && <span className="cq-method">{human(it.dimension)}</span>}</div>
          <div className="cq-reason"><b>Problem:</b> {it.problem}</div>
          <div className="cq-reason"><b>Fix:</b> {it.fix}</div>
          {it.example && <div className="cq-example"><div className="cq-ex-head">Example <button className="cq-link" onClick={() => navigator.clipboard?.writeText(it.example)}>Copy</button></div>{it.example}</div>}
        </div>
      ))}
    </div>
  );
}

function History({ r, onOpen, onCompare, compareId }) {
  const [h, setH] = useState(null);
  useEffect(() => { if (r.pageId) api(`/api/history?pageId=${r.pageId}`).then(j => setH(j.history)).catch(() => setH([])); }, [r.pageId, r.crawlId]);
  if (!h || h.length < 2) return <div className="cq-panel"><div className="cq-panel-head"><b>Score history</b></div><div className="cq-faint-i">{h ? 'Only one check so far. Re-check the page after an update to see the diff.' : 'Loading…'}</div></div>;
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>Score history</b><span className="cq-faint-i">{h.length} checks · click Compare to see what changed</span></div>
      <table className="cq-table sm">
        <thead><tr><th>Date</th><th>Overall</th>{DIMS.map(([k, l]) => <th key={k} title={l}>{l.split(' ')[0].slice(0, 6)}</th>)}<th>Words</th><th></th></tr></thead>
        <tbody>{h.map((x, i) => {
          const p = h[i + 1];
          return (
            <tr key={x.crawlId} className={x.crawlId === r.crawlId ? 'cur' : ''}>
              <td><button className="cq-link" onClick={() => onOpen(x.crawlId)}>{fmtDate(x.scoredAt)}</button></td>
              <td><b style={{ color: color(x.overall) }}>{sc(x.overall)}</b> {p && <Delta v={x.overall != null && p.overall != null ? Math.round((x.overall - p.overall) * 10) / 10 : null} />}</td>
              {DIMS.map(([k]) => <td key={k} style={{ color: color(x.dims[k]) }}>{sc(x.dims[k])}</td>)}
              <td>{n(x.wordCount)} {p && x.wordCount != null && p.wordCount != null && x.wordCount !== p.wordCount && <Delta v={x.wordCount - p.wordCount} suffix="" />}</td>
              <td>{x.crawlId !== r.crawlId && <button className="cq-link" onClick={() => onCompare(compareId === x.crawlId ? null : x.crawlId)}>{compareId === x.crawlId ? 'Stop' : 'Compare'}</button>}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function ContentDiff({ cur, prev }) {
  const a = new Set(prev.meta?.headings || []), b = new Set(cur.meta?.headings || []);
  const added = [...b].filter(x => !a.has(x)), removed = [...a].filter(x => !b.has(x));
  return (
    <div className="cq-panel cq-diff">
      <div className="cq-panel-head"><b>Compared with {fmtDate(prev.scoredAt)}</b><span className="cq-faint-i">Deltas and flipped checks are shown on each dimension below</span></div>
      <div className="cq-kpis">
        <div><span>Overall</span><b>{sc(prev.overall)} → {sc(cur.overall)}</b><Delta v={cur.overall != null && prev.overall != null ? Math.round((cur.overall - prev.overall) * 10) / 10 : null} /></div>
        <div><span>Words</span><b>{n(prev.wordCount)} → {n(cur.wordCount)}</b></div>
        <div><span>Modified date</span><b>{fmtDay(prev.meta?.dateModified) || '–'} → {fmtDay(cur.meta?.dateModified) || '–'}</b></div>
      </div>
      {(added.length > 0 || removed.length > 0) && <div className="cq-headdiff">
        {added.map(x => <div key={'a' + x} className="add">+ {x}</div>)}
        {removed.map(x => <div key={'r' + x} className="rem">− {x}</div>)}
      </div>}
    </div>
  );
}

function LabelForm({ r, onSaved }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState('');
  const [vals, setVals] = useState({});
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { try { setBy(localStorage.getItem('cq_labeler') || ''); } catch {} }, []);
  async function save() {
    setMsg('');
    try { try { localStorage.setItem('cq_labeler', by); } catch {}
      const j = await api('/api/calibration', { method: 'POST', body: JSON.stringify({ pageId: r.pageId, labeledBy: by, scores: vals, note }) });
      setMsg(`Saved ${j.saved} scores.`); onSaved?.();
    } catch (e) { setMsg(e.message); }
  }
  return (
    <div className="cq-panel">
      <div className="cq-panel-head"><b>Calibrate: score this page yourself</b><span className="cq-faint-i">Score it blind first, before reading the tool's scores</span><button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Add my scores'}</button></div>
      {open && <>
        <div className="cq-label-grid">
          {[...DIMS, ['overall', 'Overall']].map(([k, l]) => (
            <label key={k}><span>{l}</span>
              <span className="cq-stars">{[1, 2, 3, 4, 5].map(v => <button key={v} className={vals[k] === v ? 'on' : ''} onClick={() => setVals({ ...vals, [k]: vals[k] === v ? undefined : v })}>{v}</button>)}</span>
            </label>
          ))}
        </div>
        <div className="cq-row">
          <input className="cq-input" placeholder="Your name" value={by} onChange={e => setBy(e.target.value)} />
          <input className="cq-input grow" placeholder="Note (optional): why you scored it this way" value={note} onChange={e => setNote(e.target.value)} />
          <button className="btn primary sm" onClick={save} disabled={!by || !Object.values(vals).some(Boolean)}>Save</button>
        </div>
        {msg && <div className="cq-faint-i">{msg}</div>}
      </>}
    </div>
  );
}

export default function Result({ r, onOpen }) {
  const [compareId, setCompareId] = useState(null);
  const [prev, setPrev] = useState(null);
  useEffect(() => { setCompareId(null); setPrev(null); }, [r.crawlId]);
  useEffect(() => { if (compareId) api(`/api/results?id=${compareId}`).then(setPrev).catch(() => setPrev(null)); else setPrev(null); }, [compareId]);
  const prevDim = k => prev?.dimensions?.find(d => d.dim === k);
  return (
    <div className="cq-result">
      <div className="cq-result-head">
        <div className="cq-crumb">{r.draft ? 'Draft · ' : ''}{r.pageType} · {r.game || '–'} · {n(r.wordCount)} words · {fmtDate(r.scoredAt)}</div>
        {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="cq-url">{path(r.url)} ↗</a> : <div className="cq-url">{r.title}</div>}
        {r.url && <div className="cq-title">{r.title}</div>}
      </div>
      <div className="cq-overall">
        <div className="cq-overall-card">
          <div className="cq-label">Overall score</div>
          <Gauge score={r.overall} />
          <div className="cq-verdict" style={{ color: color(r.overall) }}>{r.verdict || ''}</div>
          {r.isYmyl && <div className="cq-ymyl">YMYL page: Trust counts double</div>}
          {r.meta?.author && <div className="cq-faint" style={{ textAlign: 'center' }}>Author: {r.meta.author}</div>}
        </div>
        <div className="cq-mini">
          {r.dimensions.map(d => <div key={d.dim} className="cq-mini-row"><span>{d.label}</span><b style={{ color: color(d.score) }}>{sc(d.score)}</b></div>)}
        </div>
      </div>
      {!r.draft && r.pageId && <GscPanel r={r} />}
      {!r.draft && r.pageId && <History r={r} onOpen={onOpen} onCompare={setCompareId} compareId={compareId} />}
      {prev && <ContentDiff cur={r} prev={prev} />}
      <div className="cq-dims">{r.dimensions.map(d => <Dimension key={d.dim} d={d} prev={prevDim(d.dim)} />)}</div>
      {!r.draft && r.crawlId && <Suggestions r={r} />}
      {!r.draft && r.pageId && <LabelForm r={r} />}
      <div className="cq-foot">{r.meta?.model ? `Judge: ${r.meta.model} · ` : ''}Only the page text is scored. Speed, layout and images are not.</div>
    </div>
  );
}
