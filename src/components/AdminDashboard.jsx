import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import NoticeManagement from './admin/NoticeManagement';
import AdminNotifications from './admin/AdminNotifications';
import '../styles/AdminDashboard.css';

const moduleOptions = [
  {
    key: 'routine-management',
    title: 'Routine Management',
    description: 'Create, update, and publish semester class routines.',
    icon: '📅',
    color: 'gradient-blue'
  },
  {
    key: 'thesis-management',
    title: 'Thesis Management',
    description: 'Track thesis topics, supervisors, and submission status.',
    icon: '📚',
    color: 'gradient-green'
  },
  {
    key: 'exam-routine',
    title: 'Exam Routine',
    description: 'Schedule examinations and coordinate hall-wise planning.',
    icon: '📝',
    color: 'gradient-purple'
  },
  {
    key: 'invigilation-assignment',
    title: 'Invigilation Assignment',
    description: 'Assign invigilators by date, slot, and examination hall.',
    icon: '👥',
    color: 'gradient-orange'
  },
  {
    key: 'notice-management',
    title: 'Notice Management',
    description: 'Post and manage notices visible to all teachers.',
    icon: '📢',
    color: 'gradient-teal'
  },
  {
    key: 'teacher-management',
    title: 'Teacher Management',
    description: 'Manage teacher profiles, designations, availability, and records.',
    icon: '👨‍🏫',
    color: 'gradient-indigo'
  },
  {
    key: 'student-management',
    title: 'Student Management',
    description: 'Manage student records, year progression, batch promotion, and contact details.',
    icon: '🎓',
    color: 'gradient-rose'
  },
  {
    key: 'notification-center',
    title: 'Notification Center',
    description: 'Publish routines, audit email delivery logs, and manage unsubscribe preferences.',
    icon: '🔔',
    color: 'gradient-amber'
  }
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [showNotices, setShowNotices] = useState(false);

  const handleModuleClick = (moduleKey) => {
    if (moduleKey === 'notice-management') {
      setShowNotices(true);
      return;
    }
    navigate(`/admin-dashboard/${moduleKey}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = (email) => {
    if (!email) return 'A';
    const parts = email.split('@')[0].split(/[._-]/);
    return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || 'A';
  };

  const getUserDisplayName = (email) => {
    if (!email) return 'Admin User';
    const emailPrefix = email.split('@')[0];
    return emailPrefix.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (showNotices) {
    return (
      <main className="admin-dashboard-page">
        <header className="admin-dashboard-header">
          <div className="header-left">
            <img src="/favicon.svg" alt="Academic Operation Suit logo" className="brand-logo" />
            <h1>Academic Operation Suit</h1>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AdminNotifications />
            <button
              onClick={() => setShowNotices(false)}
              style={{ padding: '7px 16px', background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              ← Back to Dashboard
            </button>
            <div className="user-profile">
              <div className="user-avatar">{getUserInitials(user?.email)}</div>
              <span className="user-name">{getUserDisplayName(user?.email)}</span>
            </div>
          </div>
        </header>
        <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
          <NoticeManagement user={user} />
        </div>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      {/* Header */}
      <header className="admin-dashboard-header">
        <div className="header-left">
          <img src="/favicon.svg" alt="Academic Operation Suit logo" className="brand-logo" />
          <h1>Academic Operation Suit</h1>
        </div>
        <div className="header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <AdminNotifications />
          <div className="user-profile">
            <div className="user-avatar">{getUserInitials(user?.email)}</div>
            <span className="user-name">{getUserDisplayName(user?.email)}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Welcome */}
      <section className="welcome-section">
        <p className="welcome-message">Welcome to the administrative operation dashboard.</p>
      </section>

      {/* Module Grid */}
      <section className="modules-grid-container">
        <div className="modules-grid modules-grid-8">
          {moduleOptions.map((module) => (
            <div
              key={module.key}
              className={`module-card ${module.color}`}
              onClick={() => handleModuleClick(module.key)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && handleModuleClick(module.key)}
            >
              <div className="module-icon">{module.icon}</div>
              <h2 className="module-title">{module.title}</h2>
              <p className="module-description">{module.description}</p>
              <div className="module-arrow">→</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default AdminDashboard;
