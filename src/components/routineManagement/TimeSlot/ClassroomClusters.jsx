import { useState, useEffect, useRef } from 'react';
import { classroomClustersAPI } from '../../../services/classroomClustersAPI';
import './styles/ClassroomClusters.css';

/* ─── Shared pop-up components ─────────────────────────────────────────── */

function AlertModal({ isOpen, message, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay cc-alert-overlay" onClick={onClose}>
      <div className="modal-content cc-alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notice</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>
        <div className="modal-body">
          <p className="cc-popup-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-submit" onClick={onClose} type="button">OK</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, message, confirmLabel, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay cc-confirm-overlay" onClick={onCancel}>
      <div className="modal-content cc-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm</h2>
          <button className="modal-close" onClick={onCancel} type="button">&times;</button>
        </div>
        <div className="modal-body">
          <p className="cc-popup-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel} type="button">Cancel</button>
          <button className="btn-submit btn-remove-danger" onClick={onConfirm} type="button">
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Feature modals ────────────────────────────────────────────────────── */

function RemovedClustersModal({ isOpen, removedClusters, onRestore, onClose, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content removed-clusters-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Removed Clusters</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p className="loading-text">Loading removed clusters...</p>
          ) : removedClusters.length === 0 ? (
            <p className="no-removed-clusters">No clusters have been removed yet.</p>
          ) : (
            <div className="removed-clusters-list">
              {removedClusters.map((cluster) => (
                <div key={cluster.id} className="removed-cluster-item">
                  <div className="removed-cluster-info">
                    <h4 className="removed-cluster-name">{cluster.name}</h4>
                    <div className="removed-cluster-rooms">
                      {(cluster.rooms || []).length === 0 ? (
                        <span className="no-rooms-text">No rooms</span>
                      ) : (
                        (cluster.rooms || []).map((room, idx) => (
                          <span key={idx} className="removed-room-badge">{room}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <button className="btn-restore" onClick={() => onRestore(cluster.id)} type="button">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </div>
  );
}

function RemoveClusterModal({ isOpen, clusters, selectedClusterId, onSelectCluster, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content remove-cluster-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Remove Classroom Cluster</h2>
          <button className="modal-close" onClick={onCancel} type="button">&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="cluster-to-remove">Which cluster should be removed?</label>
            <select
              id="cluster-to-remove"
              value={selectedClusterId}
              onChange={(e) => onSelectCluster(e.target.value)}
            >
              <option value="">Select a cluster</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
              ))}
            </select>
          </div>
          <p className="remove-cluster-warning">
            This will move the cluster to a removed state. You can restore it later using
            the &quot;Removed Clusters&quot; button.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel} type="button">Cancel</button>
          <button
            className="btn-submit btn-remove-danger"
            onClick={onConfirm}
            type="button"
            disabled={!selectedClusterId}
          >
            Remove Cluster
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */

function ClassroomClusters() {
  const [clusters, setClusters] = useState([]);
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feature modals
  const [showModal, setShowModal] = useState(false);
  const [showRemoveClusterModal, setShowRemoveClusterModal] = useState(false);
  const [showRemovedClustersModal, setShowRemovedClustersModal] = useState(false);
  const [removedClusters, setRemovedClusters] = useState([]);
  const [removedClustersLoading, setRemovedClustersLoading] = useState(false);
  const [clusterToRemoveId, setClusterToRemoveId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [classroomNumbers, setClassroomNumbers] = useState('');
  const [editingCluster, setEditingCluster] = useState(null);
  const [newRoom, setNewRoom] = useState('');

  // Custom alert state
  const [alertState, setAlertState] = useState({ open: false, message: '' });

  // Custom confirm state — resolve stored in ref so it outlives re-renders
  const [confirmState, setConfirmState] = useState({ open: false, message: '', confirmLabel: 'Confirm' });
  const confirmResolveRef = useRef(null);

  // Distance toast
  const [distanceToast, setDistanceToast] = useState({ visible: false, message: '', key: 0 });
  const toastTimeoutRef = useRef(null);

  const distanceDebounceRef = useRef({});

  useEffect(() => {
    loadData();
    return () => {
      Object.values(distanceDebounceRef.current).forEach(clearTimeout);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  /* ── Dialog helpers ─────────────────────────────────────────────────── */

  const showAlert = (message) => {
    setAlertState({ open: true, message });
  };

  const showConfirm = (message, confirmLabel = 'Confirm') => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ open: true, message, confirmLabel });
    });
  };

  const handleConfirmYes = () => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolveRef.current?.(true);
    confirmResolveRef.current = null;
  };

  const handleConfirmNo = () => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
  };

  const showDistanceToast = (value) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setDistanceToast((prev) => ({
      visible: true,
      message: `Distance updated: ${value || 0} min`,
      key: prev.key + 1,
    }));
    toastTimeoutRef.current = setTimeout(() => {
      setDistanceToast((prev) => ({ ...prev, visible: false }));
    }, 2500);
  };

  /* ── Data loading ───────────────────────────────────────────────────── */

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [clustersResult, distancesResult] = await Promise.all([
      classroomClustersAPI.getClusters(),
      classroomClustersAPI.getDistances(),
    ]);

    if (clustersResult.success) {
      setClusters(clustersResult.data || []);
    } else {
      setError(
        clustersResult.offline
          ? 'Backend server is not running. Please start it with: npm run dev'
          : clustersResult.error
      );
    }

    if (distancesResult.success) {
      const distancesObj = {};
      (distancesResult.data || []).forEach((d) => {
        const key = generateDistanceKey(d.cluster1_id, d.cluster2_id);
        distancesObj[key] = d.distance_minutes;
      });
      setDistances(distancesObj);
    }

    setLoading(false);
  };

  /* ── Helpers ────────────────────────────────────────────────────────── */

  // '||' separator avoids clashing with UUID hyphens
  const generateDistanceKey = (cluster1, cluster2) => {
    const sorted = [String(cluster1), String(cluster2)].sort();
    return `${sorted[0]}||${sorted[1]}`;
  };

  /* ── Cluster actions ────────────────────────────────────────────────── */

  const addCluster = async () => {
    if (!clusterName.trim() || !classroomNumbers.trim()) {
      showAlert('Please enter both cluster name and classroom numbers.');
      return;
    }

    const roomArray = classroomNumbers
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r);

    if (roomArray.length === 0) {
      showAlert('Please enter valid classroom numbers.');
      return;
    }

    const result = await classroomClustersAPI.createCluster({
      name: clusterName.trim(),
      rooms: roomArray,
    });

    if (result.success) {
      const newCluster = result.data;
      const currentClusters = clusters;

      setClusters((prev) => [...prev, newCluster]);
      setDistances((prev) => {
        const updated = { ...prev };
        currentClusters.forEach((existing) => {
          const key = generateDistanceKey(newCluster.id, existing.id);
          if (!(key in updated)) updated[key] = 0;
        });
        return updated;
      });

      setClusterName('');
      setClassroomNumbers('');
      setShowModal(false);
    } else {
      showAlert(`Failed to create cluster: ${result.error}`);
    }
  };

  const removeCluster = async (clusterId) => {
    if (!clusterId) return;

    const result = await classroomClustersAPI.deleteCluster(clusterId);
    if (result.success) {
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
      setDistances((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (key.includes(clusterId)) delete updated[key];
        });
        return updated;
      });
    } else {
      showAlert(`Failed to remove cluster: ${result.error}`);
    }
  };

  const openRemoveClusterModal = (clusterId = '') => {
    if (clusters.length === 0) {
      showAlert('No clusters available to remove.');
      return;
    }
    setClusterToRemoveId(clusterId ? String(clusterId) : '');
    setShowRemoveClusterModal(true);
  };

  const confirmRemoveCluster = async () => {
    if (!clusterToRemoveId) {
      showAlert('Please select a cluster to remove.');
      return;
    }

    const cluster = clusters.find((item) => item.id === clusterToRemoveId);
    if (!cluster) {
      showAlert('The selected cluster could not be found.');
      return;
    }

    const confirmed = await showConfirm(
      `Remove the cluster "${cluster.name}"?\n\nIt will be moved to removed state and can be restored later.`,
      'Remove'
    );
    if (!confirmed) return;

    await removeCluster(cluster.id);
    setShowRemoveClusterModal(false);
    setClusterToRemoveId('');
  };

  const openRemovedClustersModal = async () => {
    setShowRemovedClustersModal(true);
    setRemovedClustersLoading(true);

    const result = await classroomClustersAPI.getRemovedClusters();
    if (result.success) {
      setRemovedClusters(result.data || []);
    } else {
      showAlert(`Failed to load removed clusters: ${result.error}`);
    }

    setRemovedClustersLoading(false);
  };

  const restoreCluster = async (clusterId) => {
    const result = await classroomClustersAPI.restoreCluster(clusterId);
    if (result.success) {
      setRemovedClusters((prev) => prev.filter((c) => c.id !== clusterId));
      setClusters((prev) => [...prev, result.data]);
    } else {
      showAlert(`Failed to restore cluster: ${result.error}`);
    }
  };

  /* ── Room actions ───────────────────────────────────────────────────── */

  const addRoomToCluster = async (clusterId, roomNumber) => {
    if (!roomNumber.trim()) {
      showAlert('Please enter a room number.');
      return;
    }

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return;

    const newRooms = [...(cluster.rooms || []), roomNumber.trim()];
    const result = await classroomClustersAPI.updateCluster(clusterId, { rooms: newRooms });

    if (result.success) {
      setClusters((prev) =>
        prev.map((c) => (c.id === clusterId ? { ...c, rooms: result.data.rooms || [] } : c))
      );
      setNewRoom('');
      setEditingCluster(null);
    } else {
      showAlert(`Failed to add room: ${result.error}`);
    }
  };

  const removeRoomFromCluster = async (clusterId, roomIndex, roomNumber) => {
    const confirmed = await showConfirm(
      `Remove classroom "${roomNumber}" from this cluster?`,
      'Remove'
    );
    if (!confirmed) return;

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return;

    const newRooms = (cluster.rooms || []).filter((_, i) => i !== roomIndex);
    const result = await classroomClustersAPI.updateCluster(clusterId, { rooms: newRooms });

    if (result.success) {
      setClusters((prev) =>
        prev.map((c) => (c.id === clusterId ? { ...c, rooms: result.data.rooms || [] } : c))
      );
    } else {
      showAlert(`Failed to remove room: ${result.error}`);
    }
  };

  /* ── Distance actions ───────────────────────────────────────────────── */

  const updateDistance = (cluster1Id, cluster2Id, distance) => {
    const key = generateDistanceKey(cluster1Id, cluster2Id);
    setDistances((prev) => ({ ...prev, [key]: distance }));

    if (distanceDebounceRef.current[key]) clearTimeout(distanceDebounceRef.current[key]);
    distanceDebounceRef.current[key] = setTimeout(async () => {
      await classroomClustersAPI.upsertDistance(cluster1Id, cluster2Id, Number(distance) || 0);
      delete distanceDebounceRef.current[key];
    }, 600);
  };

  const getDistance = (cluster1Id, cluster2Id) => {
    const key = generateDistanceKey(cluster1Id, cluster2Id);
    return distances[key] ?? 0;
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="classroom-clusters-container">
        <div className="clusters-loading">Loading clusters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="classroom-clusters-container">
        <div className="clusters-error">
          <p>{error}</p>
          <button className="btn-retry" onClick={loadData} type="button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="classroom-clusters-container">

      {/* ── Custom dialogs (always mounted so promises resolve correctly) ── */}
      <AlertModal
        isOpen={alertState.open}
        message={alertState.message}
        onClose={() => setAlertState({ open: false, message: '' })}
      />
      <ConfirmModal
        isOpen={confirmState.open}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={handleConfirmYes}
        onCancel={handleConfirmNo}
      />

      {/* ── Distance toast ───────────────────────────────────────────────── */}
      {distanceToast.visible && (
        <div key={distanceToast.key} className="distance-toast">
          <span className="distance-toast-icon">✓</span>
          {distanceToast.message}
        </div>
      )}

      {/* ── Header buttons ───────────────────────────────────────────────── */}
      <div className="clusters-header">
        <button className="btn-add-cluster" onClick={() => setShowModal(true)} type="button">
          Add a Classroom Cluster
        </button>
        <button
          className="btn-remove-cluster"
          onClick={() => openRemoveClusterModal()}
          disabled={clusters.length === 0}
          title="Remove a cluster"
          type="button"
        >
          Remove a Cluster
        </button>
        <button
          className="btn-removed-clusters"
          onClick={openRemovedClustersModal}
          title="View and restore removed clusters"
          type="button"
        >
          Removed Clusters
        </button>
      </div>

      {/* ── Add Cluster Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Classroom Cluster</h2>
              <button
                className="modal-close"
                onClick={() => { setShowModal(false); setClusterName(''); setClassroomNumbers(''); }}
                type="button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cluster Name:</label>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="e.g., Block A"
                />
              </div>
              <div className="form-group">
                <label>Classroom Numbers (comma-separated):</label>
                <textarea
                  value={classroomNumbers}
                  onChange={(e) => setClassroomNumbers(e.target.value)}
                  placeholder="e.g., 101, 102, 103, 104"
                  rows="4"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => { setShowModal(false); setClusterName(''); setClassroomNumbers(''); }}
                type="button"
              >
                Cancel
              </button>
              <button className="btn-submit" onClick={addCluster} type="button">
                Create Cluster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Cluster Modal ──────────────────────────────────────────── */}
      {showRemoveClusterModal && (
        <RemoveClusterModal
          isOpen={showRemoveClusterModal}
          clusters={clusters}
          selectedClusterId={clusterToRemoveId}
          onSelectCluster={setClusterToRemoveId}
          onConfirm={confirmRemoveCluster}
          onCancel={() => { setShowRemoveClusterModal(false); setClusterToRemoveId(''); }}
        />
      )}

      {/* ── Removed Clusters Modal ────────────────────────────────────────── */}
      <RemovedClustersModal
        isOpen={showRemovedClustersModal}
        removedClusters={removedClusters}
        onRestore={restoreCluster}
        onClose={() => setShowRemovedClustersModal(false)}
        loading={removedClustersLoading}
      />

      {/* ── Distance Table ────────────────────────────────────────────────── */}
      {clusters.length > 1 && (
        <div className="distance-section">
          <h3>Distance Between Clusters (in minutes)</h3>
          <table className="distance-table">
            <thead>
              <tr>
                <th>Cluster 1</th>
                <th>Cluster 2</th>
                <th>Distance (minutes)</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster1, i) =>
                clusters.map((cluster2, j) =>
                  i < j ? (
                    <tr key={`${cluster1.id}-${cluster2.id}`}>
                      <td>{cluster1.name}</td>
                      <td>{cluster2.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={getDistance(cluster1.id, cluster2.id)}
                          onChange={(e) => updateDistance(cluster1.id, cluster2.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                              showDistanceToast(e.currentTarget.value);
                            }
                          }}
                          className="distance-input"
                        />
                      </td>
                    </tr>
                  ) : null
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Clusters Grid ─────────────────────────────────────────────────── */}
      <div className="clusters-section">
        <h3>Clusters</h3>
        {clusters.length === 0 ? (
          <p className="no-clusters">No clusters created yet. Add one to get started!</p>
        ) : (
          <div className="clusters-grid">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="cluster-card"
                onContextMenu={(e) => { e.preventDefault(); openRemoveClusterModal(cluster.id); }}
              >
                <div className="cluster-card-header">
                  <h4>{cluster.name}</h4>
                  <button
                    className="btn-remove-card"
                    onClick={() => openRemoveClusterModal(cluster.id)}
                    title="Remove this cluster"
                    type="button"
                  >
                    &times;
                  </button>
                </div>
                <div className="cluster-rooms">
                  <p className="rooms-label">Classrooms:</p>
                  <div className="rooms-list">
                    {(cluster.rooms || []).map((room, index) => (
                      <div key={`${cluster.id}-${room}-${index}`} className="room-badge">
                        <span>{room}</span>
                        <button
                          className="btn-remove-room"
                          onClick={() => removeRoomFromCluster(cluster.id, index, room)}
                          title={`Remove classroom ${room}`}
                          type="button"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cluster-card-footer">
                  {editingCluster === cluster.id ? (
                    <div className="add-room-form">
                      <input
                        type="text"
                        value={newRoom}
                        onChange={(e) => setNewRoom(e.target.value)}
                        placeholder="Room number"
                        onKeyDown={(e) => { if (e.key === 'Enter') addRoomToCluster(cluster.id, newRoom); }}
                        autoFocus
                      />
                      <button className="btn-add-room" onClick={() => addRoomToCluster(cluster.id, newRoom)} type="button">
                        Add
                      </button>
                      <button className="btn-cancel-room" onClick={() => { setEditingCluster(null); setNewRoom(''); }} type="button">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="btn-add-room-primary" onClick={() => setEditingCluster(cluster.id)} type="button">
                      Add Classroom
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassroomClusters;
