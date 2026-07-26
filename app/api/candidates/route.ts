import { NextResponse } from 'next/server';
import { ensureDb, getConfig, getMrrClient } from '@/lib/server';
import { getCandidateSnapshot, decideRentAction } from '@/lib/candidates.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withDecision(snap: Record<string, unknown>) {
  const decision = decideRentAction({
    waitEndingBetterPct: getConfig('wait_ending_better_pct'),
    waitEndingMaxMin: getConfig('wait_ending_max_min'),
  });
  return { ...snap, decision };
}

export async function GET() {
  try {
    ensureDb();
    getMrrClient();
    return NextResponse.json({
      success: true,
      data: withDecision(getCandidateSnapshot()),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
