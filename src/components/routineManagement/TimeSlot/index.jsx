import { useState } from 'react';
import ClassTimeDetails from './ClassTimeDetails';
import ClassroomClusters from './ClassroomClusters';
import CourseTime from './CourseTime';
import TeachersTime from './TeachersTime';
import './styles/TimeSlot.css';

function TimeSlot() {
  const [activeTab, setActiveTab] = useState('classTimeDetails');

  const tabs = [
    { id: 'classTimeDetails', label: 'Class Time Details' },
    { id: 'classroomClusters', label: 'Classroom Clusters' },
    { id: 'courseTime', label: 'Course Time' },
    { id: 'teachersTime', label: "Teacher's Time" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'classTimeDetails':
        return <ClassTimeDetails />;
      case 'classroomClusters':
        return <ClassroomClusters />;
      case 'courseTime':
        return <CourseTime />;
      case 'teachersTime':
        return <TeachersTime />;
      default:
        return <ClassTimeDetails />;
    }
  };

  return (
    <div className="routine-section-content timeslot-container">
      <h2>Time Slot Management</h2>
      <p>Configure and manage time slots for class scheduling.</p>

      {/* Tab Buttons */}
      <div className="timeslot-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default TimeSlot;
