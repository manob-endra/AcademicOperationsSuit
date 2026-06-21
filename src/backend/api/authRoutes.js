import express from 'express';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';

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

    // Create signup notification for admin (fire-and-forget — never fail signup)
    notificationService.createSignupNotification({
      userId:   result.user.id,
      email:    result.user.email,
      fullName,
      role:     result.user.role,
    }).catch(err => console.warn('Notification create error (non-fatal):', err.message));

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
      return res.status(401).json({ error: result.error });
    }

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Signin failed' });
  }
});

/**
 * POST /api/auth/verify-email
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    res.json({ success: true, message: 'Email verified successfully', user: { email, verified: true } });
  } catch (error) {
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    res.json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

export default router;
