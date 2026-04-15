function Home() {
  return (
    <div className="routine-section-content">
      <h2>Home</h2>
      <p>Welcome to Routine Management. Select an option from the navigation to get started.</p>
      
      <div className="home-cards">
        <div className="info-card">
          <h3>Teacher Management</h3>
          <p>Manage teacher profiles and their teaching schedules.</p>
        </div>
        <div className="info-card">
          <h3>Time Slot Configuration</h3>
          <p>Set up and manage available time slots for classes.</p>
        </div>
        <div className="info-card">
          <h3>Course Management</h3>
          <p>Organize courses and their respective schedules.</p>
        </div>
        <div className="info-card">
          <h3>Allocation Planning</h3>
          <p>Allocate teachers, courses, and time slots to create routines.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
