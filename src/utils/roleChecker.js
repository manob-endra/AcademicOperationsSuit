import { USER_ROLES } from './constants';

export const hasAdminAccess = (userRole) => {
  return userRole === USER_ROLES.SUPER_ADMIN || userRole === USER_ROLES.ADMIN;
};

export const hasTeacherAccess = (userRole) => {
  return userRole === USER_ROLES.TEACHER || hasAdminAccess(userRole);
};

export const hasStudentAccess = (userRole) => {
  return userRole === USER_ROLES.STUDENT || hasTeacherAccess(userRole);
};

export const canManageUsers = (userRole) => {
  return hasAdminAccess(userRole);
};

export const canViewReports = (userRole) => {
  return hasAdminAccess(userRole) || userRole === USER_ROLES.TEACHER;
};
