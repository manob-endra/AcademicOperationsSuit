import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import NoticeManagement from './admin/NoticeManagement';
import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
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

function getUserDisplayName(email) {
  if (!email) return 'Admin';
  return email.split('@')[0].split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [showNotices, setShowNotices] = useState(false);

  const handleModuleClick = (moduleKey) => {
    if (moduleKey === 'notice-management') {
      setShowNotices(true);
      return;
    }
    navigate(`/admin-dashboard/${moduleKey}`);
  };

  if (showNotices) {
    return (
      <main className="admin-dashboard-page page-shell">
        <BackToDashboard onClick={() => setShowNotices(false)} />
        <AdminHeader pageTitle="Notice Management" />
        <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <NoticeManagement user={user} />
        </div>
        <AppFooter />
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page page-shell">
      <AdminHeader />

      {/* Welcome */}
      <section className="welcome-section">
        <h2 className="welcome-title">Welcome back, {getUserDisplayName(user?.email)} 👋</h2>
        <p className="welcome-message">
          Manage routines, exams, people and notifications — all from one place.
        </p>
      </section>

      {/* Module Grid */}
      <section className="modules-grid-container">
        <div className="modules-grid modules-grid-8">
          {moduleOptions.map((module) => (
            <div
              key={module.key}
              className={`module-card-v2 ${module.color}`}
              onClick={() => handleModuleClick(module.key)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && handleModuleClick(module.key)}
            >
              <div className="mc-icon">{module.icon}</div>
              <h2 className="mc-title">{module.title}</h2>
              <p className="mc-desc">{module.description}</p>
              <div className="mc-open">
                Open module <span className="mc-arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <AppFooter />
    </main>
  );
}

export default AdminDashboard;
