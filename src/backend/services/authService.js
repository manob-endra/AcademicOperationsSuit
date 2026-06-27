import { supabase } from '../config/supabaseClient.js';
import { validateDomain, validateEmail } from '../utils/validators.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';
import { generateVerificationCode } from '../utils/codeGenerator.js';

// Emails that are granted admin role regardless of domain.
// All other @cse.du.ac.bd users are treated as teachers.
const ADMIN_EMAILS = ['tst@cse.du.ac.bd'];

export const authService = {

  async signUpWithEmail(email, password, fullName) {
    try {
      if (!validateDomain(email)) {
        throw new Error('Invalid email domain. Use university-approved domains.');
      }
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);

      if (checkError) throw checkError;
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('This email is already registered. Please login or use a different email.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const role         = this.getUserRoleByEmail(email);
      const passwordHash = await hashPassword(password);
      const verCode      = generateVerificationCode();
      const expiresAt    = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const { data, error } = await supabase
        .from('users')
        .insert([{
          email,
          password_hash:                  passwordHash,
          role,
          email_verified:                 false,
          verification_token:             verCode,
          verification_token_expires_at:  expiresAt.toISOString(),
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') throw new Error('This email is already registered.');
        throw error;
      }

      await supabase
        .from('user_profiles')
        .insert([{ user_id: data.id, full_name: fullName }]);

      return { success: true, user: data, verificationCode: verCode };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  },

  async verifyEmail(email, code) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, email_verified, verification_token, verification_token_expires_at')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !user) throw new Error('User not found');

      if (user.email_verified) {
        return { success: true, alreadyVerified: true };
      }

      if (!user.verification_token) {
        throw new Error('No verification code found. Please request a new one.');
      }
      if (user.verification_token !== String(code)) {
        throw new Error('Invalid verification code');
      }
      if (Date.now() > new Date(user.verification_token_expires_at).getTime()) {
        throw new Error('Verification code has expired. Please request a new one.');
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          email_verified:                true,
          verification_token:            null,
          verification_token_expires_at: null,
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;
      return { success: true };
    } catch (error) {
      console.error('Verify email error:', error);
      return { success: false, error: error.message };
    }
  },

  async resendVerification(email) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, email_verified')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !user) throw new Error('User not found');
      if (user.email_verified) throw new Error('Email is already verified.');

      const verCode   = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          verification_token:            verCode,
          verification_token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;
      return { success: true, verificationCode: verCode };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { success: false, error: error.message };
    }
  },

  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) throw new Error('User not found');

      const isValid = await verifyPassword(password, data.password_hash);
      if (!isValid) throw new Error('Invalid password');

      // Block login if email not yet verified
      if (!data.email_verified) {
        return {
          success: false,
          error:  'Email not verified. Please check your inbox.',
          code:   'EMAIL_NOT_VERIFIED',
          email:  data.email,
        };
      }

      // Always recompute role from email so ADMIN_EMAILS whitelist takes effect
      const role = this.getUserRoleByEmail(email);
      return { success: true, user: { ...data, role } };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  },

  getUserRoleByEmail(email) {
    const normalized = email.toLowerCase().trim();
    if (ADMIN_EMAILS.includes(normalized)) return 'admin';

    const domain         = normalized.split('@')[1];
    const adminDomains   = ['admin.du.ac.bd'];
    const teacherDomains = ['cse.du.ac.bd'];

    if (adminDomains.includes(domain))   return 'admin';
    if (teacherDomains.includes(domain)) return 'teacher';
    return 'student';
  },

  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      console.error('Get profile error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  },
};
