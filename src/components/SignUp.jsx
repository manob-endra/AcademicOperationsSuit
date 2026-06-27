import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, validateEmail } from '../services/authAPI';
import '../styles/Auth.css';

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName:        '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.fullName.trim())       throw new Error('Full name is required');
      if (!validateEmail(formData.email))  throw new Error('Invalid email format');
      if (formData.password.length < 8)    throw new Error('Password must be at least 8 characters');
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const result = await authAPI.signUpWithEmail(
        formData.email,
        formData.password,
        formData.fullName,
      );

      if (!result.success) throw new Error(result.error);

      // Navigate to email verification page
      navigate('/verify', { state: { userEmail: formData.email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="auth-form-title">Create Account</h2>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSignUp} className="auth-form">
            <div className="auth-field">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                placeholder="Your full name"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>

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
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Create Account'}
            </button>
          </form>

          <div className="auth-role-hint">
            <span className="auth-role-chip teacher">@cse.du.ac.bd → Teacher</span>
            <span className="auth-role-chip student">@cs.du.ac.bd → Student</span>
          </div>

          <p className="auth-footer-text">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
