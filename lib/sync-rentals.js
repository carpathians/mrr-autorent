import {
  getConfig,
  setConfig,
  upsertMrrRental,
  getKnownRentalIds,
  countMrrRentals,
} from './db.js';

function mapRental(r, role) {
  const currency = r.price?.currency || 'BTC';
  const paid = parseFloat(r.price?.paid) || 0;
  return {
    rental_id: Number(r.id),
    role,
    rig_id: r.rig?.id != null ? Number(r.rig.id) : null,
    rig_name: r.rig?.name || null,
    currency,
    paid,
    hours: parseFloat(r.length) || 0,
    started_at: r.start || null,
    ended_at: r.end || null,
    start_unix: r.start_unix != null ? Number(r.start_unix) : null,
    end_unix: r.end_unix != null ? Number(r.end_unix) : null,
    ended: r.ended ? 1 : 0,
    status: r.ended ? 'complete' : 'active',
    raw_json: JSON.stringify(r),
  };
}

async function fetchPages(client, { type, history, maxPages = 50 }) {
  const out = [];
  let start = 0;
  const limit = 100;
  for (let page = 0; page < maxPages; page++) {
    const res = await client.listRentals({
      type,
      history: history ? 1 : 0,
      start,
      limit,
    });
    const batch = res?.data?.rentals || [];
    out.push(...batch);
    const total = Number(res?.data?.total || 0);
    start += batch.length;
    if (!batch.length || start >= total) break;
  }
  return out;
}

/**
 * Incremental sync:
 * - Always pull active rentals (small) and upsert
 * - History: full bootstrap once, then only pages until we hit already-known IDs
 */
async function syncRole(client, role) {
  const bootKey = `rentals_sync_bootstrapped_${role}`;
  const bootstrapped = getConfig(bootKey) === '1';
  const known = getKnownRentalIds(role);
  let inserted = 0;
  let updated = 0;

  // Active always
  const active = await fetchPages(client, { type: role, history: false, maxPages: 20 });
  for (const r of active) {
    const row = mapRental(r, role);
    const { changes, isNew } = upsertMrrRental(row);
    if (isNew) inserted++;
    else if (changes) updated++;
  }

  // History
  if (!bootstrapped) {
    const hist = await fetchPages(client, { type: role, history: true, maxPages: 100 });
    for (const r of hist) {
      const row = mapRental(r, role);
      const { changes, isNew } = upsertMrrRental(row);
      if (isNew) inserted++;
      else if (changes) updated++;
      known.add(row.rental_id);
    }
    setConfig(bootKey, '1');
  } else {
    // Newest-first pages until a full page is already known
    let start = 0;
    const limit = 100;
    for (let page = 0; page < 20; page++) {
      const res = await client.listRentals({
        type: role,
        history: 1,
        start,
        limit,
      });
      const batch = res?.data?.rentals || [];
      if (!batch.length) break;

      let newOnPage = 0;
      for (const r of batch) {
        const row = mapRental(r, role);
        const wasKnown = known.has(row.rental_id);
        const { changes, isNew } = upsertMrrRental(row);
        if (isNew) {
          inserted++;
          newOnPage++;
          known.add(row.rental_id);
        } else if (changes) {
          updated++;
        }
        if (!wasKnown && !isNew) known.add(row.rental_id);
      }

      start += batch.length;
      const total = Number(res?.data?.total || 0);
      if (newOnPage === 0) break; // caught up
      if (start >= total) break;
    }
  }

  return { role, active: active.length, inserted, updated, total: countMrrRentals(role) };
}

export async function syncRentals(client) {
  const renter = await syncRole(client, 'renter');
  const owner = await syncRole(client, 'owner');
  const at = new Date().toISOString();
  setConfig('rentals_last_sync', at);
  return { at, renter, owner };
}
