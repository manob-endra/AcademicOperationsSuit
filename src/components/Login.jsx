import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, validateEmail } from '../services/authAPI';
import { AuthContext } from '../contexts/AuthContext';
import AuthLayout from './shared/layout/AuthLayout';
import '../styles/Auth.css';

function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const [formData,       setFormData]       = useState({ email: '', password: '' });
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(''); // set when EMAIL_NOT_VERIFIED
  const [resendLoading,  setResendLoading]  = useState(false);
  const [resendInfo,     setResendInfo]     = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear the unverified banner when user edits the form
    if (unverifiedEmail) { setUnverifiedEmail(''); setResendInfo(''); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setResendInfo('');
    setLoading(true);

    try {
      if (!validateEmail(formData.email)) throw new Error('Invalid email format');
      if (!formData.password)             throw new Error('Password is required');

      const result = await authAPI.signInWithEmail(formData.email, formData.password);

      if (!result.success) {
        if (result.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(result.email || formData.email);
        } else {
          throw new Error(result.error);
        }
        return;
      }

      setUser(result.user);

      if (result.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else if (result.user.role === 'teacher') {
        navigate('/teacher-dashboard');
      } else if (result.user.role === 'student') {
        navigate('/student-dashboard');
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendInfo('');
    setError('');
    setResendLoading(true);
    try {
      const result = await authAPI.resendVerificationCode(unverifiedEmail);
      if (!result.success) throw new Error(result.error);
      setResendInfo('Verification code sent! Check your inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card-simple">
        <h2 className="auth-form-title">Sign In</h2>
        <p className="auth-form-sub">Use your university email to continue</p>

        {error && <div className="auth-error">{error}</div>}

          {/* Email-not-verified banner */}
          {unverifiedEmail && (
            <div className="auth-unverified-banner">
              <div className="auth-unverified-icon">✉️</div>
              <div className="auth-unverified-body">
                <p className="auth-unverified-title">Email not verified</p>
                <p className="auth-unverified-email">{unverifiedEmail}</p>
                {resendInfo
                  ? <p className="auth-unverified-info">{resendInfo}</p>
                  : <p className="auth-unverified-hint">Check your inbox for the verification code.</p>
                }
                <div className="auth-unverified-actions">
                  <button
                    type="button"
                    className="auth-unverified-resend"
                    onClick={handleResend}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending…' : 'Resend Code'}
                  </button>
                  <Link
                    to="/verify"
                    state={{ userEmail: unverifiedEmail }}
                    className="auth-unverified-enter"
                  >
                    Enter Code →
                  </Link>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">University Email</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="yourname@cse.du.ac.bd"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Sign In'}
            </button>
          </form>

        <p className="auth-footer-text">
          Don&apos;t have an account?{' '}
          <Link to="/signup">Create one here</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;
