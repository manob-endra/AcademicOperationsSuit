import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { emailService } from '../services/emailService';
import '../styles/Auth.css';

function EmailVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = location.state?.userId;
  const userEmail = location.state?.userEmail;

  const [code, setCode] = useState('');
  const [status, setStatus] = useState('input'); // 'input', 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for code expiration
  useEffect(() => {
    if (status === 'input' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && status === 'input') {
      setCanResend(true);
    }
  }, [timeLeft, status]);

  if (!userId || !userEmail) {
    return (
      <div className="auth-container">
        <h2>Error</h2>
        <p className="message error">
          Invalid verification request. Please sign up again.
        </p>
        <button onClick={() => navigate('/signup')} className="btn">
          Back to Sign Up
        </button>
      </div>
    );
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (!code.trim()) {
        throw new Error('Please enter the verification code');
      }

      if (code.length !== 6 || isNaN(code)) {
        throw new Error('Verification code must be 6 digits');
      }

      setStatus('verifying');
      const result = await emailService.verifyCode(userId, code);

      if (result.success) {
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to home page...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await emailService.resendCode(userId, userEmail);
      if (result.success) {
        setCode('');
        setTimeLeft(900); // Reset timer
        setCanResend(false);
        setMessage('New verification code sent to your email!');
        setStatus('input');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="auth-container">
      {status === 'success' ? (
        <>
          <h2>✓ Email Verified!</h2>
          <p className="message success">{message}</p>
        </>
      ) : status === 'error' ? (
        <>
          <h2>Verification Failed</h2>
          <p className="message error">{error}</p>
          {canResend && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="btn"
              >
                {loading ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          )}
          <p style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
            <a href="/signup" style={{ color: '#007bff', textDecoration: 'none' }}>
              Back to Sign Up
            </a>
          </p>
        </>
      ) : (
        <>
          <h2>Verify Your Email</h2>
          <p style={{ color: '#666', marginBottom: '10px' }}>
            We've sent a verification code to:
          </p>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '20px' }}>
            {userEmail}
          </p>

          {message && <div className="success-message">{message}</div>}

          <form onSubmit={handleVerifyCode}>
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                maxLength="6"
                disabled={loading || status !== 'input'}
                style={{
                  fontSize: '24px',
                  letterSpacing: '10px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', color: '#999' }}>
                Code expires in: <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                  {formatTime(timeLeft)}
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6 || status !== 'input'}
              className="btn"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Didn't receive the code?
            </p>
            <button
              onClick={handleResendCode}
              disabled={loading || !canResend}
              style={{
                background: 'none',
                border: 'none',
                color: canResend ? '#007bff' : '#ccc',
                cursor: canResend ? 'pointer' : 'not-allowed',
                textDecoration: 'underline',
                fontSize: '12px'
              }}
            >
              {loading ? 'Sending...' : canResend ? 'Resend Code' : `Resend in ${formatTime(timeLeft)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default EmailVerification;