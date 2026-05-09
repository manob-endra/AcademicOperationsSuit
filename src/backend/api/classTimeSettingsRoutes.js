import express from 'express';
import { classTimeSettingsService } from '../services/classTimeSettingsService.js';

const router = express.Router();

/**
 * GET /api/class-time-settings
 * Get the active class time settings
 */
router.get('/', async (req, res) => {
  try {
    const result = await classTimeSettingsService.getSettings();
    if (result.success) {
      res.json({ success: true, data: result.settings });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching class time settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch class time settings' });
  }
});

/**
 * POST /api/class-time-settings
 * Create new class time settings
 */
router.post('/', async (req, res) => {
  try {
    const settingsData = req.body;

    // Validate required fields
    const requiredFields = ['startTime', 'duration', 'classesBeforeLunch', 'lunchDuration', 'classesAfterLunch', 'classDay', 'skipTime'];
    const missingFields = requiredFields.filter(field => settingsData[field] === undefined || settingsData[field] === null);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const result = await classTimeSettingsService.saveSettings(settingsData);
    if (result.success) {
      res.status(201).json({ success: true, data: result.settings });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating class time settings:', error);
    res.status(500).json({ success: false, error: 'Failed to create class time settings' });
  }
});

/**
 * PUT /api/class-time-settings/:id
 * Update class time settings
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const result = await classTimeSettingsService.updateSettings(id, updates);
    if (result.success) {
      res.json({ success: true, data: result.settings });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error updating class time settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update class time settings' });
  }
});

export default router;
