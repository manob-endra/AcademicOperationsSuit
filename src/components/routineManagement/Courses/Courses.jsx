import { useState, useMemo, useEffect } from 'react';
import AddCourseModal from './components/AddCourseModal';
import ImportCoursesModal from './components/ImportCoursesModal';
import RemoveCoursesModal from './components/RemoveCoursesModal';
import RemovedCoursesModal from './components/RemovedCoursesModal';
import CourseHistoryModal from './components/CourseHistoryModal';
import EditCourseModal from './components/EditCourseModal';
import SyllabusManager from './components/SyllabusManager';
import BatchSyllabusPanel from './components/BatchSyllabusPanel';
import GroupActionBar from './components/GroupActionBar';
import RoutineCoursesPanel from './components/RoutineCoursesPanel';
import { courseAPI } from '../../../services/courseAPI';
import { syllabusAPI } from '../../../services/syllabusAPI';
import '../../../styles/Courses.css';
import './styles/Courses.css';
import './styles/SyllabusManager.css';

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
    'mixed': 'Mixed',
    'project': 'Project',
    'internship': 'Internship',
    'viva': 'Viva',
  };

  return {
    id: dbCourse.id,
    code: dbCourse.code,
    title: dbCourse.title,
    type: typeMap[dbCourse.course_type?.toLowerCase()] || dbCourse.course_type || 'Theory',
    year: normalizeYear(dbCourse.year) || 'Unknown',
    semester: normalizeSemester(dbCourse.semester) || 'Unknown',
    credit: Number(dbCourse.credit_hours) || 0,   // NUMERIC may arrive as a string ("3.00")
    description: dbCourse.description,
    is_active: dbCourse.is_active,
    isExceptional: dbCourse.is_exceptional || false,
    inRoutine: dbCourse.in_routine || false,
    syllabusId: dbCourse.syllabus_id || null,
    optionGroupId: dbCourse.option_group_id || null,
    weeklyClasses: dbCourse.weekly_classes ?? null,
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

function Courses({ semesterId, selectedSemesters = [] }) {
  // Convert Home.jsx semester IDs to year and semester info
  const selectedCourseSemesters = useMemo(() => {
    return selectedSemesters.map(id => extractYearAndSemester(id)).filter(s => s.year && s.semester);
  }, [selectedSemesters]);

  // Page tabs: course catalog / syllabus manager / batch syllabus assignment / routine courses
  const [pageTab, setPageTab] = useState('courses');

  // State for courses
  const [courses, setCourses] = useState([]);
  const [removedCourses, setRemovedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Syllabus catalog state
  const [syllabi, setSyllabi] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [syllabusFilter, setSyllabusFilter] = useState('all'); // 'all' | syllabus id | 'none'

  // Selection state for group actions (Set of course IDs)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupActionOpen, setGroupActionOpen] = useState(null); // null | 'create' | 'existing'

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
    loadSyllabusData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSyllabusData = async () => {
    const [sRes, gRes] = await Promise.all([
      syllabusAPI.getAllSyllabi(),
      syllabusAPI.getOptionGroups(),
    ]);
    if (sRes.success) setSyllabi(sRes.data || []);
    if (gRes.success) setOptionGroups(gRes.data || []);
  };

  // After syllabus/group edits, refresh both the catalog and the courses
  const handleSyllabusChanged = async () => {
    await Promise.all([loadSyllabusData(), loadCourses()]);
  };

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

  const typeOptions = ['All types', 'Theory', 'Lab', 'Mixed', 'Project', 'Internship', 'Viva'];

  // Filter courses based on selected filters and search term
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Syllabus filter (from the syllabus selector above the table)
    if (syllabusFilter === 'none') {
      filtered = filtered.filter(c => !c.syllabusId);
    } else if (syllabusFilter !== 'all') {
      filtered = filtered.filter(c => c.syllabusId === syllabusFilter);
    }

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
  }, [courses, yearFilter, semesterFilter, creditFilter, typeFilter, searchTerm, viewMode, selectedCourseSemesters, syllabusFilter]);

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

  // Handle Import Courses (optionally into a syllabus version)
  const handleImportCourses = async (importedCourses, syllabusId = null) => {
    try {
      setError(null);
      const result = await courseAPI.importCourses(importedCourses, syllabusId);

      if (result.success) {
        // The backend returns exactly the rows it inserted. Course code is
        // not unique (electives share placeholder codes like 'CSE-4XXX'), so
        // we append every inserted row rather than deduping by code.
        const transformedCourses = result.courses.map(transformDBCourse);
        setCourses([...courses, ...transformedCourses]);
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
      code:          updatedFields.code,
      title:         updatedFields.title,
      type:          updatedFields.type,
      year:          updatedFields.year,
      semester:      updatedFields.semester,
      credit:        updatedFields.credit,
      weeklyClasses: updatedFields.weeklyClasses,
      syllabusId:    updatedFields.syllabusId,
      optionGroupId: updatedFields.optionGroupId,
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
    setSyllabusFilter('all');
    setSearchTerm('');
    setViewMode('all');
  };

  // Small helpers for rendering catalog metadata in the table
  const syllabusTitle = (id) => syllabi.find(s => s.id === id)?.title || null;
  const groupName = (id) => optionGroups.find(g => g.id === id)?.name || null;

  // Handle View Mode Change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedIds(new Set());
    setGroupActionOpen(null);
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

  const clearSelection = () => {
    setSelectedIds(new Set());
    setGroupActionOpen(null);
  };

  // Assign the selected courses to an existing option group.
  const handleAddSelectedToGroup = async (groupId) => {
    if (selectedIds.size === 0 || !groupId) return;
    setGroupSaving(true);
    const ids = [...selectedIds];
    const result = await courseAPI.assignToGroup(ids, groupId);
    if (result.success) {
      setCourses(prev => prev.map(c => ids.includes(c.id) ? { ...c, optionGroupId: groupId } : c));
      clearSelection();
    } else {
      setError(result.error || 'Failed to add courses to group');
    }
    setGroupSaving(false);
  };

  // Create a new option group from the given details, then assign the
  // selected courses to it.
  const handleCreateGroupWithSelected = async (details) => {
    if (selectedIds.size === 0) return;
    setGroupSaving(true);
    const ids = [...selectedIds];
    const created = await syllabusAPI.createOptionGroup(details);
    if (!created.success) {
      setError(created.error || 'Failed to create group');
      setGroupSaving(false);
      return;
    }
    const groupId = created.data.id;
    const assigned = await courseAPI.assignToGroup(ids, groupId);
    if (assigned.success) {
      setCourses(prev => prev.map(c => ids.includes(c.id) ? { ...c, optionGroupId: groupId } : c));
      await loadSyllabusData();
      clearSelection();
    } else {
      setError(assigned.error || 'Group created, but failed to add courses');
    }
    setGroupSaving(false);
  };

  // Remove the selected courses from whatever option group they're in.
  const handleRemoveSelectedFromGroup = async () => {
    if (selectedIds.size === 0) return;
    setGroupSaving(true);
    const ids = [...selectedIds];
    const result = await courseAPI.assignToGroup(ids, null);
    if (result.success) {
      setCourses(prev => prev.map(c => ids.includes(c.id) ? { ...c, optionGroupId: null } : c));
      clearSelection();
    } else {
      setError(result.error || 'Failed to remove courses from group');
    }
    setGroupSaving(false);
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
      <p>Manage the course catalog, syllabus versions and per-semester syllabus assignments.</p>

      {/* Page tabs */}
      <div className="view-mode-toggle" style={{ marginBottom: 16 }}>
        <button
          className={`toggle-btn ${pageTab === 'courses' ? 'active' : ''}`}
          onClick={() => setPageTab('courses')}
        >
          Course Catalog
        </button>
        <button
          className={`toggle-btn ${pageTab === 'syllabi' ? 'active' : ''}`}
          onClick={() => setPageTab('syllabi')}
        >
          Syllabi &amp; Options {syllabi.length > 0 && `(${syllabi.length})`}
        </button>
        <button
          className={`toggle-btn ${pageTab === 'assignment' ? 'active' : ''}`}
          onClick={() => setPageTab('assignment')}
          title="Assign each running semester its syllabus and choose offered options"
        >
          Semester Syllabus
        </button>
        <button
          className={`toggle-btn ${pageTab === 'routine' ? 'active' : ''}`}
          onClick={() => setPageTab('routine')}
          title="Pick which courses take part in routine generation, by type"
        >
          Routine Courses
        </button>
      </div>

      {pageTab === 'syllabi' && (
        <SyllabusManager
          syllabi={syllabi}
          optionGroups={optionGroups}
          courses={courses}
          onChanged={handleSyllabusChanged}
        />
      )}

      {pageTab === 'assignment' && (
        <BatchSyllabusPanel
          semesterId={semesterId}
          selectedSemesters={selectedSemesters}
          syllabi={syllabi}
          optionGroups={optionGroups}
          courses={courses}
        />
      )}

      {pageTab === 'routine' && (
        <RoutineCoursesPanel
          courses={courses}
          onCoursesChanged={setCourses}
        />
      )}

      {pageTab !== 'courses' ? null : (
      <>
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

              {/* Syllabus Filter */}
              {syllabi.length > 0 && (
                <div className="filter-dropdown">
                  <label>Syllabus</label>
                  <select value={syllabusFilter} onChange={(e) => setSyllabusFilter(e.target.value)}>
                    <option value="all">All syllabi</option>
                    {syllabi.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                    <option value="none">No syllabus (legacy)</option>
                  </select>
                </div>
              )}

              {/* Clear Filters Button */}
              <button className="clear-filters-btn" onClick={handleViewAllCourses}>
                Clear All
              </button>
            </div>
          </div>

          {/* Group action bar — appears when one or more courses are selected */}
          {selectedIds.size > 0 && (
            <GroupActionBar
              count={selectedIds.size}
              optionGroups={optionGroups}
              syllabi={syllabi}
              saving={groupSaving}
              actionOpen={groupActionOpen}
              setActionOpen={setGroupActionOpen}
              onAddToGroup={handleAddSelectedToGroup}
              onCreateGroup={handleCreateGroupWithSelected}
              onRemoveFromGroup={handleRemoveSelectedFromGroup}
              onClear={clearSelection}
            />
          )}

          {/* full block wrapper kept for consistent spacing */}
          {(
            <>
              {/* Courses Table */}
              <div className="courses-table-wrapper">
                <table className="courses-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedIds.has(c.id))}
                          onChange={() => toggleSelectAll(filteredCourses)}
                          title="Select all visible"
                        />
                      </th>
                      <th>Course Code</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Credit</th>
                      <th>Weekly</th>
                      <th>Routine</th>
                      <th>Syllabus</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map((course, index) => (
                        <tr
                          key={course.id}
                          className={`${selectedIds.has(course.id) ? 'row-selected' : index % 2 === 0 ? 'row-light' : 'row-dark'}`}
                        >
                          <td className="col-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(course.id)}
                              onChange={() => toggleSelect(course.id)}
                            />
                          </td>
                          <td>
                            {course.code}
                            {course.optionGroupId && (
                              <span className="optional-chip" title={`Group — ${groupName(course.optionGroupId) || 'option group'}`}>
                                {groupName(course.optionGroupId) || 'Group'}
                              </span>
                            )}
                          </td>
                          <td>{course.title}</td>
                          <td>
                            <span className={`course-type-chip ${course.type.toLowerCase()}`}>{course.type}</span>
                          </td>
                          <td>{course.year}</td>
                          <td>{course.semester}</td>
                          <td>{course.credit}</td>
                          <td>{course.weeklyClasses != null ? course.weeklyClasses : '—'}</td>
                          <td>
                            {course.inRoutine
                              ? <span className="routine-badge in">In routine</span>
                              : <span className="routine-badge out">—</span>}
                          </td>
                          <td style={{ fontSize: 12, color: '#6b7280' }}>
                            {syllabusTitle(course.syllabusId) || '—'}
                          </td>
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
                        <td colSpan="11" className="no-results">
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
      </>
      )}

      {/* Modals */}
      <AddCourseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCourse={handleAddCourse}
        syllabi={syllabi}
        optionGroups={optionGroups}
        defaultSyllabusId={syllabusFilter !== 'all' && syllabusFilter !== 'none' ? syllabusFilter : ''}
      />

      <ImportCoursesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportCourses={handleImportCourses}
        syllabi={syllabi}
        defaultSyllabusId={syllabusFilter !== 'all' && syllabusFilter !== 'none' ? syllabusFilter : ''}
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
        syllabi={syllabi}
        optionGroups={optionGroups}
      />
    </div>
  );
}

export default Courses;
