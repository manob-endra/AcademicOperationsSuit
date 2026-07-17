import express from 'express';
import { roomAllocationService } from '../services/roomAllocationService.js';
import { requireSemester } from './requireSemester.js';

const router = express.Router();

router.use(requireSemester);

// GET /api/room-allocation?semesterId=...
router.get('/', async (req, res) => {
  const result = await roomAllocationService.getAllocation(req.semesterId);
  if (result.success) return res.json({ success: true, data: result.data });
  res.status(500).json({ success: false, error: result.error });
});

// POST /api/room-allocation   body: { semesterId, theoryRooms, labRooms, semesterTheoryRooms }
router.post('/', async (req, res) => {
  const { theoryRooms, labRooms, semesterTheoryRooms } = req.body;
  if (!Array.isArray(theoryRooms) || !Array.isArray(labRooms)) {
    return res.status(400).json({ success: false, error: 'theoryRooms and labRooms must be arrays.' });
  }
  const result = await roomAllocationService.saveAllocation(
    req.semesterId,
    theoryRooms,
    labRooms,
    semesterTheoryRooms || {}
  );
  if (result.success) return res.json({ success: true });
  res.status(500).json({ success: false, error: result.error });
});

export default router;
