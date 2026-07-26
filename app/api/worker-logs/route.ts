import { NextRequest, NextResponse } from 'next/server';
import { getWorkerLogs } from '@/lib/db.js';
import { ensureDb } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    ensureDb();
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 500);
    const action = req.nextUrl.searchParams.get('action') || undefined;
    const logs = getWorkerLogs(limit, action ? { action } : undefined);
    return NextResponse.json(Array.isArray(logs) ? logs : []);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
