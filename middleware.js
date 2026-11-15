import { NextResponse } from 'next/server';
import { COOKIE, authToken } from './lib/auth';

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.png|logo.png|icon.png|login|api/login|api/health|api/cron|api/queue/worker).*)'] };

export async function middleware(req) {
  if (!process.env.DASHBOARD_PASSWORD) {
    return new NextResponse('Setup needed: add DASHBOARD_PASSWORD in Vercel environment variables, then redeploy.', { status: 500 });
  }
  const got = req.cookies.get(COOKIE)?.value;
  if (got && got === (await authToken())) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
  return NextResponse.redirect(url);
}
