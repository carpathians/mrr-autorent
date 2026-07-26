import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfig, setConfig, addWorkerLog, dataDir } from './db.js';
import {
  findGoodDeals,
  getHashrateGH,
  effectiveMinHours,
  getHourCost,
  getMinCost,
} from './deals-engine.js';

const CURRENCIES = ['BTC', 'LTC', 'ETH', 'DOGE', 'BCH'];
const SNAPSHOT_PATH = () => join(dataDir, 'candidates.json');

let builderTimer = null;
let rentTimer = null;
let building = false;
let renting = false;

/** In-process cache; persisted to DATA_DIR so web + worker share state */
let snapshot = {
  updated_at: null,
  building: false,
  error: null,
  type: 'sha256ab',
  balances: {},
  suggested: {},
  currencies: [],
  candidates: [],
  stats: { api_calls_est: 0, scanned: 0, duration_ms: 0 },
};

function loadSnapshotFromDisk() {
  try {
    const p = SNAPSHOT_PATH();
    if (!existsSync(p)) return;
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      snapshot = { ...snapshot, ...parsed, building: false };
    }
  } catch {
    /* ignore corrupt snapshot */
  }
}

function persistSnapshot() {
  try {
    const rest = { ...snapshot, building: false };
    writeFileSync(SNAPSHOT_PATH(), JSON.stringify(rest, null, 0));
  } catch (err) {
    addWorkerLog('error', `Failed to persist candidates: ${err.message}`);
  }
}

loadSnapshotFromDisk();

export function getCandidateSnapshot() {
  // Web process: always refresh from disk written by worker
  if (!building) loadSnapshotFromDisk();
  return { ...snapshot, building };
}

function spendable(balances, currency) {
  const row = balances?.[currency];
  if (!row) return 0;
  // Confirmed only — unconfirmed cannot be used for rent / affordable
  return parseFloat(row.confirmed) || 0;
}

/**
 * Hours we can rent given confirmed balance.
 * Uses quote.hour when present, else min_cost / minhours.
 */
export function computeRentHours({
  balance,
  minCost,
  minHours,
  maxHours,
  rigMaxHours,
  hourCost,
} = {}) {
  const bal = parseFloat(balance) || 0;
  const minH = Math.max(parseFloat(minHours) || 3, 0.01);
  const cap = Math.min(
    Number.isFinite(parseFloat(maxHours)) && parseFloat(maxHours) > 0
      ? parseFloat(maxHours)
      : 24,
    Number.isFinite(parseFloat(rigMaxHours)) && parseFloat(rigMaxHours) > 0
      ? parseFloat(rigMaxHours)
      : Infinity,
  );
  if (!(bal > 0) || !(cap >= minH)) return null;
  if (minCost != null && Number.isFinite(minCost) && bal + 1e-12 < minCost) return null;

  let perHour = parseFloat(hourCost);
  if (!(perHour > 0) && minCost != null && minCost > 0) {
    perHour = minCost / minH;
  }
  if (!(perHour > 0)) return minH;

  // 0.01h precision, spend as much balance as fits under caps
  let hours = Math.floor((bal / perHour) * 100) / 100;
  hours = Math.min(hours, cap);
  if (hours < minH) return null;
  // Safety: never exceed balance
  while (hours > minH && perHour * hours > bal + 1e-12) {
    hours = Math.round((hours - 0.01) * 100) / 100;
  }
  if (perHour * hours > bal + 1e-12) return null;
  return hours;
}

function slimCandidate(rig, currency, balance = 0, maxHoursCfg = 0) {
  const d = rig.deal || {};
  const minHours = effectiveMinHours(rig, currency);
  const hourCost = getHourCost(rig, currency);
  const minCost = getMinCost(rig, currency) ?? d.min_cost;
  const rentHours = computeRentHours({
    balance,
    minCost,
    minHours,
    maxHours: maxHoursCfg,
    rigMaxHours: rig.maxhours,
    hourCost,
  });
  return {
    id: String(rig.id),
    name: rig.name || `#${rig.id}`,
    currency,
    price: d.price,
    suggested: d.suggested,
    baseline: d.baseline,
    baseline_key: d.baseline_key,
    discount: d.discount,
    hash_type: d.hash_type,
    min_cost: minCost,
    hour_cost: hourCost,
    rent_hours: rentHours,
    rent_cost: rentHours != null && hourCost != null
      ? Math.round(rentHours * hourCost * 1e8) / 1e8
      : (rentHours != null && minCost != null
        ? Math.round((rentHours / minHours) * minCost * 1e8) / 1e8
        : null),
    rpi: d.rpi,
    ending_soon: !!d.ending_soon,
    hours_left: d.hours_left,
    hashrate_gh: d.hashrate_gh ?? getHashrateGH(rig),
    hashrate_nice: rig.hashrate?.advertised?.nice || null,
    minhours: minHours,
    maxhours: rig.maxhours,
    region: rig.region,
    rentable_now: !d.ending_soon && rentHours != null,
  };
}

/**
 * Build multi-currency deal candidates.
 * Rate-limit friendly: 1 pricing + 1 balances + shallow scans per funded currency.
 */
export async function buildCandidates(client) {
  if (building) return getCandidateSnapshot();
  building = true;
  snapshot.building = true;
  snapshot.error = null;
  const t0 = Date.now();
  let scanned = 0;

  try {
    const type = getConfig('autorent_algo') || 'sha256ab';
    const maxPrice = Math.max(0, parseFloat(getConfig('max_price') || '0') || 0);
    let endingMinutes = parseFloat(getConfig('ending_minutes'));
    if (!Number.isFinite(endingMinutes)) {
      const legacyH = parseFloat(getConfig('ending_hours'));
      endingMinutes = Number.isFinite(legacyH) ? legacyH * 60 : 120;
    }
    endingMinutes = Math.min(Math.max(endingMinutes, 5), 24 * 60);
    const includeEnding = getConfig('include_ending_soon') !== 'false';
    const minHashrateTH = parseFloat(getConfig('min_hashrate') || '0') || 0;
    const maxHashrateTH = parseFloat(getConfig('max_hashrate') || '0') || 0;
    const maxHours = parseFloat(getConfig('max_hours') || '0') || 0;
    // Same engine as Good Deals; fetch a page then cap top N after sort
    const maxScan = Math.min(Math.max(parseInt(getConfig('candidate_max_scan') || '800', 10) || 800, 100), 1200);
    const topN = Math.min(Math.max(parseInt(getConfig('candidates_top') || '10', 10) || 10, 5), 25);
    const perCurrencyCap = Math.min(
      Math.max(parseInt(getConfig('candidates_per_currency') || '100', 10) || 100, topN),
      100,
    );
    const baselineKey = getConfig('discount_baseline') || 'last_10';

    const [pricing, balRes, algoInfo] = await Promise.all([
      client.getPricing(),
      client.getAccountBalances(),
      client.getAlgoInfo(type).catch(() => null),
    ]);
    const balances = balRes?.data || {};
    const market = pricing?.data?.market_rates?.[type] || {};
    const fx = pricing?.data?.conversion_rates || {};

    // Settings max_price is BTC/hash-unit; convert for alt coins
    const maxPriceFor = (currency) => {
      if (!(maxPrice > 0)) return 0;
      if (currency === 'BTC') return maxPrice;
      const btcPerCoin = parseFloat(fx[currency]);
      if (!(btcPerCoin > 0)) return 0; // skip broken fx — don't apply BTC ceiling as alt
      return maxPrice / btcPerCoin;
    };

    const funded = CURRENCIES.filter((c) => spendable(balances, c) > 0);
    const suggested = {};
    for (const c of CURRENCIES) {
      const s = parseFloat(market[c]);
      if (Number.isFinite(s)) suggested[c] = s;
    }

    const all = [];
    const currencyMeta = [];

    for (const currency of funded) {
      const bal = spendable(balances, currency);
      const priceCap = maxPriceFor(currency);

      // Same params Good Deals uses with autorent settings + affordable
      const result = await findGoodDeals(client, {
        type,
        currency,
        maxPrice: priceCap,
        affordable: true,
        includeEndingSoon: includeEnding,
        endingMinutes,
        minHashrateTH,
        maxHashrateTH,
        maxHours,
        start: 0,
        limit: perCurrencyCap,
        maxScan,
        orderby: 'price',
        baselineKey,
        pricing,
        algoInfo,
        balances,
        balance: bal,
      });

      scanned += result.data?.scanned || 0;
      // Same set as Good Deals (affordable page) — no extra discount filter.
      // Sort by discount later; top-N cap after merge.
      const slim = (result.data?.records || [])
        .map((r) => slimCandidate(r, currency, bal, maxHours))
        .filter((c) => c.rent_hours != null);
      all.push(...slim);
      currencyMeta.push({
        currency,
        balance: bal,
        suggested: suggested[currency] ?? null,
        max_price: priceCap || null,
        count: slim.length,
        ending_soon: slim.filter((x) => x.ending_soon).length,
        available: slim.filter((x) => !x.ending_soon).length,
        scanned: result.data?.scanned || 0,
      });
    }

    // Prefer available + best discount; ending soon after → top N
    all.sort((a, b) => {
      if (a.rentable_now !== b.rentable_now) return a.rentable_now ? -1 : 1;
      if (a.ending_soon && b.ending_soon) {
        return (a.hours_left ?? 99) - (b.hours_left ?? 99);
      }
      return (b.discount || 0) - (a.discount || 0);
    });
    const top = all.slice(0, topN);

    snapshot = {
      updated_at: new Date().toISOString(),
      building: false,
      error: null,
      type,
      balances: Object.fromEntries(
        CURRENCIES.map((c) => [c, {
          confirmed: parseFloat(balances[c]?.confirmed) || 0,
          unconfirmed: parseFloat(balances[c]?.unconfirmed) || 0,
          spendable: spendable(balances, c),
        }])
      ),
      suggested,
      currencies: currencyMeta,
      candidates: top,
      stats: {
        api_calls_est: 2 + funded.length * (includeEnding ? 2 : 1),
        scanned,
        duration_ms: Date.now() - t0,
        funded: funded.length,
        max_scan: maxScan,
        top_n: topN,
        matched_before_top: all.length,
      },
    };

    setConfig('candidates_updated_at', snapshot.updated_at);
    setConfig('candidates_count', String(top.length));
    persistSnapshot();
  } catch (err) {
    snapshot.building = false;
    snapshot.error = err.message;
    snapshot.updated_at = new Date().toISOString();
    persistSnapshot();
    addWorkerLog('error', `Candidate build failed: ${err.message}`);
  } finally {
    building = false;
    snapshot.building = false;
  }

  return getCandidateSnapshot();
}

/** Best available (not ending-soon) candidate for auto-rent */
export function pickRentCandidate() {
  const list = getCandidateSnapshot().candidates || [];
  return list.find((c) => c.rentable_now && !c.ending_soon) || null;
}

/**
 * Rent decision with wait-for-ending-soon.
 * - wait_ending_better_pct: wait if ending-soon beats available by this many % points
 * - wait_ending_max_min: only wait for ending-soon within this many minutes
 */
export function decideRentAction(cfg = {}) {
  const list = getCandidateSnapshot().candidates || [];
  const waitMargin = Number.isFinite(parseFloat(cfg.waitEndingBetterPct))
    ? parseFloat(cfg.waitEndingBetterPct)
    : 5;
  const waitMaxMin = Number.isFinite(parseFloat(cfg.waitEndingMaxMin))
    ? parseFloat(cfg.waitEndingMaxMin)
    : 30;

  const available = list.filter((c) => c.rentable_now && !c.ending_soon);
  const pick = available[0] || null;
  if (!pick) {
    return { action: 'skip', reason: 'No available rentable candidate', pick: null, wait_for: null };
  }

  if (waitMargin > 0 && waitMaxMin > 0) {
    const waitMaxHours = waitMaxMin / 60;
    const ending = list
      .filter((c) => c.ending_soon && c.rent_hours != null)
      .filter((c) => {
        const left = c.hours_left;
        return left != null && left > 0 && left <= waitMaxHours;
      })
      .sort((a, b) => (b.discount || 0) - (a.discount || 0));

    const bestEnding = ending[0] || null;
    if (
      bestEnding &&
      (bestEnding.discount || 0) >= (pick.discount || 0) + waitMargin
    ) {
      const leftMin = Math.ceil((bestEnding.hours_left || 0) * 60);
      return {
        action: 'wait',
        reason:
          `Waiting ~${leftMin}m for ending-soon ${bestEnding.name} ` +
          `(${bestEnding.discount}% vs available ${pick.discount}% — margin ${waitMargin}pp)`,
        pick,
        wait_for: bestEnding,
      };
    }
  }

  return { action: 'rent', reason: null, pick, wait_for: null };
}

export function startCandidateBuilder(getClient) {
  if (builderTimer) clearInterval(builderTimer);

  const run = async () => {
    const client = getClient();
    if (!client) return;
    // Always refresh candidates so AutoRent page stays current
    await buildCandidates(client);
  };

  // Kick off soon, then every 60s
  setTimeout(run, 2000);
  builderTimer = setInterval(run, 60 * 1000);
  addWorkerLog('start', 'Candidate builder started (60s)');
}

export function stopCandidateBuilder() {
  if (builderTimer) {
    clearInterval(builderTimer);
    builderTimer = null;
  }
}

export function startRentLoop(getClient, rentFn) {
  if (rentTimer) clearInterval(rentTimer);

  const intervalMin = 3;

  const run = async () => {
    if (renting) return;
    if (getConfig('worker_enabled') !== 'true') return;
    renting = true;
    try {
      await rentFn(getClient());
    } finally {
      renting = false;
      setConfig(
        'next_check',
        new Date(Date.now() + intervalMin * 60000).toISOString()
      );
    }
  };

  // First rent attempt after candidates have a chance to build
  setTimeout(run, 15 * 1000);
  rentTimer = setInterval(run, intervalMin * 60 * 1000);
  addWorkerLog('start', `Rent loop started (${intervalMin}min)`);
}

export function stopRentLoop() {
  if (rentTimer) {
    clearInterval(rentTimer);
    rentTimer = null;
  }
}
