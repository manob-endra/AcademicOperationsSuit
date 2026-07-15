import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/ModulePages.css';

function InvigilationAssignment() {
  return (
    <main className="module-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Invigilation Assignment" />

      <div className="module-title-bar">
        <h1>Invigilation Assignment</h1>
        <p>Assign invigilators by date, slot, and examination hall.</p>
      </div>

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

      <AppFooter />
    </main>
  );
}

export default InvigilationAssignment;
