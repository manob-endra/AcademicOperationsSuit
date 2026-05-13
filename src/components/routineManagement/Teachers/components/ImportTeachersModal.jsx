import { useState } from 'react';
import { parseCSVFile, parseXMLFile, isDuplicateTeacher } from '../utils/teacherUtils';

function ImportTeachersModal({ isOpen, onClose, onImportTeachers, existingTeachers, existingInitials = [] }) {
  const [previewTeachers, setPreviewTeachers] = useState([]);
  const [fileLoaded, setFileLoaded]           = useState(false);
  const [error, setError]                     = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCSV    = fileName.endsWith('.csv');
    const isXML    = fileName.endsWith('.xml');

    if (!isCSV && !isXML) {
      setError('Please select a CSV (.csv) or XML (.xml) file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result || '';
        // Pass existingInitials so auto-generated initials are globally unique
        const parsed  = isCSV
          ? parseCSVFile(content, existingInitials)
          : parseXMLFile(content, existingInitials);

        if (parsed.length === 0) {
          setError(
            isCSV
              ? 'No valid rows found. Make sure the file has a "name" column.'
              : 'No valid <teacher> nodes found. Each must have a <name> child.'
          );
          return;
        }

        const newTeachers = parsed.filter((t) => !isDuplicateTeacher(existingTeachers, t));

        if (newTeachers.length === 0) {
          setError('All teachers in the file already exist in the list.');
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
      <div className="modal-content import-teachers-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Teachers</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!fileLoaded ? (
            <div className="import-section">
              <p className="import-instructions">
                Upload a <strong>CSV</strong> or <strong>XML</strong> file with teacher names.
                Initials are auto-generated. All other values use defaults
                (load&nbsp;0&nbsp;hrs, limit&nbsp;10&nbsp;hrs, preferences&nbsp;0).
              </p>

              <div className="import-format-hint">
                <div className="hint-block">
                  <strong>CSV format</strong>
                  <code>name</code>
                  <code>Dr. Ahmed Khan</code>
                  <code>Prof. Sara Rahman</code>
                </div>
                <div className="hint-block">
                  <strong>XML format</strong>
                  <code>{'<teachers>'}</code>
                  <code>&nbsp;&nbsp;{'<teacher>'}</code>
                  <code>&nbsp;&nbsp;&nbsp;&nbsp;{'<name>Dr. Ahmed Khan</name>'}</code>
                  <code>&nbsp;&nbsp;{'</teacher>'}</code>
                  <code>{'</teachers>'}</code>
                </div>
              </div>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="file-input"
                  accept=".csv,.xml"
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
              <h3>
                Preview — {previewTeachers.length} teacher{previewTeachers.length !== 1 ? 's' : ''} to import
              </h3>

              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Initials (auto)</th>
                      <th>Load</th>
                      <th>Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTeachers.map((teacher, idx) => (
                      <tr key={idx}>
                        <td>{teacher.name}</td>
                        <td><strong>{teacher.initials}</strong></td>
                        <td>0 hrs</td>
                        <td>10 hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-buttons">
                <button type="button" className="btn-cancel" onClick={resetModal}>
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
