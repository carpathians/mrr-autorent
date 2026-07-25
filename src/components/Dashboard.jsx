import React, { useEffect, useState } from 'react';
import { useStore, useActions } from '../store';

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-dark-700 rounded-lg p-4 border border-dark-500">
      <div className="text-xs text-dark-200 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value ?? '—'}</div>
      {sub && <div className="text-xs text-dark-300 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const { fetchAccount, fetchWorkerStatus, fetchRentals, fetchProfit } = useActions();

  useEffect(() => {
    fetchAccount();
    fetchWorkerStatus();
    fetchRentals({ type: 'renter' });
    fetchRentals({ type: 'owner' });
    fetchProfit();
  }, []);

  const ws = state.workerStatus || {};
  const workerOn = ws.enabled === true || ws.enabled === 'true';
  const renterRentals = state.rentals?.renter || [];
  const ownerRentals = state.rentals?.owner || [];
  const p = state.profit || {};
  const bal = state.account?.balance_btc;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {state.account?.username && (
        <p className="text-sm text-dark-200 -mt-4 mb-6">Signed in as {state.account.username}</p>
      )}
      {state.account?.can_rent === false && (
        <div className="mb-4 rounded-md border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          API key rent permission is <span className="font-semibold">read</span> — enable <span className="font-semibold">Write</span> on MRR Account → API.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Balance"
          value={bal != null ? `${bal} BTC` : '—'}
          sub={state.account?.balance_btc_unconfirmed ? `+${state.account.balance_btc_unconfirmed} unconfirmed` : null}
          color="text-accent-yellow"
        />
        <StatCard
          label="Worker"
          value={workerOn ? 'Running' : 'Stopped'}
          sub={ws.lastCheck ? `Last: ${new Date(ws.lastCheck).toLocaleTimeString()}` : null}
          color={workerOn ? 'text-accent-green' : 'text-accent-red'}
        />
        <StatCard
          label="Active Rentals (You)"
          value={renterRentals.length}
          sub="Rigs you're renting"
          color="text-accent-blue"
        />
        <StatCard
          label="Active Rentals (Yours)"
          value={ownerRentals.length}
          sub="Rigs rented by others"
          color="text-accent-orange"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Spent"
          value={p.total_spent != null ? `${p.total_spent} BTC` : '—'}
          color="text-accent-red"
        />
        <StatCard
          label="Total Earned"
          value={p.total_earned != null ? `${p.total_earned} BTC` : '—'}
          color="text-accent-green"
        />
        <StatCard
          label="Net Profit"
          value={p.net_profit != null ? `${p.net_profit} BTC` : '—'}
          color={(p.net_profit ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-dark-700 rounded-lg p-4 border border-dark-500">
          <h2 className="text-sm font-semibold text-dark-100 mb-3">Hours Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-200">Hours Your Rigs Rented Out</span>
              <span className="text-accent-orange">{p.owner_hours?.toFixed(1) ?? '0'}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-200">Hours You've Rented</span>
              <span className="text-accent-blue">{p.renter_hours?.toFixed(1) ?? '0'}h</span>
            </div>
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-4 border border-dark-500">
          <h2 className="text-sm font-semibold text-dark-100 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/browse" className="block px-3 py-2 bg-dark-500 rounded text-sm hover:bg-dark-400 transition">
              Browse SHA256 Rigs
            </a>
            <a href="/auto-rent" className="block px-3 py-2 bg-dark-500 rounded text-sm hover:bg-dark-400 transition">
              Configure Auto-Rent
            </a>
            <a href="/logs" className="block px-3 py-2 bg-dark-500 rounded text-sm hover:bg-dark-400 transition">
              View Worker Logs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
