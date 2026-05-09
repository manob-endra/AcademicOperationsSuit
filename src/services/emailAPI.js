/**
 * Frontend Email API Service
 * Makes HTTP calls to backend email endpoints
 */

const API_BASE_URL = 'http://localhost:3001/api/email';

export const emailAPI = {
  /**
   * Send verification email
   */
  async sendVerificationEmail(email) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/send-verification`, {
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
        throw new Error(result.error || 'Failed to send verification email');
      }

      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Send verification email error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Failed to send email' };
    }
  },

  /**
   * Send custom email
   */
  async sendEmail(to, subject, htmlBody) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to, subject, htmlBody }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to send email');
      }

      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Send email error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Server connection timeout', offline: true };
      }
      return { success: false, error: error.message || 'Failed to send email' };
    }
  }
};
