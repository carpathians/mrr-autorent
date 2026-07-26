import { NextResponse } from 'next/server';
import { ensureDb, getConfig } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    const enabled = getConfig('worker_enabled') === 'true';
    const lastCheck = getConfig('last_check') || null;
    const nextCheck = getConfig('next_check') || null;
    const cooldownUntil = getConfig('rent_cooldown_until') || null;
    const coolMs = cooldownUntil
      ? Math.max(0, new Date(cooldownUntil).getTime() - Date.now())
      : 0;
    const coolCfg = parseFloat(getConfig('rent_cooldown_min') || '');
    return NextResponse.json({
      enabled,
      lastCheck,
      nextCheck,
      lastRentAt: getConfig('last_rent_at') || null,
      cooldownUntil: coolMs > 0 ? cooldownUntil : null,
      cooldownRemainingMin: coolMs > 0 ? Math.ceil(coolMs / 60000) : 0,
      cooldownMin: Number.isFinite(coolCfg) && coolCfg >= 0 ? coolCfg : 30,
      candidateIntervalSec: 60,
      rentIntervalMin: 3,
      candidates: {
        updated_at: getConfig('candidates_updated_at') || null,
        count: parseInt(getConfig('candidates_count') || '0', 10) || 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
