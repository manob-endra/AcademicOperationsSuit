function StudentCourses() {
  return (
    <div>
      <h2 className="sd-section-title">My Courses</h2>
      <p className="sd-section-subtitle">Courses you are enrolled in this semester.</p>
      <div className="sd-placeholder">
        <div className="sd-placeholder-icon">📚</div>
        <p className="sd-placeholder-title">Coming Soon</p>
        <p className="sd-placeholder-text">
          Your enrolled courses will appear here once the department finalises the semester offerings.
        </p>
      </div>
    </div>
  );
}

export default StudentCourses;
