import { Router } from 'express';
import { getConfig } from '../db.js';
import { getCandidateSnapshot, buildCandidates, decideRentAction } from '../candidates.js';

const router = Router();

function withDecision(snap) {
  const decision = decideRentAction({
    waitEndingBetterPct: getConfig('wait_ending_better_pct'),
    waitEndingMaxMin: getConfig('wait_ending_max_min'),
  });
  return { ...snap, decision };
}

// GET /api/candidates — current autorent deal candidates
router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: withDecision(getCandidateSnapshot()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates/refresh — force rebuild (rate-limited by building flag)
router.post('/refresh', async (req, res) => {
  try {
    const client = req.app.locals.mrrClient;
    const data = await buildCandidates(client);
    res.json({ success: true, data: withDecision(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
