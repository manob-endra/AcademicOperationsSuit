/**
 * Backend Validators
 * 
 * Validation functions for backend operations
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate email domain (university-specific)
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export const validateDomain = (email) => {
  const allowedDomains = [
    '@cs.du.ac.bd',
    '@cse.du.ac.bd',
    '@du.ac.bd',
    '@admin.du.ac.bd'
  ];
  
  return allowedDomains.some(domain => email.endsWith(domain));
};

/**
 * Determine user role from email domain
 * @param {string} email - User email
 * @returns {string} - 'admin', 'teacher', or 'student'
 */
export const getUserRoleByEmail = (email) => {
  const domain = email.split('@')[1];
  const adminDomains = ['admin.du.ac.bd'];
  const teacherDomains = ['cse.du.ac.bd'];

  if (adminDomains.includes(domain)) return 'admin';
  if (teacherDomains.includes(domain)) return 'teacher';
  return 'student';
};

/**
 * Validate course data
 * @param {object} course - Course object
 * @returns {object} - Validation result
 */
export const validateCourseData = (course) => {
  const errors = [];

  if (!course.code || course.code.trim() === '') {
    errors.push('Course code is required');
  }

  if (!course.title || course.title.trim() === '') {
    errors.push('Course title is required');
  }

  if (!course.semester || course.semester.trim() === '') {
    errors.push('Semester is required');
  }

  if (course.credit && (isNaN(course.credit) || course.credit < 0)) {
    errors.push('Credit hours must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate teacher data
 * @param {object} teacher - Teacher object
 * @returns {object} - Validation result
 */
export const validateTeacherData = (teacher) => {
  const errors = [];

  if (!teacher.name || teacher.name.trim() === '') {
    errors.push('Teacher name is required');
  }

  if (!teacher.initials || teacher.initials.trim() === '') {
    errors.push('Teacher initials are required');
  }

  if (teacher.load_limit && (isNaN(teacher.load_limit) || teacher.load_limit <= 0)) {
    errors.push('Load limit must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate classroom data
 * @param {object} classroom - Classroom object
 * @returns {object} - Validation result
 */
export const validateClassroomData = (classroom) => {
  const errors = [];

  if (!classroom.name || classroom.name.trim() === '') {
    errors.push('Classroom name is required');
  }

  if (!classroom.capacity || isNaN(classroom.capacity) || classroom.capacity < 0) {
    errors.push('Classroom capacity must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate time slot data
 * @param {object} timeSlot - Time slot object
 * @returns {object} - Validation result
 */
export const validateTimeSlotData = (timeSlot) => {
  const errors = [];

  if (!timeSlot.start_time) {
    errors.push('Start time is required');
  }

  if (!timeSlot.end_time) {
    errors.push('End time is required');
  }

  if (timeSlot.start_time >= timeSlot.end_time) {
    errors.push('Start time must be before end time');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate routine/schedule data
 * @param {object} routine - Routine object
 * @returns {object} - Validation result
 */
export const validateRoutineData = (routine) => {
  const errors = [];

  if (!routine.course_id) {
    errors.push('Course is required');
  }

  if (!routine.teacher_id) {
    errors.push('Teacher is required');
  }

  if (!routine.classroom_id) {
    errors.push('Classroom is required');
  }

  if (!routine.time_slot_id) {
    errors.push('Time slot is required');
  }

  if (!routine.day_of_week || !['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(routine.day_of_week)) {
    errors.push('Valid day of week is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
