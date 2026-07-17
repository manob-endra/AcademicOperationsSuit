import { useState } from 'react';
import '../../styles/DemoCredentials.css';

// TEMPORARY — demo credentials for the showcase build. Remove this component
// (and its two usages in Login.jsx / SignUp.jsx) before a real deployment.
const DEMO_ACCOUNTS = [
  { role: 'Admin Portal',   icon: '🛠️', email: 'tst@cse.du.ac.bd',                    password: '12345678' },
  { role: 'Teacher Portal', icon: '👩‍🏫', email: 'teacher@cse.du.ac.bd',                password: '12345678' },
  { role: 'Student Portal', icon: '🎓', email: 'manobendra2021911211@cs.du.ac.bd',    password: '12345678' },
];

/**
 * Dismissible demo-credentials helper shown on the auth pages.
 *
 * Auto-opens on first mount, can be reopened via a floating button, and
 * (on the login page) offers a one-click "Use" that fills the form.
 *
 * @param {(email: string, password: string) => void} [onUse] optional filler
 */
function DemoCredentials({ onUse }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="demo-fab"
          onClick={() => setOpen(true)}
          title="Show demo login credentials"
        >
          🔑 Demo Logins
        </button>
      )}

      {open && (
        <div className="demo-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="demo-modal" role="dialog" aria-label="Demo credentials">
            <div className="demo-modal-head">
              <div>
                <h3 className="demo-modal-title">Demo Login Credentials</h3>
                <p className="demo-modal-sub">For demonstration only · temporary accounts</p>
              </div>
              <button type="button" className="demo-modal-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <p className="demo-modal-intro">
              Use one of the accounts below to explore each portal. Enter the email and password
              on the sign-in form.
            </p>

            <div className="demo-list">
              {DEMO_ACCOUNTS.map(acc => (
                <div key={acc.role} className="demo-item">
                  <div className="demo-item-head">
                    <span className="demo-item-icon">{acc.icon}</span>
                    <span className="demo-item-role">{acc.role}</span>
                    {onUse && (
                      <button
                        type="button"
                        className="demo-item-use"
                        onClick={() => { onUse(acc.email, acc.password); setOpen(false); }}
                      >
                        Use
                      </button>
                    )}
                  </div>
                  <dl className="demo-item-creds">
                    <div>
                      <dt>Email</dt>
                      <dd>{acc.email}</dd>
                    </div>
                    <div>
                      <dt>Password</dt>
                      <dd>{acc.password}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <button type="button" className="demo-modal-dismiss" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default DemoCredentials;
