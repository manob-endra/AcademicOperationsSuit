import { useNavigate } from 'react-router-dom';
import '../../../styles/Layout.css';

/**
 * Invisible button pinned to the top-left corner of the page. It pops in
 * when the cursor reaches the corner (or on keyboard focus) and returns
 * the admin to the dashboard. Pass `onClick` to override the action.
 */
function BackToDashboard({ onClick, label = 'Back to Dashboard' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="btd-btn"
      onClick={onClick || (() => navigate('/admin-dashboard'))}
      aria-label={label}
    >
      <span className="btd-arrow">←</span>
      {label}
    </button>
  );
}

export default BackToDashboard;
