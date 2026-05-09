// Course utility functions

export const validateCourseFields = (course) => {
  const requiredFields = ['code', 'title', 'type', 'year', 'semester', 'credit'];
  
  for (let field of requiredFields) {
    if (!course[field] || (typeof course[field] === 'string' && course[field].trim() === '')) {
      return { isValid: false, message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required` };
    }
  }

  if (isNaN(course.credit) || parseFloat(course.credit) <= 0) {
    return { isValid: false, message: 'Credit must be a valid positive number' };
  }

  return { isValid: true, message: 'All fields are valid' };
};

export const parseCSVFile = (fileContent) => {
  const lines = fileContent.trim().split('\n');
  const courses = [];

  // Skip header row and parse data
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= 6) {
      courses.push({
        code: values[0],
        title: values[1],
        type: values[2],
        year: values[3],
        semester: values[4],
        credit: parseFloat(values[5]),
      });
    }
  }

  return courses;
};

export const parseExcelFile = async (file) => {
  // This will require a library like xlsx
  // For now, returning placeholder
  console.log('Excel parsing requires xlsx library');
  return [];
};

export const generateCourseID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const filterCoursesBySemester = (courses, selectedSemesters) => {
  if (!selectedSemesters || selectedSemesters.length === 0) {
    return courses;
  }
  return courses.filter(course => selectedSemesters.includes(course.semester));
};
