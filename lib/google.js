// Parse a Google service account JSON from an env var, forgiving common paste mistakes.
export function parseServiceAccount(raw) {
  if (!raw) return { error: 'missing' };
  let s = raw.trim();
  const tries = [];
  tries.push(s);
  // wrapped in quotes / escaped as a JSON string
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { tries.push(JSON.parse(s)); } catch { tries.push(s.slice(1, -1)); }
  }
  // smart quotes from TextEdit / Notes
  tries.push(s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"));
  // base64 encoded file
  if (/^[A-Za-z0-9+/=\s]+$/.test(s)) { try { tries.push(Buffer.from(s, 'base64').toString('utf8')); } catch {} }
  for (const t of tries) {
    try {
      const sa = typeof t === 'string' ? JSON.parse(t) : t;
      if (sa && sa.client_email && sa.private_key) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
        return { sa };
      }
    } catch {}
  }
  return { error: 'not valid service account JSON', diag: diagnose(s) };
}

function diagnose(s) {
  return {
    length: s.length,
    starts_with: s.slice(0, 1),
    ends_with: s.slice(-1),
    has_type_service_account: s.includes('service_account'),
    has_client_email: s.includes('client_email'),
    has_private_key_field: s.includes('"private_key"'),
    has_begin_private_key: s.includes('BEGIN PRIVATE KEY'),
    has_smart_quotes: /[“”]/.test(s),
    hint: !s.includes('client_email') && s.includes('BEGIN PRIVATE KEY')
      ? 'Only the private key was pasted. Paste the whole .json file.'
      : !s.trim().endsWith('}') ? 'Looks cut off. The value should end with }.' : 'Check the paste.'
  };
}
