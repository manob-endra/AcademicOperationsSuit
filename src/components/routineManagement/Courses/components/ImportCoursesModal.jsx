import { useRef, useState } from 'react';
import { parseCSVFile } from '../utils/courseUtils';
import '../styles/Modal.css';

function ImportCoursesModal({ isOpen, onClose, onImportCourses }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [previewCourses, setPreviewCourses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = ['csv', 'xlsx', 'xls'];

    if (!allowedTypes.includes(fileExtension)) {
      setError('Please upload a CSV or Excel file');
      setSelectedFile(null);
      setPreviewCourses([]);
      return;
    }

    setSelectedFile(file);
    setError('');

    // Preview the file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (fileExtension === 'csv') {
          const courses = parseCSVFile(event.target.result);
          setPreviewCourses(courses);
        } else {
          setError('Excel file parsing requires additional setup. Please use CSV format for now.');
          setPreviewCourses([]);
        }
      } catch (err) {
        setError('Error reading file: ' + err.message);
        setPreviewCourses([]);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    if (!selectedFile || previewCourses.length === 0) {
      setError('No valid courses to import');
      return;
    }

    setIsSubmitting(true);
    try {
      await onImportCourses(previewCourses);
      handleCancel();
    } catch (err) {
      setError(err.message || 'Failed to import courses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setError('');
    setPreviewCourses([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Courses</h2>
          <button className="modal-close-btn" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="import-section">
            <p className="import-info">
              Supported formats: CSV, Excel (.xlsx, .xls)
            </p>
            <p className="import-info">
              CSV Format: Code, Title, Type, Year, Semester, Credit
            </p>

            <button
              className="file-input-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              📁 Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isSubmitting}
            />

            {selectedFile && (
              <div className="file-selected">
                ✓ Selected: {selectedFile.name}
              </div>
            )}

            {previewCourses.length > 0 && (
              <div className="preview-section">
                <h3>Preview ({previewCourses.length} courses)</h3>
                <div className="preview-table-wrapper">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Year</th>
                        <th>Semester</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewCourses.map((course, index) => (
                        <tr key={index}>
                          <td>{course.code}</td>
                          <td>{course.title}</td>
                          <td>{course.type}</td>
                          <td>{course.year}</td>
                          <td>{course.semester}</td>
                          <td>{course.credit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-cancel" 
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-confirm" 
            onClick={handleConfirm}
            disabled={previewCourses.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Importing...' : `Import (${previewCourses.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportCoursesModal;
