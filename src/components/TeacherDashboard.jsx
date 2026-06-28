import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { teacherAPI } from '../services/teacherAPI';
import Notice from './teacher/Notice';
import MyRoutine from './teacher/MyRoutine';
import BatchWiseRoutine from './teacher/BatchWiseRoutine';
import Preference from './teacher/Preference';
import LeaveRequest from './teacher/LeaveRequest';
import TeacherAcademicCalendar from './teacher/TeacherAcademicCalendar';
import TeacherExamRoutine from './teacher/TeacherExamRoutine';
import '../styles/TeacherDashboard.css';

// Nav items that require admission
const RESTRICTED = new Set(['my-routine', 'preference', 'leave']);

const ALL_NAV = [
  { key: 'notice',        label: 'Notice' },
  { key: 'my-routine',    label: 'My Routine' },
  { key: 'batch-routine', label: 'Batch Wise Routine' },
  { key: 'preference',    label: 'Preference' },
  { key: 'leave',         label: 'Leave' },
  { key: 'calendar',      label: 'Academic Calendar' },
  { key: 'exam',          label: 'Exam Schedule' },
];

function TeacherDashboard() {
  const [activeSection,    setActiveSection]    = useState('notice');
  const [teacherRecord,    setTeacherRecord]    = useState(null);   // teacher row from DB
  const [admissionLoading, setAdmissionLoading] = useState(true);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const checkAdmission = useCallback(async () => {
    if (!user?.email) { setAdmissionLoading(false); return; }
    const r = await teacherAPI.getTeachers();
    if (r.success) {
      const found = (r.data || []).find(
        t => t.email?.toLowerCase() === user.email.toLowerCase()
      );
      setTeacherRecord(found || null);
    }
    setAdmissionLoading(false);
  }, [user]);

  useEffect(() => {
    checkAdmission();
    // Re-check every 30 s so the UI updates after admin admits the teacher
    const tid = setInterval(checkAdmission, 30000);
    return () => clearInterval(tid);
  }, [checkAdmission]);

  // If current section becomes invisible after admission revoked, fall back to notice
  useEffect(() => {
    if (!admissionLoading && !teacherRecord && RESTRICTED.has(activeSection)) {
      setActiveSection('notice');
    }
  }, [admissionLoading, teacherRecord, activeSection]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = (key) => {
    if (RESTRICTED.has(key) && !teacherRecord) return; // guard
    setActiveSection(key);
  };

  const getUserInitials = (email) => {
    if (!email) return 'T';
    const local = email.split('@')[0];
    return local.split(/[._-]/).map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || 'T';
  };

  const getUserDisplayName = (email) => {
    if (!email) return 'Teacher';
    return email.split('@')[0].split(/[._-]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const renderContent = () => {
    if (admissionLoading) {
      return (
        <div className="td-loading">
          <div className="td-loading-spinner" />
          Loading…
        </div>
      );
    }
    switch (activeSection) {
      case 'notice':        return <Notice />;
      case 'my-routine':    return <MyRoutine user={user} teacherRecord={teacherRecord} />;
      case 'batch-routine': return <BatchWiseRoutine />;
      case 'preference':    return <Preference user={user} teacherRecord={teacherRecord} />;
      case 'leave':         return <LeaveRequest teacherRecord={teacherRecord} userEmail={user?.email} />;
      case 'calendar':      return <TeacherAcademicCalendar />;
      case 'exam':          return <TeacherExamRoutine teacherRecord={teacherRecord} />;
      default:              return <Notice />;
    }
  };

  return (
    <div className="teacher-dashboard">
      {/* ── Top Navigation Bar ── */}
      <header className="td-header">
        {/* Brand */}
        <div className="td-brand">
          <img src="/favicon.svg" alt="logo" className="td-brand-logo" />
          <div className="td-brand-text">
            <span className="td-brand-name">CSE DU Academic</span>
            <span className="td-brand-role">Teacher Portal</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="td-nav">
          {ALL_NAV.map(item => {
            const locked = RESTRICTED.has(item.key) && !teacherRecord && !admissionLoading;
            return (
              <button
                key={item.key}
                className={`td-nav-item${activeSection === item.key ? ' active' : ''}${locked ? ' locked' : ''}`}
                onClick={() => handleNavClick(item.key)}
                title={locked ? 'Available after admin approval' : undefined}
              >
                {item.label}
                {locked && <span className="td-nav-lock">🔒</span>}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="td-user-area">
          <div className="td-user-info">
            <div className="td-avatar">{getUserInitials(user?.email)}</div>
            <div className="td-user-meta">
              <span className="td-user-name">{teacherRecord?.name || getUserDisplayName(user?.email)}</span>
              <span className="td-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="td-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* Pending approval banner */}
      {!admissionLoading && !teacherRecord && (
        <div className="td-pending-banner">
          <span>⏳</span>
          <span>
            Your account is <strong>pending admin approval</strong>. My Routine and Preference will unlock once the admin admits you as a teacher.
          </span>
        </div>
      )}

      {/* ── Page Content ── */}
      <main className="td-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default TeacherDashboard;
