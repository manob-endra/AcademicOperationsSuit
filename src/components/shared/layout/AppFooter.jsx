import { Link } from 'react-router-dom';
import '../../../styles/Layout.css';

function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-main">
        <div className="app-footer-brand">
          <div className="app-footer-brand-row">
            <img src="/favicon.svg" alt="Academic Operation Suite logo" className="app-footer-logo" />
            <span className="app-footer-app-name">Academic Operation Suite</span>
          </div>
          <p className="app-footer-tagline">
            The unified academic management platform of the Department of Computer
            Science and Engineering, University of Dhaka — class routines, exam
            schedules, academic calendars and notifications in one place.
          </p>
        </div>

        <div className="app-footer-col">
          <h4>Quick Links</h4>
          <Link to="/login">Sign In</Link>
          <Link to="/signup">Create Account</Link>
          <Link to="/verify">Verify Email</Link>
        </div>

        <div className="app-footer-col">
          <h4>Resources</h4>
          <a href="https://www.du.ac.bd" target="_blank" rel="noreferrer">University of Dhaka</a>
          <a href="https://www.cse.du.ac.bd" target="_blank" rel="noreferrer">Department of CSE</a>
          <a href="https://www.du.ac.bd/notice" target="_blank" rel="noreferrer">University Notices</a>
        </div>

        <div className="app-footer-col">
          <h4>Contact</h4>
          <span>Department of Computer Science &amp; Engineering</span>
          <span>University of Dhaka, Dhaka-1000, Bangladesh</span>
          <a href="mailto:office@cse.du.ac.bd">office@cse.du.ac.bd</a>
          <span>+880-2-9661900 (Ext. 7420)</span>
        </div>
      </div>

      <div className="app-footer-bottom">
        <span>© {year} Department of Computer Science &amp; Engineering, University of Dhaka. All rights reserved.</span>
      </div>
    </footer>
  );
}

export default AppFooter;
