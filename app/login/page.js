'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (r.ok) { try { sessionStorage.setItem('gb_cq_login', '1'); } catch (e) {} window.location.href = '/'; } else setErr('Wrong password. Try again.');
  }
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="GameBoost" className="login-logo" />
        <div className="login-title">Content Quality</div>
        <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} autoFocus />
        {err && <div className="login-err">{err}</div>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? 'Checking…' : 'Log in'}</button>
      </form>
    </div>
  );
}
