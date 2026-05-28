import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { semesterSelectionAPI } from '../services/semesterSelectionAPI';
import Home from './routineManagement/Home';
import Teachers from './routineManagement/Teachers/Teachers';
import Allocation from './routineManagement/Allocation';
import TimeSlot from './routineManagement/TimeSlot';
import Routine from './routineManagement/Routine';
import Courses from './routineManagement/Courses/Courses';
import '../styles/ModulePages.css';
import '../styles/RoutineManagement.css';

const sections = [
  { key: 'home', label: 'Home' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'timeslot', label: 'Time Slot' },
  { key: 'routine', label: 'Routine' },
  { key: 'courses', label: 'Courses' }
];

function RoutineManagement() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [activeSection, setActiveSection]       = useState('home');
  const [selectedSemesters, setSelectedSemesters] = useState([]);
  const initialLoadDone = useRef(false);
  const saveTimer       = useRef(null);

  // Load saved selection from DB on first mount
  useEffect(() => {
    semesterSelectionAPI.getSelectedSemesters().then((result) => {
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setSelectedSemesters(result.data);
      }
      initialLoadDone.current = true;
    });
  }, []);

  // Auto-save to DB whenever selection changes (skip the initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      semesterSelectionAPI.saveSelectedSemesters(selectedSemesters);
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [selectedSemesters]);

  const handleHomeNavigate = (sectionKey) => {
    setActiveSection(sectionKey);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return (
          <Home
            selectedSemesters={selectedSemesters}
            setSelectedSemesters={setSelectedSemesters}
            onNavigateToSection={handleHomeNavigate}
          />
        );
      case 'teacher':
        return <Teachers />;
      case 'allocation':
        return <Allocation selectedSemesters={selectedSemesters} />;
      case 'timeslot':
        return <TimeSlot />;
      case 'routine':
        return <Routine onNavigate={setActiveSection} />;
      case 'courses':
        return <Courses selectedSemesters={selectedSemesters} />;
      default:
        return (
          <Home
            selectedSemesters={selectedSemesters}
            setSelectedSemesters={setSelectedSemesters}
            onNavigateToSection={handleHomeNavigate}
          />
        );
    }
  };

  return (
    <main className="routine-management-page">
      <header className="routine-module-header">
        <div className="header-top">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate('/admin-dashboard')}>
              ←
            </button>
            <h1>Routine Manager</h1>
          </div>

          <nav className="routine-navigation">
            {sections.map((section) => (
              <button
                key={section.key}
                className={`nav-option ${activeSection === section.key ? 'active' : ''}`}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="routine-content">
        {renderSection()}
      </section>
    </main>
  );
}

export default RoutineManagement;
