import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import Home from './routineManagement/Home';
import Teacher from './routineManagement/Teacher';
import Allocation from './routineManagement/Allocation';
import TimeSlot from './routineManagement/TimeSlot';
import Routine from './routineManagement/Routine';
import Courses from './routineManagement/Courses';
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
  const [activeSection, setActiveSection] = useState('home');

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <Home />;
      case 'teacher':
        return <Teacher />;
      case 'allocation':
        return <Allocation />;
      case 'timeslot':
        return <TimeSlot />;
      case 'routine':
        return <Routine />;
      case 'courses':
        return <Courses />;
      default:
        return <Home />;
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
