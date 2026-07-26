import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';
import { syncProfit } from '@/lib/profit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    ensureDb();
    const data = await syncProfit(getMrrClient());
    return NextResponse.json(data);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
