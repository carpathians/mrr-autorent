import { NextResponse } from 'next/server';
import { ensureDb, getConfig, getMrrClient } from '@/lib/server';
import { buildCandidates, decideRentAction } from '@/lib/candidates.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withDecision(snap: Record<string, unknown>) {
  const decision = decideRentAction({
    waitEndingBetterPct: getConfig('wait_ending_better_pct'),
    waitEndingMaxMin: getConfig('wait_ending_max_min'),
  });
  return { ...snap, decision };
}

export async function POST() {
  try {
    ensureDb();
    const client = getMrrClient();
    const data = await buildCandidates(client);
    return NextResponse.json({ success: true, data: withDecision(data) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
