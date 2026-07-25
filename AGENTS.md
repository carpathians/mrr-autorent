# MRR AutoRent — Agent Instructions

## Project Overview

React dashboard for auto-renting mining rigs from MiningRigRentals (SHA256 Asicboost). A Node.js/Express backend proxies MRR API v2 calls (keeping API keys server-side), runs a periodic auto-rent worker, and serves a Vite-built React frontend.

## Stack

- **Frontend**: React 18 + Vite + TailwindCSS, dark theme, React Router v6
- **Backend**: Express 4, ES modules (`"type": "module"` in package.json)
- **DB**: SQLite via `better-sqlite3` (file at `server/data/mrr.db`)
- **Key deps**: `better-sqlite3`, `cors`, `dotenv`, `express`, `recharts` (installed but unused in current build)

## Key Commands

```bash
npm run dev       # Vite dev server on :5173 (frontend only, proxies /api → :3001)
npm run server    # Express backend on :3001
npm run build     # Vite build → dist/
npm start         # Build + serve (production mode)
```

## Architecture

```
mrr-autorent/
├── server/               # Express backend + worker
│   ├── index.js          # Entry: mounts routes, serves dist/, starts worker
│   ├── mrr-client.js     # MRR API v2 HMAC auth client
│   ├── db.js             # SQLite layer (all DB functions are module-level)
│   ├── worker.js         # Auto-rent background worker (startWorker/stopWorker)
│   └── routes/           # Express route files (rigs, rent, my-rigs, rentals, account, config, profit, worker)
├── src/
│   ├── main.jsx          # Entry point
│   ├── App.jsx           # Router setup
│   ├── api.js            # Fetch wrapper for backend
│   ├── store.jsx         # React context (useReducer) — note: .jsx extension due to JSX
│   ├── index.css         # Tailwind base + custom scrollbar/pulse animations
│   └── components/       # Layout, Dashboard, RigList, AutoRent, MyRigs, Rentals, Profit, WorkerLog, Settings
├── dist/                 # Vite build output (served by Express in production)
├── index.html
├── vite.config.js        # Proxy /api → localhost:3001
├── tailwind.config.js    # Dark theme colors
├── .env                  # MRR_API_KEY, MRR_API_SECRET, PORT
```

## Critical Notes

1. **Store file is `.jsx`** — `src/store.js` was renamed to `src/store.jsx` because Vite rejects JSX in `.js` files. All imports use `import ... from './store'` (no extension) — Vite resolves automatically.

2. **DB functions use module-level `db` instance** — `initDb()` sets the internal db variable. All exported functions (`getConfig`, `setConfig`, etc.) operate on this single instance. No need to pass db around.

3. **MRR API v2 HMAC auth** — Server-side only. The sign string is `apiKey + nonce + endpoint` (no trailing slash). Nonce is `Date.now().toString()`.

4. **Worker starts at server boot** — `startWorker()` is called at the bottom of `server/index.js`. It reads `worker_enabled` from DB config; if false, ticks are skipped but the interval still runs.

5. **`.env` is in `.gitignore`** — API keys are stored in SQLite `config` table after being saved via the Settings UI. The `.env` file is only for initial seed.

6. **Database file** — `server/data/mrr.db` is created on first init. Add `*.db` to `.gitignore`.

7. **Frontend builds to `dist/`** — Express serves `dist/` as static in production. Dev mode uses Vite dev server with proxy.

## MRR Endpoints Used

| Purpose | Method | Endpoint |
|---------|--------|----------|
| List rigs | GET | `/rig?algo=sha256ab` |
| Rig detail | GET | `/rig/{id}` |
| Account info | GET | `/account` |
| Balances | GET | `/account/balances` |
| List rentals | GET | `/rental?type=renter|owner` |
| Create rental | POST | `/rental` |
| Whoami | GET | `/whoami` |

## Common Gotchas

- **Node 18+ required** for native `fetch` API (used in mrr-client.js)
- **`recharts` is listed in deps but unused** — can be removed if not needed
- **`startWorker()` called without `db` argument** — it uses the module-level db from `db.js`
- **`app.locals.mrrClient`** must be set before routes are mounted (order matters in index.js)