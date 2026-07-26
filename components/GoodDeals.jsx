'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useStore, useActions } from '@/components/store';
import TableSkeleton, { SkeletonBar } from './TableSkeleton';

const ALGOS = [
  { value: 'sha256ab', label: 'SHA256 Asicboost' },
  { value: 'sha256', label: 'SHA256' },
  { value: 'scrypt', label: 'Scrypt' },
  { value: 'kheavyhash', label: 'kHeavyHash (Kaspa)' },
  { value: 'randomx', label: 'RandomX (XMR)' },
  { value: 'etchash', label: 'ETCHash' },
  { value: 'equihash', label: 'Equihash' },
  { value: 'kawpow', label: 'KawPOW (RVN)' },
];

const CURRENCIES = ['BTC', 'LTC', 'ETH', 'DOGE', 'BCH'];
const PAGE_SIZE = 25;

const inputClass =
  'bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white';

function getRigHashrate(rig) {
  const hr = rig.hashrate;
  if (!hr) return '—';
  if (typeof hr === 'string' || typeof hr === 'number') return String(hr);
  return hr.advertised?.nice || hr.last_5min?.nice || '—';
}

function currencyMinHours(rig, currency) {
  const quote = rig?.price?.[currency];
  const fromRig = Number(rig?.minhours || rig?.minperiod || 3);
  const fromQuote = Number(quote?.min_rental_length || 0);
  const hour = parseFloat(quote?.hour);
  // MRR BTC dust floor 0.000001
  const dust = currency === 'BTC' && hour > 0 ? Math.ceil((0.000001 / hour) * 100) / 100 : 0;
  return Math.max(fromRig, fromQuote, dust);
}

function RentModal({ rig, currency, onClose, onConfirm }) {
  const minHours = currencyMinHours(rig, currency);
  const [hours, setHours] = useState(minHours);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const price = rig.deal?.price;
  const unit = rig.deal?.hash_type || rig.price?.type || 'unit';
  const hourCost = parseFloat(rig?.price?.[currency]?.hour);
  const estCost = Number.isFinite(hourCost) ? hourCost * Math.max(hours, minHours) : null;

  const handleRent = async () => {
    setLoading(true);
    setLocalError(null);
    try {
      await onConfirm({
        rig_id: rig.id,
        length: Math.max(hours, minHours),
        name: rig.name || `Rig ${rig.id}`,
        currency,
      });
      onClose();
    } catch (e) {
      setLocalError(e.message || 'Rent failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-dark-700 rounded-lg p-6 w-full max-w-md border border-dark-400" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Rent: {rig.name || rig.id}</h2>
        <a
          href={`https://www.miningrigrentals.com/rigs/${rig.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent-blue hover:underline mb-4 inline-block"
        >
          Open on MRR ↗
        </a>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-200">Deal price</span>
            <span className="text-accent-yellow">
              {price != null ? `${price} ${currency}/${unit}*day` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-200">Discount</span>
            <span className={
              rig.deal?.discount == null ? 'text-dark-300'
                : rig.deal.discount > 0 ? 'text-accent-green'
                  : rig.deal.discount < 0 ? 'text-red-300' : 'text-dark-100'
            }>
              {rig.deal?.discount == null
                ? '—'
                : rig.deal.discount > 0
                  ? `${rig.deal.discount}% under market`
                  : rig.deal.discount < 0
                    ? `${Math.abs(rig.deal.discount)}% over market`
                    : 'at market'}
            </span>
          </div>
          {rig.deal?.ending_soon && (
            <div className="rounded bg-orange-950/40 border border-orange-800/50 px-3 py-2 text-xs text-orange-200">
              Ending soon
              {rig.deal.hours_left != null && <> — ~{rig.deal.hours_left.toFixed(1)}h left on current rental</>}.
              Rent may queue or fail until the rig frees up.
            </div>
          )}
          <div>
            <label className="text-xs text-dark-200 block mb-1">Duration (hours)</label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || minHours)}
              className="w-full bg-dark-600 border border-dark-400 rounded px-3 py-2 text-sm text-white"
              min={minHours}
              step="1"
            />
            <p className="text-[11px] text-dark-300 mt-1">
              Min {minHours}h
              {estCost != null && <> · ≈ {estCost.toFixed(8)} {currency}</>}
            </p>
          </div>
          {localError && (
            <p className="text-xs text-accent-red">{localError}</p>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-dark-500 hover:bg-dark-400 rounded text-sm">Cancel</button>
          <button
            onClick={handleRent}
            disabled={loading}
            className="flex-1 py-2 bg-accent-green hover:bg-green-600 text-black font-medium rounded text-sm disabled:opacity-50"
          >
            {loading ? 'Renting...' : 'Confirm Rent'}
          </button>
        </div>
      </div>
    </div>
  );
}

function applyAutorentConfig(cfg, setters) {
  if (!cfg) return;
  if (cfg.autorent_algo) setters.setAlgo(cfg.autorent_algo);
  if (cfg.max_price != null && cfg.max_price !== '') {
    setters.setMaxPrice(String(cfg.max_price));
  }
  setters.setMinHashrate(cfg.min_hashrate != null && cfg.min_hashrate !== '' ? String(cfg.min_hashrate) : '');
  setters.setMaxHashrate(cfg.max_hashrate != null && cfg.max_hashrate !== '' ? String(cfg.max_hashrate) : '');
  setters.setMaxHours(cfg.max_hours != null && cfg.max_hours !== '' ? String(cfg.max_hours) : '');
  let endMin = cfg.ending_minutes;
  if ((endMin == null || endMin === '') && cfg.ending_hours != null && cfg.ending_hours !== '') {
    endMin = String(parseFloat(cfg.ending_hours) * 60);
  }
  if (endMin != null && endMin !== '') setters.setEndingMinutes(String(endMin));
}

export default function GoodDeals() {
  const { state } = useStore();
  const { fetchDeals, fetchConfig, rentRig } = useActions();
  const [algo, setAlgo] = useState('sha256ab');
  const [currency, setCurrency] = useState('BTC');
  const [maxPrice, setMaxPrice] = useState('');
  const [minHashrate, setMinHashrate] = useState('');
  const [maxHashrate, setMaxHashrate] = useState('');
  const [maxHours, setMaxHours] = useState('');
  const [affordableOnly, setAffordableOnly] = useState(true);
  const [includeEndingSoon, setIncludeEndingSoon] = useState(true);
  const [endingMinutes, setEndingMinutes] = useState('120');
  const [page, setPage] = useState(1);
  const [rentModal, setRentModal] = useState(null);
  const [seeded, setSeeded] = useState(false);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchConfig();
      if (alive) setConfigReady(true);
    })();
    return () => { alive = false; };
  }, [fetchConfig]);

  useEffect(() => {
    if (!configReady || seeded) return;
    applyAutorentConfig(state.config || {}, {
      setAlgo, setMaxPrice, setMinHashrate, setMaxHashrate, setMaxHours, setEndingMinutes,
    });
    setSeeded(true);
  }, [configReady, state.config, seeded]);

  const loadFromAutorent = () => {
    applyAutorentConfig(state.config || {}, {
      setAlgo, setMaxPrice, setMinHashrate, setMaxHashrate, setMaxHours, setEndingMinutes,
    });
    setPage(1);
  };

  const load = useCallback(() => {
    if (!seeded) return;
    fetchDeals({
      algo,
      currency,
      max_price: maxPrice || '0',
      min_hashrate: minHashrate || '0',
      max_hashrate: maxHashrate || '0',
      max_hours: maxHours || '0',
      affordable: affordableOnly ? '1' : '0',
      ending_soon: includeEndingSoon ? '1' : '0',
      ending_minutes: endingMinutes,
      baseline: state.config?.discount_baseline || 'last_10',
      limit: PAGE_SIZE,
      start: (page - 1) * PAGE_SIZE,
    });
  }, [
    fetchDeals, seeded, algo, currency, maxPrice, minHashrate, maxHashrate, maxHours,
    affordableOnly, includeEndingSoon, endingMinutes, page, state.config?.discount_baseline,
  ]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPage(1);
  }, [algo, currency, maxPrice, minHashrate, maxHashrate, maxHours, affordableOnly, includeEndingSoon, endingMinutes]);

  const raw = state.deals?.data ?? state.deals;
  const deals = Array.isArray(raw?.records) ? raw.records : [];
  const total = Number(raw?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const suggested = raw?.suggested;
  const baseline = raw?.baseline ?? suggested;
  const baselineKey = raw?.baseline_key || 'last_10';
  const hashType = raw?.hash_type || 'ph';
  const baselineLabel = ({
    last_10: 'avg10',
    last_20: 'avg20',
    last_30: 'avg30',
    last: 'last',
    lowest: 'lowest',
    suggested: 'suggested',
  })[baselineKey] || baselineKey;

  const handleRent = async (data) => {
    await rentRig(data);
    load();
  };

  const pages = [];
  const pStart = Math.max(1, page - 2);
  const pEnd = Math.min(totalPages, pStart + 4);
  for (let i = Math.max(1, pEnd - 4); i <= pEnd; i++) pages.push(i);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Good Deals</h1>
          <p className="text-sm text-dark-300 mt-1">
            Discount vs MRR {baselineLabel}
            {baseline != null && (
              <>
                {' · '}
                <span className="text-accent-yellow">
                  {baseline} {currency}/{hashType}*day
                </span>
                {suggested != null && baselineKey !== 'suggested' && (
                  <span className="text-dark-300"> (suggested {suggested})</span>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 rounded text-sm text-white"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <label className="flex flex-col gap-1 text-[11px] text-dark-300">
          Algo
          <select value={algo} onChange={(e) => setAlgo(e.target.value)} className={inputClass}>
            {ALGOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-dark-300">
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label
          className="flex flex-col gap-1 text-[11px] text-dark-300"
          title={`Max ${currency}/${hashType}*day — same unit as MRR price`}
        >
          Max price
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="market"
            step="any"
            min="0"
            className={`${inputClass} w-32`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-dark-300">
          Min TH
          <input
            type="number"
            value={minHashrate}
            onChange={(e) => setMinHashrate(e.target.value)}
            placeholder="0"
            step="0.1"
            min="0"
            className={`${inputClass} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-dark-300">
          Max TH
          <input
            type="number"
            value={maxHashrate}
            onChange={(e) => setMaxHashrate(e.target.value)}
            placeholder="any"
            step="0.1"
            min="0"
            className={`${inputClass} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-dark-300">
          Max hours
          <input
            type="number"
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
            placeholder="any"
            step="0.5"
            min="0"
            className={`${inputClass} w-24`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-100 cursor-pointer select-none px-2 py-1.5 rounded bg-dark-600 border border-dark-400 h-[34px]">
          <input
            type="checkbox"
            checked={affordableOnly}
            onChange={(e) => setAffordableOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Affordable
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-100 cursor-pointer select-none px-2 py-1.5 rounded bg-dark-600 border border-dark-400 h-[34px]">
          <input
            type="checkbox"
            checked={includeEndingSoon}
            onChange={(e) => setIncludeEndingSoon(e.target.checked)}
            className="accent-orange-500"
          />
          Ending soon
        </label>
        {includeEndingSoon && (
          <label className="flex flex-col gap-1 text-[11px] text-dark-300">
            Ending ≤ min
            <input
              type="number"
              value={endingMinutes}
              onChange={(e) => setEndingMinutes(e.target.value)}
              step="5"
              min="5"
              className={`${inputClass} w-24`}
            />
          </label>
        )}
        <button
          type="button"
          onClick={loadFromAutorent}
          className="px-3 py-1.5 text-xs rounded border border-dark-400 bg-dark-600 text-dark-100 hover:text-white h-[34px]"
          title="Reset filters from Settings → Auto-rent"
        >
          Use autorent settings
        </button>
        {raw?.scanned != null && (
          <span className="text-xs text-dark-300 self-center">
            {total} deals
            {raw.ending_soon_count != null && ` · ${raw.ending_soon_count} ending soon`}
            {` (scanned ${raw.scanned})`}
          </span>
        )}
      </div>

      <div className="bg-dark-700 border border-dark-500 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-600 border-b border-dark-500">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Name</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Hashrate</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Price</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Discount</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Min Cost</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">RPI</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Status</th>
                <th className="px-3 py-2 text-right text-xs text-dark-100">Action</th>
              </tr>
            </thead>
            <tbody>
              {state.loading.deals && <TableSkeleton rows={PAGE_SIZE > 10 ? 10 : PAGE_SIZE} cols={8} />}
              {!state.loading.deals && deals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-dark-300">
                    No deals for these filters. Raise max price, widen TH range, or switch currency.
                  </td>
                </tr>
              )}
              {!state.loading.deals && deals.map((rig) => {
                const d = rig.deal || {};
                const pending = !!rig._skeleton || d.price == null;
                const hrs = d.hours_left;
                return (
                  <tr
                    key={rig.id}
                    className={`border-b border-dark-600 hover:bg-dark-600/60 ${
                      d.ending_soon ? 'bg-orange-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-white max-w-[220px]" title={rig.name || ''}>
                      {pending && !rig.name ? (
                        <SkeletonBar className="w-36" />
                      ) : (
                        <>
                          <div className="truncate">{rig.name || `#${rig.id}`}</div>
                          {d.ending_soon && (
                            <span className="inline-flex mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-900/80 text-orange-200">
                              Ending soon{hrs != null ? ` · ${hrs.toFixed(1)}h` : ''}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                      {pending && getRigHashrate(rig) === '—' ? <SkeletonBar className="w-14" /> : getRigHashrate(rig)}
                    </td>
                    <td className="px-3 py-2 text-accent-yellow whitespace-nowrap">
                      {pending ? (
                        <SkeletonBar className="w-24" />
                      ) : (
                        `${d.price} ${currency}/${hashType}*day`
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {pending || d.discount == null ? (
                        pending ? <SkeletonBar className="w-12" /> : <span className="text-xs text-dark-300">—</span>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          d.discount >= 10
                            ? 'bg-green-900 text-accent-green'
                            : d.discount > 0
                              ? 'bg-emerald-900/60 text-emerald-300'
                              : d.discount < 0
                                ? 'bg-red-950/50 text-red-300'
                                : 'bg-dark-500 text-dark-100'
                        }`}>
                          {d.discount > 0
                            ? `−${d.discount}%`
                            : d.discount < 0
                              ? `+${Math.abs(d.discount)}%`
                              : 'at market'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                      {pending ? (
                        <SkeletonBar className="w-16" />
                      ) : d.min_cost != null ? (
                        `${d.min_cost} ${currency}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-dark-100">
                      {pending ? <SkeletonBar className="w-10" /> : (d.rpi != null ? d.rpi : '—')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {pending ? (
                        <SkeletonBar className="w-16" />
                      ) : d.ending_soon ? (
                        <span className="text-xs text-orange-300">Rented · {hrs != null ? `${hrs.toFixed(1)}h left` : 'ending'}</span>
                      ) : (
                        <span className="text-xs text-accent-green">Available</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {pending ? (
                        <SkeletonBar className="w-14 ml-auto" />
                      ) : (
                        <>
                          <a
                            href={`https://www.miningrigrentals.com/rigs/${rig.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent-blue hover:underline mr-2"
                            title="View on MiningRigRentals"
                          >
                            MRR
                          </a>
                          <button
                            onClick={() => setRentModal(rig)}
                            className={`px-2.5 py-1 text-white text-xs font-medium rounded ${
                              d.ending_soon
                                ? 'bg-orange-600 hover:bg-orange-500'
                                : 'bg-accent-blue hover:bg-blue-600'
                            }`}
                            title={d.ending_soon ? 'Currently rented — may queue or fail until free' : 'Rent now'}
                          >
                            {d.ending_soon ? 'Watch/Rent' : 'Rent'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-dark-500">
            <div className="text-xs text-dark-300">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2 py-1 text-xs rounded bg-dark-600 border border-dark-400 disabled:opacity-40"
              >
                Prev
              </button>
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-[28px] px-2 py-1 text-xs rounded border ${
                    p === page
                      ? 'bg-accent-blue border-accent-blue text-white'
                      : 'bg-dark-600 border-dark-400'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2 py-1 text-xs rounded bg-dark-600 border border-dark-400 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {rentModal && (
        <RentModal
          rig={rentModal}
          currency={currency}
          onClose={() => setRentModal(null)}
          onConfirm={handleRent}
        />
      )}
    </div>
  );
}
