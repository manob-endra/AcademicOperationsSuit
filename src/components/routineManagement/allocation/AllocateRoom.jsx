import { useState, useEffect, useRef } from 'react';
import { classroomClustersAPI } from '../../../services/classroomClustersAPI';
import { roomAllocationAPI } from '../../../services/roomAllocationAPI';
import './styles/AllocateRoom.css';

const SEMESTER_LABELS = {
  'Y1-S1': '1st Year • 1st Semester',
  'Y1-S2': '1st Year • 2nd Semester',
  'Y2-S1': '2nd Year • 1st Semester',
  'Y2-S2': '2nd Year • 2nd Semester',
  'Y3-S1': '3rd Year • 1st Semester',
  'Y3-S2': '3rd Year • 2nd Semester',
  'Y4-S1': '4th Year • 1st Semester',
  'Y4-S2': '4th Year • 2nd Semester',
  'MS-S1': 'MS • 1st Semester',
  'MS-S2': 'MS • 2nd Semester',
};

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="allocate-room-confirm-overlay" onClick={onCancel}>
      <div className="allocate-room-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h4 className="allocate-room-confirm-title">Confirm</h4>
        <p className="allocate-room-confirm-text">{message}</p>
        <div className="allocate-room-confirm-actions">
          <button type="button" className="allocate-room-confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="allocate-room-confirm-btn confirm" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function AllocateRoom({ semesterId, selectedSemesters = [] }) {
  const [clusters, setClusters] = useState([]);
  const [theoryRooms, setTheoryRooms] = useState([]);
  const [labRooms, setLabRooms] = useState([]);
  const [semesterTheoryRooms, setSemesterTheoryRooms] = useState({});
  const [dragOverZone, setDragOverZone] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const initialLoadDone = useRef(false);
  const saveTimer = useRef(null);
  const confirmResolveRef = useRef(null);

  // Always-current refs for use inside drag handlers
  const theoryRoomsRef = useRef([]);
  const labRoomsRef = useRef([]);
  theoryRoomsRef.current = theoryRooms;
  labRoomsRef.current = labRooms;

  // Load clusters and saved allocation on mount
  useEffect(() => {
    if (!semesterId) return;
    initialLoadDone.current = false;
    setLoading(true);
    Promise.all([
      classroomClustersAPI.getClusters(),
      roomAllocationAPI.getAllocation(semesterId),
    ]).then(([clustersResult, allocResult]) => {
      if (clustersResult.success) {
        setClusters(clustersResult.data || []);
      }
      if (allocResult.success && allocResult.data) {
        const d = allocResult.data;
        setTheoryRooms(d.theory_rooms || []);
        setLabRooms(d.lab_rooms || []);
        setSemesterTheoryRooms(d.semester_theory_rooms || {});
      } else {
        setTheoryRooms([]);
        setLabRooms([]);
        setSemesterTheoryRooms({});
      }
      setLoading(false);
      initialLoadDone.current = true;
    });
  }, [semesterId]);

  // Auto-save 400ms after any allocation state change
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      roomAllocationAPI.saveAllocation(semesterId, theoryRooms, labRooms, semesterTheoryRooms);
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [theoryRooms, labRooms, semesterTheoryRooms, semesterId]);

  // Clear semester assignments whose room was removed from theory list
  useEffect(() => {
    if (!initialLoadDone.current) return;
    setSemesterTheoryRooms((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (next[key] && !theoryRooms.includes(next[key])) {
          next[key] = '';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [theoryRooms]);

  const showConfirm = (message) =>
    new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmMsg(message);
    });

  const handleConfirmResult = (result) => {
    setConfirmMsg(null);
    confirmResolveRef.current?.(result);
  };

  // Enter = Confirm, Escape = Cancel when the confirm modal is open
  useEffect(() => {
    if (!confirmMsg) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleConfirmResult(true); }
      else if (e.key === 'Escape') { handleConfirmResult(false); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmMsg]);

  const handleDrop = async (zone, room) => {
    setDragOverZone(null);
    if (!room) return;

    const inTheory = theoryRoomsRef.current.includes(room);
    const inLab = labRoomsRef.current.includes(room);

    if (zone === 'theory') {
      if (inTheory) return;
      if (inLab) {
        const ok = await showConfirm(
          `"${room}" is already in Lab classrooms. Add it to Theory as well?`
        );
        if (!ok) return;
      }
      setTheoryRooms((prev) => [...prev, room]);
    } else {
      if (inLab) return;
      if (inTheory) {
        const ok = await showConfirm(
          `"${room}" is already in Theory classrooms. Add it to Lab as well?`
        );
        if (!ok) return;
      }
      setLabRooms((prev) => [...prev, room]);
    }
  };

  const removeFromTheory = (room) => setTheoryRooms((prev) => prev.filter((r) => r !== room));
  const removeFromLab = (room) => setLabRooms((prev) => prev.filter((r) => r !== room));

  const updateSemesterRoom = (semId, room) => {
    setSemesterTheoryRooms((prev) => ({ ...prev, [semId]: room }));
  };

  if (loading) {
    return (
      <div className="allocation-panel">
        <p className="allocate-room-loading">Loading room allocation...</p>
      </div>
    );
  }

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Allocate Room</h3>
      <p className="allocation-panel-description">
        Drag rooms from classroom clusters into the Theory or Lab sections below.
      </p>

      {/* Source: classroom clusters */}
      <div className="allocate-room-source-panel">
        <h4 className="allocate-room-source-title">Classroom Clusters</h4>
        {clusters.length === 0 ? (
          <p className="allocate-room-empty">
            No clusters defined. Create clusters in the Time Slot page.
          </p>
        ) : (
          <div className="allocate-room-clusters-grid">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="allocate-room-cluster-row">
                <span className="allocate-room-cluster-label">{cluster.name}</span>
                <div className="allocate-room-cluster-chips">
                  {(cluster.rooms || []).length === 0 ? (
                    <span className="allocate-room-empty-inline">No rooms</span>
                  ) : (
                    (cluster.rooms || []).map((room) => (
                      <div
                        key={room}
                        className="allocate-room-draggable-chip"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', room)}
                      >
                        {room}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drop zones */}
      <div className="allocate-room-clusters">
        <div className="allocate-room-card">
          <h4 className="allocate-room-card-title">Classrooms for Theory</h4>
          <div
            className={`allocate-room-drop-zone ${dragOverZone === 'theory' ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone('theory');
            }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop('theory', e.dataTransfer.getData('text/plain'));
            }}
          >
            {theoryRooms.length === 0 ? (
              <p className="allocate-room-drop-hint">Drop rooms here</p>
            ) : (
              theoryRooms.map((room) => (
                <div key={room} className="allocate-room-chip">
                  <span>{room}</span>
                  <button
                    type="button"
                    className="allocate-room-remove-btn"
                    onClick={() => removeFromTheory(room)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="allocate-room-card">
          <h4 className="allocate-room-card-title">Classrooms for Lab</h4>
          <div
            className={`allocate-room-drop-zone ${dragOverZone === 'lab' ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone('lab');
            }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop('lab', e.dataTransfer.getData('text/plain'));
            }}
          >
            {labRooms.length === 0 ? (
              <p className="allocate-room-drop-hint">Drop rooms here</p>
            ) : (
              labRooms.map((room) => (
                <div key={room} className="allocate-room-chip">
                  <span>{room}</span>
                  <button
                    type="button"
                    className="allocate-room-remove-btn"
                    onClick={() => removeFromLab(room)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Semester assignment table */}
      {selectedSemesters.length === 0 ? (
        <p className="allocate-room-empty">
          No semesters selected. Please select semesters on the Home page.
        </p>
      ) : (
        <div className="allocate-room-table-wrap">
          <table className="allocate-room-table">
            <thead>
              <tr>
                <th>Year and Semester</th>
                <th>Preferred Theory Classroom</th>
              </tr>
            </thead>
            <tbody>
              {selectedSemesters.map((semId) => (
                <tr key={semId}>
                  <td>{SEMESTER_LABELS[semId] || semId}</td>
                  <td>
                    <select
                      className="allocate-room-select"
                      value={semesterTheoryRooms[semId] || ''}
                      onChange={(e) => updateSemesterRoom(semId, e.target.value)}
                    >
                      <option value="">Select Theory Classroom</option>
                      {theoryRooms.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmMsg && (
        <ConfirmModal
          message={confirmMsg}
          onConfirm={() => handleConfirmResult(true)}
          onCancel={() => handleConfirmResult(false)}
        />
      )}
    </div>
  );
}

export default AllocateRoom;
