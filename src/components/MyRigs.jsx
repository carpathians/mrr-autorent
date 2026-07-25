import React, { useEffect } from 'react';
import { useStore, useActions } from '../store';

function getStatus(rig) {
  if (typeof rig.status === 'string') return rig.status;
  return rig.status?.status || rig.available_status || 'unknown';
}

function getHashrate(rig) {
  const hr = rig.hashrate;
  if (hr == null) return '—';
  if (typeof hr === 'string' || typeof hr === 'number') {
    return rig.hashrate_type ? `${hr} ${rig.hashrate_type}` : String(hr);
  }
  return hr.advertised?.nice || hr.last_5min?.nice || '—';
}

function getPrice(rig) {
  if (!rig.price) return null;
  if (rig.price.per_text) return rig.price.per_text;
  const btc = rig.price.BTC;
  if (btc == null) return null;
  if (typeof btc === 'string' || typeof btc === 'number') return `${btc} BTC`;
  const unit = rig.price.type || 'unit';
  return btc.price ? `${btc.price} BTC/${unit}*day` : null;
}

export default function MyRigs() {
  const { state } = useStore();
  const { fetchMyRigs, clearError } = useActions();

  useEffect(() => {
    clearError();
    fetchMyRigs();
  }, []);

  const raw = state.myRigs?.data ?? state.myRigs;
  const rigs = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.records)
      ? raw.records
      : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Rigs (Owner)</h1>
          <p className="text-sm text-dark-200 mt-1">Rigs you own that others can rent.</p>
        </div>
        <button
          onClick={() => { clearError(); fetchMyRigs(); }}
          className="px-4 py-1.5 bg-accent-blue hover:bg-blue-600 rounded text-sm text-white transition"
        >
          Refresh
        </button>
      </div>

      {state.error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-accent-red">
          {state.error}
          <div className="mt-1 text-xs text-dark-200">
            Update API key/secret in Settings (needs <code className="text-dark-100">rigs</code> permission), then refresh.
          </div>
        </div>
      )}

      {state.loading.myRigs && <div className="text-center py-8 text-dark-200">Loading...</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rigs.map((rig) => {
          const status = getStatus(rig);
          const price = getPrice(rig);
          return (
            <div key={rig.id} className="bg-dark-700 rounded-lg p-4 border border-dark-500">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-sm text-white truncate max-w-[180px]">
                  {rig.name || `Rig #${rig.id}`}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  status === 'available' ? 'bg-green-900 text-accent-green' :
                  status === 'rented' ? 'bg-orange-900 text-accent-orange' :
                  'bg-dark-500 text-dark-200'
                }`}>
                  {status}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-dark-200">Hashrate</span>
                  <span className="text-white">{getHashrate(rig)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-200">Algo</span>
                  <span className="text-white">{rig.type || '—'}</span>
                </div>
                {price && (
                  <div className="flex justify-between">
                    <span className="text-dark-200">Price</span>
                    <span className="text-accent-yellow">{price}</span>
                  </div>
                )}
                {rig.region && (
                  <div className="flex justify-between">
                    <span className="text-dark-200">Region</span>
                    <span className="text-white">{rig.region}</span>
                  </div>
                )}
                {rig.shorturl && (
                  <div className="flex justify-between">
                    <span className="text-dark-200">Link</span>
                    <a href={rig.shorturl} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline truncate max-w-[140px]">
                      View on MRR
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!state.loading.myRigs && !state.error && rigs.length === 0 && (
        <div className="text-center py-12 text-dark-300">
          No owner rigs on this account.
        </div>
      )}
    </div>
  );
}
