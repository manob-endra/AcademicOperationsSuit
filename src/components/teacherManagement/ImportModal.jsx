import { useState, useRef } from 'react';

const EXPECTED_HEADERS = ['name', 'initials', 'designation', 'email', 'joining_date', 'special_post', 'contact_number', 'availability_status', 'department'];

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(r => r.name?.trim());
};

const parseTSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = line.split('\t').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(r => r.name?.trim());
};

const parseJSON = (text) => {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.teachers || [];
  return arr.filter(r => r.name?.trim());
};

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = () => reject(new Error('Failed to read file.'));
  reader.readAsText(file);
});

function ImportModal({ onClose, onImport }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setPreview(null);
    try {
      const text = await readFile(file);
      let rows;
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'json') rows = parseJSON(text);
      else if (ext === 'tsv') rows = parseTSV(text);
      else rows = parseCSV(text);

      if (!rows.length) throw new Error('No valid records found. Make sure the file has a header row and at least one data row with a "name" column.');
      setPreview(rows);
    } catch (err) {
      setParseError(err.message);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    setImportError('');
    const result = await onImport(preview);
    setImporting(false);
    if (!result.success) setImportError(result.error || 'Import failed.');
  };

  const AVAIL_LABEL = { available: 'Available', unavailable: 'Unavailable', study_leave: 'Study Leave', medical_leave: 'Medical', sabbatical: 'Sabbatical' };

  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal tm-modal--wide">
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Import Teachers</h2>
          <button className="tm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tm-modal-body">
          <div className="tm-import-hint">
            <p>Supported formats: <strong>CSV, TSV, JSON</strong>. The file must include a header row.</p>
            <p>Expected columns: <code>{EXPECTED_HEADERS.join(', ')}</code></p>
            <p>Only <strong>name</strong> is required. All other columns are optional.</p>
          </div>

          <div className="tm-import-drop" onClick={() => inputRef.current?.click()}>
            <span className="tm-import-drop-icon">⬆</span>
            <span>Click to choose a file</span>
            <span className="tm-import-drop-sub">.csv  .tsv  .json</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.json,.txt"
            style={{ display: 'none' }}
            onChange={handleFile}
          />

          {parseError && <p className="tm-form-error">{parseError}</p>}

          {preview && (
            <div className="tm-import-preview">
              <p className="tm-import-count">{preview.length} record{preview.length !== 1 ? 's' : ''} ready to import</p>
              <div className="tm-table-wrap">
                <table className="tm-table">
                  <thead>
                    <tr>
                      <th>Initials</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Email</th>
                      <th>Joining Date</th>
                      <th>Special Post</th>
                      <th>Contact</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td><span className="tm-initials-badge">{r.initials || '—'}</span></td>
                        <td>{r.name}</td>
                        <td>{r.designation || '—'}</td>
                        <td>{r.email || '—'}</td>
                        <td>{r.joining_date || '—'}</td>
                        <td>{r.special_post || '—'}</td>
                        <td>{r.contact_number || '—'}</td>
                        <td>{AVAIL_LABEL[r.availability_status] || r.availability_status || 'Available'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="tm-import-more">… and {preview.length - 10} more</p>
                )}
              </div>
            </div>
          )}

          {importError && <p className="tm-form-error">{importError}</p>}
        </div>

        <div className="tm-modal-footer">
          <button className="tm-btn tm-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="tm-btn tm-btn-primary"
            onClick={handleImport}
            disabled={!preview || importing}
          >
            {importing ? 'Importing…' : `Import ${preview ? preview.length : ''} Teachers`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
