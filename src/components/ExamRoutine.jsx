import { useNavigate } from 'react-router-dom';
import '../styles/ModulePages.css';

function ExamRoutine() {
  const navigate = useNavigate();

  return (
    <main className="module-page">
      <header className="module-header">
        <button className="back-button" onClick={() => navigate('/admin-dashboard')}>
          ←
        </button>
        <h1>Exam Routine</h1>
      </header>

      <section className="module-content">
        <div className="content-placeholder">
          <p>Exam Routine module content will be implemented here.</p>
          <p>Features:</p>
          <ul>
            <li>Generate examination schedules</li>
            <li>Allocate examination halls</li>
            <li>Manage seat arrangements and conflict resolution</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default ExamRoutine;
