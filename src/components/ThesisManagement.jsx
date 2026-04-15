import { useNavigate } from 'react-router-dom';
import '../styles/ModulePages.css';

function ThesisManagement() {
  const navigate = useNavigate();

  return (
    <main className="module-page">
      <header className="module-header">
        <button className="back-button" onClick={() => navigate('/admin-dashboard')}>
          ←
        </button>
        <h1>Thesis Management</h1>
      </header>

      <section className="module-content">
        <div className="content-placeholder">
          <p>Thesis Management module content will be implemented here.</p>
          <p>Features:</p>
          <ul>
            <li>Assign thesis supervisors</li>
            <li>Track thesis progress and milestones</li>
            <li>Manage thesis submissions and reviews</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default ThesisManagement;
