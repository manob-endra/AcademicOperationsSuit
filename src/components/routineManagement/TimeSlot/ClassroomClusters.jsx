import { useState } from 'react';
import './styles/ClassroomClusters.css';

function RemoveClusterModal({
  isOpen,
  clusters,
  selectedClusterId,
  onSelectCluster,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content remove-cluster-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Remove Classroom Cluster</h2>
          <button className="modal-close" onClick={onCancel} type="button">
            ×
          </button>
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
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))}
            </select>
          </div>

          <p className="remove-cluster-warning">
            This will permanently delete the selected cluster and all rooms in it.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel} type="button">
            Cancel
          </button>
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

function ClassroomClusters() {
  const [clusters, setClusters] = useState([]);
  const [distances, setDistances] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showRemoveClusterModal, setShowRemoveClusterModal] = useState(false);
  const [clusterToRemoveId, setClusterToRemoveId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [classroomNumbers, setClassroomNumbers] = useState('');
  const [editingCluster, setEditingCluster] = useState(null);
  const [newRoom, setNewRoom] = useState('');

  const generateDistanceKey = (cluster1, cluster2) => {
    const sorted = [cluster1, cluster2].sort();
    return `${sorted[0]}-${sorted[1]}`;
  };

  const addCluster = () => {
    if (!clusterName.trim() || !classroomNumbers.trim()) {
      alert('Please enter both cluster name and classroom numbers');
      return;
    }

    const roomArray = classroomNumbers
      .split(',')
      .map((room) => room.trim())
      .filter((room) => room);

    if (roomArray.length === 0) {
      alert('Please enter valid classroom numbers');
      return;
    }

    const newCluster = {
      id: Date.now(),
      name: clusterName,
      rooms: roomArray,
    };

    setClusters((currentClusters) => {
      const updatedClusters = [...currentClusters, newCluster];

      setDistances((currentDistances) => {
        const updatedDistances = { ...currentDistances };
        currentClusters.forEach((existingCluster) => {
          const key = generateDistanceKey(newCluster.id, existingCluster.id);
          updatedDistances[key] = 0;
        });
        return updatedDistances;
      });

      return updatedClusters;
    });

    setClusterName('');
    setClassroomNumbers('');
    setShowModal(false);
  };

  const removeCluster = (clusterId) => {
    if (clusterId == null) {
      return;
    }

    setClusters((currentClusters) => currentClusters.filter((c) => c.id !== clusterId));

    setDistances((currentDistances) => {
      const updatedDistances = { ...currentDistances };
      Object.keys(updatedDistances).forEach((key) => {
        const [firstId, secondId] = key.split('-').map(Number);
        if (firstId === clusterId || secondId === clusterId) {
          delete updatedDistances[key];
        }
      });
      return updatedDistances;
    });
  };

  const openRemoveClusterModal = (clusterId = '') => {
    if (clusters.length === 0) {
      alert('No clusters available to remove');
      return;
    }

    setClusterToRemoveId(clusterId ? String(clusterId) : '');
    setShowRemoveClusterModal(true);
  };

  const confirmRemoveCluster = () => {
    if (!clusterToRemoveId) {
      alert('Please select a cluster to remove');
      return;
    }

    const cluster = clusters.find((item) => String(item.id) === String(clusterToRemoveId));
    if (!cluster) {
      alert('The selected cluster could not be found');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove the cluster "${cluster.name}"?\n\nAll rooms in this cluster will be deleted permanently.`
    );

    if (!confirmed) {
      return;
    }

    removeCluster(cluster.id);
    setShowRemoveClusterModal(false);
    setClusterToRemoveId('');
  };

  const addRoomToCluster = (clusterId, roomNumber) => {
    if (!roomNumber.trim()) {
      alert('Please enter a room number');
      return;
    }

    setClusters((currentClusters) =>
      currentClusters.map((cluster) =>
        cluster.id === clusterId
          ? { ...cluster, rooms: [...cluster.rooms, roomNumber.trim()] }
          : cluster
      )
    );
    setNewRoom('');
    setEditingCluster(null);
  };

  const removeRoomFromCluster = (clusterId, roomIndex, roomNumber) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove classroom "${roomNumber}" from this cluster?`
    );

    if (!confirmed) {
      return;
    }

    setClusters((currentClusters) =>
      currentClusters.map((cluster) =>
        cluster.id === clusterId
          ? { ...cluster, rooms: cluster.rooms.filter((_, i) => i !== roomIndex) }
          : cluster
      )
    );
  };

  const updateDistance = (cluster1Id, cluster2Id, distance) => {
    const key = generateDistanceKey(cluster1Id, cluster2Id);
    setDistances({ ...distances, [key]: distance });
  };

  const getDistance = (cluster1Id, cluster2Id) => {
    const key = generateDistanceKey(cluster1Id, cluster2Id);
    return distances[key] || 0;
  };

  return (
    <div className="classroom-clusters-container">
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
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Classroom Cluster</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowModal(false);
                  setClusterName('');
                  setClassroomNumbers('');
                }}
                type="button"
              >
                ×
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
                onClick={() => {
                  setShowModal(false);
                  setClusterName('');
                  setClassroomNumbers('');
                }}
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

      {showRemoveClusterModal && (
        <RemoveClusterModal
          isOpen={showRemoveClusterModal}
          clusters={clusters}
          selectedClusterId={clusterToRemoveId}
          onSelectCluster={setClusterToRemoveId}
          onConfirm={confirmRemoveCluster}
          onCancel={() => {
            setShowRemoveClusterModal(false);
            setClusterToRemoveId('');
          }}
        />
      )}

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
                          onChange={(e) =>
                            updateDistance(cluster1.id, cluster2.id, e.target.value)
                          }
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  openRemoveClusterModal(cluster.id);
                }}
              >
                <div className="cluster-card-header">
                  <h4>{cluster.name}</h4>
                  <button
                    className="btn-remove-card"
                    onClick={() => openRemoveClusterModal(cluster.id)}
                    title="Remove this cluster"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <div className="cluster-rooms">
                  <p className="rooms-label">Classrooms:</p>
                  <div className="rooms-list">
                    {cluster.rooms.map((room, index) => (
                      <div key={`${cluster.id}-${room}-${index}`} className="room-badge">
                        <span>{room}</span>
                        <button
                          className="btn-remove-room"
                          onClick={() => removeRoomFromCluster(cluster.id, index, room)}
                          title={`Remove classroom ${room}`}
                          type="button"
                        >
                          ✕
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addRoomToCluster(cluster.id, newRoom);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        className="btn-add-room"
                        onClick={() => addRoomToCluster(cluster.id, newRoom)}
                        type="button"
                      >
                        Add
                      </button>
                      <button
                        className="btn-cancel-room"
                        onClick={() => {
                          setEditingCluster(null);
                          setNewRoom('');
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-add-room-primary"
                      onClick={() => setEditingCluster(cluster.id)}
                      type="button"
                    >
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
