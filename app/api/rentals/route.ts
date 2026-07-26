import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    ensureDb();
    const type = req.nextUrl.searchParams.get('type') || undefined;
    const history = req.nextUrl.searchParams.get('history');
    const opts: Record<string, unknown> = {};
    if (type) opts.type = type;
    if (history !== null && history !== undefined) {
      opts.history = history === 'true' ? 1 : 0;
    }
    const data = await getMrrClient().listRentals(opts);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
