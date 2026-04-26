import { useMemo, useState } from 'react';

const SEMESTERS = [
  { id: 'Y1-S1', label: '1st Year • 1st Semester' },
  { id: 'Y1-S2', label: '1st Year • 2nd Semester' },
  { id: 'Y2-S1', label: '2nd Year • 1st Semester' },
  { id: 'Y2-S2', label: '2nd Year • 2nd Semester' },
  { id: 'Y3-S1', label: '3rd Year • 1st Semester' },
  { id: 'Y3-S2', label: '3rd Year • 2nd Semester' },
  { id: 'Y4-S1', label: '4th Year • 1st Semester' },
  { id: 'Y4-S2', label: '4th Year • 2nd Semester' },
  { id: 'MS-S1', label: 'MS • 1st Semester' },
  { id: 'MS-S2', label: 'MS • 2nd Semester' },
];

const HOME_ACTIONS = [
  {
    id: 'teacher',
    title: 'Teacher Management',
    description: 'Manage teacher profiles and their teaching schedules.',
  },
  {
    id: 'timeslot',
    title: 'Time Slot Configuration',
    description: 'Set up and manage available time slots for classes.',
  },
  {
    id: 'courses',
    title: 'Course Management',
    description: 'Organize courses and their respective schedules.',
  },
  {
    id: 'allocation',
    title: 'Allocation Planning',
    description: 'Allocate teachers, courses, and time slots to create routines.',
  },
  {
    id: 'routine',
    title: 'Routine Management',
    description: 'Generate, review, and finalize class routines semester-wise.',
  },
];

function ActionIcon({ type }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (type === 'teacher') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19.5c1.5-3 3.7-4.5 7-4.5s5.5 1.5 7 4.5" />
      </svg>
    );
  }

  if (type === 'timeslot') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (type === 'courses') {
    return (
      <svg {...commonProps}>
        <path d="M4.5 5.5h15v13h-15z" />
        <path d="M8 9h8M8 12h8M8 15h5" />
      </svg>
    );
  }

  if (type === 'allocation') {
    return (
      <svg {...commonProps}>
        <path d="M4 7h7" />
        <path d="M13 17h7" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="11" cy="17" r="2" />
        <path d="M15 8.5l3.5 6" />
        <path d="M9 15.5L5.5 9" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M5 6.5h14v11H5z" />
      <path d="M8 4.5v4M16 4.5v4" />
      <path d="M8 12h3M8 15h6" />
    </svg>
  );
}

function Home({ selectedSemesters, setSelectedSemesters, onNavigateToSection }) {
  const [pendingAction, setPendingAction] = useState(null);

  const selectedSemesterLabels = useMemo(
    () =>
      SEMESTERS.filter((semester) => selectedSemesters.includes(semester.id)).map(
        (semester) => semester.label
      ),
    [selectedSemesters]
  );

  const toggleSemester = (semesterId) => {
    setSelectedSemesters((current) => {
      if (current.includes(semesterId)) {
        return current.filter((id) => id !== semesterId);
      }

      return [...current, semesterId];
    });
  };

  const requestProceed = (action) => {
    if (selectedSemesters.length === 0) {
      window.alert('Please select at least one semester before proceeding.');
      return;
    }

    setPendingAction(action);
  };

  const closeConfirm = () => {
    setPendingAction(null);
  };

  const confirmProceed = () => {
    if (!pendingAction) {
      return;
    }

    onNavigateToSection(pendingAction.id);
    closeConfirm();
  };

  return (
    <div className="routine-section-content routine-home">
      <h2>Home</h2>
      <p>
        Select one or multiple semesters, then choose a module to continue routine preparation.
      </p>

      <div className="home-dashboard-grid">
        <section className="semester-selector-card">
          <div className="semester-selector-head">
            <h3>Select Semesters For Routine</h3>
            <span>{selectedSemesters.length}/10 Selected</span>
          </div>

          <div className="semester-grid">
            {SEMESTERS.map((semester) => {
              const checked = selectedSemesters.includes(semester.id);

              return (
                <label key={semester.id} className={`semester-option ${checked ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSemester(semester.id)}
                  />
                  <span>{semester.label}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="home-actions-card">
          <div className="home-actions-head">
            <h3>Choose A Module</h3>
            <p>Click any option to continue with your selected semesters.</p>
          </div>

          <div className="home-cards">
            {HOME_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className="info-card info-card-action"
                onClick={() => requestProceed(action)}
              >
                <div className="info-card-icon">
                  <ActionIcon type={action.id} />
                </div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <span className="info-card-cta">Open Section</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {pendingAction && (
        <div className="home-confirm-overlay" onClick={closeConfirm}>
          <div className="home-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Confirm Selected Semesters</h3>
            <p>
              You are about to open <strong>{pendingAction.title}</strong> for the following semesters:
            </p>

            <div className="home-confirm-semesters">
              {selectedSemesterLabels.map((label) => (
                <span key={label} className="home-confirm-chip">
                  {label}
                </span>
              ))}
            </div>

            <div className="home-confirm-actions">
              <button type="button" className="home-btn cancel" onClick={closeConfirm}>
                Cancel
              </button>
              <button type="button" className="home-btn proceed" onClick={confirmProceed}>
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
