import AppFooter from './AppFooter';
import '../../../styles/Layout.css';

/**
 * Layout for the public auth pages: a welcome hero with the application
 * name on top, the auth card centred in the middle, and the app footer.
 */
function AuthLayout({ children }) {
  return (
    <div className="auth-shell page-shell">
      <header className="auth-hero">
        <img src="/favicon.svg" alt="Academic Operation Suite logo" className="auth-hero-logo" />
        <p className="auth-hero-welcome">Welcome to</p>
        <h1 className="auth-hero-title">Academic Operation Suite</h1>
        <p className="auth-hero-sub">Department of Computer Science &amp; Engineering · University of Dhaka</p>
      </header>

      <main className="auth-shell-body">{children}</main>

      <AppFooter />
    </div>
  );
}

export default AuthLayout;
