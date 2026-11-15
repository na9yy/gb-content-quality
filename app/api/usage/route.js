import { NextResponse } from 'next/server';
import { getUsage } from '@/lib/usage';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export async function GET() { return NextResponse.json(await getUsage()); }
