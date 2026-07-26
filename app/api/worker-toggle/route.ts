import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getConfig, setConfig } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    ensureDb();
    const body = await req.json().catch(() => ({}));
    const enabled = Boolean(body?.enabled);
    setConfig('worker_enabled', enabled ? 'true' : 'false');
    return NextResponse.json({
      enabled,
      lastCheck: getConfig('last_check') || null,
      nextCheck: getConfig('next_check') || null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
