import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { validateEmail, validateDomain } from '../utils/validators';
import '../styles/Auth.css';

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validation
      if (!formData.fullName) throw new Error('Full name is required');
      if (!validateEmail(formData.email)) throw new Error('Invalid email format');
      if (!validateDomain(formData.email)) {
        throw new Error('Email must end with @cs.du.ac.bd, @cse.du.ac.bd, or @du.ac.bd');
      }
      if (formData.password.length < 8) throw new Error('Password must be at least 8 characters');
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Sign up
      const result = await authService.signUpWithEmail(
        formData.email,
        formData.password,
        formData.fullName
      );

      if (!result.success) throw new Error(result.error);

      setSuccess('Sign up successful! Redirecting to login...');
      setFormData({ fullName: '', email: '', password: '', confirmPassword: '' });
      
      // Redirect to login after 1 second
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Sign Up</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSignUp}>
        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          value={formData.fullName}
          onChange={handleChange}
          required
        />
        
        <input
          type="email"
          name="email"
          placeholder="Email (@cs.du.ac.bd, @cse.du.ac.bd, or @du.ac.bd)"
          value={formData.email}
          onChange={handleChange}
          required
        />
        
        <input
          type="password"
          name="password"
          placeholder="Password (min 8 chars)"
          value={formData.password}
          onChange={handleChange}
          required
        />
        
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>

      <p>Already have an account? <a href="/login">Login here</a></p>
    </div>
  );
}

export default SignUp;