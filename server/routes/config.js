import { Router } from 'express';
import { getAllConfig, getConfig, setConfig } from '../db.js';
import { MRRClient } from '../mrr-client.js';

const router = Router();
function refreshMrrClient(app) {
  const apiKey = getConfig('api_key') || process.env.MRR_API_KEY || '';
  const apiSecret = getConfig('api_secret') || process.env.MRR_API_SECRET || '';
  app.locals.mrrClient = new MRRClient(apiKey, apiSecret);
}

function publicConfig() {
  const config = getAllConfig();
  const out = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === 'mrr_last_nonce') continue;
    if (key === 'api_key' || key === 'api_secret') {
      out[key] = value ? '••••••••' : '';
      out[`${key}_set`] = Boolean(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// GET /api/config — return config (secrets masked)
router.get('/', (req, res) => {
  try {
    res.json(publicConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config — update config values
router.post('/', (req, res) => {
  try {
    const updates = req.body || {};
    for (const [key, value] of Object.entries(updates)) {
      if (key.endsWith('_set')) continue;
      // Ignore masked placeholders so Save doesn't wipe secrets
      if ((key === 'api_key' || key === 'api_secret') && (!value || String(value).includes('•'))) {
        continue;
      }
      setConfig(key, String(value));
    }
    if ('api_key' in updates || 'api_secret' in updates) {
      refreshMrrClient(req.app);
    }
    res.json(publicConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
