import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { validateEmail } from '../utils/validators';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/Auth.css';

function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!validateEmail(formData.email)) throw new Error('Invalid email format');
      if (!formData.password) throw new Error('Password is required');

      const result = await authService.signInWithEmail(formData.email, formData.password);

      if (!result.success) {
        throw new Error(result.error);
      }

      setUser(result.user);
      // Redirect to admin dashboard
      navigate('/admin-dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleLogin}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p>Don't have an account? <a href="/signup">Sign up here</a></p>
      <p><a href="/forgot-password">Forgot password?</a></p>
    </div>
  );
}

export default Login;