// Validate teacher fields
export const validateTeacherFields = (teacher) => {
  const requiredFields = ['name', 'theoryPreferences', 'labPreferences', 'loadLimit'];
  
  for (const field of requiredFields) {
    if (!teacher[field] || teacher[field] === '') {
      return false;
    }
  }
  
  // Validate that load limit is a positive number
  if (isNaN(teacher.loadLimit) || teacher.loadLimit <= 0) {
    return false;
  }
  
  return true;
};

// Parse CSV file for teacher import
export const parseCSVFile = (fileContent) => {
  const lines = fileContent.trim().split('\n');
  
  if (lines.length < 2) {
    return [];
  }
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const teachers = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    if (values.length === headers.length && values.some(v => v !== '')) {
      const teacher = {
        initials: values[headers.indexOf('initials')] || '',
        name: values[headers.indexOf('name')] || '',
        theoryPreferences: parseInt(values[headers.indexOf('theorypreferences')] || 0),
        labPreferences: parseInt(values[headers.indexOf('labpreferences')] || 0),
        timePreferences: parseInt(values[headers.indexOf('timepreferences')] || 0),
        weeklyLoadHours: parseInt(values[headers.indexOf('weeklyloadhours')] || 0),
        loadLimit: parseInt(values[headers.indexOf('loadlimit')] || 20),
        assignedCourses: (values[headers.indexOf('assignedcourses')] || '').split(';').map(c => c.trim()).filter(c => c !== ''),
      };
      
      if (teacher.name && teacher.initials) {
        teachers.push(teacher);
      }
    }
  }
  
  return teachers;
};

// Parse Excel file for teacher import (placeholder)
export const parseExcelFile = (file) => {
  // Placeholder for Excel parsing - would need xlsx library
  console.log('Excel parsing not yet implemented');
  return [];
};

// Generate unique teacher ID
export const generateTeacherID = () => {
  return 'TCH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Check for duplicate teachers by name
export const isDuplicateTeacher = (teachers, newTeacher) => {
  return teachers.some(t => t.name.toLowerCase() === newTeacher.name.toLowerCase());
};
