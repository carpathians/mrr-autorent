'use client';
import React, { useEffect } from 'react';
import { useStore, useActions } from '@/components/store';

function fmtHash(c) {
  if (c.hashrate_nice) return c.hashrate_nice;
  if (c.hashrate_gh == null) return '—';
  const gh = c.hashrate_gh;
  if (gh >= 1e6) return `${(gh / 1e6).toFixed(2)} PH`;
  if (gh >= 1e3) return `${(gh / 1e3).toFixed(2)} TH`;
  return `${gh.toFixed(1)} GH`;
}

export default function AutoRent() {
  const { state } = useStore();
  const {
    fetchWorkerStatus,
    toggleWorker,
    fetchConfig,
    fetchCandidates,
    refreshCandidates,
    fetchAccount,
  } = useActions();

  const ws = state.workerStatus || {};
  const cfg = state.config || {};
  const enabled = ws.enabled === true || ws.enabled === 'true';
  const snap = state.candidates || {};
  const candidates = Array.isArray(snap.candidates) ? snap.candidates : [];
  const currencies = Array.isArray(snap.currencies) ? snap.currencies : [];

  useEffect(() => {
    fetchWorkerStatus();
    fetchConfig();
    fetchCandidates();
    fetchAccount();
    const id = setInterval(() => {
      fetchCandidates();
      fetchWorkerStatus();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const available = candidates.filter((c) => c.rentable_now);
  const ending = candidates.filter((c) => c.ending_soon);
  const nextPick = available[0] || null;

  return (
    <div>
      {state.account?.can_rent === false && (
        <div className="mb-4 rounded-md border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          API key has <span className="font-semibold">rent:read</span> — cannot rent.
          Fix on MRR → Account → API: set Rent = <span className="font-semibold">Write</span>, then update keys in Settings.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Auto Rent</h1>
          <p className="text-sm text-dark-300 mt-1">
            Candidates every 60s · rent every 3 min
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refreshCandidates()}
            disabled={!!state.loading.candidates || snap.building}
            className="px-4 py-2 bg-dark-500 hover:bg-dark-400 border border-dark-400 rounded text-sm disabled:opacity-50"
          >
            {snap.building || state.loading.candidates ? 'Building…' : 'Refresh candidates'}
          </button>
          <button
            onClick={() => toggleWorker(!enabled)}
            className={`px-5 py-2 rounded font-medium text-sm transition ${
              enabled
                ? 'bg-accent-red hover:bg-red-600 text-white'
                : 'bg-accent-green hover:bg-green-600 text-black'
            }`}
          >
            {enabled ? 'Stop Worker' : 'Start Worker'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-700 rounded-lg p-5 border border-dark-500">
          <div className="text-xs text-dark-200 uppercase tracking-wide">Worker</div>
          <div className={`text-xl font-bold mt-1 ${enabled ? 'text-accent-green' : 'text-accent-red'}`}>
            {enabled ? 'Running' : 'Stopped'}
          </div>
          <div className="mt-3 space-y-1 text-xs text-dark-300">
            {ws.lastCheck && <div>Last rent check: {new Date(ws.lastCheck).toLocaleString()}</div>}
            {ws.lastRentAt && <div>Last rent: {new Date(ws.lastRentAt).toLocaleString()}</div>}
            {ws.cooldownUntil ? (
              <div className="text-accent-yellow">
                Cooldown: {ws.cooldownRemainingMin}m left
                {' '}(until {new Date(ws.cooldownUntil).toLocaleString()})
              </div>
            ) : (
              ws.nextCheck && <div>Next rent check: {new Date(ws.nextCheck).toLocaleString()}</div>
            )}
            {snap.updated_at && <div>Candidates: {new Date(snap.updated_at).toLocaleString()}</div>}
            {ws.cooldownMin != null && (
              <div>Cooldown setting: {ws.cooldownMin}m after rent</div>
            )}
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-5 border border-dark-500">
          <div className="text-xs text-dark-200 uppercase tracking-wide">Candidates</div>
          <div className="text-xl font-bold mt-1 text-white">
            {candidates.length}
            <span className="text-sm font-normal text-dark-300 ml-2">
              ({available.length} now · {ending.length} ending)
            </span>
          </div>
          {snap.stats && (
            <div className="mt-3 text-xs text-dark-300">
              Scanned {snap.stats.scanned} · {snap.stats.duration_ms}ms · {snap.stats.funded} currencies
            </div>
          )}
          {snap.error && <div className="mt-2 text-xs text-accent-red">{snap.error}</div>}
        </div>

        <div className="bg-dark-700 rounded-lg p-5 border border-dark-500">
          <div className="text-xs text-dark-200 uppercase tracking-wide">Next pick</div>
          {nextPick ? (
            <>
              <div className="text-sm font-semibold text-white mt-1 truncate" title={nextPick.name}>
                {nextPick.name}
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div className="text-accent-yellow">
                  {nextPick.price} {nextPick.currency}/{nextPick.hash_type}*day
                  {nextPick.discount != null && (
                    <span className={`ml-2 ${nextPick.discount >= 0 ? 'text-accent-green' : 'text-red-300'}`}>
                      {nextPick.discount > 0
                        ? `−${nextPick.discount}%`
                        : nextPick.discount < 0
                          ? `+${Math.abs(nextPick.discount)}%`
                          : 'at market'}
                    </span>
                  )}
                </div>
                <div className="text-dark-300">
                  Min {nextPick.min_cost} {nextPick.currency} · {fmtHash(nextPick)}
                </div>
                {nextPick.rent_hours != null && (
                  <div className="text-dark-100">
                    Rent {nextPick.rent_hours}h
                    {nextPick.rent_cost != null && (
                      <span className="text-dark-300">
                        {' '}≈ {nextPick.rent_cost} {nextPick.currency}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-dark-300 mt-1">No available deal yet</div>
          )}
          {snap.decision?.action === 'wait' && (
            <div className="mt-3 text-xs text-accent-yellow border-t border-dark-500 pt-2">
              Waiting: {snap.decision.reason}
            </div>
          )}
          {snap.decision?.action === 'skip' && snap.decision.reason && (
            <div className="mt-3 text-xs text-dark-300 border-t border-dark-500 pt-2">
              Hold: {snap.decision.reason}
            </div>
          )}
        </div>
      </div>

      {currencies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {currencies.map((c) => (
            <div
              key={c.currency}
              className="text-xs px-3 py-1.5 rounded bg-dark-700 border border-dark-500"
            >
              <span className="text-accent-yellow font-medium">{c.currency}</span>
              <span className="text-dark-300 ml-2">{c.balance}</span>
              {c.skipped ? (
                <span className="text-accent-red ml-2">{c.skipped}</span>
              ) : (
                <span className="text-dark-200 ml-2">
                  {c.available ?? 0} avail / {c.ending_soon ?? 0} ending
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-dark-700 border border-dark-500 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-dark-500 flex justify-between items-center">
          <h2 className="text-sm font-semibold">Deal candidates (all funded currencies)</h2>
          <span className="text-xs text-dark-300">Same affordable set as Good Deals · top 10 by discount</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-600 border-b border-dark-500">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Name</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Pay</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Hashrate</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Price</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Discount</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Min Cost</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Rent hrs</th>
                <th className="px-3 py-2 text-left text-xs text-dark-100">Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-dark-300">
                    {snap.building
                      ? 'Building candidates…'
                      : 'No candidates yet. Fund a balance or wait for the 60s scan.'}
                  </td>
                </tr>
              )}
              {candidates.map((c) => (
                <tr
                  key={`${c.currency}-${c.id}`}
                  className={`border-b border-dark-600 ${
                    c.ending_soon ? 'bg-orange-950/20' : ''
                  } ${nextPick && nextPick.id === c.id && nextPick.currency === c.currency ? 'bg-blue-950/30' : ''}`}
                >
                  <td className="px-3 py-2 text-white max-w-[200px]">
                    <div className="truncate" title={c.name}>{c.name}</div>
                    {c.ending_soon && (
                      <span className="inline-flex mt-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-900/80 text-orange-200">
                        Ending soon{c.hours_left != null ? ` · ${c.hours_left.toFixed(1)}h` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-accent-yellow whitespace-nowrap">{c.currency}</td>
                  <td className="px-3 py-2 text-dark-100 whitespace-nowrap">{fmtHash(c)}</td>
                  <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                    {c.price} /{c.hash_type}*day
                  </td>
                  <td className="px-3 py-2">
                    {c.discount == null ? (
                      <span className="text-xs text-dark-300">—</span>
                    ) : (
                      <span className={`text-xs ${c.discount >= 0 ? 'text-accent-green' : 'text-red-300'}`}>
                        {c.discount > 0
                          ? `−${c.discount}%`
                          : c.discount < 0
                            ? `+${Math.abs(c.discount)}%`
                            : 'at market'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                    {c.min_cost} {c.currency}
                  </td>
                  <td className="px-3 py-2 text-dark-100 whitespace-nowrap">
                    {c.rent_hours != null ? `${c.rent_hours}h` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {c.rentable_now ? (
                      <span className="text-accent-green">Available</span>
                    ) : (
                      <span className="text-orange-300">Wait</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-5 border border-dark-500 max-w-lg">
        <h2 className="text-sm font-semibold text-white mb-3">Rules used for candidates</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-200">Algo</span>
            <span className="text-white">{cfg.autorent_algo || 'sha256ab'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-200">Min / Max Hashrate</span>
            <span className="text-white">
              {cfg.min_hashrate || '0'}
              {cfg.max_hashrate ? ` – ${cfg.max_hashrate}` : '+'} TH
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-200">Max Rental Hours</span>
            <span className="text-white">{cfg.max_hours || '24'}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-200">Candidate Scan Cap</span>
            <span className="text-white">{cfg.candidate_max_scan || '100'} / currency</span>
          </div>
        </div>
        <a href="/settings" className="block mt-4 text-accent-blue text-xs hover:underline">
          Edit rules in Settings →
        </a>
      </div>
    </div>
  );
}
