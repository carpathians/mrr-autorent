import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';
import { getProfit } from '@/lib/profit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    ensureDb();
    const startDate = req.nextUrl.searchParams.get('startDate') || '';
    const endDate = req.nextUrl.searchParams.get('endDate') || '';
    const nosync = req.nextUrl.searchParams.get('nosync') || '';
    const data = await getProfit(getMrrClient(), {
      startDate,
      endDate,
      nosync,
    } as { startDate?: string; endDate?: string; nosync?: string });
    return NextResponse.json(data);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
