import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../contexts/AuthContext';
import AdminNotifications from '../../admin/AdminNotifications';
import '../../../styles/Layout.css';

function getUserInitials(email) {
  if (!email) return 'A';
  const parts = email.split('@')[0].split(/[._-]/);
  return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || 'A';
}

function getUserDisplayName(email) {
  if (!email) return 'Admin User';
  return email.split('@')[0].split(/[._-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Global header: application name on the left, options (notifications,
 * user profile, sign out) on the right. Optional `pageTitle` renders a
 * chip next to the brand; `children` render in the centre area (e.g. a
 * section nav).
 */
function AdminHeader({ pageTitle, children, showNotifications = true }) {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div
        className="app-header-brand"
        onClick={() => navigate('/admin-dashboard')}
        title="Go to dashboard"
      >
        <img src="/favicon.svg" alt="Academic Operation Suite logo" className="app-header-logo" />
        <div className="app-header-titles">
          <span className="app-header-name">Academic Operation Suite</span>
          <span className="app-header-dept">Dept. of CSE · University of Dhaka</span>
        </div>
        {pageTitle && <span className="app-header-page-chip">{pageTitle}</span>}
      </div>

      {children && <div className="app-header-center">{children}</div>}

      <div className="app-header-right">
        {showNotifications && <AdminNotifications />}
        <div className="app-user-chip">
          <div className="app-user-avatar">{getUserInitials(user?.email)}</div>
          <div className="app-user-meta">
            <span className="app-user-name">{getUserDisplayName(user?.email)}</span>
            <span className="app-user-mail">{user?.email}</span>
          </div>
        </div>
        <button className="app-signout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}

export default AdminHeader;
