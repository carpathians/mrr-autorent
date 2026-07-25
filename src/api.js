const BASE = '/api';

async function request(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `API error: ${res.status}`);
  }
  return data;
}

export const api = {
  getAccount: () => request('/account'),
  getAccountBalances: () => request('/account/balances'),
  getProfiles: () => request('/account/profiles'),
  getRigs: (params) => request(`/rigs?${new URLSearchParams(params)}`),
  getDeals: (params) => request(`/deals?${new URLSearchParams(params)}`),
  getCandidates: () => request('/candidates'),
  refreshCandidates: () => request('/candidates/refresh', { method: 'POST' }),
  getRig: (id) => request(`/rigs/${id}`),
  rentRig: (data) => request('/rent', { method: 'POST', body: JSON.stringify(data) }),
  getMyRigs: () => request('/my-rigs'),
  getRentals: (params) => request(`/rentals?${new URLSearchParams(params)}`),
  getProfit: (params) => request(`/profit?${new URLSearchParams(params || {})}`),
  getWorkerLogs: (limit) => request(`/worker-logs?limit=${limit || 100}`),
  getConfig: () => request('/config'),
  updateConfig: (data) => request('/config', { method: 'POST', body: JSON.stringify(data) }),
  getWorkerStatus: () => request('/worker-status'),
  toggleWorker: (enabled) => request('/worker-toggle', { method: 'POST', body: JSON.stringify({ enabled }) })
};
