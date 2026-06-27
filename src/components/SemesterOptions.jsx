import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { academicSemesterAPI } from '../services/academicSemesterAPI';
import '../styles/ModulePages.css';
import '../styles/SemesterOptions.css';

const options = [
  {
    key: 'routine',
    title: 'Create Routine',
    description: 'Build and manage class schedules, assign teachers, configure time slots, and generate the semester routine.',
    icon: '📅',
  },
  {
    key: 'academic-calendar',
    title: 'Create Academic Calendar',
    description: 'Plan academic events, holidays, exam periods, and important dates for the semester.',
    icon: '🗓️',
  },
];

function SemesterOptions() {
  const { semesterId } = useParams();
  const navigate = useNavigate();
  const [semester, setSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    academicSemesterAPI.getSemesterById(semesterId).then(result => {
      if (result.success) setSemester(result.data);
      else setError('Semester not found.');
      setLoading(false);
    });
  }, [semesterId]);

  const handleOption = (key, comingSoon) => {
    if (comingSoon) return;
    navigate(`/admin-dashboard/routine-management/${semesterId}/${key}`);
  };

  return (
    <main className="module-page">
      <header className="module-header">
        <button
          className="back-button"
          onClick={() => navigate('/admin-dashboard/routine-management')}
        >
          ← Semesters
        </button>
        <div>
          {loading ? (
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Loading…</h1>
          ) : error ? (
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fca5a5' }}>{error}</h1>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                {semester.name} {semester.year}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.75 }}>
                Choose what you want to manage for this semester
              </p>
            </>
          )}
        </div>
      </header>

      <div className="module-content">
        {!loading && !error && (
          <div className="so-grid">
            {options.map(opt => (
              <div
                key={opt.key}
                className={`so-card ${opt.comingSoon ? 'so-card--disabled' : ''}`}
                onClick={() => handleOption(opt.key, opt.comingSoon)}
                role="button"
                tabIndex={opt.comingSoon ? -1 : 0}
                onKeyPress={e => e.key === 'Enter' && handleOption(opt.key, opt.comingSoon)}
              >
                <div className="so-icon">{opt.icon}</div>
                <h2 className="so-title">{opt.title}</h2>
                <p className="so-desc">{opt.description}</p>
                {opt.comingSoon ? (
                  <span className="so-badge">Coming Soon</span>
                ) : (
                  <div className="so-arrow">→</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default SemesterOptions;
