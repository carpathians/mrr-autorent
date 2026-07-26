import 'server-only';
import { initDb, getConfig, getAllConfig, setConfig } from './db.js';
import { MRRClient } from './mrr-client.js';

let dbReady = false;
let client: InstanceType<typeof MRRClient> | null = null;

export function ensureDb() {
  if (!dbReady) {
    initDb();
    dbReady = true;
  }
}

export function getMrrClient(): InstanceType<typeof MRRClient> {
  ensureDb();
  const apiKey = getConfig('api_key') || process.env.MRR_API_KEY || '';
  const apiSecret = getConfig('api_secret') || process.env.MRR_API_SECRET || '';
  if (!client || client.apiKey !== apiKey || client.apiSecret !== apiSecret) {
    client = new MRRClient(apiKey, apiSecret);
  }
  return client;
}

export function refreshMrrClient() {
  client = null;
  return getMrrClient();
}

export function publicConfig() {
  ensureDb();
  const config = getAllConfig();
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === 'mrr_last_nonce') continue;
    if (key === 'api_key' || key === 'api_secret') {
      out[key] = value ? '••••••••' : '';
      out[`${key}_set`] = Boolean(value);
    } else {
      out[key] = value;
    }
  }
  if (!out.api_key_set && process.env.MRR_API_KEY) out.api_key_set = true;
  if (!out.api_secret_set && process.env.MRR_API_SECRET) out.api_secret_set = true;
  out.setup_complete = Boolean(out.api_key_set && out.api_secret_set);
  return out;
}

export { getConfig, setConfig };
