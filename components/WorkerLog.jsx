'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useStore, useActions } from '@/components/store';

const actionColors = {
  check: 'text-dark-200',
  skip: 'text-accent-yellow',
  rent: 'text-accent-green',
  start: 'text-accent-blue',
  stop: 'text-accent-red',
  error: 'text-accent-red',
};

const actionIcons = {
  check: '🔍',
  skip: '⏭',
  rent: '⛏',
  start: '▶',
  stop: '⏹',
  error: '❌',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'rent', label: 'Rents' },
  { key: 'check', label: 'Checks' },
  { key: 'skip', label: 'Skips' },
];

export default function WorkerLog() {
  const { state } = useStore();
  const { fetchWorkerLogs, fetchWorkerStatus } = useActions();
  const scrollRef = useRef(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    fetchWorkerLogs(200);
    fetchWorkerStatus();
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [state.workerLogs]);

  const logs = Array.isArray(state.workerLogs) ? state.workerLogs : [];
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.action === filter);
  const recentErrors = logs.filter((l) => l.action === 'error').slice(0, 5);
  const ws = state.workerStatus || {};
  const alive = ws.alive === true;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Worker Logs</h1>
          <p className="text-xs text-dark-300 mt-1">
            Auto-refreshes every 10s · process{' '}
            <span className={alive ? 'text-accent-green' : 'text-accent-red'}>
              {alive ? 'alive' : 'not detected'}
            </span>
            {ws.heartbeatAgeSec != null && (
              <span className="text-dark-300"> · heartbeat {ws.heartbeatAgeSec}s ago</span>
            )}
            {ws.lastPhase && <span className="text-dark-300"> · {ws.lastPhase}</span>}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm text-dark-100 transition"
        >
          Refresh
        </button>
      </div>

      {!alive && (
        <div className="mb-4 rounded-md border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          Worker process not heartbeating. Run <code className="text-accent-yellow">npm run worker</code> or{' '}
          <code className="text-accent-yellow">npm run dev:all</code> (Docker: ensure the worker service is up).
          Toggling Start on Auto Rent only enables renting — it does not start the process.
        </div>
      )}

      {recentErrors.length > 0 && (
        <div className="mb-4 rounded-md border border-red-800/60 bg-red-950/40 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-red-300 mb-2">Recent errors</div>
          <ul className="space-y-1.5 text-sm text-red-100">
            {recentErrors.map((log) => (
              <li key={`err-${log.id}`} className="flex gap-3">
                <span className="text-dark-300 shrink-0 text-xs w-[130px]">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                </span>
                <span className="break-all">{log.details}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 text-xs rounded border transition ${
              filter === f.key
                ? 'bg-accent-blue/20 border-accent-blue text-white'
                : 'bg-dark-700 border-dark-500 text-dark-200 hover:bg-dark-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="bg-dark-800 rounded-lg border border-dark-500 p-4 max-h-[600px] overflow-auto font-mono text-xs"
      >
        {filtered.length === 0 && (
          <div className="text-dark-300 text-center py-8">
            {logs.length === 0
              ? 'No logs yet. Start the worker process to begin.'
              : `No ${filter} logs in the latest ${logs.length}.`}
          </div>
        )}
        {filtered.map((log) => (
          <div
            key={log.id}
            className={`flex gap-3 py-1.5 border-b border-dark-700 ${
              log.action === 'error' ? 'bg-red-950/20' : ''
            }`}
          >
            <span className="text-dark-300 w-[140px] shrink-0">
              {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
            </span>
            <span className="w-[16px] shrink-0 text-center">
              {actionIcons[log.action] || '•'}
            </span>
            <span
              className={`w-[60px] shrink-0 uppercase font-bold ${
                actionColors[log.action] || 'text-dark-200'
              }`}
            >
              {log.action}
            </span>
            <span className="text-dark-100 flex-1 break-all">{log.details}</span>
            {log.rig_id && <span className="text-dark-300 shrink-0">rig:{log.rig_id}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
