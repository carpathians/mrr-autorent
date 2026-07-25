import React, { useEffect, useState } from 'react';
import { useStore, useActions } from '../store';

function StatBox({ label, value, color = 'text-white', sub }) {
  return (
    <div className="bg-dark-700 rounded-lg p-4 border border-dark-500">
      <div className="text-xs text-dark-200 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-dark-300 mt-1">{sub}</div>}
    </div>
  );
}

function fmt(n, digits = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}

export default function Profit() {
  const { state } = useStore();
  const { fetchProfit, clearError } = useActions();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    clearError();
    fetchProfit();
  }, []);

  const p = state.profit || {};
  const summaries = p.summaries || [];
  const byCurrency = p.by_currency || [];
  const loading = state.loading.profit;

  const handleFilter = () => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    fetchProfit(params);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Profit</h1>
        <button
          onClick={() => fetchProfit(startDate || endDate ? { startDate, endDate } : undefined)}
          className="px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded text-sm transition"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {state.error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-accent-red">
          {state.error}
        </div>
      )}

      <p className="text-xs text-dark-300 mb-4">
        Synced to local DB — MRR only for new/changed rentals. BTC totals are BTC-only.
        {p.renter_count != null && (
          <span> ({p.renter_count} renter / {p.owner_count} owner in DB)</span>
        )}
        {p.last_sync && (
          <span> · last sync {new Date(p.last_sync).toLocaleString()}</span>
        )}
        {p.sync && (
          <span>
            {' '}· +{ (p.sync.renter?.inserted || 0) + (p.sync.owner?.inserted || 0) } new
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatBox label="Spent (BTC)" value={`${fmt(p.total_spent)} BTC`} color="text-accent-red" />
        <StatBox label="Earned (BTC)" value={`${fmt(p.total_earned)} BTC`} color="text-accent-green" />
        <StatBox
          label="Net (BTC)"
          value={`${fmt(p.net_profit)} BTC`}
          color={(Number(p.net_profit) || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}
        />
        <StatBox label="Hours Rented Out" value={`${fmt(p.owner_hours, 1)}h`} color="text-accent-orange" />
        <StatBox label="Hours Rented" value={`${fmt(p.renter_hours, 1)}h`} color="text-accent-blue" />
      </div>

      {byCurrency.length > 0 && (
        <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden mb-6">
          <div className="px-4 py-3 text-sm font-semibold text-white border-b border-dark-500">By Currency</div>
          <table className="w-full">
            <thead>
              <tr className="bg-dark-600 text-xs text-dark-200 uppercase">
                <th className="py-2 px-3 text-left">Currency</th>
                <th className="py-2 px-3 text-right">Spent</th>
                <th className="py-2 px-3 text-right">Earned</th>
                <th className="py-2 px-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {byCurrency.map((row) => (
                <tr key={row.currency} className="border-b border-dark-500">
                  <td className="py-2 px-3 text-sm">{row.currency}</td>
                  <td className="py-2 px-3 text-sm text-right text-accent-red">{fmt(row.spent)}</td>
                  <td className="py-2 px-3 text-sm text-right text-accent-green">{fmt(row.earned)}</td>
                  <td className={`py-2 px-3 text-sm text-right ${(row.net || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {fmt(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-dark-700 rounded-lg p-4 border border-dark-500 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Date Range</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-dark-200 block mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-dark-200 block mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-dark-600 border border-dark-400 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <button onClick={handleFilter}
            className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 rounded text-sm text-white transition">
            Filter
          </button>
          <button onClick={() => { setStartDate(''); setEndDate(''); fetchProfit(); }}
            className="px-4 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm text-dark-100 transition">
            Clear
          </button>
        </div>
      </div>

      {loading && summaries.length === 0 && (
        <div className="text-center py-8 text-dark-200 text-sm">Loading rentals from MRR…</div>
      )}

      {summaries.length > 0 && (
        <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-600 text-xs text-dark-200 uppercase">
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 text-right">Spent (BTC)</th>
                <th className="py-2 px-3 text-right">Earned (BTC)</th>
                <th className="py-2 px-3 text-right">Net (BTC)</th>
                <th className="py-2 px-3 text-right">Owner Hours</th>
                <th className="py-2 px-3 text-right">Renter Hours</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.date} className="border-b border-dark-500 hover:bg-dark-600 transition">
                  <td className="py-2 px-3 text-sm">{s.date}</td>
                  <td className="py-2 px-3 text-sm text-right text-accent-red">{fmt(s.total_spent)}</td>
                  <td className="py-2 px-3 text-sm text-right text-accent-green">{fmt(s.total_earned)}</td>
                  <td className={`py-2 px-3 text-sm text-right ${(Number(s.net_profit) || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {fmt(s.net_profit)}
                  </td>
                  <td className="py-2 px-3 text-sm text-right">{fmt(s.owner_hours_rented, 1)}h</td>
                  <td className="py-2 px-3 text-sm text-right">{fmt(s.renter_hours_used, 1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
