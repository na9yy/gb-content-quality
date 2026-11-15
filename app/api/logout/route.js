import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
import { COOKIE } from '@/lib/auth';

export async function GET(req) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
