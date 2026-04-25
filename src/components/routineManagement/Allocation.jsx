import { useState } from 'react';
import AllocateRoom from './allocation/AllocateRoom';
import CourseWiseTeacher from './allocation/CourseWiseTeacher';
import TeacherPreferences from './allocation/TeacherPreferences';
import './allocation/styles/AllocationTabs.css';

function Allocation() {
  const [activeSection, setActiveSection] = useState('allocateRoom');

  const sections = [
    { id: 'allocateRoom', label: 'Allocate Room' },
    { id: 'courseWiseTeacher', label: 'Course Wise Teacher' },
    { id: 'teacherPreferences', label: 'Teacher Preferences' },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'allocateRoom':
        return <AllocateRoom />;
      case 'courseWiseTeacher':
        return <CourseWiseTeacher />;
      case 'teacherPreferences':
        return <TeacherPreferences />;
      default:
        return <AllocateRoom />;
    }
  };

  return (
    <div className="routine-section-content allocation-container">
      <h2>Allocation</h2>
      <p>Allocate teachers, courses, and time slots to create class routines.</p>

      <div className="allocation-tabs">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`allocation-tab-btn ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="allocation-tab-content">
        {renderSection()}
      </div>
    </div>
  );
}

export default Allocation;
