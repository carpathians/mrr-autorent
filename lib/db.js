import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';

// DATA_DIR for Docker/Umbrel; local default: <cwd>/data
export const dataDir = resolve(process.env.DATA_DIR || join(process.cwd(), 'data'));
const dbPath = resolve(dataDir, 'mrr.db');

mkdirSync(dataDir, { recursive: true });

let db;

export function initDb() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rental_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rig_id INTEGER,
      rig_name TEXT,
      role TEXT CHECK(role IN ('renter', 'owner')),
      rental_id INTEGER,
      started_at TEXT,
      ended_at TEXT,
      hours REAL DEFAULT 0,
      cost_btc REAL DEFAULT 0,
      earned_btc REAL DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS worker_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      details TEXT,
      rig_id INTEGER,
      rental_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_summary (
      date TEXT PRIMARY KEY,
      total_spent REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      net_profit REAL DEFAULT 0,
      owner_hours_rented REAL DEFAULT 0,
      renter_hours_used REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mrr_rentals (
      rental_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('renter', 'owner')),
      rig_id INTEGER,
      rig_name TEXT,
      currency TEXT,
      paid REAL DEFAULT 0,
      hours REAL DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      start_unix INTEGER,
      end_unix INTEGER,
      ended INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      raw_json TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (rental_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_mrr_rentals_started ON mrr_rentals(started_at);
    CREATE INDEX IF NOT EXISTS idx_mrr_rentals_role ON mrr_rentals(role);
    CREATE INDEX IF NOT EXISTS idx_mrr_rentals_currency ON mrr_rentals(currency);
  `);

  return db;
}

export function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : undefined;
}

export function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllConfig() {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

export function addRentalLog(data) {
  const stmt = db.prepare(`
    INSERT INTO rental_logs (rig_id, rig_name, role, rental_id, started_at, ended_at, hours, cost_btc, earned_btc, status)
    VALUES (@rig_id, @rig_name, @role, @rental_id, @started_at, @ended_at, @hours, @cost_btc, @earned_btc, @status)
  `);
  const info = stmt.run(data);
  return info.lastInsertRowid;
}

export function getRentalLogs(filters = {}) {
  let sql = 'SELECT * FROM rental_logs WHERE 1=1';
  const params = [];

  if (filters.role) {
    sql += ' AND role = ?';
    params.push(filters.role);
  }

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params);
}

export function addWorkerLog(action, details, rigId, rentalId) {
  const ts = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO worker_logs (timestamp, action, details, rig_id, rental_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(ts, action, details ?? null, rigId ?? null, rentalId ?? null);
  // Mirror to stdout so docker/compose logs show the same trail
  try {
    const tag = String(action || 'log').toUpperCase();
    const extra = rigId != null ? ` rig:${rigId}` : '';
    console.log(`[worker ${ts}] ${tag}${extra} ${details || ''}`);
  } catch {
    /* ignore */
  }
}

export function getWorkerLogs(limit = 100, { action } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (action) {
    return db.prepare(
      'SELECT * FROM worker_logs WHERE action = ? ORDER BY id DESC LIMIT ?'
    ).all(action, lim);
  }
  return db.prepare('SELECT * FROM worker_logs ORDER BY id DESC LIMIT ?').all(lim);
}

/** Recent errors for UI banners (newest first). */
export function getRecentWorkerErrors(limit = 10) {
  return getWorkerLogs(limit, { action: 'error' });
}

export function touchWorkerHeartbeat(extra = {}) {
  const now = new Date().toISOString();
  setConfig('worker_heartbeat', now);
  if (extra.phase) setConfig('worker_last_phase', String(extra.phase));
  return now;
}

export function updateDailySummary(date, data) {
  const stmt = db.prepare(`
    INSERT INTO daily_summary (date, total_spent, total_earned, net_profit, owner_hours_rented, renter_hours_used)
    VALUES (@date, @total_spent, @total_earned, @net_profit, @owner_hours_rented, @renter_hours_used)
    ON CONFLICT(date) DO UPDATE SET
      total_spent = @total_spent,
      total_earned = @total_earned,
      net_profit = @net_profit,
      owner_hours_rented = @owner_hours_rented,
      renter_hours_used = @renter_hours_used
  `);
  stmt.run({ date, ...data });
}

export function getDailySummaries(startDate, endDate) {
  return db.prepare(
    'SELECT * FROM daily_summary WHERE date >= ? AND date <= ? ORDER BY date ASC'
  ).all(startDate, endDate);
}

export function getProfitSummary() {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN role = 'renter' AND currency = 'BTC' THEN paid ELSE 0 END), 0) AS total_spent,
      COALESCE(SUM(CASE WHEN role = 'owner' AND currency = 'BTC' THEN paid ELSE 0 END), 0) AS total_earned,
      COALESCE(SUM(CASE WHEN role = 'owner' THEN hours ELSE 0 END), 0) AS owner_hours,
      COALESCE(SUM(CASE WHEN role = 'renter' THEN hours ELSE 0 END), 0) AS renter_hours,
      COALESCE(SUM(CASE WHEN role = 'renter' THEN 1 ELSE 0 END), 0) AS renter_count,
      COALESCE(SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END), 0) AS owner_count
    FROM mrr_rentals
  `).get();
  return {
    ...row,
    net_profit: (row.total_earned || 0) - (row.total_spent || 0),
  };
}

export function getProfitByCurrency() {
  return db.prepare(`
    SELECT
      currency,
      COALESCE(SUM(CASE WHEN role = 'renter' THEN paid ELSE 0 END), 0) AS spent,
      COALESCE(SUM(CASE WHEN role = 'owner' THEN paid ELSE 0 END), 0) AS earned
    FROM mrr_rentals
    GROUP BY currency
    ORDER BY currency
  `).all().map((r) => ({
    currency: r.currency,
    spent: r.spent,
    earned: r.earned,
    net: r.earned - r.spent,
  }));
}

export function getProfitDaily(startDate, endDate) {
  let sql = `
    SELECT
      substr(started_at, 1, 10) AS date,
      COALESCE(SUM(CASE WHEN role = 'renter' AND currency = 'BTC' THEN paid ELSE 0 END), 0) AS total_spent,
      COALESCE(SUM(CASE WHEN role = 'owner' AND currency = 'BTC' THEN paid ELSE 0 END), 0) AS total_earned,
      COALESCE(SUM(CASE WHEN role = 'owner' THEN hours ELSE 0 END), 0) AS owner_hours_rented,
      COALESCE(SUM(CASE WHEN role = 'renter' THEN hours ELSE 0 END), 0) AS renter_hours_used
    FROM mrr_rentals
    WHERE started_at IS NOT NULL
  `;
  const params = [];
  if (startDate) {
    sql += ' AND substr(started_at, 1, 10) >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND substr(started_at, 1, 10) <= ?';
    params.push(endDate);
  }
  sql += ' GROUP BY substr(started_at, 1, 10) ORDER BY date ASC';

  return db.prepare(sql).all(...params).map((d) => ({
    ...d,
    net_profit: d.total_earned - d.total_spent,
  }));
}

export function getKnownRentalIds(role) {
  const rows = db.prepare('SELECT rental_id FROM mrr_rentals WHERE role = ?').all(role);
  return new Set(rows.map((r) => r.rental_id));
}

export function countMrrRentals(role) {
  if (role) {
    return db.prepare('SELECT COUNT(*) AS c FROM mrr_rentals WHERE role = ?').get(role).c;
  }
  return db.prepare('SELECT COUNT(*) AS c FROM mrr_rentals').get().c;
}

export function upsertMrrRental(row) {
  const existing = db.prepare(
    'SELECT paid, hours, ended, status, ended_at FROM mrr_rentals WHERE rental_id = ? AND role = ?'
  ).get(row.rental_id, row.role);

  db.prepare(`
    INSERT INTO mrr_rentals (
      rental_id, role, rig_id, rig_name, currency, paid, hours,
      started_at, ended_at, start_unix, end_unix, ended, status, raw_json, updated_at
    ) VALUES (
      @rental_id, @role, @rig_id, @rig_name, @currency, @paid, @hours,
      @started_at, @ended_at, @start_unix, @end_unix, @ended, @status, @raw_json, datetime('now')
    )
    ON CONFLICT(rental_id, role) DO UPDATE SET
      rig_id = excluded.rig_id,
      rig_name = excluded.rig_name,
      currency = excluded.currency,
      paid = excluded.paid,
      hours = excluded.hours,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      start_unix = excluded.start_unix,
      end_unix = excluded.end_unix,
      ended = excluded.ended,
      status = excluded.status,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
  `).run(row);

  if (!existing) return { changes: true, isNew: true };
  const changed =
    existing.paid !== row.paid ||
    existing.hours !== row.hours ||
    existing.ended !== row.ended ||
    existing.status !== row.status ||
    existing.ended_at !== row.ended_at;
  return { changes: changed, isNew: false };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
