import { useEffect, useMemo, useState } from 'react';
import './styles/AllocateRoom.css';

function AllocateRoom() {
  const semesterRows = useMemo(
    () => [
      { key: 'year1-sem1', label: '1st Year - 1st Semester' },
      { key: 'year1-sem2', label: '1st Year - 2nd Semester' },
      { key: 'year2-sem1', label: '2nd Year - 1st Semester' },
      { key: 'year2-sem2', label: '2nd Year - 2nd Semester' },
      { key: 'year3-sem1', label: '3rd Year - 1st Semester' },
      { key: 'year3-sem2', label: '3rd Year - 2nd Semester' },
      { key: 'year4-sem1', label: '4th Year - 1st Semester' },
      { key: 'year4-sem2', label: '4th Year - 2nd Semester' },
    ],
    []
  );

  const [theoryClassrooms, setTheoryClassrooms] = useState(['A-101', 'A-102', 'A-103']);
  const [labClassrooms, setLabClassrooms] = useState(['LAB-1', 'LAB-2']);
  const [theoryInput, setTheoryInput] = useState('');
  const [labInput, setLabInput] = useState('');
  const [removeConfirmation, setRemoveConfirmation] = useState({
    isOpen: false,
    clusterType: '',
    room: '',
  });
  const [preferredTheoryRooms, setPreferredTheoryRooms] = useState(() => {
    const initial = {};
    semesterRows.forEach((row) => {
      initial[row.key] = '';
    });
    return initial;
  });

  useEffect(() => {
    setPreferredTheoryRooms((current) => {
      const next = { ...current };
      let changed = false;

      Object.keys(next).forEach((semesterKey) => {
        const selectedRoom = next[semesterKey];
        if (selectedRoom && !theoryClassrooms.includes(selectedRoom)) {
          next[semesterKey] = '';
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [theoryClassrooms]);

  const normalizeRoom = (value) => value.trim().toUpperCase();

  const addRoomToCluster = (clusterType) => {
    const isTheory = clusterType === 'theory';
    const value = normalizeRoom(isTheory ? theoryInput : labInput);

    if (!value) {
      return;
    }

    if (isTheory) {
      if (!theoryClassrooms.includes(value)) {
        setTheoryClassrooms((prev) => [...prev, value]);
      }
      setTheoryInput('');
      return;
    }

    if (!labClassrooms.includes(value)) {
      setLabClassrooms((prev) => [...prev, value]);
    }
    setLabInput('');
  };

  const removeRoomFromCluster = (clusterType, room) => {
    if (clusterType === 'theory') {
      setTheoryClassrooms((prev) => prev.filter((item) => item !== room));
      return;
    }

    setLabClassrooms((prev) => prev.filter((item) => item !== room));
  };

  const openRemoveConfirmation = (clusterType, room) => {
    setRemoveConfirmation({
      isOpen: true,
      clusterType,
      room,
    });
  };

  const closeRemoveConfirmation = () => {
    setRemoveConfirmation({
      isOpen: false,
      clusterType: '',
      room: '',
    });
  };

  const confirmRoomRemoval = () => {
    if (removeConfirmation.clusterType && removeConfirmation.room) {
      removeRoomFromCluster(removeConfirmation.clusterType, removeConfirmation.room);
    }
    closeRemoveConfirmation();
  };

  const updatePreferredRoom = (semesterKey, room) => {
    setPreferredTheoryRooms((prev) => ({
      ...prev,
      [semesterKey]: room,
    }));
  };

  const handleClusterInputKeyDown = (event, clusterType) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addRoomToCluster(clusterType);
    }
  };

  return (
    <div className="allocation-panel">
      <h3 className="allocation-panel-title">Allocate Room</h3>
      <p className="allocation-panel-description">
        Assign available classrooms to course sections and time slots.
      </p>

      <div className="allocate-room-clusters">
        <div className="allocate-room-card">
          <h4 className="allocate-room-card-title">Classrooms for Theory Class</h4>
          <div className="allocate-room-add-row">
            <input
              type="text"
              value={theoryInput}
              onChange={(event) => setTheoryInput(event.target.value)}
              onKeyDown={(event) => handleClusterInputKeyDown(event, 'theory')}
              className="allocate-room-input"
              placeholder="e.g., A-104"
            />
            <button
              type="button"
              className="allocate-room-action-btn"
              onClick={() => addRoomToCluster('theory')}
            >
              Add
            </button>
          </div>

          <div className="allocate-room-list">
            {theoryClassrooms.length === 0 ? (
              <p className="allocate-room-empty">No theory classroom added yet.</p>
            ) : (
              theoryClassrooms.map((room) => (
                <div key={room} className="allocate-room-chip">
                  <span>{room}</span>
                  <button
                    type="button"
                    className="allocate-room-remove-btn"
                    onClick={() => openRemoveConfirmation('theory', room)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="allocate-room-card">
          <h4 className="allocate-room-card-title">Classrooms for Lab Class</h4>
          <div className="allocate-room-add-row">
            <input
              type="text"
              value={labInput}
              onChange={(event) => setLabInput(event.target.value)}
              onKeyDown={(event) => handleClusterInputKeyDown(event, 'lab')}
              className="allocate-room-input"
              placeholder="e.g., LAB-3"
            />
            <button
              type="button"
              className="allocate-room-action-btn"
              onClick={() => addRoomToCluster('lab')}
            >
              Add
            </button>
          </div>

          <div className="allocate-room-list">
            {labClassrooms.length === 0 ? (
              <p className="allocate-room-empty">No lab classroom added yet.</p>
            ) : (
              labClassrooms.map((room) => (
                <div key={room} className="allocate-room-chip">
                  <span>{room}</span>
                  <button
                    type="button"
                    className="allocate-room-remove-btn"
                    onClick={() => openRemoveConfirmation('lab', room)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="allocate-room-table-wrap">
        <table className="allocate-room-table">
          <thead>
            <tr>
              <th>Year and Semester</th>
              <th>Preferred Theory Classroom</th>
            </tr>
          </thead>
          <tbody>
            {semesterRows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  <select
                    className="allocate-room-select"
                    value={preferredTheoryRooms[row.key]}
                    onChange={(event) => updatePreferredRoom(row.key, event.target.value)}
                  >
                    <option value="">Select Theory Classroom</option>
                    {theoryClassrooms.map((room) => (
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

      {removeConfirmation.isOpen && (
        <div className="allocate-room-confirm-overlay" onClick={closeRemoveConfirmation}>
          <div className="allocate-room-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h4 className="allocate-room-confirm-title">Confirm Removal</h4>
            <p className="allocate-room-confirm-text">
              Are you sure you want to remove room {removeConfirmation.room} from the{' '}
              {removeConfirmation.clusterType === 'theory' ? 'Theory' : 'Lab'} classroom cluster?
            </p>
            <div className="allocate-room-confirm-actions">
              <button
                type="button"
                className="allocate-room-confirm-btn cancel"
                onClick={closeRemoveConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                className="allocate-room-confirm-btn confirm"
                onClick={confirmRoomRemoval}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllocateRoom;
