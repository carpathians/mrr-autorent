import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    const data = await getMrrClient().getAccountBalances();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
