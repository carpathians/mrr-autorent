# MRR AutoRent

Next.js 15 (App Router) UI + API routes, plus a dedicated worker process, for scanning [MiningRigRentals](https://www.miningrigrentals.com) deals and optional auto-rent.

## Local (dev)

```bash
npm install
npm run dev:all          # Next :3001 + worker (shared DATA_DIR=./data)
# or separately:
npm run worker           # terminal 1
npm run dev              # terminal 2
```

Open **http://127.0.0.1:3001**.

### Test first-run wizard (no keys)

```bash
npm run dev:fresh        # empty DATA_DIR → setup walkthrough
```

### Smoke test (server must already be running)

```bash
npm run test:smoke
```

Keys: `.env` (`MRR_API_KEY` / `MRR_API_SECRET`) or paste in the wizard / Settings.

## Docker (web + worker)

```bash
npm run docker:up        # build + run web:3001 + worker
npm run test:smoke
npm run docker:logs
npm run docker:down
```

SQLite + `candidates.json` persist in volume `mrr-data` (`DATA_DIR=/data`).

## Umbrel

Packaging: https://github.com/carpathians/store  

Community store → **MRR AutoRent** `1.0.0`. Image: `ghcr.io/carpathians/mrr-autorent:latest` (public).

Compose runs **web** (Next standalone) + **worker** (`node worker.mjs`) on the same data volume.

## Architecture

| Process | Role |
| --- | --- |
| `web` | Next.js UI + `/api/*` Route Handlers |
| `worker` | Candidate builder (60s) + rent loop (3m+) |

Shared state: SQLite (`mrr.db`) and `candidates.json` under `DATA_DIR`.
