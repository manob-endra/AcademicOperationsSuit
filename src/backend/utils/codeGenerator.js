/**
 * Code Generator Utilities
 * 
 * Generates various codes for backend operations
 */

/**
 * Generate 6-digit verification code
 * @returns {string} - Verification code
 */
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate unique ID
 * @param {string} prefix - ID prefix (optional)
 * @returns {string} - Unique ID
 */
export const generateUniqueId = (prefix = 'ID') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`.toUpperCase();
};

/**
 * Generate JWT token (basic implementation)
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key
 * @returns {string} - JWT token
 */
export const generateJWT = (payload, secret) => {
  // TODO: Use 'jsonwebtoken' package in production
  // import jwt from 'jsonwebtoken';
  // return jwt.sign(payload, secret, { expiresIn: '24h' });
  
  console.warn('⚠️ Using basic JWT implementation. Install jsonwebtoken for production.');
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

/**
 * Generate random slug from text
 * @param {string} text - Text to slugify
 * @returns {string} - Slug
 */
export const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate course code (auto-increment)
 * @param {string} prefix - Course code prefix (e.g., 'CSE')
 * @param {number} nextNumber - Next number in sequence
 * @returns {string} - Course code
 */
export const generateCourseCode = (prefix, nextNumber) => {
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
};
