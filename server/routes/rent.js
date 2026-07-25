import { Router } from 'express';
import { addRentalLog, getConfig } from '../db.js';
import {
  effectiveMinHours,
  getHourCost,
  MRR_MIN_PAID,
} from '../deals-engine.js';

const router = Router();

async function resolveProfileId(client, body) {
  if (body.profile || body.profile_id) return Number(body.profile || body.profile_id);
  const fromConfig = getConfig('pool_profile_id');
  if (fromConfig) return Number(fromConfig);

  const profiles = await client.listProfiles();
  const list = Array.isArray(profiles?.data)
    ? profiles.data
    : Array.isArray(profiles?.data?.profiles)
      ? profiles.data.profiles
      : [];
  if (list[0]?.id) return Number(list[0].id);

  throw new Error('No pool profile found. Create one on MRR (Account → Profiles) or set pool_profile_id in Settings.');
}

async function loadRig(client, rigId) {
  const rows = await client.getRigsBatch([Number(rigId)]);
  return rows?.[0] || null;
}

// POST /api/rent — rent a rig manually
router.post('/', async (req, res) => {
  try {
    const client = req.app.locals.mrrClient;
    const { length, name, rig_id, currency = 'BTC' } = req.body;
    if (!rig_id) return res.status(400).json({ error: 'rig_id is required' });
    if (!length) return res.status(400).json({ error: 'length (hours) is required' });

    if (!(await client.canRent())) {
      return res.status(403).json({
        error:
          'API key has rent:read only. Edit the key on MRR → Account → API and enable Rent = Write, then save keys here.',
        code: 'RENT_PERMISSION',
      });
    }

    const len = Number(length);
    if (!(len > 0)) {
      return res.status(400).json({ error: 'length must be a positive number of hours' });
    }

    const rig = await loadRig(client, rig_id);
    if (rig) {
      const minH = effectiveMinHours(rig, currency);
      if (len + 1e-9 < minH) {
        return res.status(400).json({
          error: `Minimum rental for this rig in ${currency} is ${minH}h (MRR dust / min length).`,
          code: 'RENT_MIN_HOURS',
          min_hours: minH,
        });
      }
      const hour = getHourCost(rig, currency);
      const dust = MRR_MIN_PAID[currency];
      if (hour != null && dust != null && hour * len < dust - 1e-12) {
        return res.status(400).json({
          error: `Rental cost would be below MRR minimum (${dust} ${currency}). Increase hours.`,
          code: 'RENT_MIN_COST',
          min_paid: dust,
        });
      }
    }

    const profile = await resolveProfileId(client, req.body);
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

    res.json(result);
  } catch (err) {
    const msg = err.message || String(err);
    const isBiz =
      /code\s*104/i.test(msg) ||
      /too low/i.test(msg) ||
      /insufficient/i.test(msg) ||
      /not available/i.test(msg) ||
      /permission/i.test(msg) ||
      /profile/i.test(msg);
    res.status(isBiz ? 400 : 500).json({ error: msg });
  }
});

export default router;
