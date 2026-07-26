'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useStore, useActions } from '@/components/store';
import TableSkeleton from './TableSkeleton';

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
const HASH_UNITS = [
  { value: 'th', label: 'TH/s' },
  { value: 'gh', label: 'GH/s' },
  { value: 'mh', label: 'MH/s' },
  { value: 'ph', label: 'PH/s' },
  { value: 'eh', label: 'EH/s' },
];
const PAGE_SIZE = 25;

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'hashrate', label: 'Hashrate' },
  { key: 'price', label: 'Price' },
  { key: 'mincost', label: 'Min Cost' },
  { key: 'minhrs', label: 'Min Hrs' },
  { key: 'status', label: 'Status', sortable: false },
];

function getRigStatus(rig) {
  return typeof rig.status === 'string' ? rig.status : rig.status?.status || 'unknown';
}

function getRigHashrate(rig) {
  const hr = rig.hashrate;
  if (!hr) return '—';
  if (typeof hr === 'string' || typeof hr === 'number') return String(hr);
  return hr.advertised?.nice || hr.last_5min?.nice || '—';
}

function getQuote(rig, currency = 'BTC') {
  const quote = rig.price?.[currency];
  if (quote == null) return null;
  if (typeof quote === 'object' && quote.enabled === false) return null;
  return quote;
}

function getRigPrice(rig, currency = 'BTC') {
  if (rig.price?.per_text) return rig.price.per_text;
  const quote = getQuote(rig, currency);
  if (quote == null) return '—';
  if (typeof quote === 'string' || typeof quote === 'number') {
    return Number(quote) > 0 ? `${quote} ${currency}` : '—';
  }
  if (!quote.price || Number(quote.price) <= 0) return '—';
  const unit = rig.price?.type || 'unit';
  return `${quote.price} ${currency}/${unit}*day`;
}

function getMinRentalCost(rig, currency = 'BTC') {
  const quote = getQuote(rig, currency);
  if (quote == null) return null;
  if (typeof quote === 'string' || typeof quote === 'number') return null;
  const min = parseFloat(quote.minhrs);
  return Number.isFinite(min) ? min : null;
}

function SortHeader({ col, orderby, orderdir, onSort }) {
  const active = orderby === col.key;
  const sortable = col.sortable !== false;
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold text-dark-100 whitespace-nowrap">
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(col.key)}
          className={`inline-flex items-center gap-1 hover:text-white transition ${active ? 'text-accent-yellow' : ''}`}
        >
          {col.label}
          <span className="text-[10px] opacity-70">
            {active ? (orderdir === 'asc' ? '▲' : '▼') : '◇'}
          </span>
        </button>
      ) : (
        col.label
      )}
    </th>
  );
}

function Pagination({ page, totalPages, total, pageSize, onPage }) {
  if (total <= 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = Math.max(1, end - 4); i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-dark-500">
      <div className="text-xs text-dark-300">
        Showing {from}–{to} of <span className="text-dark-100 font-medium">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2 py-1 text-xs rounded bg-dark-600 border border-dark-400 disabled:opacity-40 hover:bg-dark-500"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`min-w-[28px] px-2 py-1 text-xs rounded border ${
              p === page
                ? 'bg-accent-blue border-accent-blue text-white'
                : 'bg-dark-600 border-dark-400 hover:bg-dark-500'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="px-2 py-1 text-xs rounded bg-dark-600 border border-dark-400 disabled:opacity-40 hover:bg-dark-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function currencyMinHours(rig, currency) {
  const quote = rig?.price?.[currency];
  const fromRig = Number(rig?.minhours || rig?.minperiod || 3);
  const fromQuote = Number(quote?.min_rental_length || 0);
  const hour = parseFloat(quote?.hour);
  const dust = currency === 'BTC' && hour > 0 ? Math.ceil((0.000001 / hour) * 100) / 100 : 0;
  return Math.max(fromRig, fromQuote, dust);
}

function RentModal({ rig, currency, onClose, onConfirm }) {
  const minHours = currencyMinHours(rig, currency);
  const [hours, setHours] = useState(minHours);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const price = getRigPrice(rig, currency);
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
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-dark-200">Pay with</span>
            <span className="text-accent-yellow font-medium">{currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-200">Price</span>
            <span className="text-white">{price}</span>
          </div>
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
          <button onClick={onClose} className="flex-1 py-2 bg-dark-500 hover:bg-dark-400 rounded text-sm transition">Cancel</button>
          <button
            onClick={handleRent}
            disabled={loading}
            className="flex-1 py-2 bg-accent-green hover:bg-green-600 text-black font-medium rounded text-sm transition disabled:opacity-50"
          >
            {loading ? 'Renting...' : 'Confirm Rent'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RigList() {
  const { state } = useStore();
  const { fetchRigs, fetchAccount, rentRig } = useActions();
  const [algo, setAlgo] = useState('sha256ab');
  const [currency, setCurrency] = useState('BTC');
  const [orderby, setOrderby] = useState('price');
  const [orderdir, setOrderdir] = useState('asc');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  // Default off — affordable scans the market; discount lives on Good Deals / AutoRent only
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [minHash, setMinHash] = useState('');
  const [maxHash, setMaxHash] = useState('');
  const [hashUnit, setHashUnit] = useState('th');
  const [appliedHash, setAppliedHash] = useState({ min: '', max: '', unit: 'th' });
  const [rentModal, setRentModal] = useState(null);

  const apiBalance = state.rigs?.data?.balance;
  const confirmed = parseFloat(state.account?.balances?.[currency]?.confirmed ?? 0) || 0;
  const unconfirmed = parseFloat(state.account?.balances?.[currency]?.unconfirmed ?? 0) || 0;
  // Affordable / spendable = confirmed only
  const balance = apiBalance != null ? parseFloat(apiBalance) || 0 : confirmed;

  const applyHashFilter = () => {
    setAppliedHash({ min: minHash, max: maxHash, unit: hashUnit });
    setPage(1);
  };

  const loadRigs = useCallback(() => {
    fetchAccount();
    const params = {
      algo,
      currency,
      limit: PAGE_SIZE,
      start: (page - 1) * PAGE_SIZE,
      orderby: orderby === 'mincost' ? 'minhrs' : orderby,
      orderdir,
      hash_type: appliedHash.unit,
    };
    if (affordableOnly) params.affordable = '1';
    if (appliedHash.min !== '') params.min_hash = appliedHash.min;
    if (appliedHash.max !== '') params.max_hash = appliedHash.max;
    fetchRigs(params);
  }, [fetchRigs, fetchAccount, algo, currency, orderby, orderdir, page, affordableOnly, appliedHash]);

  useEffect(() => { loadRigs(); }, [loadRigs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [algo, currency, affordableOnly, searchTerm, appliedHash]);

  const raw = state.rigs?.data ?? state.rigs;
  const rigs = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.records)
      ? raw.records
      : [];

  const filteredRigs = searchTerm
    ? rigs.filter((r) => (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : rigs;

  const total = searchTerm
    ? filteredRigs.length
    : Number(raw?.total ?? filteredRigs.length) || filteredRigs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (key) => {
    if (orderby === key) {
      setOrderdir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderby(key);
      setOrderdir('asc');
    }
    setPage(1);
  };

  const handleRent = async (data) => {
    await rentRig(data);
    loadRigs();
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Browse Rigs</h1>
          <p className="text-xs text-dark-300 mt-1">
            Fast list (no market discount %). For % under market use{' '}
            <a href="/deals" className="text-accent-blue hover:underline">Good Deals</a>.
          </p>
        </div>
        <div className="text-sm text-dark-200">
          Spendable:{' '}
          <span className="text-accent-yellow font-medium">
            {balance} {currency}
          </span>
          {unconfirmed > 0 && (
            <span className="text-dark-300 text-xs ml-2">
              (+{unconfirmed} unconf, ignored)
            </span>
          )}
          {affordableOnly && raw?.scanned != null && (
            <span className="text-dark-300 text-xs ml-2">
              · {total} affordable (scanned {raw.scanned})
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <select
          value={algo}
          onChange={(e) => setAlgo(e.target.value)}
          className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white"
        >
          {ALGOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white"
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-dark-100 cursor-pointer select-none px-2 py-1.5 rounded bg-dark-600 border border-dark-400">
          <input
            type="checkbox"
            checked={affordableOnly}
            onChange={(e) => setAffordableOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Affordable only
        </label>
        <input
          type="text"
          placeholder="Search page..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white flex-1 min-w-[200px]"
        />
        <button
          onClick={loadRigs}
          className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 rounded text-sm text-white transition"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-[11px] text-dark-300 mb-1">Min hashrate</label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="No min"
            value={minHash}
            onChange={(e) => setMinHash(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyHashFilter()}
            className="w-28 bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-[11px] text-dark-300 mb-1">Max hashrate</label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="No max"
            value={maxHash}
            onChange={(e) => setMaxHash(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyHashFilter()}
            className="w-28 bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-[11px] text-dark-300 mb-1">Unit</label>
          <select
            value={hashUnit}
            onChange={(e) => setHashUnit(e.target.value)}
            className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white"
          >
            {HASH_UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={applyHashFilter}
          className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 border border-dark-400 rounded text-sm text-white transition"
        >
          Apply
        </button>
        {(appliedHash.min || appliedHash.max) && (
          <button
            type="button"
            onClick={() => {
              setMinHash('');
              setMaxHash('');
              setAppliedHash({ min: '', max: '', unit: hashUnit });
              setPage(1);
            }}
            className="px-3 py-1.5 text-sm text-dark-200 hover:text-white transition"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-dark-700 border border-dark-500 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-600 border-b border-dark-500">
              <tr>
                {COLUMNS.map((col) => (
                  <SortHeader
                    key={col.key}
                    col={col}
                    orderby={orderby}
                    orderdir={orderdir}
                    onSort={handleSort}
                  />
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-dark-100">Action</th>
              </tr>
            </thead>
            <tbody>
              {state.loading.rigs && (
                <TableSkeleton rows={10} cols={COLUMNS.length + 1} />
              )}
              {!state.loading.rigs && filteredRigs.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-12 text-center text-dark-300">
                    {affordableOnly
                      ? `No affordable ${currency} rigs for balance ${balance}.`
                      : `No rigs found for ${currency}.`}
                  </td>
                </tr>
              )}
              {!state.loading.rigs && filteredRigs.map((rig) => {
                const status = getRigStatus(rig);
                const minCost = getMinRentalCost(rig, currency);
                const minHours = rig.minhours || rig.minperiod || '—';
                return (
                  <tr
                    key={rig.id}
                    className="border-b border-dark-600 hover:bg-dark-600/60 transition"
                  >
                    <td className="px-3 py-2 text-white max-w-[240px] truncate" title={rig.name || ''}>
                      {rig.name || `#${rig.id}`}
                    </td>
                    <td className="px-3 py-2 text-dark-100 whitespace-nowrap">{getRigHashrate(rig)}</td>
                    <td className="px-3 py-2 text-accent-yellow whitespace-nowrap">{getRigPrice(rig, currency)}</td>
                    <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                      {minCost != null ? `${minCost} ${currency}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-dark-100 whitespace-nowrap">{minHours}{minHours !== '—' ? 'h' : ''}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        status === 'available'
                          ? 'bg-green-900 text-accent-green'
                          : 'bg-red-900 text-accent-red'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a
                        href={`https://www.miningrigrentals.com/rigs/${rig.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-blue hover:underline mr-2"
                        title="View on MiningRigRentals"
                      >
                        MRR
                      </a>
                      {status === 'available' && (
                        <button
                          onClick={() => setRentModal(rig)}
                          className="px-2.5 py-1 bg-accent-blue hover:bg-blue-600 text-white text-xs font-medium rounded transition"
                        >
                          Rent
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!searchTerm && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
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
