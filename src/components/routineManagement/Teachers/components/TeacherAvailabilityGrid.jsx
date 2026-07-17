import { Fragment, useEffect, useState } from 'react';
import { teacherAPI } from '../../../../services/teacherAPI';
import '../../TimeSlot/styles/TeachersTime.css';

const workingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const timeSlots = [
  { id: 's1',    label: '8:30-9:20',   isBreak: false },
  { id: 's2',    label: '9:25-10:15',  isBreak: false },
  { id: 's3',    label: '10:20-11:10', isBreak: false },
  { id: 'break', label: 'Break',       isBreak: true  },
  { id: 's4',    label: '11:40-12:30', isBreak: false },
  { id: 's5',    label: '12:35-1:25',  isBreak: false },
];

const totalSelectableSlots = workingDays.length * timeSlots.filter(s => !s.isBreak).length;

function TeacherAvailabilityGrid({ semesterId, teacherId, onSaved }) {
  const [savedSlots, setSavedSlots] = useState([]);
  const [draftSlots, setDraftSlots] = useState([]);
  const [isEditing, setIsEditing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!teacherId || !semesterId) return;
    setLoading(true);
    teacherAPI.getAllAvailability(semesterId).then(result => {
      if (result.success) {
        const slots = (result.data || [])
          .filter(r => r.teacher_id === teacherId)
          .map(r => `${r.day_of_week}-${r.slot_id}`);
        setSavedSlots(slots);
        // Sync the badge in the parent table with the real count from DB
        onSaved?.(teacherId, slots.length);
      }
      setLoading(false);
    });
  }, [teacherId, semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSlots  = isEditing ? draftSlots : savedSlots;
  const selectedCount = currentSlots.length;

  const handleEdit = () => {
    setIsEditing(true);
    setDraftSlots([...savedSlots]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftSlots([]);
  };

  const handleSlotToggle = (day, slot) => {
    if (slot.isBreak) return;
    const key = `${day}-${slot.id}`;
    setDraftSlots(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await teacherAPI.saveAvailability(semesterId, teacherId, draftSlots);
    setSaving(false);
    if (result.success) {
      setSavedSlots(draftSlots);
      setIsEditing(false);
      onSaved?.(teacherId, draftSlots.length);
      setDraftSlots([]);
    } else {
      alert(`Failed to save availability: ${result.error}`);
    }
  };

  if (loading) {
    return <p style={{ padding: '12px 0', color: '#666', fontSize: 14 }}>Loading availability…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isEditing && (
        <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
          Click a cell to toggle availability. Green = available.
        </p>
      )}

      <div className="teacher-grid-scroll">
        <div
          className="teacher-time-grid"
          style={{
            gridTemplateColumns: `58px repeat(${timeSlots.length}, minmax(48px, 1fr))`,
            gridTemplateRows: `30px repeat(${workingDays.length}, 30px)`,
          }}
        >
          {/* Header row */}
          <div className="teacher-grid-head day-head">Day</div>
          {timeSlots.map(slot => (
            <div
              key={`head-${slot.id}`}
              className={`teacher-grid-head${slot.isBreak ? ' break-head' : ''}`}
            >
              {slot.label}
            </div>
          ))}

          {/* Day rows */}
          {workingDays.map(day => (
            <Fragment key={day}>
              <div className="teacher-day-cell">{day.slice(0, 3)}</div>
              {timeSlots.map(slot => {
                const slotKey     = `${day}-${slot.id}`;
                const isSelected  = currentSlots.includes(slotKey);
                const isClickable = isEditing && !slot.isBreak;
                return (
                  <button
                    key={slotKey}
                    type="button"
                    className={[
                      'teacher-slot-cell',
                      slot.isBreak ? 'break-cell' : '',
                      isSelected   ? 'selected'   : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => isEditing && handleSlotToggle(day, slot)}
                    disabled={!isClickable}
                    aria-label={`${day} ${slot.label}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="teacher-progress-head">
        <span>Available Slots</span>
        <span>{selectedCount} / {totalSelectableSlots}</span>
      </div>
      <div className="teacher-progress-track">
        <div
          className="teacher-progress-fill"
          style={{ width: `${(selectedCount / totalSelectableSlots) * 100}%` }}
        />
      </div>

      {/* Edit / OK / Cancel */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isEditing ? (
          <>
            <button
              type="button"
              className="teacher-edit-btn teacher-edit-btn--ok"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'OK'}
            </button>
            <button
              type="button"
              className="teacher-edit-btn"
              style={{ background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' }}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="teacher-edit-btn"
            onClick={handleEdit}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default TeacherAvailabilityGrid;
