/**
 * Backend Services Index
 * 
 * Export all services and utilities from a single entry point
 * Usage: import { authService, courseService } from '@/backend'
 */

// Services
export { authService } from './services/authService';
export { courseService } from './services/courseService';
export { teacherService } from './services/teacherService';
export { emailService } from './services/emailService';

// Utilities
export { validateEmail, validateDomain, getUserRoleByEmail, validateCourseData, validateTeacherData } from './utils/validators';
export { hashPassword, verifyPassword, validatePasswordStrength } from './utils/passwordUtils';
export { generateVerificationCode, generateUniqueId, generateJWT, generateSlug, generateCourseCode } from './utils/codeGenerator';
