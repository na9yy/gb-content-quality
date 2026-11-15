import crypto from 'node:crypto';

// Parse a Google service account JSON from an env var, forgiving common paste mistakes.
export function parseServiceAccount(raw) {
  if (!raw) return { error: 'missing' };
  const s = raw.trim();
  const tries = [s];
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { tries.push(JSON.parse(s)); } catch { tries.push(s.slice(1, -1)); }
  }
  tries.push(s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"));
  if (/^[A-Za-z0-9+/=\s]+$/.test(s)) { try { tries.push(Buffer.from(s, 'base64').toString('utf8')); } catch {} }
  for (const t of tries) {
    try {
      const sa = typeof t === 'string' ? JSON.parse(t) : t;
      if (sa && sa.client_email && sa.private_key) { sa.private_key = sa.private_key.replace(/\\n/g, '\n'); return { sa }; }
    } catch {}
  }
  return { error: 'not valid service account JSON', diag: diagnose(s) };
}

function diagnose(s) {
  return {
    length: s.length, starts_with: s.slice(0, 1), ends_with: s.slice(-1),
    has_client_email: s.includes('client_email'), has_private_key_field: s.includes('"private_key"'), has_begin_private_key: s.includes('BEGIN PRIVATE KEY'),
    hint: !s.includes('client_email') && s.includes('BEGIN PRIVATE KEY') ? 'Only the private key was pasted. Paste the whole .json file.' : !s.trim().endsWith('}') ? 'Looks cut off. The value should end with }.' : 'Check the paste.',
  };
}

export function serviceAccount() {
  const { sa, error } = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa) throw new Error(`Google service account: ${error}`);
  return sa;
}

const tokens = {};
export async function googleToken(scope) {
  const hit = tokens[scope];
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Google auth: ${j.error_description || j.error}`);
  tokens[scope] = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}
