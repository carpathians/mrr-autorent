import 'dotenv/config';
import { initDb, closeDb } from './lib/db.js';
import { startWorker, stopWorker } from './lib/worker-rent.js';

initDb();
startWorker();
console.log('MRR worker running (candidates 60s, rent loop)');

function shutdown() {
  console.log('Worker shutting down...');
  stopWorker();
  closeDb();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
