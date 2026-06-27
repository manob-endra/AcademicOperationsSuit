import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/authAPI';
import '../styles/Auth.css';

const EXPIRY_SECONDS = 15 * 60; // 15 minutes

function EmailVerification() {
  const location = useLocation();
  const navigate = useNavigate();

  // Email can come from navigation state (SignUp redirect) or be entered manually
  const [email, setEmail]         = useState(location.state?.userEmail || '');
  const [emailInput, setEmailInput] = useState('');   // for manual entry if no state
  const [code, setCode]           = useState('');
  const [phase, setPhase]         = useState(
    location.state?.userEmail ? 'verify' : 'enter-email'
  );
  // phase: 'enter-email' | 'verify' | 'success'

  const [error,   setError]   = useState('');
  const [info,    setInfo]     = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'verify') return;
    if (timeLeft <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Step 1: User enters email manually (arrived at /verify directly) ──
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.resendVerificationCode(emailInput.trim());
      if (!result.success) throw new Error(result.error);
      setEmail(emailInput.trim());
      setTimeLeft(EXPIRY_SECONDS);
      setCanResend(false);
      setPhase('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify the code ──
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (code.length !== 6 || isNaN(code)) throw new Error('Enter the 6-digit code');
      const result = await authAPI.verifyEmail(email, code);
      if (!result.success) throw new Error(result.error);
      setPhase('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ──
  const handleResend = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const result = await authAPI.resendVerificationCode(email);
      if (!result.success) throw new Error(result.error);
      setCode('');
      setTimeLeft(EXPIRY_SECONDS);
      setCanResend(false);
      setInfo('A new code has been sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──
  if (phase === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo">
              <img src="/favicon.svg" alt="logo" />
            </div>
            <h1 className="auth-title">Academic Operation Suite</h1>
            <p className="auth-subtitle">Department of CSE, University of Dhaka</p>
          </div>
          <div className="auth-card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
            <h2 className="auth-form-title" style={{ marginBottom: 10 }}>Email Verified!</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>
              Your email address has been verified successfully.<br />
              You can now sign in to your account.
            </p>
            <button
              className="auth-btn-primary"
              onClick={() => navigate('/login')}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Enter email screen (no state provided) ──
  if (phase === 'enter-email') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo">
              <img src="/favicon.svg" alt="logo" />
            </div>
            <h1 className="auth-title">Academic Operation Suite</h1>
            <p className="auth-subtitle">Department of CSE, University of Dhaka</p>
          </div>
          <div className="auth-card-body">
            <h2 className="auth-form-title">Verify Your Email</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
              Enter your university email and we&apos;ll send you a verification code.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSendCode} className="auth-form">
              <div className="auth-field">
                <label htmlFor="emailInput">University Email</label>
                <input
                  id="emailInput"
                  type="email"
                  placeholder="yourname@cse.du.ac.bd"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : 'Send Verification Code'}
              </button>
            </form>

            <p className="auth-footer-text">
              Already verified? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Code entry screen ──
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo">
            <img src="/favicon.svg" alt="logo" />
          </div>
          <h1 className="auth-title">Academic Operation Suite</h1>
          <p className="auth-subtitle">Department of CSE, University of Dhaka</p>
        </div>

        <div className="auth-card-body">
          <h2 className="auth-form-title">Check Your Email</h2>

          <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>
            We sent a 6-digit verification code to
          </p>
          <p style={{ color: '#1a2a4a', fontWeight: 700, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            {email}
          </p>

          {error && <div className="auth-error">{error}</div>}
          {info  && <div className="auth-success">{info}</div>}

          <form onSubmit={handleVerify} className="auth-form">
            <div className="auth-field">
              <label htmlFor="code">Verification Code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="• • • • • •"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoComplete="one-time-code"
                style={{ textAlign: 'center', fontSize: 26, letterSpacing: 10, fontWeight: 700 }}
              />
            </div>

            {/* Countdown */}
            <p style={{ textAlign: 'center', fontSize: 13, color: timeLeft > 60 ? '#6b7280' : '#dc2626', margin: '-4px 0 4px' }}>
              {canResend
                ? 'Code expired — request a new one below'
                : `Code expires in ${formatTime(timeLeft)}`}
            </p>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading || code.length !== 6 || canResend}
            >
              {loading ? <span className="auth-spinner" /> : 'Verify Email'}
            </button>
          </form>

          {/* Resend */}
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Didn&apos;t receive the code?
            </p>
            <button
              onClick={handleResend}
              disabled={loading || !canResend}
              style={{
                background: 'none',
                border: 'none',
                color: canResend ? '#2c5f8a' : '#d1d5db',
                cursor: canResend ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: 13,
                textDecoration: canResend ? 'underline' : 'none',
                padding: 0,
              }}
            >
              {loading ? 'Sending…' : 'Resend Code'}
            </button>
          </div>

          <p className="auth-footer-text" style={{ marginTop: 16 }}>
            Wrong email? <Link to="/signup">Sign up again</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailVerification;
