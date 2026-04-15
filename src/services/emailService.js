import { supabase } from '../supabaseClient';

const API_BASE_URL = 'http://localhost:3001/api';

export const emailService = {
  
  async verifyCode(userId, code) {
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

      const createdAt = new Date(data.created_at);
      const now = new Date();
      const diffInSeconds = (now - createdAt) / 1000;

      if (diffInSeconds > 900) {
        throw new Error('Verification code has expired');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', userId);

      if (updateError) {
        throw new Error('Failed to verify email');
      }

      await supabase
        .from('email_verifications')
        .delete()
        .eq('id', data.id);

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async resendCode(userId, userEmail) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await supabase
        .from('email_verifications')
        .delete()
        .eq('user_id', userId);

      const { data, error } = await supabase
        .from('email_verifications')
        .insert([{
          user_id: userId,
          code: code,
          expires_at: new Date(Date.now() + 15 * 60 * 1000)
        }])
        .select()
        .single();

      if (error) {
        throw new Error('Failed to generate verification code');
      }

      const htmlBody = `
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${code}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      `;

      const emailResponse = await fetch(`${API_BASE_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: userEmail,
          subject: 'Email Verification Code',
          htmlBody: htmlBody
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send verification email');
      }

      return { success: true, message: 'Verification code sent to your email' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async sendVerificationEmail(userId, userEmail) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const { error } = await supabase
        .from('email_verifications')
        .insert([{
          user_id: userId,
          code: code,
          expires_at: new Date(Date.now() + 15 * 60 * 1000)
        }]);

      if (error) {
        throw new Error('Failed to generate verification code');
      }

      const htmlBody = `
        <h2>Welcome! Verify Your Email</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${code}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `;

      const emailResponse = await fetch(`${API_BASE_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: userEmail,
          subject: 'Email Verification Code - Academic Portal',
          htmlBody: htmlBody
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send verification email');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
