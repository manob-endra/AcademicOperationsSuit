import { Fragment, useMemo, useState } from 'react';
import './styles/TeachersTime.css';

const workingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const timeSlots = [
  { id: 's1', label: '8:30-9:20', isBreak: false },
  { id: 's2', label: '9:25-10:15', isBreak: false },
  { id: 's3', label: '10:20-11:10', isBreak: false },
  { id: 'break', label: 'Break', isBreak: true },
  { id: 's4', label: '11:40-12:30', isBreak: false },
  { id: 's5', label: '12:35-1:25', isBreak: false },
];

const initialTeachers = [
  { id: 't1', name: 'Dr. Anik Rahman', selectedSlots: ['Sunday-s1', 'Sunday-s2', 'Monday-s3', 'Tuesday-s4'] },
  { id: 't2', name: 'Prof. Nadia Sultana', selectedSlots: ['Sunday-s3', 'Monday-s1', 'Wednesday-s5'] },
  { id: 't3', name: 'Dr. Samiul Haque', selectedSlots: ['Tuesday-s1', 'Tuesday-s2', 'Thursday-s4', 'Thursday-s5'] },
  { id: 't4', name: 'Lecturer Farhana Islam', selectedSlots: ['Sunday-s4', 'Monday-s4', 'Tuesday-s4'] },
  { id: 't5', name: 'Dr. Shadman Kabir', selectedSlots: ['Monday-s5', 'Wednesday-s1', 'Thursday-s2'] },
  { id: 't6', name: 'Lecturer Mehedi Hasan', selectedSlots: ['Sunday-s5', 'Tuesday-s3', 'Wednesday-s4'] },
];

const totalSelectableSlots = workingDays.length * timeSlots.filter((slot) => !slot.isBreak).length;

function TeachersTime() {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return teachers;
    }

    return teachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(normalizedSearch)
    );
  }, [teachers, searchTerm]);

  const toggleTeacherSlot = (teacherId, day, slot) => {
    if (editingTeacherId !== teacherId || slot.isBreak) {
      return;
    }

    const slotKey = `${day}-${slot.id}`;

    setTeachers((prevTeachers) =>
      prevTeachers.map((teacher) => {
        if (teacher.id !== teacherId) {
          return teacher;
        }

        const isSelected = teacher.selectedSlots.includes(slotKey);
        const updatedSlots = isSelected
          ? teacher.selectedSlots.filter((item) => item !== slotKey)
          : [...teacher.selectedSlots, slotKey];

        return {
          ...teacher,
          selectedSlots: updatedSlots,
        };
      })
    );
  };

  const handleEditToggle = (teacherId) => {
    setEditingTeacherId((prev) => (prev === teacherId ? null : teacherId));
  };

  return (
    <div className="teachers-time-container">
      <div className="teachers-time-search-block">
        <label htmlFor="teacher-search" className="teachers-time-search-label">
          Search Teacher
        </label>
        <input
          id="teacher-search"
          type="text"
          className="teachers-time-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by teacher name"
        />
      </div>

      <div className="teacher-cards-grid">
        {filteredTeachers.map((teacher) => {
          const selectedCount = teacher.selectedSlots.length;
          const percentage = Math.round((selectedCount / totalSelectableSlots) * 100);
          const isEditing = editingTeacherId === teacher.id;

          return (
            <article key={teacher.id} className="teacher-card">
              <div className="teacher-card-header">
                <h3>{teacher.name}</h3>
                <span className="teacher-availability">{percentage}%</span>
              </div>

              <div className="teacher-grid-scroll">
                <div
                  className="teacher-time-grid"
                  style={{
                    gridTemplateColumns: `58px repeat(${timeSlots.length}, minmax(48px, 1fr))`,
                    gridTemplateRows: `30px repeat(${workingDays.length}, 30px)`,
                  }}
                >
                  <div className="teacher-grid-head day-head">Day</div>
                  {timeSlots.map((slot) => (
                    <div
                      key={`head-${teacher.id}-${slot.id}`}
                      className={`teacher-grid-head ${slot.isBreak ? 'break-head' : ''}`}
                    >
                      {slot.label}
                    </div>
                  ))}

                  {workingDays.map((day) => (
                    <Fragment key={`${teacher.id}-${day}`}>
                      <div className="teacher-day-cell">
                        {day.slice(0, 3)}
                      </div>
                      {timeSlots.map((slot) => {
                        const slotKey = `${day}-${slot.id}`;
                        const isSelected = teacher.selectedSlots.includes(slotKey);
                        const isClickable = isEditing && !slot.isBreak;

                        return (
                          <button
                            key={`${teacher.id}-${slotKey}`}
                            type="button"
                            className={`teacher-slot-cell ${
                              slot.isBreak ? 'break-cell' : ''
                            } ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleTeacherSlot(teacher.id, day, slot)}
                            disabled={!isClickable}
                            aria-label={`${teacher.name} ${day} ${slot.label}`}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div className="teacher-progress-head">
                <span>Available Slots</span>
                <span>{selectedCount}/{totalSelectableSlots}</span>
              </div>
              <div className="teacher-progress-track">
                <div
                  className="teacher-progress-fill"
                  style={{ width: `${(selectedCount / totalSelectableSlots) * 100}%` }}
                ></div>
              </div>

              <button
                type="button"
                className="teacher-edit-btn"
                onClick={() => handleEditToggle(teacher.id)}
              >
                {isEditing ? 'OK' : 'Edit'}
              </button>
            </article>
          );
        })}
      </div>

      {filteredTeachers.length === 0 && (
        <div className="teacher-no-results">No teacher found with this name.</div>
      )}
    </div>
  );
}

export default TeachersTime;
