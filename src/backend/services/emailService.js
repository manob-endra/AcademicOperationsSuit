import { supabase } from '../config/supabaseClient.js';
import { generateVerificationCode } from '../utils/codeGenerator.js';

/**
 * Email Service
 * 
 * Handles email-related operations:
 * - Email verification codes
 * - Code validation
 * - Resending verification codes
 */

export const emailService = {

  /**
   * Send verification code to user email
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<{success: boolean, code?: string, error?: string}>}
   */
  async sendVerificationCode(userId, userEmail) {
    try {
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store verification code
      const { data, error } = await supabase
        .from('email_verifications')
        .insert([{
          user_id: userId,
          code,
          expires_at: expiresAt.toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
      console.log(`📧 Verification code for ${userEmail}: ${code}`);

      return { success: true, code };
    } catch (error) {
      console.error('Send verification code error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Verify email code
   * @param {string} userId - User ID
   * @param {string} code - Verification code
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async verifyEmailCode(userId, code) {
    try {
      const { data, error } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('code', code)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired verification code');
      }

      // Check if expired
      const expiresAt = new Date(data.expires_at);
      if (new Date() > expiresAt) {
        throw new Error('Verification code has expired');
      }

      // Mark email as verified
      const { error: updateError } = await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Delete used code
      await supabase
        .from('email_verifications')
        .delete()
        .eq('id', data.id);

      return { success: true };
    } catch (error) {
      console.error('Verify email code error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Resend verification code
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resendVerificationCode(userId, userEmail) {
    try {
      // Delete old codes
      await supabase
        .from('email_verifications')
        .delete()
        .eq('user_id', userId);

      // Send new code
      return await this.sendVerificationCode(userId, userEmail);
    } catch (error) {
      console.error('Resend verification code error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send password reset email
   * @param {string} userEmail - User email
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendPasswordResetEmail(userEmail) {
    try {
      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Generate reset token
      const resetToken = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      const { error } = await supabase
        .from('password_resets')
        .insert([{
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt.toISOString()
        }]);

      if (error) throw error;

      // TODO: Send email with reset link
      console.log(`🔐 Password reset token for ${userEmail}: ${resetToken}`);

      return { success: true };
    } catch (error) {
      console.error('Send password reset email error:', error);
      return { success: false, error: error.message };
    }
  }
};
