import express from 'express';
import { notificationService } from '../services/notificationService.js';

const router = express.Router();

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const result = await notificationService.getAllNotifications();
    if (!result.success) return res.status(500).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const result = await notificationService.getUnreadCount();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, count: 0, error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await notificationService.markAsRead(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/handled
router.patch('/:id/handled', async (req, res) => {
  try {
    const result = await notificationService.markAsHandled(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
