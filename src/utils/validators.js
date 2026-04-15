import { ALLOWED_DOMAINS, USER_ROLES } from './constants';

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const getUserRoleByEmail = (email) => {
  if (email.endsWith(ALLOWED_DOMAINS.STUDENT)) {
    return USER_ROLES.STUDENT;
  } else if (ALLOWED_DOMAINS.TEACHER.some(domain => email.endsWith(domain))) {
    return USER_ROLES.TEACHER;
  }
  return null; // Invalid domain
};

export const validateDomain = (email) => {
  const domain = email.split('@')[1];
  const validDomains = [
    ALLOWED_DOMAINS.STUDENT,
    ...ALLOWED_DOMAINS.TEACHER
  ];
  return validDomains.includes(`@${domain}`);
};