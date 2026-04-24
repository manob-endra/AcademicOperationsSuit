import { useState, useRef, useMemo } from 'react';
import './ClassroomClusters.css';

// Add Cluster Modal Component
function AddClusterModal({ isOpen, onConfirm, onCancel }) {
  const [clusterName, setClusterName] = useState('');
  const [roomNumbers, setRoomNumbers] = useState('');

  const handleConfirm = () => {
    if (!clusterName.trim()) {
      alert('Please enter a cluster name');
      return;
    }
    if (!roomNumbers.trim()) {
      alert('Please enter at least one room number');
      return;
    }

    // Parse comma-separated room numbers
    const rooms = roomNumbers
      .split(',')
      .map((room) => room.trim())
      .filter((room) => room.length > 0);

    if (rooms.length === 0) {
      alert('Please enter valid room numbers');
      return;
    }

    onConfirm({
      name: clusterName,
      rooms: rooms,
    });

    // Reset form
    setClusterName('');
    setRoomNumbers('');
  };

  const handleCancel = () => {
    setClusterName('');
    setRoomNumbers('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add a New Cluster</h3>
        <div className="cluster-form">
          <div className="form-group">
            <label className="form-label">Cluster Name</label>
            <input
              type="text"
              className="form-input"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="e.g., Building A, North Wing"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Room Numbers</label>
            <input
              type="text"
              className="form-input"
              value={roomNumbers}
              onChange={(e) => setRoomNumbers(e.target.value)}
              placeholder="Enter comma separated room no...."
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            <small className="form-hint">Example: 101, 102, 103, 104</small>
          </div>
        </div>
        <div className="modal-buttons">
          <button className="modal-btn cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={handleConfirm}>
            Create Cluster
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Room Modal Component
function AddRoomModal({ isOpen, clusterName, onConfirm, onCancel }) {
  const [roomNumbers, setRoomNumbers] = useState('');

  const handleConfirm = () => {
    if (!roomNumbers.trim()) {
      alert('Please enter at least one room number');
      return;
    }

    const rooms = roomNumbers
      .split(',')
      .map((room) => room.trim())
      .filter((room) => room.length > 0);

    if (rooms.length === 0) {
      alert('Please enter valid room numbers');
      return;
    }

    onConfirm(rooms);
    setRoomNumbers('');
  };

  const handleCancel = () => {
    setRoomNumbers('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add Rooms to {clusterName}</h3>
        <div className="cluster-form">
          <div className="form-group">
            <label className="form-label">Room Numbers</label>
            <input
              type="text"
              className="form-input"
              value={roomNumbers}
              onChange={(e) => setRoomNumbers(e.target.value)}
              placeholder="Enter comma separated room no...."
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
            <small className="form-hint">Example: 105, 106, 107</small>
          </div>
        </div>
        <div className="modal-buttons">
          <button className="modal-btn cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={handleConfirm}>
            Add Rooms
          </button>
        </div>
      </div>
    </div>
  );
}

// Cluster Card Component
function ClusterCard({ cluster, onAddRooms, onRemoveRoom, onDeleteCluster, onOpenAddRoomModal }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState(new Set());

  const handleRemoveSelected = () => {
    if (selectedRooms.size === 0) {
      alert('Please select rooms to remove');
      return;
    }

    const roomList = Array.from(selectedRooms).join(', ');
    if (
      confirm(
        `Are you sure you want to remove the following rooms?\n\n${roomList}\n\nThis action cannot be undone.`
      )
    ) {
      selectedRooms.forEach((room) => {
        onRemoveRoom(cluster.id, room);
      });
      setSelectedRooms(new Set());
      setIsRemoving(false);
    }
  };

  const toggleRoomSelection = (room) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(room)) {
      newSelected.delete(room);
    } else {
      newSelected.add(room);
    }
    setSelectedRooms(newSelected);
  };

  return (
    <div className="cluster-card">
      <div className="cluster-card-header">
        <h3 className="cluster-card-title">{cluster.name}</h3>
        <button
          className="cluster-delete-btn"
          onClick={() => {
            if (confirm(`Delete cluster "${cluster.name}"?`)) {
              onDeleteCluster(cluster.id);
            }
          }}
          title="Delete cluster"
        >
          ✕
        </button>
      </div>

      <div className="cluster-card-content">
        <div className="rooms-section">
          <div className="rooms-header">
            <span className="rooms-label">
              Rooms ({cluster.rooms.length})
            </span>
            {isRemoving && selectedRooms.size > 0 && (
              <span className="rooms-selected">{selectedRooms.size} selected</span>
            )}
          </div>

          {cluster.rooms.length === 0 ? (
            <div className="no-rooms">No rooms added yet</div>
          ) : (
            <div className="rooms-list">
              {cluster.rooms.map((room) => (
                <div
                  key={room}
                  className={`room-item ${isRemoving ? 'removable' : ''} ${
                    selectedRooms.has(room) ? 'selected' : ''
                  }`}
                  onClick={() => isRemoving && toggleRoomSelection(room)}
                >
                  <span className="room-number">{room}</span>
                  {isRemoving && selectedRooms.has(room) && (
                    <span className="room-check">✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cluster-card-actions">
          {isRemoving ? (
            <>
              <button
                className="action-btn remove-btn"
                onClick={handleRemoveSelected}
                disabled={selectedRooms.size === 0}
              >
                Remove Selected
              </button>
              <button
                className="action-btn cancel-btn"
                onClick={() => {
                  setIsRemoving(false);
                  setSelectedRooms(new Set());
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="action-btn add-btn"
                onClick={() => onOpenAddRoomModal(cluster.id)}
              >
                + Add Rooms
              </button>
              <button
                className="action-btn remove-btn"
                onClick={() => setIsRemoving(true)}
                disabled={cluster.rooms.length === 0}
              >
                − Remove Rooms
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Cluster Distances Table Component
function ClusterDistancesTable({ clusters, distances, onUpdateDistance }) {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Generate all cluster combinations
  const combinations = useMemo(() => {
    const combos = [];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const cluster1 = clusters[i];
        const cluster2 = clusters[j];
        const key = `${cluster1.id}-${cluster2.id}`;
        combos.push({
          key,
          cluster1,
          cluster2,
          distance: distances[key] || 0,
        });
      }
    }
    return combos;
  }, [clusters, distances]);

  const handleStartEdit = (key, currentValue) => {
    setEditingKey(key);
    setEditValue(String(currentValue));
  };

  const handleSaveEdit = (key) => {
    const numValue = parseInt(editValue) || 0;
    if (numValue < 0) {
      alert('Distance must be a positive number');
      return;
    }
    onUpdateDistance(key, numValue);
    setEditingKey(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  if (combinations.length === 0) {
    return null;
  }

  return (
    <div className="distances-section">
      <h3 className="distances-title">Cluster Distances</h3>
      <div className="distances-table-container">
        <table className="distances-table">
          <thead>
            <tr>
              <th>From Cluster</th>
              <th>To Cluster</th>
              <th>Distance (minutes)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {combinations.map((combo) => (
              <tr key={combo.key} className="distance-row">
                <td className="cluster-name">{combo.cluster1.name}</td>
                <td className="cluster-name">{combo.cluster2.name}</td>
                <td className="distance-value">
                  {editingKey === combo.key ? (
                    <input
                      type="number"
                      className="distance-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(combo.key);
                        if (e.key === 'Escape') handleCancel();
                      }}
                      autoFocus
                      min="0"
                    />
                  ) : (
                    <span>{combo.distance}</span>
                  )}
                </td>
                <td className="distance-action">
                  {editingKey === combo.key ? (
                    <div className="edit-actions">
                      <button
                        className="edit-save-btn"
                        onClick={() => handleSaveEdit(combo.key)}
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        className="edit-cancel-btn"
                        onClick={handleCancel}
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="edit-distance-btn"
                      onClick={() => handleStartEdit(combo.key, combo.distance)}
                      title="Edit distance"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main Component
export default function ClassroomClusters() {
  const [clusters, setClusters] = useState([
    {
      id: 1,
      name: 'Building A',
      rooms: ['101', '102', '103', '104'],
    },
    {
      id: 2,
      name: 'Building B',
      rooms: ['201', '202', '203'],
    },
  ]);

  const [distances, setDistances] = useState({
    '1-2': 5,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const nextIdRef = useRef(3);

  const handleAddCluster = (clusterData) => {
    const newCluster = {
      id: nextIdRef.current,
      name: clusterData.name,
      rooms: clusterData.rooms,
    };
    setClusters([...clusters, newCluster]);
    nextIdRef.current += 1;
    setShowAddModal(false);
  };

  const handleOpenAddRoomModal = (clusterId) => {
    setSelectedClusterId(clusterId);
    setShowAddRoomModal(true);
  };

  const handleAddRooms = (newRooms) => {
    setClusters(
      clusters.map((cluster) => {
        if (cluster.id === selectedClusterId) {
          // Filter out duplicate rooms
          const existingRooms = new Set(cluster.rooms);
          const roomsToAdd = newRooms.filter((room) => !existingRooms.has(room));
          return {
            ...cluster,
            rooms: [...cluster.rooms, ...roomsToAdd],
          };
        }
        return cluster;
      })
    );
    setShowAddRoomModal(false);
    setSelectedClusterId(null);
  };

  const handleRemoveRoom = (clusterId, room) => {
    setClusters(
      clusters.map((cluster) => {
        if (cluster.id === clusterId) {
          return {
            ...cluster,
            rooms: cluster.rooms.filter((r) => r !== room),
          };
        }
        return cluster;
      })
    );
  };

  const handleDeleteCluster = (clusterId) => {
    setClusters(clusters.filter((cluster) => cluster.id !== clusterId));
    
    // Remove distances related to this cluster
    setDistances((prevDistances) => {
      const newDistances = { ...prevDistances };
      Object.keys(newDistances).forEach((key) => {
        const [id1, id2] = key.split('-').map(Number);
        if (id1 === clusterId || id2 === clusterId) {
          delete newDistances[key];
        }
      });
      return newDistances;
    });
  };

  const handleUpdateDistance = (key, value) => {
    setDistances({
      ...distances,
      [key]: value,
    });
  };

  const handleRemoveCluster = () => {
    if (clusters.length === 0) {
      alert('No clusters to remove');
      return;
    }

    if (clusters.length === 1) {
      if (
        confirm(
          `Are you sure you want to remove the cluster "${clusters[0].name}"?\n\nAll rooms in this cluster will be deleted.\nThis action cannot be undone.`
        )
      ) {
        handleDeleteCluster(clusters[0].id);
      }
      return;
    }

    // If multiple clusters, show a selection dialog
    const clusterNames = clusters
      .map((c, i) => `${i + 1}. ${c.name}`)
      .join('\n');
    const selected = prompt(
      `Select a cluster to remove:\n\n${clusterNames}\n\nEnter the cluster number:`,
      '1'
    );

    if (selected === null) return; // User cancelled

    const index = parseInt(selected) - 1;
    if (index >= 0 && index < clusters.length) {
      const clusterToDelete = clusters[index];
      if (
        confirm(
          `Are you sure you want to remove the cluster "${clusterToDelete.name}"?\n\nAll rooms in this cluster will be deleted.\nThis action cannot be undone.`
        )
      ) {
        handleDeleteCluster(clusterToDelete.id);
      }
    } else {
      alert('Invalid selection. Please enter a valid cluster number.');
    }
  };

  return (
    <div className="tab-content">
      <div className="clusters-container">
        <div className="clusters-header">
          <h2 className="clusters-title">Classroom Clusters</h2>
          <div className="header-buttons">
            <button
              className="add-cluster-btn"
              onClick={() => setShowAddModal(true)}
            >
              + ADD A CLUSTER
            </button>
            <button
              className="remove-cluster-btn"
              onClick={handleRemoveCluster}
              disabled={clusters.length === 0}
            >
              − REMOVE A CLUSTER
            </button>
          </div>
        </div>

        {clusters.length === 0 ? (
          <div className="no-clusters">
            <p>No clusters created yet. Click "ADD A CLUSTER" to get started.</p>
          </div>
        ) : (
          <>
            <div className="clusters-grid">
              {clusters.map((cluster) => (
                <ClusterCard
                  key={cluster.id}
                  cluster={cluster}
                  onAddRooms={handleAddRooms}
                  onRemoveRoom={handleRemoveRoom}
                  onDeleteCluster={handleDeleteCluster}
                  onOpenAddRoomModal={handleOpenAddRoomModal}
                />
              ))}
            </div>

            {clusters.length > 1 && (
              <ClusterDistancesTable
                clusters={clusters}
                distances={distances}
                onUpdateDistance={handleUpdateDistance}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AddClusterModal
        isOpen={showAddModal}
        onConfirm={handleAddCluster}
        onCancel={() => setShowAddModal(false)}
      />

      <AddRoomModal
        isOpen={showAddRoomModal}
        clusterName={
          clusters.find((c) => c.id === selectedClusterId)?.name || 'Cluster'
        }
        onConfirm={handleAddRooms}
        onCancel={() => {
          setShowAddRoomModal(false);
          setSelectedClusterId(null);
        }}
      />
    </div>
  );
}
