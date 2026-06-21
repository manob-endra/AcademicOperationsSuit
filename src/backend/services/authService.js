import { supabase } from '../config/supabaseClient.js';
import { validateDomain, validateEmail } from '../utils/validators.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';

/**
 * Authentication Service
 *
 * Handles all user authentication operations including:
 * - Sign up with email/password
 * - Sign in with email/password
 * - Password hashing and verification
 * - Email validation
 */

// Emails that are granted admin role regardless of domain.
// All other @cse.du.ac.bd users are treated as teachers.
const ADMIN_EMAILS = ['tst@cse.du.ac.bd'];

export const authService = {
  
  /**
   * Sign up with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} fullName - User's full name
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async signUpWithEmail(email, password, fullName) {
    try {
      // Validate email domain
      if (!validateDomain(email)) {
        throw new Error('Invalid email domain. Use university-approved domains.');
      }

      // Validate email format
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      // Check if email already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);

      if (checkError) throw checkError;
      
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('This email is already registered. Please login or use a different email.');
      }

      // Validate password strength
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Determine role based on email
      const role = this.getUserRoleByEmail(email);
      
      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user
      const { data, error } = await supabase
        .from('users')
        .insert([{
          email,
          password_hash: passwordHash,
          role,
          email_verified: true
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This email is already registered.');
        }
        throw error;
      }

      // Create user profile
      await supabase
        .from('user_profiles')
        .insert([{
          user_id: data.id,
          full_name: fullName
        }]);

      return { success: true, user: data };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        throw new Error('User not found');
      }

      // Verify password
      const isValid = await verifyPassword(password, data.password_hash);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Always recompute role from email so ADMIN_EMAILS whitelist takes effect
      // even for rows that were inserted before the whitelist was added.
      const role = this.getUserRoleByEmail(email);
      return { success: true, user: { ...data, role } };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Determine user role based on email. Specific admin emails take
   * precedence over domain-based assignment.
   * @param {string} email - User email
   * @returns {string} - 'admin', 'teacher', or 'student'
   */
  getUserRoleByEmail(email) {
    const normalized = email.toLowerCase().trim();
    if (ADMIN_EMAILS.includes(normalized)) return 'admin';

    const domain = normalized.split('@')[1];
    const adminDomains = ['admin.du.ac.bd'];
    const teacherDomains = ['cs.du.ac.bd', 'cse.du.ac.bd'];

    if (adminDomains.includes(domain)) return 'admin';
    if (teacherDomains.includes(domain)) return 'teacher';
    return 'student';
  },

  /**
   * Get user profile with additional details
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
   */
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

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {object} updates - Profile updates
   * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
   */
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
  }
};
