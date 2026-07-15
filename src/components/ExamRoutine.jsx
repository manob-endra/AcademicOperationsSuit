import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/ModulePages.css';

function ExamRoutine() {
  return (
    <main className="module-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Exam Routine" />

      <div className="module-title-bar">
        <h1>Exam Routine</h1>
        <p>Schedule examinations and coordinate hall-wise planning.</p>
      </div>

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

      <AppFooter />
    </main>
  );
}

export default ExamRoutine;
