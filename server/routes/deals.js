import { Router } from 'express';
import { getConfig } from '../db.js';
import { findGoodDeals } from '../deals-engine.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const {
      algo,
      type = algo || 'sha256ab',
      currency = 'BTC',
      start = 0,
      limit = 25,
      max_price,
      affordable,
      ending_soon,
      ending_minutes,
      ending_hours,
      min_hashrate,
      max_hashrate,
      max_hours,
      baseline,
    } = req.query;

    const includeEndingSoon = ending_soon !== '0' && ending_soon !== 'false';
    let endingMinutes = parseFloat(ending_minutes);
    if (!Number.isFinite(endingMinutes) && ending_hours != null) {
      endingMinutes = parseFloat(ending_hours) * 60;
    }
    if (!Number.isFinite(endingMinutes)) endingMinutes = 120;

    const baselineKey = baseline || getConfig('discount_baseline') || 'last_10';

    const data = await findGoodDeals(req.app.locals.mrrClient, {
      type,
      currency,
      maxPrice: Math.max(0, parseFloat(max_price) || 0),
      affordable: affordable === '1' || affordable === 'true',
      includeEndingSoon,
      endingMinutes: Math.min(Math.max(endingMinutes, 5), 24 * 60),
      minHashrateTH: Math.max(0, parseFloat(min_hashrate) || 0),
      maxHashrateTH: Math.max(0, parseFloat(max_hashrate) || 0),
      maxHours: Math.max(0, parseFloat(max_hours) || 0),
      start: Math.max(0, Number(start) || 0),
      limit: Math.min(Math.max(1, Number(limit) || 25), 100),
      baselineKey,
      maxScan: 800,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
