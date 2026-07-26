import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';
import { listRigs } from '@/lib/rigs.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    ensureDb();
    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    const data = await listRigs(getMrrClient(), query);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
