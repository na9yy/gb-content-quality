export const COOKIE = 'gb_cq_auth';
export async function authToken() {
  const pw = process.env.DASHBOARD_PASSWORD || '';
  const secret = process.env.AUTH_SECRET || 'gb-cq';
  const data = new TextEncoder().encode(`${pw}::${secret}::gb-cq`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
