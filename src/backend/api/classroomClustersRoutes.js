import express from 'express';
import { classroomClustersService } from '../services/classroomClustersService.js';

const router = express.Router();

/**
 * GET /api/classroom-clusters
 */
router.get('/', async (req, res) => {
  try {
    const result = await classroomClustersService.getClusters();
    if (result.success) {
      res.json({ success: true, data: result.clusters });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clusters' });
  }
});

/**
 * GET /api/classroom-clusters/removed
 * Must be defined before /:id to avoid route conflict
 */
router.get('/removed', async (req, res) => {
  try {
    const result = await classroomClustersService.getRemovedClusters();
    if (result.success) {
      res.json({ success: true, data: result.clusters });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching removed clusters:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch removed clusters' });
  }
});

/**
 * GET /api/classroom-clusters/distances
 * Must be defined before /:id to avoid route conflict
 */
router.get('/distances', async (req, res) => {
  try {
    const result = await classroomClustersService.getDistances();
    if (result.success) {
      res.json({ success: true, data: result.distances });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error fetching distances:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch distances' });
  }
});

/**
 * POST /api/classroom-clusters
 */
router.post('/', async (req, res) => {
  try {
    const { name, rooms } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Cluster name is required' });
    }

    const result = await classroomClustersService.createCluster({
      name: name.trim(),
      rooms: rooms || [],
    });

    if (result.success) {
      res.status(201).json({ success: true, data: result.cluster });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating cluster:', error);
    res.status(500).json({ success: false, error: 'Failed to create cluster' });
  }
});

/**
 * POST /api/classroom-clusters/distances
 * Must be defined before /:id/restore to avoid ambiguity
 */
router.post('/distances', async (req, res) => {
  try {
    const { cluster1Id, cluster2Id, distanceMinutes } = req.body;

    if (!cluster1Id || !cluster2Id) {
      return res.status(400).json({ success: false, error: 'Both cluster IDs are required' });
    }

    const result = await classroomClustersService.upsertDistance(
      cluster1Id,
      cluster2Id,
      distanceMinutes
    );

    if (result.success) {
      res.json({ success: true, data: result.distance });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error saving distance:', error);
    res.status(500).json({ success: false, error: 'Failed to save distance' });
  }
});

/**
 * PUT /api/classroom-clusters/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const result = await classroomClustersService.updateCluster(id, updates);
    if (result.success) {
      res.json({ success: true, data: result.cluster });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error updating cluster:', error);
    res.status(500).json({ success: false, error: 'Failed to update cluster' });
  }
});

/**
 * DELETE /api/classroom-clusters/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await classroomClustersService.deleteCluster(id);

    if (result.success) {
      res.json({ success: true, data: result.cluster });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error deleting cluster:', error);
    res.status(500).json({ success: false, error: 'Failed to delete cluster' });
  }
});

/**
 * POST /api/classroom-clusters/:id/restore
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await classroomClustersService.restoreCluster(id);

    if (result.success) {
      res.json({ success: true, data: result.cluster });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error restoring cluster:', error);
    res.status(500).json({ success: false, error: 'Failed to restore cluster' });
  }
});

export default router;
