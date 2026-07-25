import { Router } from 'express';
import { getWorkerLogs } from '../db.js';
const router = Router();

// GET /api/worker-logs — get worker logs
router.get('/', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = getWorkerLogs(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
