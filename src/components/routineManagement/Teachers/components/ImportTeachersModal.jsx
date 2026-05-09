import { useState } from 'react';
import { parseCSVFile, isDuplicateTeacher } from '../utils/teacherUtils';

function ImportTeachersModal({ isOpen, onClose, onImportTeachers, existingTeachers }) {
  const [previewTeachers, setPreviewTeachers] = useState([]);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      setError('Please select a CSV or Excel file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        const parsedTeachers = parseCSVFile(fileContent);

        if (parsedTeachers.length === 0) {
          setError('No valid teachers found in the file.');
          return;
        }

        // Filter out duplicates
        const newTeachers = parsedTeachers.filter(
          t => !isDuplicateTeacher(existingTeachers, t)
        );

        if (newTeachers.length === 0) {
          setError('All teachers in the file already exist.');
          return;
        }

        setPreviewTeachers(newTeachers);
        setFileLoaded(true);
        setError('');
      } catch (err) {
        setError('Error parsing file: ' + err.message);
      }
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    if (previewTeachers.length > 0) {
      onImportTeachers(previewTeachers);
      resetModal();
    }
  };

  const resetModal = () => {
    setPreviewTeachers([]);
    setFileLoaded(false);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-teachers-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Teachers</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!fileLoaded ? (
            <div className="import-section">
              <p className="import-instructions">
                Upload a CSV file with the following columns:<br/>
                <code>initials, name, theoryPreferences, labPreferences, timePreferences, weeklyLoadHours, loadLimit, assignedCourses</code>
              </p>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="file-input"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  className="file-input"
                />
                <label htmlFor="file-input" className="file-input-label">
                  📁 Choose File
                </label>
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>
          ) : (
            <div className="preview-section">
              <h3>Preview ({previewTeachers.length} teachers to import)</h3>

              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Initials</th>
                      <th>Name</th>
                      <th>Theory Pref</th>
                      <th>Lab Pref</th>
                      <th>Time Pref</th>
                      <th>Load (hrs)</th>
                      <th>Load Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTeachers.map((teacher, idx) => (
                      <tr key={idx}>
                        <td>{teacher.initials}</td>
                        <td>{teacher.name}</td>
                        <td>{teacher.theoryPreferences}</td>
                        <td>{teacher.labPreferences}</td>
                        <td>{teacher.timePreferences}</td>
                        <td>{teacher.weeklyLoadHours}</td>
                        <td>{teacher.loadLimit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-buttons">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    resetModal();
                  }}
                >
                  Choose Different File
                </button>
                <button type="button" className="btn-confirm" onClick={handleImport}>
                  Import Teachers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportTeachersModal;
