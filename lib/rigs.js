import { buildRigFilters, getMinCost, getPriceNum, getHashrateGH, isOnline } from './deals-engine.js';

function getStatus(rig) {
  return typeof rig.status === 'string' ? rig.status : rig.status?.status;
}

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
 * Affordable browse — NO discount / pricing / algo baseline calls.
 * Scans MRR by web-minhrs ascending and stops once min cost exceeds balance
 * (later pages are more expensive).
 */
async function listAffordableRigs(client, {
  type,
  currency,
  orderby = 'price',
  orderdir = 'asc',
  start = 0,
  limit = 25,
  filters = {},
  maxScan = 500,
}) {
  const t0 = Date.now();
  const balRes = await client.getAccountBalances();
  const confirmed = parseFloat(balRes?.data?.[currency]?.confirmed || 0) || 0;
  const unconfirmed = parseFloat(balRes?.data?.[currency]?.unconfirmed || 0) || 0;
  const balance = confirmed;

  const matches = [];
  const seen = new Set();
  let offset = 0;
  let total = Infinity;
  let scanned = 0;
  let hitPriceCeiling = false;

  while (offset < total && scanned < maxScan && !hitPriceCeiling) {
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
      seen.add(id);

      if (!isAvailableOnline(rig)) continue;

      const minCost = getMinCost(rig, currency);
      // MRR web-minhrs asc → once over balance, rest of market is unaffordable
      if (minCost != null && minCost > balance) {
        hitPriceCeiling = true;
        break;
      }
      if (minCost == null || minCost > balance) continue;
      matches.push(rig);
    }

    offset += batch.length;
    if (!batch.length) break;
  }

  const sorted = sortRigs(matches, orderby, orderdir, currency);
  const from = Math.max(0, Number(start) || 0);
  const size = Math.min(Math.max(1, Number(limit) || 25), 100);
  const records = sorted.slice(from, from + size);
  const ms = Date.now() - t0;
  if (ms >= 1500) {
    console.warn(
      `[rigs] affordable browse slow ${ms}ms scanned=${scanned} matches=${matches.length} ceiling=${hitPriceCeiling}`,
    );
  }

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
      // Browse never attaches deal/discount — use Good Deals / AutoRent for that
      discount: false,
      duration_ms: ms,
      mrr_filters: filters,
    },
  };
}

/** List market rigs — fast path, no discount % / market baseline. */
export async function listRigs(client, query) {
  const t0 = Date.now();
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
  } = query;

  const wantAffordable = affordable === '1' || affordable === 'true' || affordable === true;
  const pageStart = Math.max(0, Number(start) || 0);
  const pageLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
  const dir = orderdir === 'desc' ? 'desc' : 'asc';

  // Price filter unit: use client hash_type when set — do NOT call getPricing/getAlgoInfo
  // (those are for discount baselines on Good Deals / AutoRent only).
  const priceCap = Math.max(0, parseFloat(max_price) || 0);
  let priceType = 'ph';
  if (priceCap > 0) {
    const ht = String(hash_type || 'th').toLowerCase();
    priceType = ['eh', 'ph', 'th', 'gh', 'mh', 'kh'].includes(ht) ? ht : 'ph';
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
    return listAffordableRigs(client, {
      type,
      currency,
      orderby,
      orderdir: dir,
      start: pageStart,
      limit: pageLimit,
      filters,
    });
  }

  // Single-page market list — one MRR call, no hydrate, no discount
  const data = await client.listRigs({
    type,
    currency,
    offset: pageStart,
    count: pageLimit,
    orderby,
    orderdir: dir,
    rented: false,
    offline: false,
    ...filters,
  });
  const batch = data?.data?.records || [];
  const records = batch.filter((rig) => isAvailableOnline(rig));
  const marketTotal = Number(data?.data?.total || records.length);
  const ms = Date.now() - t0;

  return {
    success: true,
    data: {
      records,
      count: records.length,
      total: marketTotal,
      start: pageStart,
      limit: pageLimit,
      scanned: batch.length,
      discount: false,
      duration_ms: ms,
      mrr_filters: filters,
    },
  };
}

export async function getRigById(client, id) {
  return client.getRig(id);
}
