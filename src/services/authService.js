import { supabase } from '../supabaseClient';
import { validateDomain, getUserRoleByEmail } from '../utils/validators';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid

export const authService = {
  
  // Sign up with email
  async signUpWithEmail(email, password, fullName) {
    try {
      // Validate domain
      if (!validateDomain(email)) {
        throw new Error('Invalid email domain. Use @cs.du.ac.bd, @cse.du.ac.bd, or @du.ac.bd');
      }

      // Check if email already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('This email is already registered. Please login or use a different email.');
      }

      // Determine role
      const role = getUserRoleByEmail(email);
      
      // Hash password (use bcryptjs in production)
      const passwordHash = await this.hashPassword(password);

      // Insert user
      const { data, error } = await supabase
        .from('users')
        .insert([{
          email,
          password_hash: passwordHash,
          role,
          email_verified: true // Auto-verified (no email verification required)
        }])
        .select()
        .single();

      if (error) {
        // Handle specific error codes
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This email is already registered. Please login or use a different email.');
        }
        throw error;
      }

      // Create profile
      await supabase
        .from('user_profiles')
        .insert([{
          user_id: data.id,
          full_name: fullName
        }]);

      return { success: true, user: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign in with email
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
      const isValid = await this.verifyPassword(password, data.password_hash);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      return { success: true, user: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Google OAuth (setup in Firebase/Google Cloud)
  async signInWithGoogle(googleIdToken) {
    try {
      // In production, verify the token with Google
      const { data: googleUser } = await this.verifyGoogleToken(googleIdToken);
      
      const emailDomain = googleUser.email.split('@')[1];
      if (!validateDomain(googleUser.email)) {
        throw new Error('Google account email domain not allowed');
      }

      // Check if user exists
      let { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', googleUser.email)
        .single();

      if (!user) {
        // Create new user
        const role = getUserRoleByEmail(googleUser.email);
        const { data: newUser } = await supabase
          .from('users')
          .insert([{
            email: googleUser.email,
            role,
            email_verified: true // Auto-verified via Google
          }])
          .select()
          .single();

        user = newUser;
      }

      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Password hashing
  async hashPassword(password) {
    // Use bcryptjs in production
    // const bcrypt = require('bcryptjs');
    // return await bcrypt.hash(password, 10);
    return password; // Placeholder - NEVER USE IN PRODUCTION
  },

  async verifyPassword(password, hash) {
    // Use bcryptjs
    // return await bcrypt.compare(password, hash);
    return password === hash; // Placeholder
  },

  async verifyGoogleToken(token) {
    // Implement Google token verification using google-auth-library
    // Return decoded user info
  }
};