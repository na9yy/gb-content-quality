import { createClient } from '@supabase/supabase-js';

// Server-only client. Never import this in client components.
// cache: 'no-store' stops Next.js from caching database reads (otherwise lists go stale).
const noStore = (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' });

export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: noStore } });
}
