/**
 * Frontend Auth API Service
 * Makes HTTP calls to backend authentication endpoints
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/auth`;

// Helper function to validate email locally (without backend)
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate domain
export const validateDomain = (email) => {
  if (!email) return false;
  // Accept most academic domains or allow all for now
  return true;
};

// Helper function to validate password strength
export const validatePasswordStrength = (password) => {
  return password && password.length >= 8;
};

export const authAPI = {
  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password, fullName) {
    try {
      // Validate inputs locally first
      if (!validateEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      if (!validatePasswordStrength(password)) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, fullName }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Signup failed');
      }

      const result = await response.json();
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Signup error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Signup failed' };
    }
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    try {
      if (!validateEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Login failed');
      }

      const result = await response.json();
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  /**
   * Verify email with code
   */
  async verifyEmail(email, code) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Verification failed');
      }

      const result = await response.json();
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Email verification error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Verification failed' };
    }
  },

  /**
   * Resend verification code
   */
  async resendVerificationCode(email) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to resend code');
      }

      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Resend verification code error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Failed to resend code' };
    }
  }
};
