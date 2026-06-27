import express from 'express';
import { notificationCoreService } from '../services/notificationCoreService.js';

const router = express.Router();

// GET /api/unsubscribe?token=xxxx  — processes the unsubscribe (redirect to frontend confirmation)
router.get('/', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });

  const result = await notificationCoreService.unsubscribeByToken(token);
  if (!result.success) {
    return res.status(404).json({ success: false, error: 'Invalid or expired token' });
  }
  // For API consumers return JSON; the React app handles the UI at /unsubscribe
  res.json({ success: true, email: result.email });
});

// POST /api/unsubscribe  { token }
router.post('/', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  const result = await notificationCoreService.unsubscribeByToken(token);
  if (!result.success) return res.status(404).json({ success: false, error: 'Invalid or expired token' });
  res.json({ success: true, email: result.email });
});

export default router;
