import express from 'express';
import { notificationCoreService } from '../services/notificationCoreService.js';

const router = express.Router();

// ── Jobs ──────────────────────────────────────────────────────────────────────

// GET /api/notifications/jobs?limit=50
router.get('/jobs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const jobs  = await notificationCoreService.getJobs(limit);
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/jobs/:id/cancel
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    await notificationCoreService.cancelJob(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Deliveries ────────────────────────────────────────────────────────────────

// GET /api/notifications/deliveries?jobId=xxx&status=failed&limit=100&offset=0
router.get('/deliveries', async (req, res) => {
  try {
    const { jobId, status, limit = '100', offset = '0' } = req.query;
    const result = await notificationCoreService.getDeliveries({
      jobId,
      status,
      limit:  Math.min(parseInt(limit), 500),
      offset: parseInt(offset),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/deliveries/:id/retry — reset a single delivery so the worker picks it up
router.post('/deliveries/:id/retry', async (req, res) => {
  try {
    await notificationCoreService.resetDeliveryForResend(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Unsubscribe Management (admin) ────────────────────────────────────────────

// GET /api/notifications/opted-out
router.get('/opted-out', async (req, res) => {
  try {
    const list = await notificationCoreService.getOptedOutList();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/resubscribe  { email }
router.post('/resubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    const result = await notificationCoreService.resubscribeByEmail(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
