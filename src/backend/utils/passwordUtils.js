/**
 * Password Utilities
 * 
 * Handles password hashing and verification using bcryptjs
 * Provides secure password management for authentication
 */

import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcryptjs
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} - Hashed password (salt included)
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

/**
 * Verify a plain password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches, false otherwise
 */
export const verifyPassword = async (password, hash) => {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with strength level
 */
export const validatePasswordStrength = (password) => {
  const result = {
    isValid: true,
    strength: 'weak',
    errors: []
  };

  if (password.length < 6) {
    result.errors.push('Password must be at least 6 characters');
    result.isValid = false;
  }

  if (!/[A-Z]/.test(password)) {
    result.errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    result.errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    result.errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    result.errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  // Determine strength
  if (result.errors.length === 0) {
    result.strength = 'strong';
  } else if (result.errors.length <= 2) {
    result.strength = 'medium';
  }

  return result;
};
