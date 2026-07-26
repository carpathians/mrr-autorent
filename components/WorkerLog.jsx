'use client';
import React, { useEffect, useRef } from 'react';
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

export default function WorkerLog() {
  const { state } = useStore();
  const { fetchWorkerLogs } = useActions();
  const scrollRef = useRef(null);

  useEffect(() => { fetchWorkerLogs(200); }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [state.workerLogs]);

  const logs = state.workerLogs || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Worker Logs</h1>
        <button onClick={() => fetchWorkerLogs(200)}
          className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm text-dark-100 transition">
          Refresh
        </button>
      </div>

      <div ref={scrollRef} className="bg-dark-800 rounded-lg border border-dark-500 p-4 max-h-[600px] overflow-auto font-mono text-xs">
        {logs.length === 0 && (
          <div className="text-dark-300 text-center py-8">No logs yet. Start the worker to begin.</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 py-1.5 border-b border-dark-700">
            <span className="text-dark-300 w-[140px] shrink-0">
              {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
            </span>
            <span className="w-[16px] shrink-0 text-center">
              {actionIcons[log.action] || '•'}
            </span>
            <span className={`w-[60px] shrink-0 uppercase font-bold ${actionColors[log.action] || 'text-dark-200'}`}>
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
