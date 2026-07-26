import { NextRequest, NextResponse } from 'next/server';
import { addRentalLog } from '@/lib/db.js';
import { ensureDb, getConfig, getMrrClient } from '@/lib/server';
import {
  effectiveMinHours,
  getHourCost,
  MRR_MIN_PAID,
} from '@/lib/deals-engine.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveProfileId(client: { listProfiles: () => Promise<unknown> }, body: Record<string, unknown>) {
  if (body.profile || body.profile_id) return Number(body.profile || body.profile_id);
  const fromConfig = getConfig('pool_profile_id');
  if (fromConfig) return Number(fromConfig);

  const profiles = (await client.listProfiles()) as {
    data?: unknown[] | { profiles?: unknown[] };
  };
  const list = Array.isArray(profiles?.data)
    ? profiles.data
    : Array.isArray((profiles?.data as { profiles?: unknown[] })?.profiles)
      ? (profiles.data as { profiles: unknown[] }).profiles
      : [];
  const first = list[0] as { id?: number } | undefined;
  if (first?.id) return Number(first.id);

  throw new Error(
    'No pool profile found. Create one on MRR (Account → Profiles) or set pool_profile_id in Settings.'
  );
}

export async function POST(req: NextRequest) {
  try {
    ensureDb();
    const client = getMrrClient();
    const body = await req.json();
    const { length, name, rig_id, currency = 'BTC' } = body;
    if (!rig_id) return NextResponse.json({ error: 'rig_id is required' }, { status: 400 });
    if (!length) return NextResponse.json({ error: 'length (hours) is required' }, { status: 400 });

    if (!(await client.canRent())) {
      return NextResponse.json(
        {
          error:
            'API key has rent:read only. Edit the key on MRR → Account → API and enable Rent = Write, then save keys here.',
          code: 'RENT_PERMISSION',
        },
        { status: 403 }
      );
    }

    const len = Number(length);
    if (!(len > 0)) {
      return NextResponse.json({ error: 'length must be a positive number of hours' }, { status: 400 });
    }

    const rows = await client.getRigsBatch([Number(rig_id)]);
    const rig = rows?.[0] || null;
    if (rig) {
      const minH = effectiveMinHours(rig, currency);
      if (len + 1e-9 < minH) {
        return NextResponse.json(
          {
            error: `Minimum rental for this rig in ${currency} is ${minH}h (MRR dust / min length).`,
            code: 'RENT_MIN_HOURS',
            min_hours: minH,
          },
          { status: 400 }
        );
      }
      const hour = getHourCost(rig, currency);
      const dust = MRR_MIN_PAID[currency as keyof typeof MRR_MIN_PAID];
      if (hour != null && dust != null && hour * len < dust - 1e-12) {
        return NextResponse.json(
          {
            error: `Rental cost would be below MRR minimum (${dust} ${currency}). Increase hours.`,
            code: 'RENT_MIN_COST',
            min_paid: dust,
          },
          { status: 400 }
        );
      }
    }

    const profile = await resolveProfileId(client, body);
    const result = await client.rentRig({
      rig: rig_id,
      length: len,
      profile,
      currency,
    });

    const rentalId = result?.data?.id || result?.data?.rental_id || null;
    addRentalLog({
      rig_id: Number(rig_id),
      rig_name: name || result?.data?.rig?.name || null,
      role: 'renter',
      rental_id: rentalId ? Number(rentalId) : null,
      started_at: new Date().toISOString(),
      ended_at: null,
      hours: len || 0,
      cost_btc: parseFloat(result?.data?.price?.paid) || 0,
      earned_btc: 0,
      status: 'active',
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    const isBiz =
      /code\s*104/i.test(msg) ||
      /too low/i.test(msg) ||
      /insufficient/i.test(msg) ||
      /not available/i.test(msg) ||
      /permission/i.test(msg) ||
      /profile/i.test(msg);
    return NextResponse.json({ error: msg }, { status: isBiz ? 400 : 500 });
  }
}
