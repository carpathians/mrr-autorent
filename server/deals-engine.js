function getStatus(rig) {
  return typeof rig.status === 'string' ? rig.status : rig.status?.status;
}

function isRented(rig) {
  const st = rig.status;
  if (!st || typeof st === 'string') return st === 'rented';
  return st.rented === true || st.status === 'rented';
}

/** Explicit online check — MRR offline=false still returns some offline rows */
export function isOnline(rig) {
  if (rig == null) return false;
  if (rig.online === false || rig.online === 0 || rig.online === 'false') return false;
  const st = getStatus(rig);
  if (st === 'offline') return false;
  const s = rig.status;
  if (s && typeof s === 'object') {
    if (s.online === false || s.online === 0 || s.online === 'false') return false;
  }
  return true;
}

function hoursLeft(rig) {
  const h = parseFloat(rig?.status?.hours);
  return Number.isFinite(h) ? h : null;
}

function getQuote(rig, currency) {
  const quote = rig.price?.[currency];
  if (!quote || typeof quote !== 'object' || quote.enabled === false) return null;
  return quote;
}

export function getPriceNum(rig, currency) {
  const quote = getQuote(rig, currency);
  if (!quote) return null;
  const n = parseFloat(quote.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** MRR rejects rentals below this paid amount (error code 104). */
export const MRR_MIN_PAID = { BTC: 0.000001 };

export function getHourCost(rig, currency) {
  const quote = getQuote(rig, currency);
  if (!quote) return null;
  const h = parseFloat(quote.hour);
  return Number.isFinite(h) && h > 0 ? h : null;
}

/** Max of rig.minhours, price[currency].min_rental_length, and hours needed for MRR dust floor. */
export function effectiveMinHours(rig, currency) {
  const quote = getQuote(rig, currency);
  const fromRig = parseFloat(rig?.minhours) || 3;
  const fromQuote = parseFloat(quote?.min_rental_length) || 0;
  const hour = getHourCost(rig, currency);
  const dust = MRR_MIN_PAID[currency] || 0;
  const fromDust = hour && dust ? Math.ceil((dust / hour) * 100) / 100 : 0;
  return Math.max(fromRig, fromQuote, fromDust);
}

export function getMinCost(rig, currency) {
  const quote = getQuote(rig, currency);
  if (!quote) return null;
  const min = parseFloat(quote.minhrs);
  const hour = parseFloat(quote.hour);
  const dust = MRR_MIN_PAID[currency] || 0;
  const fromDust = Number.isFinite(hour) && hour > 0 && dust > 0 ? dust : 0;
  const fromMinHrs = Number.isFinite(min) ? min : null;
  if (fromMinHrs == null && !fromDust) return null;
  return Math.max(fromMinHrs || 0, fromDust);
}

export function parseHashrateGH(str) {
  if (!str) return 0;
  if (typeof str === 'object') {
    str = str.advertised?.nice || str.last_5min?.nice || '';
  }
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  const upper = String(str).toUpperCase().replace(/\s+/g, '');
  if (/\d(?:\.\d+)?E(?:H)?(?:\/S)?$/.test(upper) || upper.includes('EH')) return num * 1e9;
  if (/\d(?:\.\d+)?P(?:H)?(?:\/S)?$/.test(upper) || upper.includes('PH')) return num * 1e6;
  if (/\d(?:\.\d+)?T(?:H)?(?:\/S)?$/.test(upper) || upper.includes('TH')) return num * 1e3;
  if (/\d(?:\.\d+)?G(?:H)?(?:\/S)?$/.test(upper) || upper.includes('GH')) return num;
  if (/\d(?:\.\d+)?M(?:H)?(?:\/S)?$/.test(upper) || upper.includes('MH')) return num / 1e3;
  if (/\d(?:\.\d+)?K(?:H)?(?:\/S)?$/.test(upper) || upper.includes('KH')) return num / 1e6;
  return num;
}

export function getHashrateGH(rig) {
  const hr = rig.hashrate;
  if (!hr) return 0;
  if (typeof hr === 'number') return hr / 1e9;
  if (typeof hr === 'string') return parseHashrateGH(hr);
  if (hr.advertised?.hash) return parseFloat(hr.advertised.hash) / 1e9 || 0;
  return parseHashrateGH(hr.advertised?.nice || hr.last_5min?.nice);
}

const BASELINE_KEYS = ['suggested', 'last', 'last_10', 'last_20', 'last_30', 'lowest'];

/**
 * Resolve discount baseline from GET /pricing + GET /info/algo/{type}.
 * Averages (last_10/20/…) are BTC on MRR; convert to other currencies via FX.
 */
export async function resolveMarketBaseline(client, {
  type,
  currency = 'BTC',
  baselineKey = 'last_10',
  pricing: pricingIn,
  algoInfo: algoIn,
} = {}) {
  const key = BASELINE_KEYS.includes(baselineKey) ? baselineKey : 'last_10';
  const [pricing, algoInfo] = await Promise.all([
    pricingIn ? Promise.resolve(pricingIn) : client.getPricing(),
    key === 'suggested' && pricingIn
      ? Promise.resolve(null)
      : (algoIn ? Promise.resolve(algoIn) : client.getAlgoInfo(type).catch(() => null)),
  ]);

  const market = pricing?.data?.market_rates?.[type];
  const hashType = market?.hashType || algoInfo?.data?.suggested_price?.unit?.split('*')?.[0] || 'ph';
  const fx = pricing?.data?.conversion_rates || {};
  const suggestedCcy = parseFloat(market?.[currency]);

  let baseline = null;
  if (key === 'suggested') {
    baseline = suggestedCcy;
  } else {
    const btcAmt = parseFloat(algoInfo?.data?.stats?.prices?.[key]?.amount);
    if (Number.isFinite(btcAmt) && btcAmt > 0) {
      if (currency === 'BTC') baseline = btcAmt;
      else {
        const btcPerCoin = parseFloat(fx[currency]);
        baseline = btcPerCoin > 0 ? btcAmt / btcPerCoin : NaN;
      }
    }
  }
  if (!Number.isFinite(baseline) || baseline <= 0) baseline = suggestedCcy;

  const pricesBtc = {};
  const raw = algoInfo?.data?.stats?.prices || {};
  for (const k of Object.keys(raw)) {
    const n = parseFloat(raw[k]?.amount);
    if (Number.isFinite(n)) pricesBtc[k] = n;
  }
  if (algoInfo?.data?.suggested_price?.amount) {
    pricesBtc.suggested = parseFloat(algoInfo.data.suggested_price.amount);
  }

  return {
    baseline: Number.isFinite(baseline) ? baseline : null,
    baselineKey: key,
    suggested: Number.isFinite(suggestedCcy) ? suggestedCcy : null,
    hashType,
    pricing,
    algoInfo,
    pricesBtc,
  };
}

function toDeal(rig, {
  currency,
  baseline,
  baselineKey = 'last_10',
  suggested,
  hashType,
  endingSoon = false,
}) {
  const price = getPriceNum(rig, currency);
  if (price == null) return null;
  const ref = Number.isFinite(baseline) && baseline > 0 ? baseline : suggested;
  let discount = null;
  if (Number.isFinite(ref) && ref > 0 && Number.isFinite(price)) {
    discount = Math.round(((ref - price) / ref) * 10000) / 100;
  }
  const left = hoursLeft(rig);
  return {
    ...rig,
    deal: {
      price,
      baseline: Number.isFinite(ref) ? ref : null,
      baseline_key: baselineKey,
      suggested: Number.isFinite(suggested) ? suggested : null,
      discount,
      hash_type: hashType,
      min_cost: getMinCost(rig, currency),
      rpi: parseFloat(rig.rpi) || null,
      ending_soon: endingSoon,
      hours_left: endingSoon ? left : null,
      hashrate_gh: getHashrateGH(rig),
    },
  };
}

/**
 * Build MRR /rig query filters (applied server-side by MRR).
 */
export function buildRigFilters({
  minHash,
  maxHash,
  hashType = 'th',
  minHashrateTH = 0,
  maxHashrateTH = 0,
  maxPrice = 0,
  priceType = 'ph',
  maxHours = 0,
} = {}) {
  const filters = {};
  const min = Number(minHash ?? minHashrateTH) || 0;
  const max = Number(maxHash ?? maxHashrateTH) || 0;
  if (min > 0 || max > 0) {
    filters.hash = { type: String(hashType || 'th').toLowerCase() };
    if (min > 0) filters.hash.min = min;
    if (max > 0) filters.hash.max = max;
  }
  const ceiling = parseFloat(maxPrice);
  if (Number.isFinite(ceiling) && ceiling > 0) {
    filters.price = { max: ceiling, type: priceType || 'ph' };
  }
  const maxHrs = Number(maxHours) || 0;
  if (maxHrs > 0) {
    filters.minhours = { max: maxHrs };
  }
  return filters;
}

/**
 * Phase 1 — build ID list via MRR server-side filters (+ light local affordable/online).
 * Does not wait on discount/pricing.
 */
async function collectRigIds(client, {
  type,
  currency,
  rented = false,
  filters,
  orderby = 'price',
  orderdir = 'asc',
  skip = 0,
  limit = 25,
  affordable = false,
  balance = Infinity,
  accept,
  maxScan = 800,
  tallyExtra = true,
}) {
  const ids = [];
  const seen = new Set();
  let offset = 0;
  let marketTotal = Infinity;
  let scanned = 0;
  let matched = 0;
  let skipped = 0;

  while (offset < marketTotal && scanned < maxScan) {
    const pageFilled = ids.length >= limit && skipped >= skip;
    if (pageFilled && !tallyExtra) break;
    if (pageFilled && matched >= skip + limit + 40) break;

    const pageSize = Math.min(100, maxScan - scanned);
    const res = await client.listRigs({
      type,
      currency,
      orderby,
      orderdir,
      count: pageSize,
      offset,
      rented: rented ? true : false,
      offline: false,
      ...filters,
    });
    const batch = res?.data?.records || [];
    marketTotal = Number(res?.data?.total ?? 0);
    scanned += batch.length;
    if (!batch.length) break;

    for (const rig of batch) {
      const id = String(rig.id);
      if (seen.has(id)) continue;
      seen.add(id);
      if (accept && !accept(rig)) continue;
      if (affordable) {
        const minCost = getMinCost(rig, currency);
        if (minCost == null || minCost > balance) continue;
      }
      matched += 1;
      if (skipped < skip) {
        skipped += 1;
        continue;
      }
      if (ids.length < limit) ids.push(id);
    }

    offset += batch.length;
  }

  return {
    ids,
    scanned,
    matched,
    market_total: Number.isFinite(marketTotal) ? marketTotal : scanned,
    total: matched,
  };
}

/**
 * Phase 2 — batch hydrate IDs, then attach discount from suggested.
 */
async function hydrateDeals(client, ids, {
  currency, baseline, baselineKey, suggested, hashType, endingSoon = false,
}) {
  if (!ids.length) return [];
  const rigs = await client.getRigsBatch(ids);
  const byId = new Map(rigs.map((r) => [String(r.id), r]));
  const deals = [];
  for (const id of ids) {
    const rig = byId.get(String(id));
    if (!rig) continue;
    if (!isOnline(rig) && !endingSoon) continue;
    const deal = toDeal(rig, {
      currency, baseline, baselineKey, suggested, hashType, endingSoon,
    });
    if (deal) deals.push(deal);
  }
  return deals;
}

/**
 * @param {object} [opts.pricing] - preloaded GET /pricing response
 * @param {object} [opts.balances] - preloaded GET /account/balance data map
 */
export async function findGoodDeals(client, {
  type = 'sha256ab',
  currency = 'BTC',
  maxPrice = 0,
  affordable = false,
  includeEndingSoon = true,
  endingMinutes = 120,
  minHashrateTH = 0,
  maxHashrateTH = 0,
  maxHours = 0,
  start = 0,
  limit = 25,
  maxScan = 800,
  /** Override list sort. Default: web-minhrs if affordable, else price */
  orderby: orderbyIn,
  baselineKey: baselineKeyIn = 'last_10',
  pricing: pricingIn,
  algoInfo: algoInfoIn,
  balances: balancesIn,
  balance: balanceIn,
} = {}) {
  // Allow up to 100 (AutoRent fetches a full page / currency before top-N cap)
  const pageLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
  const pageStart = Math.max(0, Number(start) || 0);
  const scanCap = Math.min(Math.max(Number(maxScan) || 800, 100), 2000);

  const ceiling = parseFloat(maxPrice);
  const priceCap = Number.isFinite(ceiling) && ceiling > 0 ? ceiling : 0;

  // Wave A: market baseline + balance
  const needBal = affordable && balanceIn == null && !balancesIn;
  const [marketRef, balRes] = await Promise.all([
    resolveMarketBaseline(client, {
      type,
      currency,
      baselineKey: baselineKeyIn,
      pricing: pricingIn,
      algoInfo: algoInfoIn,
    }),
    needBal ? client.getAccountBalances() : Promise.resolve(null),
  ]);

  const {
    baseline, baselineKey, suggested, hashType, pricing, pricesBtc,
  } = marketRef;

  let balance = balanceIn;
  if (balance == null && affordable) {
    const src = balancesIn || balRes?.data;
    balance = parseFloat(src?.[currency]?.confirmed || 0) || 0;
  }
  if (balance == null) balance = Infinity;

  const filters = buildRigFilters({
    minHashrateTH,
    maxHashrateTH,
    maxPrice: priceCap,
    priceType: hashType,
    maxHours,
  });

  const orderby = orderbyIn || (affordable ? 'web-minhrs' : 'price');

  // Wave B — Phase 1: ID lists from MRR server-side filters
  const [availIds, endingIds] = await Promise.all([
    collectRigIds(client, {
      type,
      currency,
      rented: false,
      filters,
      orderby,
      orderdir: 'asc',
      skip: pageStart,
      limit: pageLimit,
      affordable,
      balance,
      accept: (rig) => isOnline(rig) && !isRented(rig),
      maxScan: scanCap,
      tallyExtra: affordable,
    }),
    includeEndingSoon
      ? collectRigIds(client, {
          type,
          currency,
          rented: true,
          filters,
          orderby: 'price',
          orderdir: 'asc',
          skip: 0,
          limit: Math.min(10, pageLimit),
          affordable,
          balance,
          accept: (rig) => {
            if (!isOnline(rig) || !isRented(rig)) return false;
            const left = hoursLeft(rig);
            if (left == null || left <= 0) return false;
            if (left * 60 > endingMinutes) return false;
            return true;
          },
          maxScan: Math.min(200, scanCap),
          tallyExtra: false,
        })
      : Promise.resolve({ ids: [], scanned: 0, matched: 0, total: 0 }),
  ]);

  // Wave C — Phase 2: batch detail fetch, then discount
  const endingSet = new Set(endingIds.ids || []);
  const pageIds = [...availIds.ids];
  for (const id of endingIds.ids || []) {
    if (!pageIds.includes(id)) pageIds.push(id);
  }

  const hydrateOpts = {
    currency, baseline, baselineKey, suggested, hashType,
  };
  const hydrated = await hydrateDeals(client, pageIds, {
    ...hydrateOpts,
    endingSoon: false,
  });

  const byId = new Map();
  for (const deal of hydrated) {
    const id = String(deal.id);
    if (endingSet.has(id)) {
      deal.deal.ending_soon = true;
      deal.deal.hours_left = hoursLeft(deal);
    }
    byId.set(id, deal);
  }

  // Ending-only ids that weren't in available list
  const missingEnding = (endingIds.ids || []).filter((id) => !byId.has(String(id)));
  if (missingEnding.length) {
    const endingDeals = await hydrateDeals(client, missingEnding, {
      ...hydrateOpts,
      endingSoon: true,
    });
    for (const deal of endingDeals) byId.set(String(deal.id), deal);
  }

  let deals = [...byId.values()];
  deals.sort((a, b) => {
    if (a.deal.ending_soon !== b.deal.ending_soon) {
      return a.deal.ending_soon ? -1 : 1;
    }
    if (a.deal.ending_soon && b.deal.ending_soon) {
      const ha = a.deal.hours_left ?? 99;
      const hb = b.deal.hours_left ?? 99;
      if (ha !== hb) return ha - hb;
    }
    const dd = (b.deal.discount || 0) - (a.deal.discount || 0);
    if (dd !== 0) return dd;
    return (a.deal.price || 0) - (b.deal.price || 0);
  });

  // Keep available page order preference: available first by list order for non-ending
  const availOrder = new Map(availIds.ids.map((id, i) => [String(id), i]));
  deals.sort((a, b) => {
    if (!!a.deal.ending_soon !== !!b.deal.ending_soon) {
      return a.deal.ending_soon ? -1 : 1;
    }
    if (a.deal.ending_soon && b.deal.ending_soon) {
      return (a.deal.hours_left ?? 99) - (b.deal.hours_left ?? 99);
    }
    const ia = availOrder.has(String(a.id)) ? availOrder.get(String(a.id)) : 999;
    const ib = availOrder.has(String(b.id)) ? availOrder.get(String(b.id)) : 999;
    if (ia !== ib) return ia - ib;
    return (b.deal.discount || 0) - (a.deal.discount || 0);
  });

  const endingCount = deals.filter((r) => r.deal?.ending_soon).length;
  const total = affordable
    ? Math.max(availIds.matched || 0, deals.filter((d) => !d.deal.ending_soon).length)
    : Math.max(availIds.market_total || 0, deals.length);

  return {
    success: true,
    data: {
      records: deals.slice(0, pageLimit),
      count: Math.min(deals.length, pageLimit),
      total,
      start: pageStart,
      limit: pageLimit,
      scanned: availIds.scanned + (endingIds.scanned || 0),
      ending_soon_count: endingCount,
      ending_minutes: endingMinutes,
      min_hashrate_th: minHashrateTH || 0,
      max_hashrate_th: maxHashrateTH || 0,
      max_hours: Number(maxHours) || null,
      suggested: Number.isFinite(suggested) ? suggested : null,
      baseline: Number.isFinite(baseline) ? baseline : null,
      baseline_key: baselineKey,
      market_prices_btc: pricesBtc,
      hash_type: hashType,
      max_price: priceCap || null,
      ceiling: priceCap || null,
      currency,
      type,
      affordable,
      include_ending_soon: includeEndingSoon,
      balance: affordable ? balance : undefined,
      mrr_filters: filters,
      hydrated: pageIds.length,
    },
  };
}
