import { useState, useMemo, useEffect } from 'react';
import AddCourseModal from './components/AddCourseModal';
import ImportCoursesModal from './components/ImportCoursesModal';
import RemoveCoursesModal from './components/RemoveCoursesModal';
import RemovedCoursesModal from './components/RemovedCoursesModal';
import CourseHistoryModal from './components/CourseHistoryModal';
import EditCourseModal from './components/EditCourseModal';
import { courseAPI } from '../../../services/courseAPI';
import '../../../styles/Courses.css';
import './styles/Courses.css';

// Semester mapping - supports both capitalized and lowercase formats
const SEMESTER_MAPPING = {
  'Y1-S1': '1st Semester',
  'Y1-S2': '2nd Semester',
  'Y2-S1': '1st Semester',
  'Y2-S2': '2nd Semester',
  'Y3-S1': '1st Semester',
  'Y3-S2': '2nd Semester',
  'Y4-S1': '1st Semester',
  'Y4-S2': '2nd Semester',
  'MS-S1': '1st Semester',
  'MS-S2': '2nd Semester',
};

// Year mapping to extract year from semester ID
const YEAR_MAPPING = {
  'Y1': '1st Year',
  'Y2': '2nd Year',
  'Y3': '3rd Year',
  'Y4': '4th Year',
  'MS': 'Master',
};

/**
 * Normalize semester to standard format
 */
const normalizeSemester = (semester) => {
  if (!semester) return semester;
  const normalized = semester.trim();
  // Map old format to new format
  const oldToNew = {
    '1st semester': '1st Semester',
    '2nd semester': '2nd Semester',
    'a1': 'A1',
    'a3': 'A3',
    'b2': 'B2',
    'b4': 'B4',
  };
  return oldToNew[normalized.toLowerCase()] || normalized;
};

/**
 * Normalize year to standard format
 */
const normalizeYear = (year) => {
  if (!year) return year;
  const normalized = year.trim();
  // Map old format to new format
  const oldToNew = {
    '1st year': '1st Year',
    '2nd year': '2nd Year',
    '3rd year': '3rd Year',
    '4th year': '4th Year',
    'ms': 'Master',
    '1': '1st Year',
    '2': '2nd Year',
    '3': '3rd Year',
    '4': '4th Year',
  };
  return oldToNew[normalized.toLowerCase()] || normalized;
};

/**
 * Denormalize year to storage format (as string)
 */
const denormalizeYear = (year) => {
  if (!year) return year;
  const denormalized = year.trim();
  // Keep as-is for storage - frontend format matches display
  // The database will store the capitalized format
  return denormalized;
};

/**
 * Denormalize semester to storage format (as string)
 */
const denormalizeSemester = (semester) => {
  if (!semester) return semester;
  const denormalized = semester.trim();
  // Keep as-is for storage - frontend format matches display
  // The database will store the capitalized format
  return denormalized;
};

/**
 * Extract year identifier (number or 'master') from year string
 * Handles formats like: '1', '1st Year', 'Year 1', 'Master', 'MS', etc.
 */
const getYearIdentifier = (yearStr) => {
  if (!yearStr) return null;
  const lower = yearStr.toString().toLowerCase();
  
  // Check for master/MS
  if (lower.includes('master') || lower === 'ms') return 'master';
  
  // Extract year number 1-4
  const match = lower.match(/([1-4])/);
  return match ? parseInt(match[1]) : null;
};

/**
 * Extract year and semester from semester ID (e.g., 'Y1-S1')
 */
const extractYearAndSemester = (semesterId) => {
  const yearMatch = semesterId.match(/^(Y[1-4]|MS)/);
  const yearKey = yearMatch ? yearMatch[1] : null;
  
  return {
    year: yearKey ? YEAR_MAPPING[yearKey] : null,
    semester: SEMESTER_MAPPING[semesterId] || null,
    rawId: semesterId
  };
};

/**
 * Transform database course to frontend course object
 */
const transformDBCourse = (dbCourse) => {
  // Map course_type back to type for frontend
  const typeMap = {
    'theory': 'Theory',
    'lab': 'Lab',
    'mixed': 'Mixed'
  };

  return {
    id: dbCourse.id,
    code: dbCourse.code,
    title: dbCourse.title,
    type: typeMap[dbCourse.course_type?.toLowerCase()] || dbCourse.course_type || 'Theory',
    year: normalizeYear(dbCourse.year) || 'Unknown',
    semester: normalizeSemester(dbCourse.semester) || 'Unknown',
    credit: dbCourse.credit_hours || 0,
    description: dbCourse.description,
    is_active: dbCourse.is_active,
    isExceptional: dbCourse.is_exceptional || false,
  };
};

/**
 * Transform frontend course to database format
 */
const transformFrontendCourse = (frontendCourse) => {
  const typeMap = {
    'Theory': 'theory',
    'Lab': 'lab',
    'Mixed': 'mixed'
  };

  return {
    code: frontendCourse.code,
    title: frontendCourse.title,
    course_type: typeMap[frontendCourse.type] || frontendCourse.type,
    semester: denormalizeSemester(frontendCourse.semester),
    credit_hours: parseFloat(frontendCourse.credit),
    year: denormalizeYear(frontendCourse.year),
    is_active: true
  };
};

function Courses({ selectedSemesters = [] }) {
  // Convert Home.jsx semester IDs to year and semester info
  const selectedCourseSemesters = useMemo(() => {
    return selectedSemesters.map(id => extractYearAndSemester(id)).filter(s => s.year && s.semester);
  }, [selectedSemesters]);

  // State for courses
  const [courses, setCourses] = useState([]);
  const [removedCourses, setRemovedCourses] = useState([]);
  const [exceptionalCourses, setExceptionalCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state for exceptional feature (Set of course IDs)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exceptionalSaving, setExceptionalSaving] = useState(false);

  // State for filters
  const [yearFilter, setYearFilter] = useState('All year');
  const [semesterFilter, setSemesterFilter] = useState('All semester');
  const [creditFilter, setCreditFilter] = useState('All credits');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('all');

  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourseForHistory, setSelectedCourseForHistory] = useState(null);
  const [courseHistory, setCourseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load courses from API on component mount
  useEffect(() => {
    loadCourses();
    loadRemovedCourses();
    loadExceptionalCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await courseAPI.getAllCourses();
      
      if (result.success) {
        // Transform database courses to frontend format and filter only active ones
        const transformedCourses = result.courses
          .filter(course => course.is_active !== false) // Show only active courses
          .map(transformDBCourse);
        setCourses(transformedCourses);
      } else {
        setError(result.error || 'Failed to load courses');
        setCourses([]);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please try again.');
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExceptionalCourses = async () => {
    try {
      const result = await courseAPI.getExceptionalCourses();
      if (result.success) {
        setExceptionalCourses(result.courses.map(transformDBCourse));
      }
    } catch (err) {
      console.error('Error loading exceptional courses:', err);
    }
  };

  const loadRemovedCourses = async () => {
    try {
      const result = await courseAPI.getRemovedCourses();
      
      if (result.success) {
        // Transform database courses to frontend format
        const transformedRemovedCourses = result.courses.map(transformDBCourse);
        setRemovedCourses(transformedRemovedCourses);
      } else {
        // If error, just set empty array (removed courses are optional)
        console.warn('Failed to load removed courses:', result.error);
        setRemovedCourses([]);
      }
    } catch (err) {
      console.error('Error loading removed courses:', err);
      setRemovedCourses([]);
    }
  };

  // Filter options - dynamically generate from loaded courses
  const yearOptions = useMemo(() => {
    const years = new Set(courses.map(c => c.year).filter(y => y !== 'Unknown'));
    return ['All year', ...Array.from(years).sort()];
  }, [courses]);

  const semesterOptions = useMemo(() => {
    const semesters = new Set(courses.map(c => c.semester).filter(s => s !== 'Unknown'));
    return ['All semester', ...Array.from(semesters).sort()];
  }, [courses]);

  const creditOptions = useMemo(() => {
    const credits = new Set(courses.map(c => c.credit.toString()));
    return ['All credits', ...Array.from(credits).sort((a, b) => parseFloat(a) - parseFloat(b))];
  }, [courses]);

  const typeOptions = ['All types', 'Theory', 'Lab', 'Mixed'];

  // Filter courses based on selected filters and search term
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Apply view mode filter - match both year and semester
    if (viewMode === 'selected' && selectedCourseSemesters.length > 0) {
      filtered = filtered.filter(course => {
        return selectedCourseSemesters.some(selected => {
          // Compare year by extracting year identifier
          const courseYearId = getYearIdentifier(course.year);
          const selectedYearId = getYearIdentifier(selected.year);
          const courseYearMatches = courseYearId !== null && courseYearId === selectedYearId;
          
          // Compare semester (case-insensitive)
          const courseSemesterMatches = course.semester.toLowerCase() === selected.semester.toLowerCase();
          
          return courseYearMatches && courseSemesterMatches;
        });
      });
    }

    // Apply other filters
    filtered = filtered.filter((course) => {
      const yearMatch = yearFilter === 'All year' || course.year === yearFilter;
      const semesterMatch = semesterFilter === 'All semester' || course.semester === semesterFilter;
      const creditMatch = creditFilter === 'All credits' || course.credit.toString() === creditFilter;
      const typeMatch = typeFilter === 'All types' || course.type === typeFilter;
      const searchMatch = searchTerm === '' || 
        course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.semester.toLowerCase().includes(searchTerm.toLowerCase());
      return yearMatch && semesterMatch && creditMatch && typeMatch && searchMatch;
    });

    // Sort by year first, then by numeric part of course code
    filtered.sort((a, b) => {
      const yearA = a.year.toString();
      const yearB = b.year.toString();
      
      // Convert to numbers if possible for numeric sorting of years
      const numA = parseInt(yearA);
      const numB = parseInt(yearB);
      
      // First, sort by year
      let yearComparison = 0;
      if (!isNaN(numA) && !isNaN(numB)) {
        yearComparison = numA - numB; // Sort years numerically
      } else {
        yearComparison = yearA.localeCompare(yearB); // Sort alphabetically (Master)
      }
      
      if (yearComparison !== 0) {
        return yearComparison; // If years are different, return year comparison
      }
      
      // If years are the same, sort by numeric part of course code
      const codeA = a.code.toUpperCase();
      const codeB = b.code.toUpperCase();
      
      // Extract numeric part from the end of the code
      const numPartA = parseInt(codeA.replace(/\D/g, '')); // Remove all non-digits
      const numPartB = parseInt(codeB.replace(/\D/g, ''));
      
      // If both have numeric parts, sort numerically
      if (!isNaN(numPartA) && !isNaN(numPartB)) {
        return numPartA - numPartB;
      }
      
      // Otherwise sort alphabetically
      return codeA.localeCompare(codeB);
    });

    return filtered;
  }, [courses, yearFilter, semesterFilter, creditFilter, typeFilter, searchTerm, viewMode, selectedCourseSemesters]);

  // Handle Add Course
  const handleAddCourse = async (newCourse) => {
    try {
      setError(null);
      const result = await courseAPI.createCourse(newCourse);
      
      if (result.success) {
        const transformedCourse = transformDBCourse(result.course);
        setCourses([...courses, transformedCourse]);
        setShowAddModal(false);
      } else {
        setError(result.error || 'Failed to add course');
      }
    } catch (err) {
      console.error('Error adding course:', err);
      setError('Failed to add course. Please try again.');
    }
  };

  // Handle Import Courses
  const handleImportCourses = async (importedCourses) => {
    try {
      setError(null);
      const result = await courseAPI.importCourses(importedCourses);
      
      if (result.success) {
        const transformedCourses = result.courses.map(transformDBCourse);
        const uniqueCourses = transformedCourses.filter(
          importedCourse => !courses.some(existing => existing.code === importedCourse.code)
        );
        setCourses([...courses, ...uniqueCourses]);
        setShowImportModal(false);
      } else {
        setError(result.error || 'Failed to import courses');
      }
    } catch (err) {
      console.error('Error importing courses:', err);
      setError('Failed to import courses. Please try again.');
    }
  };

  // Handle Edit Course
  const handleEditCourse = async (courseId, updatedFields) => {
    const result = await courseAPI.updateCourse(courseId, {
      code:        updatedFields.code,
      title:       updatedFields.title,
      type:        updatedFields.type,
      year:        updatedFields.year,
      semester:    updatedFields.semester,
      credit:      updatedFields.credit,
    });
    if (result.success) {
      const updated = transformDBCourse(result.course);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...updated, isExceptional: c.isExceptional } : c));
    } else {
      throw new Error(result.error || 'Failed to update course');
    }
  };

  // Handle Remove Courses
  const handleRemoveCourses = async (courseCodestoRemove) => {
    try {
      setError(null);
      
      // Get course IDs from course codes
      const courseIdsToRemove = courses
        .filter(course => courseCodestoRemove.includes(course.code))
        .map(course => course.id);
      
      if (courseIdsToRemove.length === 0) {
        setError('No valid courses to remove');
        return;
      }
      
      // Call API to soft delete courses (set is_active to false)
      const result = await courseAPI.removeCourses(courseIdsToRemove);
      
      if (result.success) {
        // Remove courses from active list
        setCourses(courses.filter(course => !courseCodestoRemove.includes(course.code)));
        
        // Reload removed courses from database
        await loadRemovedCourses();
        
        setShowRemoveModal(false);
      } else {
        setError(result.error || 'Failed to remove courses');
      }
    } catch (err) {
      console.error('Error removing courses:', err);
      setError('Failed to remove courses. Please try again.');
    }
  };

  // Handle Restore Courses
  const handleRestoreCourses = async (courseCodestoRestore) => {
    try {
      setError(null);
      
      // Get course IDs from course codes
      const courseIdsToRestore = removedCourses
        .filter(course => courseCodestoRestore.includes(course.code))
        .map(course => course.id);
      
      if (courseIdsToRestore.length === 0) {
        setError('No valid courses to restore');
        return;
      }
      
      // Call API to restore courses (set is_active to true)
      const result = await courseAPI.restoreCourses(courseIdsToRestore);
      
      if (result.success) {
        // Get restored courses and transform them
        const restoredCourses = removedCourses.filter(course => 
          courseCodestoRestore.includes(course.code)
        );
        
        // Add restored courses back to active list
        setCourses([...courses, ...restoredCourses]);
        
        // Remove from removed courses list
        setRemovedCourses(removedCourses.filter(course => 
          !courseCodestoRestore.includes(course.code)
        ));
        
        setShowRemovedModal(false);
      } else {
        setError(result.error || 'Failed to restore courses');
      }
    } catch (err) {
      console.error('Error restoring courses:', err);
      setError('Failed to restore courses. Please try again.');
    }
  };

  // Handle View All Courses
  const handleViewAllCourses = () => {
    setYearFilter('All year');
    setSemesterFilter('All semester');
    setCreditFilter('All credits');
    setTypeFilter('All types');
    setSearchTerm('');
    setViewMode('all');
  };

  // Handle View Mode Change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedIds(new Set());
    if (mode === 'selected' && selectedCourseSemesters.length === 0) {
      setError('Please select semesters in the Home page first to view selected semester courses.');
    } else {
      setError(null);
    }
  };

  // Toggle a single checkbox
  const toggleSelect = (courseId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  };

  // Select/deselect all visible rows
  const toggleSelectAll = (rows) => {
    const allIds = rows.map(r => r.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  // Mark selected courses as exceptional
  const handleMarkExceptional = async () => {
    if (selectedIds.size === 0) return;
    setExceptionalSaving(true);
    const ids = [...selectedIds];
    const result = await courseAPI.setExceptional(ids, true);
    if (result.success) {
      setCourses(prev => prev.map(c => ids.includes(c.id) ? { ...c, isExceptional: true } : c));
      await loadExceptionalCourses();
      setSelectedIds(new Set());
    } else {
      setError(result.error || 'Failed to mark courses as exceptional');
    }
    setExceptionalSaving(false);
  };

  // Unmark selected courses (remove exceptional status)
  const handleUnmarkExceptional = async () => {
    if (selectedIds.size === 0) return;
    setExceptionalSaving(true);
    const ids = [...selectedIds];
    const result = await courseAPI.setExceptional(ids, false);
    if (result.success) {
      setCourses(prev => prev.map(c => ids.includes(c.id) ? { ...c, isExceptional: false } : c));
      setExceptionalCourses(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedIds(new Set());
    } else {
      setError(result.error || 'Failed to remove exceptional status');
    }
    setExceptionalSaving(false);
  };

  // Handle Show History — teachers who taught the course in past semesters
  // (archived automatically on semester rollover)
  const handleShowHistory = async (course) => {
    setSelectedCourseForHistory(course);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    const result = await courseAPI.getCourseHistory(course.id);
    setCourseHistory(result.success ? result.history : []);
    setHistoryLoading(false);
  };

  return (
    <div className="routine-section-content courses-container">
      <h2>Courses</h2>
      <p>Manage course information and course-related scheduling.</p>
      
      {/* Error Message Display */}
      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '2px solid #fcc',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '16px',
          color: '#c33',
          fontWeight: 'bold'
        }}>
          <div style={{ marginBottom: '8px' }}>⚠️ Error: {error}</div>
          {error.includes('Backend') && error.includes('npm run dev') && (
            <div style={{
              backgroundColor: '#fff9f0',
              padding: '12px',
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '13px',
              color: '#333',
              fontWeight: 'normal',
              whiteSpace: 'pre-wrap'
            }}>
              <strong>How to start the backend:</strong>
              <br />1. Open a new terminal/command prompt
              <br />2. Run: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px' }}>npm run dev</code>
              <br />3. Wait for the server to start on port 3001
              <br />4. Then refresh this page
            </div>
          )}
          <button 
            onClick={() => setError(null)} 
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#c33'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          fontSize: '16px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '12px' }}>Loading courses...</div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Top Action Buttons */}
          <div className="action-buttons-block">
            <button className="action-btn add-btn" onClick={() => setShowAddModal(true)}>+ Add Course</button>
            <button className="action-btn edit-course-btn" onClick={() => setShowEditModal(true)}>✎ Edit Course</button>
            <button className="action-btn import-btn" onClick={() => setShowImportModal(true)}>⬆ Import Courses</button>
            <button className="action-btn removed-courses-btn" onClick={() => setShowRemovedModal(true)}>📋 Removed Courses</button>
            <button className="action-btn remove-btn" onClick={() => setShowRemoveModal(true)}>🗑 Remove</button>
          </div>

          {/* View Mode Toggle - Outside Filter Block */}
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('all')}
            >
              All Courses
            </button>
            <button
              className={`toggle-btn ${viewMode === 'selected' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('selected')}
              disabled={selectedCourseSemesters.length === 0}
              title={selectedCourseSemesters.length === 0 ? 'Select semesters in Home page first' : `Show courses for ${selectedCourseSemesters.length} selected semester(s)`}
            >
              Selected Semester {selectedCourseSemesters.length > 0 && `(${selectedCourseSemesters.length})`}
            </button>
            <button
              className={`toggle-btn exceptional-toggle-btn ${viewMode === 'exceptional' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('exceptional')}
              title="View all courses marked as exceptional"
            >
              Exceptional {exceptionalCourses.length > 0 && `(${exceptionalCourses.length})`}
            </button>
          </div>

          {/* Filter and View Block */}
          <div className="filter-block">
            {/* Search Box */}
            <div className="search-box-container">
              <input
                type="text"
                placeholder="Search by code, title, year, or semester..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-box"
              />
            </div>

            <div className="filters-group">
              {/* Year Filter */}
              <div className="filter-dropdown">
                <label>Year</label>
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="filter-dropdown">
                <label>Semester</label>
                <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
                  {semesterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Filter */}
              <div className="filter-dropdown">
                <label>Credit</label>
                <select value={creditFilter} onChange={(e) => setCreditFilter(e.target.value)}>
                  {creditOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="filter-dropdown">
                <label>Type</label>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button */}
              <button className="clear-filters-btn" onClick={handleViewAllCourses}>
                Clear All
              </button>
            </div>
          </div>

          {/* Exceptional view — separate table, no filters */}
          {viewMode === 'exceptional' ? (
            <>
              <div className="exceptional-section-header">
                <div className="exceptional-header-info">
                  <span className="exceptional-header-icon">⚠</span>
                  <span>These courses are excluded from routine generation and conflict checks.</span>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    className="action-btn unmark-exceptional-btn"
                    disabled={exceptionalSaving}
                    onClick={handleUnmarkExceptional}
                  >
                    {exceptionalSaving ? 'Saving…' : `Remove Exception (${selectedIds.size})`}
                  </button>
                )}
              </div>

              <div className="courses-table-wrapper">
                <table className="courses-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={exceptionalCourses.length > 0 && exceptionalCourses.every(c => selectedIds.has(c.id))}
                          onChange={() => toggleSelectAll(exceptionalCourses)}
                          title="Select all"
                        />
                      </th>
                      <th>Course Code</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Credit</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionalCourses.length > 0 ? (
                      exceptionalCourses.map((course, index) => (
                        <tr
                          key={course.id}
                          className={`exceptional-row ${selectedIds.has(course.id) ? 'row-selected' : index % 2 === 0 ? 'row-light' : 'row-dark'}`}
                        >
                          <td className="col-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(course.id)}
                              onChange={() => toggleSelect(course.id)}
                            />
                          </td>
                          <td>
                            <span className="exceptional-badge">Exception</span>
                            {' '}{course.code}
                          </td>
                          <td>{course.title}</td>
                          <td>{course.type}</td>
                          <td>{course.year}</td>
                          <td>{course.semester}</td>
                          <td>{course.credit}</td>
                          <td>
                            <button className="history-btn" onClick={() => handleShowHistory(course)}>View</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="no-results">No exceptional courses. Mark courses as exceptional from the Selected Semester view.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-info">
                {exceptionalCourses.length} exceptional course{exceptionalCourses.length !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <>
              {/* Exceptional action bar — shown only in Selected Semester view */}
              {viewMode === 'selected' && (
                <div className="exceptional-action-bar">
                  <span className="exceptional-action-hint">
                    {selectedIds.size === 0
                      ? 'Select courses to mark as exceptional (excluded from routine).'
                      : `${selectedIds.size} course${selectedIds.size !== 1 ? 's' : ''} selected.`}
                  </span>
                  <div className="exceptional-action-btns">
                    <button
                      className="action-btn mark-exceptional-btn"
                      disabled={exceptionalSaving || [...selectedIds].every(id => filteredCourses.find(c => c.id === id)?.isExceptional)}
                      onClick={handleMarkExceptional}
                      title="Mark selected courses as exceptional (excluded from routine)"
                    >
                      {exceptionalSaving ? 'Saving…' : 'Mark as Exceptional'}
                    </button>
                    <button
                      className="action-btn unmark-exceptional-btn"
                      disabled={exceptionalSaving || [...selectedIds].every(id => !filteredCourses.find(c => c.id === id)?.isExceptional)}
                      onClick={handleUnmarkExceptional}
                      title="Remove exceptional status from selected courses"
                    >
                      {exceptionalSaving ? 'Saving…' : 'Remove Exception'}
                    </button>
                  </div>
                </div>
              )}

              {/* Courses Table */}
              <div className="courses-table-wrapper">
                <table className="courses-table">
                  <thead>
                    <tr>
                      {viewMode === 'selected' && (
                        <th className="col-checkbox">
                          <input
                            type="checkbox"
                            checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedIds.has(c.id))}
                            onChange={() => toggleSelectAll(filteredCourses)}
                            title="Select all visible"
                          />
                        </th>
                      )}
                      <th>Course Code</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Credit</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map((course, index) => (
                        <tr
                          key={course.code}
                          className={`${course.isExceptional ? 'exceptional-row' : ''} ${selectedIds.has(course.id) ? 'row-selected' : index % 2 === 0 ? 'row-light' : 'row-dark'}`}
                        >
                          {viewMode === 'selected' && (
                            <td className="col-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(course.id)}
                                onChange={() => toggleSelect(course.id)}
                              />
                            </td>
                          )}
                          <td>
                            {course.isExceptional && <span className="exceptional-badge">Exception</span>}{' '}
                            {course.code}
                          </td>
                          <td>{course.title}</td>
                          <td>{course.type}</td>
                          <td>{course.year}</td>
                          <td>{course.semester}</td>
                          <td>{course.credit}</td>
                          <td>
                            <button
                              className="history-btn"
                              onClick={() => handleShowHistory(course)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={viewMode === 'selected' ? '8' : '7'} className="no-results">
                          {viewMode === 'selected' && selectedCourseSemesters.length > 0
                            ? 'No courses found for the selected semesters.'
                            : viewMode === 'selected' && selectedCourseSemesters.length === 0
                            ? 'Please select semesters in Home page to view courses.'
                            : 'No courses found matching the selected filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-info">
                Showing {filteredCourses.length} of {courses.length} courses
                {viewMode === 'selected' && selectedCourseSemesters.length > 0 && (
                  <span className="view-mode-info">
                    {' '}(Viewing: {selectedCourseSemesters.map(s => `Year ${s.year}, ${s.semester}`).join(' | ')})
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modals */}
      <AddCourseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCourse={handleAddCourse}
      />

      <ImportCoursesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportCourses={handleImportCourses}
      />

      <RemoveCoursesModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        courses={courses}
        onRemoveCourses={handleRemoveCourses}
      />

      <RemovedCoursesModal
        isOpen={showRemovedModal}
        onClose={() => setShowRemovedModal(false)}
        removedCourses={removedCourses}
        onRestoreCourse={handleRestoreCourses}
      />

      <CourseHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        courseCode={selectedCourseForHistory?.code}
        courseTitle={selectedCourseForHistory?.title}
        history={courseHistory}
        loading={historyLoading}
      />

      <EditCourseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        courses={courses}
        onEditCourse={handleEditCourse}
      />
    </div>
  );
}

export default Courses;
