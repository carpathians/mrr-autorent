import { Router } from 'express';
const router = Router();

// GET /api/account — account info + BTC balance (normalized for UI)
router.get('/', async (req, res) => {
  try {
    const client = req.app.locals.mrrClient;
    const [account, balances, whoami] = await Promise.all([
      client.getAccount(),
      client.getAccountBalances().catch(() => null),
      client.whoami().catch(() => null),
    ]);

    const data = account?.data || {};
    const bal = balances?.data?.BTC || {};
    const perms = whoami?.data?.permissions || {};
    const rentPerm = String(perms.rent || '').toLowerCase();
    const canRent = rentPerm === 'write' || rentPerm === 'yes' || rentPerm === 'true' || rentPerm === '1';
    res.json({
      success: true,
      data: {
        ...data,
        balance_btc: bal.confirmed ?? null,
        balance_btc_unconfirmed: bal.unconfirmed ?? null,
        balances: balances?.data || null,
        permissions: perms,
        can_rent: canRent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/account/balances
router.get('/balances', async (req, res) => {
  try {
    const data = await req.app.locals.mrrClient.getAccountBalances();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/account/profiles — MRR pool profiles
router.get('/profiles', async (req, res) => {
  try {
    const data = await req.app.locals.mrrClient.listProfiles();
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.data?.profiles)
        ? data.data.profiles
        : [];
    res.json({
      success: true,
      data: list.map((p) => ({
        id: String(p.id),
        name: p.name || `Profile ${p.id}`,
        algo: p.algo?.name || p.algo || null,
        algo_display: p.algo?.display || null,
        pool_count: Array.isArray(p.pools) ? p.pools.length : 0,
        pools: Array.isArray(p.pools)
          ? p.pools.map((pool) => ({
              id: pool.id,
              name: pool.name || `${pool.host}:${pool.port}`,
              host: pool.host,
              port: pool.port,
              user: pool.user,
              priority: pool.priority,
            }))
          : [],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
