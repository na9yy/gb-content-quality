// Fire a request to our own API without waiting for it to finish (used to run queue workers in the background).
export async function fireSelf(origin, path, body) {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${process.env.CRON_SECRET}` };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const p = fetch(`${origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) }).catch(() => {});
  // Give the request time to leave this function, then move on.
  await Promise.race([p, new Promise(r => setTimeout(r, 1500))]);
}
