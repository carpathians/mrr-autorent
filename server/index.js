import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb, getConfig, setConfig, closeDb } from './db.js';
import { MRRClient } from './mrr-client.js';
import { startWorker } from './worker.js';
import rigsRoutes from './routes/rigs.js';
import dealsRoutes from './routes/deals.js';
import candidatesRoutes from './routes/candidates.js';
import rentRoutes from './routes/rent.js';
import myRigsRoutes from './routes/my-rigs.js';
import rentalsRoutes from './routes/rentals.js';
import accountRoutes from './routes/account.js';
import configRoutes from './routes/config.js';
import profitRoutes from './routes/profit.js';
import workerRoutes from './routes/worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Init DB
initDb();

// Create MRR client and attach to app locals
const apiKey = getConfig('api_key') || process.env.MRR_API_KEY || '';
const apiSecret = getConfig('api_secret') || process.env.MRR_API_SECRET || '';
const mrrClient = new MRRClient(apiKey, apiSecret);
app.locals.mrrClient = mrrClient;

// Routes
app.use('/api/rigs', rigsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/my-rigs', myRigsRoutes);
app.use('/api/rentals', rentalsRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/config', configRoutes);
app.use('/api/profit', profitRoutes);
app.use('/api/worker-logs', workerRoutes);

// Inline worker status routes
app.get('/api/worker-status', (req, res) => {
  try {
    const enabled = getConfig('worker_enabled') === 'true';
    const lastCheck = getConfig('last_check') || null;
    const nextCheck = getConfig('next_check') || null;
    const cooldownUntil = getConfig('rent_cooldown_until') || null;
    const coolMs = cooldownUntil
      ? Math.max(0, new Date(cooldownUntil).getTime() - Date.now())
      : 0;
    const coolCfg = parseFloat(getConfig('rent_cooldown_min'));
    res.json({
      enabled,
      lastCheck,
      nextCheck,
      lastRentAt: getConfig('last_rent_at') || null,
      cooldownUntil: coolMs > 0 ? cooldownUntil : null,
      cooldownRemainingMin: coolMs > 0 ? Math.ceil(coolMs / 60000) : 0,
      cooldownMin: Number.isFinite(coolCfg) && coolCfg >= 0 ? coolCfg : 30,
      candidateIntervalSec: 60,
      rentIntervalMin: 3,
      candidates: {
        updated_at: getConfig('candidates_updated_at') || null,
        count: parseInt(getConfig('candidates_count') || '0', 10) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/worker-toggle', (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    setConfig('worker_enabled', enabled ? 'true' : 'false');
    const lastCheck = getConfig('last_check') || null;
    const nextCheck = getConfig('next_check') || null;
    res.json({ enabled, lastCheck, nextCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.use(express.static(join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Start worker
startWorker();

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...');
  closeDb();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
