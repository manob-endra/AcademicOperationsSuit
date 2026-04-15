import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
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
  }
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleModuleClick = (moduleKey) => {
    navigate(`/admin-dashboard/${moduleKey}`);
  };

  const getUserInitials = (email) => {
    if (!email) return 'A';
    const parts = email.split('@')[0].split('.');
    return parts.map(p => p[0].toUpperCase()).join('');
  };

  const getUserDisplayName = (email) => {
    if (!email) return 'Admin User';
    const emailPrefix = email.split('@')[0];
    return emailPrefix.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <main className="admin-dashboard-page">
      {/* Header with Logo and User Profile */}
      <header className="admin-dashboard-header">
        <div className="header-left">
          <img src="/favicon.svg" alt="Academic Operation Suit logo" className="brand-logo" />
          <h1>Academic Operation Suit</h1>
        </div>
        <div className="header-right">
          <div className="user-profile">
            <div className="user-avatar">{getUserInitials(user?.email)}</div>
            <span className="user-name">{getUserDisplayName(user?.email)}</span>
          </div>
        </div>
      </header>

      {/* Welcome Message */}
      <section className="welcome-section">
        <p className="welcome-message">Welcome to the administrative operation dashboard.</p>
      </section>

      {/* Module Grid */}
      <section className="modules-grid-container">
        <div className="modules-grid">
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