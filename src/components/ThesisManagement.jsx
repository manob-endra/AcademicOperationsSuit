import AdminHeader from './shared/layout/AdminHeader';
import AppFooter from './shared/layout/AppFooter';
import BackToDashboard from './shared/layout/BackToDashboard';
import '../styles/ModulePages.css';

function ThesisManagement() {
  return (
    <main className="module-page page-shell">
      <BackToDashboard />
      <AdminHeader pageTitle="Thesis Management" />

      <div className="module-title-bar">
        <h1>Thesis Management</h1>
        <p>Track thesis topics, supervisors, and submission status.</p>
      </div>

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

      <AppFooter />
    </main>
  );
}

export default ThesisManagement;
