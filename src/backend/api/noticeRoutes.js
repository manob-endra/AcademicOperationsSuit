import express from 'express';
import { noticeService } from '../services/noticeService.js';

const router = express.Router();

// GET /api/notices — all active notices
router.get('/', async (req, res) => {
  try {
    const notices = await noticeService.getAllNotices();
    res.json({ success: true, notices });
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/notices — create notice (admin only)
// Optional attachment fields: document_url, document_name, document_size (the
// file is uploaded to Supabase Storage by the browser before this call).
router.post('/', async (req, res) => {
  try {
    const { title, content, priority, created_by, document_url, document_name, document_size } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }
    // Hard cap: reject anything over 15 MB even if the client sent it.
    const MAX_BYTES = 15 * 1024 * 1024;
    if (document_size != null && Number(document_size) > MAX_BYTES) {
      return res.status(400).json({ success: false, error: 'Document exceeds the 15 MB limit.' });
    }
    const notice = await noticeService.createNotice({
      title, content, priority, created_by,
      document_url: document_url || null,
      document_name: document_name || null,
      document_size: document_size != null ? Number(document_size) : null,
    });
    res.status(201).json({ success: true, notice });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/notices/:id — update notice
router.put('/:id', async (req, res) => {
  try {
    const notice = await noticeService.updateNotice(req.params.id, req.body);
    res.json({ success: true, notice });
  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/notices/:id — soft delete notice
router.delete('/:id', async (req, res) => {
  try {
    await noticeService.deleteNotice(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
