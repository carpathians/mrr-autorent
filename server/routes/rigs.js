import { Router } from 'express';
import { buildRigFilters, getMinCost, getPriceNum, getHashrateGH, isOnline } from '../deals-engine.js';

const router = Router();

function getStatus(rig) {
  return typeof rig.status === 'string' ? rig.status : rig.status?.status;
}

/** Available + online only (hide rented / offline) */
function isAvailableOnline(rig) {
  if (!isOnline(rig)) return false;
  const st = getStatus(rig);
  if (st && st !== 'available') return false;
  const s = rig.status;
  if (s && typeof s === 'object' && s.rented === true) return false;
  return true;
}

function isAffordable(rig, currency, balance) {
  const minCost = getMinCost(rig, currency);
  if (minCost == null) return false;
  if (!isOnline(rig)) return false;
  if (getStatus(rig) && getStatus(rig) !== 'available') return false;
  return minCost <= balance;
}

function sortRigs(records, orderby, orderdir, currency) {
  const dir = orderdir === 'desc' ? -1 : 1;
  const sorted = [...records];
  sorted.sort((a, b) => {
    let av;
    let bv;
    switch (orderby) {
      case 'name':
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      case 'hashrate':
        av = getHashrateGH(a);
        bv = getHashrateGH(b);
        return (av - bv) * dir;
      case 'minhrs':
      case 'mincost':
        av = getMinCost(a, currency) ?? Infinity;
        bv = getMinCost(b, currency) ?? Infinity;
        return (av - bv) * dir;
      case 'price':
      default:
        av = getPriceNum(a, currency) ?? Infinity;
        bv = getPriceNum(b, currency) ?? Infinity;
        return (av - bv) * dir;
    }
  });
  return sorted;
}

/**
 * Scan MRR pages with server-side hash/price/hours filters,
 * then keep affordable matches (balance filter is client-side only).
 */
async function listAffordableRigs(client, {
  type,
  currency,
  orderby = 'price',
  orderdir = 'asc',
  start = 0,
  limit = 25,
  filters = {},
  maxScan = 2000,
}) {
  const balRes = await client.getAccountBalances();
  const confirmed = parseFloat(balRes?.data?.[currency]?.confirmed || 0) || 0;
  const unconfirmed = parseFloat(balRes?.data?.[currency]?.unconfirmed || 0) || 0;
  // Affordable uses confirmed only (unconfirmed is not spendable for rent)
  const balance = confirmed;

  const matches = [];
  const seen = new Set();
  let offset = 0;
  let total = Infinity;
  let scanned = 0;

  while (offset < total && scanned < maxScan) {
    const pageSize = Math.min(100, maxScan - scanned);
    const res = await client.listRigs({
      type,
      currency,
      orderby: 'web-minhrs',
      orderdir: 'asc',
      count: pageSize,
      offset,
      rented: false,
      offline: false,
      ...filters,
    });
    const batch = res?.data?.records || [];
    total = Number(res?.data?.total || 0);
    scanned += batch.length;

    for (const rig of batch) {
      const id = String(rig.id);
      if (seen.has(id)) continue;
      if (!isAffordable(rig, currency, balance)) continue;
      seen.add(id);
      matches.push(rig);
    }

    offset += batch.length;
    if (!batch.length) break;
  }

  const sorted = sortRigs(matches, orderby, orderdir, currency);
  const from = Math.max(0, Number(start) || 0);
  const size = Math.min(Math.max(1, Number(limit) || 25), 100);
  const records = sorted.slice(from, from + size);

  return {
    success: true,
    data: {
      records,
      count: records.length,
      total: matches.length,
      start: from,
      limit: size,
      scanned,
      market_total: Number.isFinite(total) ? total : scanned,
      balance,
      balance_confirmed: confirmed,
      balance_unconfirmed: unconfirmed,
      currency,
      orderby,
      orderdir,
      affordable: true,
      mrr_filters: filters,
    },
  };
}

// GET /api/rigs — list rigs from MRR (hash/price/hours filtered server-side)
router.get('/', async (req, res) => {
  try {
    const {
      algo,
      type = algo || 'sha256ab',
      currency = 'BTC',
      start = 0,
      limit = 25,
      orderby = 'price',
      orderdir = 'asc',
      affordable,
      min_hash,
      max_hash,
      hash_type = 'th',
      max_price,
      max_hours,
    } = req.query;

    const wantAffordable = affordable === '1' || affordable === 'true';
    const pageStart = Math.max(0, Number(start) || 0);
    const pageLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
    const dir = orderdir === 'desc' ? 'desc' : 'asc';

    let priceType = 'ph';
    const priceCap = Math.max(0, parseFloat(max_price) || 0);
    if (priceCap > 0) {
      try {
        const pricing = await req.app.locals.mrrClient.getPricing();
        priceType = pricing?.data?.market_rates?.[type]?.hashType || 'ph';
      } catch {
        /* keep default */
      }
    }

    const filters = buildRigFilters({
      minHash: min_hash != null && min_hash !== '' ? Number(min_hash) : 0,
      maxHash: max_hash != null && max_hash !== '' ? Number(max_hash) : 0,
      hashType: String(hash_type || 'th').toLowerCase(),
      maxPrice: priceCap,
      priceType,
      maxHours: Math.max(0, parseFloat(max_hours) || 0),
    });

    if (wantAffordable) {
      const data = await listAffordableRigs(req.app.locals.mrrClient, {
        type,
        currency,
        orderby,
        orderdir: dir,
        start: pageStart,
        limit: pageLimit,
        filters,
      });
      return res.json(data);
    }

    // Fill a full page — local available filter used to shrink 25 → 1
    const records = [];
    let offset = pageStart;
    let marketTotal = 0;
    let scanned = 0;
    const maxPages = 8;

    for (let p = 0; p < maxPages && records.length < pageLimit; p++) {
      const need = pageLimit - records.length;
      const data = await req.app.locals.mrrClient.listRigs({
        type,
        currency,
        offset,
        count: Math.min(100, Math.max(need, pageLimit)),
        orderby,
        orderdir: dir,
        rented: false,
        offline: false,
        ...filters,
      });
      const batch = data?.data?.records || [];
      marketTotal = Number(data?.data?.total || marketTotal);
      scanned += batch.length;
      for (const rig of batch) {
        if (!isAvailableOnline(rig)) continue;
        records.push(rig);
        if (records.length >= pageLimit) break;
      }
      offset += batch.length;
      if (!batch.length) break;
    }

    res.json({
      success: true,
      data: {
        records,
        count: records.length,
        total: marketTotal,
        start: pageStart,
        limit: pageLimit,
        scanned,
        mrr_filters: filters,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rigs/:id — get single rig details
router.get('/:id', async (req, res) => {
  try {
    const data = await req.app.locals.mrrClient.getRig(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
