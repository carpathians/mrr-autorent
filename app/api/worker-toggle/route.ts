import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getConfig, setConfig } from '@/lib/server';
import { addWorkerLog } from '@/lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    ensureDb();
    const body = await req.json().catch(() => ({}));
    const enabled = Boolean(body?.enabled);
    setConfig('worker_enabled', enabled ? 'true' : 'false');
    addWorkerLog(
      enabled ? 'start' : 'stop',
      enabled
        ? 'Rent loop enabled via UI (worker process must be running)'
        : 'Rent loop disabled via UI',
    );
    const heartbeat = getConfig('worker_heartbeat') || null;
    const hbAgeMs = heartbeat
      ? Math.max(0, Date.now() - new Date(heartbeat).getTime())
      : null;
    return NextResponse.json({
      enabled,
      alive: hbAgeMs != null && hbAgeMs < 120_000,
      heartbeat,
      lastCheck: getConfig('last_check') || null,
      nextCheck: getConfig('next_check') || null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
