import { MRRClient } from './mrr-client.js';
import { getConfig, setConfig, addWorkerLog, addRentalLog } from './db.js';
import {
  startCandidateBuilder,
  stopCandidateBuilder,
  startRentLoop,
  stopRentLoop,
  buildCandidates,
  decideRentAction,
  getCandidateSnapshot,
  computeRentHours,
} from './candidates.js';

let mrrClient = null;

function getClient() {
  const apiKey = getConfig('api_key') || process.env.MRR_API_KEY;
  const apiSecret = getConfig('api_secret') || process.env.MRR_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  // Recreate if keys changed
  if (!mrrClient || mrrClient.apiKey !== apiKey) {
    mrrClient = new MRRClient(apiKey, apiSecret);
  }
  return mrrClient;
}

function cooldownMinutes() {
  const n = parseFloat(getConfig('rent_cooldown_min'));
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

function cooldownRemainingMs() {
  const until = getConfig('rent_cooldown_until');
  if (!until) return 0;
  const ms = new Date(until).getTime() - Date.now();
  return ms > 0 ? ms : 0;
}

async function rentFromCandidates(client) {
  if (!client) {
    addWorkerLog('error', 'API keys not configured');
    return;
  }

  setConfig('last_check', new Date().toISOString());

  const coolMs = cooldownRemainingMs();
  if (coolMs > 0) {
    const until = getConfig('rent_cooldown_until');
    addWorkerLog(
      'skip',
      `Post-rent cooldown — next rent after ${until} (${Math.ceil(coolMs / 60000)} min left)`,
    );
    setConfig('next_check', until);
    return;
  }

  // Prefer fresh snapshot; rebuild only if empty/stale (>2.5 min)
  const snap = getCandidateSnapshot();
  const ageMs = snap.updated_at ? Date.now() - new Date(snap.updated_at).getTime() : Infinity;
  if (!snap.candidates?.length || ageMs > 150000) {
    addWorkerLog('check', 'Refreshing candidates before rent decision');
    await buildCandidates(client);
  }

  const latest = getCandidateSnapshot();
  const available = (latest.candidates || []).filter((c) => c.rentable_now && !c.ending_soon);
  const ending = (latest.candidates || []).filter((c) => c.ending_soon);

  addWorkerLog(
    'check',
    `Candidates: ${available.length} available, ${ending.length} ending soon ` +
      `(updated ${latest.updated_at || 'never'})`
  );

  const decision = decideRentAction({
    waitEndingBetterPct: getConfig('wait_ending_better_pct'),
    waitEndingMaxMin: getConfig('wait_ending_max_min'),
  });

  if (decision.action === 'skip') {
    addWorkerLog('skip', decision.reason || 'Skipped rent');
    return;
  }
  if (decision.action === 'wait') {
    addWorkerLog('skip', decision.reason);
    return;
  }

  const pick = decision.pick;
  if (!pick) {
    addWorkerLog('skip', 'No rentable deal candidates (available + affordable + under market)');
    return;
  }

  const profileId = getConfig('pool_profile_id');
  if (!profileId) {
    addWorkerLog('error', 'pool_profile_id not set (MRR Account → Profiles)');
    return;
  }

  if (!(await client.canRent())) {
    addWorkerLog(
      'error',
      'API key rent permission is read-only. Set Rent = Write on MRR Account → API keys.',
    );
    return;
  }

  const maxHours = parseFloat(getConfig('max_hours') || '24') || 24;
  const bal = parseFloat(latest.balances?.[pick.currency]?.spendable)
    ?? parseFloat(latest.balances?.[pick.currency]?.confirmed)
    ?? 0;
  const length = pick.rent_hours ?? computeRentHours({
    balance: bal,
    minCost: pick.min_cost,
    minHours: pick.minhours,
    maxHours,
    rigMaxHours: pick.maxhours,
    hourCost: pick.hour_cost,
  });
  if (length == null || !(length > 0)) {
    addWorkerLog('skip', `Cannot afford min rental for ${pick.name} (${pick.currency})`);
    return;
  }

  try {
    const rentResult = await client.rentRig({
      rig: pick.id,
      length,
      profile: profileId,
      currency: pick.currency,
    });

    const rentalId = rentResult?.data?.id || rentResult?.data?.rental_id || null;
    addWorkerLog(
      'rent',
      `Rented ${pick.name} (${pick.currency}) −${pick.discount}% vs market for ${length}h (bal ${bal})`,
      pick.id,
      rentalId
    );

    addRentalLog({
      rig_id: Number(pick.id),
      rig_name: pick.name || null,
      role: 'renter',
      rental_id: rentalId ? Number(rentalId) : null,
      started_at: new Date().toISOString(),
      ended_at: null,
      hours: length,
      cost_btc: parseFloat(rentResult?.data?.price?.paid) || pick.min_cost || 0,
      earned_btc: 0,
      status: 'active',
    });

    const coolMin = cooldownMinutes();
    const coolUntil = new Date(Date.now() + coolMin * 60000).toISOString();
    setConfig('last_rent_at', new Date().toISOString());
    setConfig('rent_cooldown_until', coolUntil);
    setConfig('next_check', coolUntil);
    if (coolMin > 0) {
      addWorkerLog('skip', `Cooldown ${coolMin} min after rent — next attempt after ${coolUntil}`);
    }

    // Refresh candidates after a successful rent
    await buildCandidates(client);
  } catch (err) {
    addWorkerLog('error', `Rent failed for ${pick.name}: ${err.message}`, pick.id);
  }
}

export function startWorker() {
  stopWorker();
  startCandidateBuilder(getClient);
  startRentLoop(getClient, rentFromCandidates);
  addWorkerLog('start', 'Worker: candidates every 60s, rent every check_interval (min 3m)');
}

export function stopWorker() {
  stopCandidateBuilder();
  stopRentLoop();
  mrrClient = null;
}

export { getCandidateSnapshot, buildCandidates };
