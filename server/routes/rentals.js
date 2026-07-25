import { Router } from 'express';
const router = Router();

// GET /api/rentals — list rentals
router.get('/', async (req, res) => {
  try {
    const { type, history } = req.query;
    const opts = {};
    if (type) opts.type = type;
    if (history !== undefined) opts.history = history === 'true' ? 1 : 0;

    const data = await req.app.locals.mrrClient.listRentals(opts);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rentals/:id — get single rental details
router.get('/:id', async (req, res) => {
  try {
    const data = await req.app.locals.mrrClient.getRental(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
