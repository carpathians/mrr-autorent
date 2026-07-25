import { Router } from 'express';
const router = Router();

// GET /api/my-rigs — list user's own rigs (owner rigs)
router.get('/', async (req, res) => {
  try {
    const client = req.app.locals.mrrClient;
    if (!client?.apiKey || !client?.apiSecret) {
      return res.status(401).json({ error: 'API keys not configured. Add them in Settings.' });
    }

    const who = await client.whoami();
    if (!who?.data?.authed) {
      const msg = (who?.data?.auth_mesage || 'Not authenticated').replace(/\.$/, '');
      return res.status(401).json({
        error: `MRR auth failed: ${msg}. Check API key/secret and that the key has "rigs" permission.`,
      });
    }

    const data = await client.listMyRigs({ hashrate: true });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
