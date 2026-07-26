import crypto from 'crypto';
import { getConfig, setConfig } from './db.js';

const API_BASE = 'https://www.miningrigrentals.com/api/v2';

// Shared across all MRRClient instances (HTTP routes + worker)
let sharedPrevNonce = 0n;
let sharedNonceLoaded = false;
let sharedQueue = Promise.resolve();

function nextSharedNonce() {
  if (!sharedNonceLoaded) {
    sharedNonceLoaded = true;
    try {
      const saved = getConfig('mrr_last_nonce');
      if (saved) sharedPrevNonce = BigInt(saved);
    } catch {
      /* db not ready */
    }
  }
  // Docs require unique + strictly increasing. This key already has a high watermark,
  // so scale ms*1e5 (plain Date.now / PHP microtime are too small → Bad Nonce).
  let nonce = BigInt(Date.now()) * 100000n;
  if (nonce <= sharedPrevNonce) nonce = sharedPrevNonce + 1n;
  sharedPrevNonce = nonce;
  try {
    setConfig('mrr_last_nonce', nonce.toString());
  } catch {
    /* ignore */
  }
  return nonce.toString();
}

export class MRRClient {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  _sign(endpoint, nonce) {
    // Docs: HMAC-SHA1 of apiKey + nonce + endpoint (no trailing slash), secret as key
    const signStr = this.apiKey + nonce + endpoint;
    return crypto.createHmac('sha1', this.apiSecret).update(signStr).digest('hex');
  }

  async _request(method, endpoint, { query = {}, body = null } = {}) {
    // Serialize globally so concurrent clients cannot reuse / reorder nonces
    const run = sharedQueue.then(() => this._doRequest(method, endpoint, { query, body }));
    sharedQueue = run.catch(() => {});
    return run;
  }

  async _doRequest(method, endpoint, { query = {}, body = null } = {}) {
    let url = API_BASE + endpoint;
    const params = new URLSearchParams();
    // Flatten nested filters for MRR: hash: { min, max, type } → hash[min]&hash[max]&hash[type]
    const append = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj || {})) {
        if (v == null || v === '') continue;
        const key = prefix ? `${prefix}[${k}]` : k;
        if (typeof v === 'object' && !Array.isArray(v)) append(v, key);
        else params.append(key, String(v));
      }
    };
    append(query);
    const qs = params.toString();
    if (qs) url += '?' + qs;

    // Sign path only — strip query / trailing slash (per MRR docs)
    const signEndpoint = endpoint.split('?')[0].replace(/\/$/, '') || '/';
    const nonce = nextSharedNonce();
    const sign = this._sign(signEndpoint, nonce);

    const headers = {
      'x-api-key': this.apiKey,
      'x-api-nonce': nonce,
      'x-api-sign': sign,
      'Content-Type': 'application/json',
    };

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const json = await res.json();

    if (json.error && json.error !== 'ok') {
      const msg = json.error_message || JSON.stringify(json.error);
      throw new Error(`MRR API error (${method} ${endpoint}): ${msg}`);
    }

    if (json.success === false) {
      const msg = json.data?.message || json.data?.auth_mesage || JSON.stringify(json.data);
      throw new Error(`MRR API error (${method} ${endpoint}): ${msg}`);
    }

    return json;
  }

  async whoami() {
    return this._request('GET', '/whoami');
  }

  /** true if API key can create rentals (permissions.rent is write/yes) */
  async canRent() {
    const w = await this.whoami();
    const rent = String(w?.data?.permissions?.rent || '').toLowerCase();
    return rent === 'write' || rent === 'yes' || rent === 'true' || rent === '1';
  }

  async getAccount() {
    return this._request('GET', '/account');
  }

  async getAccountBalances() {
    // Docs: GET /account/balance (singular)
    return this._request('GET', '/account/balance');
  }

  async listProfiles() {
    return this._request('GET', '/account/profile');
  }

  async createOrUpdateProfile(params) {
    return this._request('PUT', '/account/profile', { body: params });
  }

  async listRigs(opts = {}) {
    const {
      algo,
      type = algo || 'sha256ab',
      limit,
      count = limit ?? 50,
      start,
      offset = start ?? 0,
      orderby = 'price',
      rented = false,
      offline = false,
      ...rest
    } = opts;
    // MRR expects boolean strings; default hide rented + offline
    const query = {
      type,
      count,
      offset,
      orderby,
      rented: rented === true || rented === 1 || rented === '1' || rented === 'true' ? 'true' : 'false',
      offline: offline === true || offline === 1 || offline === '1' || offline === 'true' ? 'true' : 'false',
      ...rest,
    };
    return this._request('GET', '/rig', { query });
  }

  async listMyRigs(opts = {}) {
    return this._request('GET', '/rig/mine', { query: opts });
  }

  async getRig(id) {
    return this._request('GET', `/rig/${id}`);
  }

  /** GET /rig/id1;id2;... — batch hydrate by id (chunks of 25) */
  async getRigsBatch(ids = []) {
    const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
    if (!unique.length) return [];
    const out = [];
    const chunkSize = 25;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const res = await this._request('GET', `/rig/${chunk.join(';')}`);
      const data = res?.data;
      if (Array.isArray(data)) out.push(...data);
      else if (data && typeof data === 'object') {
        // single-id responses sometimes return one object
        if (data.id != null) out.push(data);
        else if (Array.isArray(data.records)) out.push(...data.records);
      }
    }
    return out;
  }

  async listRentals(opts = {}) {
    return this._request('GET', '/rental', { query: opts });
  }

  async listAllRentals({ type = 'renter', history = false, max = 1000 } = {}) {
    const rentals = [];
    let start = 0;
    const limit = 100;
    while (start < max) {
      const res = await this.listRentals({
        type,
        history: history ? 1 : 0,
        start,
        limit,
      });
      const batch = res?.data?.rentals || [];
      rentals.push(...batch);
      const total = Number(res?.data?.total || 0);
      start += batch.length;
      if (!batch.length || start >= total) break;
    }
    return rentals;
  }

  async listTransactions(opts = {}) {
    return this._request('GET', '/account/transactions', { query: opts });
  }

  async getRental(id) {
    return this._request('GET', `/rental/${id}`);
  }

  async rentRig(params) {
    // Docs: PUT /rental with rig, length, profile
    const {
      rig, rig_id, length, profile, profile_id, currency = 'BTC', rate, ...rest
    } = params;
    const body = {
      rig: Number(rig ?? rig_id),
      length: Number(length),
      profile: Number(profile ?? profile_id),
      currency,
      ...rest,
    };
    if (rate) body.rate = rate;
    return this._request('PUT', '/rental', { body });
  }

  async extendRental(id, hours) {
    return this._request('POST', '/rig/batch/extend', {
      body: { rigs: [{ id, length: hours }] },
    });
  }

  async getPricing() {
    return this._request('GET', '/pricing');
  }

  /** GET /info/algo/{type} — suggested + last/avg10/20/30/lowest */
  async getAlgoInfo(type) {
    return this._request('GET', `/info/algo/${encodeURIComponent(type)}`);
  }
}
