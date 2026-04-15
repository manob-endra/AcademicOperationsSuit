import { useNavigate } from 'react-router-dom';
import '../styles/ModulePages.css';

function InvigilationAssignment() {
  const navigate = useNavigate();

  return (
    <main className="module-page">
      <header className="module-header">
        <button className="back-button" onClick={() => navigate('/admin-dashboard')}>
          ←
        </button>
        <h1>Invigilation Assignment</h1>
      </header>

      <section className="module-content">
        <div className="content-placeholder">
          <p>Invigilation Assignment module content will be implemented here.</p>
          <p>Features:</p>
          <ul>
            <li>Assign invigilators to examination slots</li>
            <li>Balance workload across faculty</li>
            <li>Generate and export duty lists</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default InvigilationAssignment;
