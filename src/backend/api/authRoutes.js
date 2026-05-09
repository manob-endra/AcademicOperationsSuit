import express from 'express';
import { authService } from '../services/authService.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Sign up a new user
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

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * POST /api/auth/signin
 * Sign in a user
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
 * Verify email with verification code
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // TODO: Implement email verification logic
    // This would typically:
    // 1. Check if the code matches what was sent to the email
    // 2. Mark the user's email as verified
    // 3. Return the updated user
    
    res.json({ 
      success: true, 
      message: 'Email verified successfully',
      user: { email, verified: true }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification code to email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // TODO: Implement resend verification code logic
    // This would:
    // 1. Generate a new verification code
    // 2. Send it to the email
    // 3. Return success message

    res.json({ 
      success: true, 
      message: 'Verification code sent to email'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

export default router;
