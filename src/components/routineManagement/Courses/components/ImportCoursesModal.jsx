import { useRef, useState } from 'react';
import { parseCSVFile, parseExcelFile } from '../utils/courseUtils';
import '../styles/Modal.css';

function ImportCoursesModal({ isOpen, onClose, onImportCourses, syllabi = [], defaultSyllabusId = '' }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [previewCourses, setPreviewCourses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syllabusId, setSyllabusId] = useState(defaultSyllabusId);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = ['csv', 'xlsx', 'xls'];

    if (!allowedTypes.includes(fileExtension)) {
      setError('Please upload a CSV or Excel (.xlsx / .xls) file');
      setSelectedFile(null);
      setPreviewCourses([]);
      return;
    }

    setSelectedFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const courses = fileExtension === 'csv'
          ? parseCSVFile(event.target.result)
          : await parseExcelFile(event.target.result);
        if (courses.length === 0) {
          setError('No valid course rows found. The first row must contain headers (Code, Title, Type, Year, Semester, Credit, Weekly Classes).');
        }
        setPreviewCourses(courses);
      } catch (err) {
        setError('Error reading file: ' + err.message);
        setPreviewCourses([]);
      }
    };
    if (fileExtension === 'csv') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const handleConfirm = async () => {
    if (!selectedFile || previewCourses.length === 0) {
      setError('No valid courses to import');
      return;
    }

    setIsSubmitting(true);
    try {
      await onImportCourses(previewCourses, syllabusId || null);
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
              Columns (first row = headers): Code, Title, Type (Theory / Lab / Mixed / Project /
              Internship / Viva), Year, Semester, Credit, Weekly Classes (optional — defaults
              3 theory · 1 lab · 0 project)
            </p>

            {syllabi.length > 0 && (
              <div className="form-group" style={{ maxWidth: 380 }}>
                <label>Import into syllabus</label>
                <select
                  value={syllabusId}
                  onChange={e => setSyllabusId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">No syllabus (legacy catalog)</option>
                  {syllabi.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.effective_session})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                        <th>Weekly</th>
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
                          <td>{course.weeklyClasses}</td>
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
