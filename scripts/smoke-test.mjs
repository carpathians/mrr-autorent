#!/usr/bin/env node
/**
 * Smoke-test a running MRR AutoRent instance (dev server or Docker).
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const base = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/$/, '');

async function waitHealth(timeoutMs = 60000) {
  const start = Date.now();
  let lastErr = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        const body = await res.json();
        if (body?.ok) return;
      }
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`health timeout: ${lastErr}`);
}

async function main() {
  console.log(`Smoke test → ${base}`);
  await waitHealth();
  console.log('✓ /api/health');

  const cfgRes = await fetch(`${base}/api/config`);
  if (!cfgRes.ok) throw new Error(`/api/config → ${cfgRes.status}`);
  const cfg = await cfgRes.json();
  console.log(`✓ /api/config  setup_complete=${Boolean(cfg.setup_complete)}`);

  const statusRes = await fetch(`${base}/api/worker-status`);
  if (!statusRes.ok) throw new Error(`/api/worker-status → ${statusRes.status}`);
  console.log('✓ /api/worker-status');

  const indexRes = await fetch(`${base}/`);
  if (!indexRes.ok) throw new Error(`/ → ${indexRes.status}`);
  const html = await indexRes.text();
  if (!html.includes('MRR AutoRent') && !html.includes('__next')) {
    throw new Error('HTML missing Next shell / brand');
  }
  console.log('✓ / (Next shell)');

  console.log('OK');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
