import express from 'express';
import { authService }         from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { emailService }        from '../services/emailService.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await authService.signUpWithEmail(email, password, fullName);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Fire-and-forget: signup notification for admin
    notificationService.createSignupNotification({
      userId:   result.user.id,
      email:    result.user.email,
      fullName,
      role:     result.user.role,
    }).catch(err => console.warn('Notification create error (non-fatal):', err.message));

    // Fire-and-forget: send verification email
    emailService.sendVerificationEmail(email, fullName, result.verificationCode)
      .catch(err => console.warn('Verification email error (non-fatal):', err.message));

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * POST /api/auth/signin
 */
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.signInWithEmail(email, password);

    if (!result.success) {
      // Pass the verification error code through so the frontend can show the right UI
      const status = result.code === 'EMAIL_NOT_VERIFIED' ? 403 : 401;
      return res.status(status).json({
        error: result.error,
        code:  result.code,
        email: result.email,
      });
    }

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Signin failed' });
  }
});

/**
 * POST /api/auth/verify-email
 * Body: { email, code }
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const result = await authService.verifyEmail(email, code);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Body: { email }
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await authService.resendVerification(email);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Send the new code (fire-and-forget)
    emailService.sendVerificationEmail(email, null, result.verificationCode)
      .catch(err => console.warn('Resend email error (non-fatal):', err.message));

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

export default router;
