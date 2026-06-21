import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, validateEmail } from '../services/authAPI';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/Auth.css';

function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!validateEmail(formData.email)) throw new Error('Invalid email format');
      if (!formData.password) throw new Error('Password is required');

      const result = await authAPI.signInWithEmail(formData.email, formData.password);
      if (!result.success) throw new Error(result.error);

      setUser(result.user);

      if (result.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else if (result.user.role === 'teacher') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/login');
      }
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
          <h2 className="auth-form-title">Sign In</h2>

          {error && <div className="auth-error">{error}</div>}

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
      </div>
    </div>
  );
}

export default Login;
