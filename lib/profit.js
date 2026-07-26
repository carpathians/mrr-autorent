import {
  getConfig,
  getProfitSummary,
  getProfitByCurrency,
  getProfitDaily,
  countMrrRentals,
} from './db.js';
import { syncRentals } from './sync-rentals.js';

function roundSummary(s) {
  return {
    total_spent: Number(Number(s.total_spent || 0).toFixed(8)),
    total_earned: Number(Number(s.total_earned || 0).toFixed(8)),
    net_profit: Number(Number(s.net_profit || 0).toFixed(8)),
    owner_hours: Number(Number(s.owner_hours || 0).toFixed(2)),
    renter_hours: Number(Number(s.renter_hours || 0).toFixed(2)),
    renter_count: s.renter_count || 0,
    owner_count: s.owner_count || 0,
    by_currency: (s.by_currency || []).map((c) => ({
      currency: c.currency,
      spent: Number(Number(c.spent || 0).toFixed(8)),
      earned: Number(Number(c.earned || 0).toFixed(8)),
      net: Number(Number(c.net || 0).toFixed(8)),
    })),
    note: 'BTC totals are BTC-paid only. Other currencies in by_currency. Data synced to local DB.',
    last_sync: s.last_sync || null,
    sync: s.sync || null,
  };
}

export function buildProfitPayload(syncMeta = null) {
  const base = getProfitSummary();
  const by_currency = getProfitByCurrency();
  const daily = getProfitDaily();
  return {
    summary: roundSummary({
      ...base,
      by_currency,
      last_sync: getConfig('rentals_last_sync') || null,
      sync: syncMeta,
    }),
    daily: daily.map((d) => ({
      ...d,
      total_spent: Number(Number(d.total_spent).toFixed(8)),
      total_earned: Number(Number(d.total_earned).toFixed(8)),
      net_profit: Number(Number(d.net_profit).toFixed(8)),
      owner_hours_rented: Number(Number(d.owner_hours_rented).toFixed(2)),
      renter_hours_used: Number(Number(d.renter_hours_used).toFixed(2)),
    })),
  };
}

/** @param {{ startDate?: string, endDate?: string, nosync?: string|boolean }} [opts] */
export async function getProfit(client, opts = {}) {
  const { startDate = '', endDate = '', nosync } = opts;
  if (!client?.apiKey) {
    const err = new Error('API keys not configured');
    err.status = 401;
    throw err;
  }

  let syncMeta = null;
  if (nosync !== '1' && nosync !== true) {
    syncMeta = await syncRentals(client);
  }

  const base = getProfitSummary();
  const by_currency = getProfitByCurrency();
  let daily = getProfitDaily(startDate || null, endDate || null);

  let summaryBase = base;
  if (startDate || endDate) {
    const filtered = daily.reduce(
      (acc, d) => {
        acc.total_spent += d.total_spent;
        acc.total_earned += d.total_earned;
        acc.owner_hours += d.owner_hours_rented;
        acc.renter_hours += d.renter_hours_used;
        return acc;
      },
      { total_spent: 0, total_earned: 0, owner_hours: 0, renter_hours: 0 }
    );
    summaryBase = {
      ...filtered,
      net_profit: filtered.total_earned - filtered.total_spent,
      renter_count: base.renter_count,
      owner_count: base.owner_count,
    };
  }

  return {
    summary: roundSummary({
      ...summaryBase,
      by_currency,
      last_sync: getConfig('rentals_last_sync') || null,
      sync: syncMeta,
    }),
    daily: daily.map((d) => ({
      ...d,
      total_spent: Number(Number(d.total_spent).toFixed(8)),
      total_earned: Number(Number(d.total_earned).toFixed(8)),
      net_profit: Number(Number(d.net_profit).toFixed(8)),
      owner_hours_rented: Number(Number(d.owner_hours_rented).toFixed(2)),
      renter_hours_used: Number(Number(d.renter_hours_used).toFixed(2)),
    })),
  };
}

export async function syncProfit(client) {
  if (!client?.apiKey) {
    const err = new Error('API keys not configured');
    err.status = 401;
    throw err;
  }
  const sync = await syncRentals(client);
  return { sync, total: countMrrRentals(), ...buildProfitPayload(sync) };
}
