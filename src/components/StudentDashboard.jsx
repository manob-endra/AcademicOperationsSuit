import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import StudentNotice           from './student/StudentNotice';
import StudentRoutine          from './student/StudentRoutine';
import StudentCourses          from './student/StudentCourses';
import StudentAcademicCalendar from './student/StudentAcademicCalendar';
import StudentExamRoutine from './student/StudentExamRoutine';
import AppFooter from './shared/layout/AppFooter';
import '../styles/StudentDashboard.css';

const ALL_NAV = [
  { key: 'notice',    label: 'Notices'           },
  { key: 'routine',   label: 'My Routine'        },
  { key: 'courses',   label: 'My Courses'        },
  { key: 'calendar',  label: 'Academic Calendar' },
  { key: 'exam',      label: 'Exam Schedule'     },
];

function StudentDashboard() {
  const [activeSection, setActiveSection] = useState('notice');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = (email) => {
    if (!email) return 'S';
    const local = email.split('@')[0];
    return local.split(/[._-]/).map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || 'S';
  };

  const getUserDisplayName = (email) => {
    if (!email) return 'Student';
    return email.split('@')[0].split(/[._-]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'notice':   return <StudentNotice />;
      case 'routine':  return <StudentRoutine />;
      case 'courses':  return <StudentCourses />;
      case 'calendar': return <StudentAcademicCalendar />;
      case 'exam':     return <StudentExamRoutine />;
      default:         return <StudentNotice />;
    }
  };

  return (
    <div className="student-dashboard page-shell">
      {/* ── Header ── */}
      <header className="sd-header">
        {/* Brand */}
        <div className="sd-brand">
          <img src="/favicon.svg" alt="logo" className="sd-brand-logo" />
          <div className="sd-brand-text">
            <span className="sd-brand-name">CSE DU Academic</span>
            <span className="sd-brand-role">Student Portal</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sd-nav">
          {ALL_NAV.map(item => (
            <button
              key={item.key}
              className={`sd-nav-item${activeSection === item.key ? ' active' : ''}`}
              onClick={() => setActiveSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="sd-user-area">
          <div className="sd-user-info">
            <div className="sd-avatar">{getUserInitials(user?.email)}</div>
            <div className="sd-user-meta">
              <span className="sd-user-name">{getUserDisplayName(user?.email)}</span>
              <span className="sd-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="sd-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="sd-content">
        {renderContent()}
      </main>

      <AppFooter />
    </div>
  );
}

export default StudentDashboard;
