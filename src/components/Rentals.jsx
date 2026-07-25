import React, { useEffect, useState } from 'react';
import { useStore, useActions } from '../store';

function normalizeRental(r) {
  const hours = parseFloat(r.length) || 0;
  const paid = r.price?.paid;
  const currency = r.price?.currency || 'BTC';
  return {
    id: r.id,
    rental_id: r.id,
    rig_id: r.rig?.id,
    rig_name: r.rig?.name || `#${r.rig?.id || '?'}`,
    status: r.ended ? 'complete' : 'active',
    hours,
    cost_btc: paid != null ? `${paid} ${currency}` : null,
    earned_btc: paid != null ? `${paid} ${currency}` : null,
    started_at: r.start,
    hashrate: r.hashrate?.advertised?.nice || r.hashrate?.average?.nice,
    owner: r.owner,
    renter: r.renter,
  };
}

function RentalRow({ r, role }) {
  return (
    <tr className="border-b border-dark-500 hover:bg-dark-600 transition">
      <td className="py-2 px-3 text-sm">{r.rig_name}</td>
      <td className="py-2 px-3 text-sm">{r.rental_id || '—'}</td>
      <td className="py-2 px-3 text-sm">
        <span className={`px-2 py-0.5 rounded text-xs ${
          r.status === 'active' ? 'bg-green-900 text-accent-green' :
          r.status === 'complete' ? 'bg-dark-500 text-dark-200' :
          'bg-orange-900 text-accent-orange'
        }`}>
          {r.status}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-right">{r.hashrate || '—'}</td>
      <td className="py-2 px-3 text-sm text-right">{r.hours ? `${r.hours}h` : '—'}</td>
      <td className="py-2 px-3 text-sm text-right">
        {role === 'renter' ? (
          <span className="text-accent-red">{r.cost_btc || '—'}</span>
        ) : (
          <span className="text-accent-green">{r.earned_btc || '—'}</span>
        )}
      </td>
      <td className="py-2 px-3 text-xs text-dark-200">
        {r.started_at || '—'}
      </td>
    </tr>
  );
}

export default function Rentals() {
  const { state } = useStore();
  const { fetchRentals } = useActions();
  const [tab, setTab] = useState('renter');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchRentals({ type: 'renter', history: showHistory });
    fetchRentals({ type: 'owner', history: showHistory });
  }, [showHistory]);

  const ownerRentals = (state.rentals?.owner || []).map(normalizeRental);
  const renterRentals = (state.rentals?.renter || []).map(normalizeRental);
  const currentList = tab === 'owner' ? ownerRentals : renterRentals;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rentals</h1>

      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setTab('renter')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition ${
            tab === 'renter' ? 'bg-accent-blue text-white' : 'bg-dark-600 text-dark-200 hover:bg-dark-500'
          }`}
        >
          Rented by You ({renterRentals.length})
        </button>
        <button
          onClick={() => setTab('owner')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition ${
            tab === 'owner' ? 'bg-accent-orange text-white' : 'bg-dark-600 text-dark-200 hover:bg-dark-500'
          }`}
        >
          On Your Rigs ({ownerRentals.length})
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-4 py-1.5 rounded text-sm transition ${
            showHistory ? 'bg-dark-400 text-white' : 'bg-dark-600 text-dark-200 hover:bg-dark-500'
          }`}
        >
          {showHistory ? 'Hide History' : 'Show History'}
        </button>
      </div>

      <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-600 text-xs text-dark-200 uppercase">
              <th className="py-2 px-3 text-left">Rig</th>
              <th className="py-2 px-3 text-left">Rental ID</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-right">Hashrate</th>
              <th className="py-2 px-3 text-right">Hours</th>
              <th className="py-2 px-3 text-right">{tab === 'renter' ? 'Paid' : 'Earned'}</th>
              <th className="py-2 px-3 text-left">Started</th>
            </tr>
          </thead>
          <tbody>
            {currentList.map((r) => (
              <RentalRow key={r.id || r.rental_id} r={r} role={tab} />
            ))}
          </tbody>
        </table>
        {currentList.length === 0 && (
          <div className="text-center py-8 text-dark-300 text-sm">
            {showHistory ? 'No rental history.' : 'No active rentals.'}
          </div>
        )}
      </div>
    </div>
  );
}
